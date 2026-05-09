"""
Server-protocol middleware that converts pydantic ValidationError raised
during tool input validation into a structured tool-result envelope.

Without this middleware, a hallucinated kwarg like
``create_plotly_chart(..., height=80)`` causes pydantic's TypeAdapter to
raise ``ValidationError`` inside ``Tool._run`` (FastMCP 3.2.x), which
propagates out as an MCP-protocol error and produces a server traceback
the chatbox-core engine cannot recover from cleanly.

With this middleware in the FastMCP server's middleware stack, the same
call returns a structured envelope as a normal tool result. The
chatbox-core engine forwards it to the LLM as tool input on the next
conversation turn.

# FastMCP 3.2.x-specific. Re-validate on FastMCP upgrade.
See ``docs/plans/2026-05-08-001-fix-mcp-validation-and-streamable-http-migration-plan.md``
Unit 1 for the original rationale and the spike that selected this mechanism.

Envelope quality (debug session 2026-05-09):

  - All applicable error classes are reported in ONE envelope (no more
    short-circuit on `unexpected_kwargs` that hid simultaneous missing
    args from the LLM).
  - `expected_kwargs` lists every property name from the tool's input
    schema, so the LLM has the correct kwarg list right there in the
    response without re-fetching `tools/list`.
  - `fix_hint` tailors a natural-language recovery instruction to the
    error class(es) that fired.

The envelope shape is additive — keys appear only when their bucket is
non-empty, so existing consumers asserting on the old `unexpected_kwargs`-
only or `details`-only shapes continue to pass for those single-class
cases.
"""

from __future__ import annotations

import logging
from typing import Any

from pydantic import ValidationError

from fastmcp.server.middleware.middleware import (
    CallNext,
    Middleware,
    MiddlewareContext,
)
from fastmcp.tools.base import ToolResult
import mcp.types as mt


LOGGER = logging.getLogger("tethysdash.mcp")


class InputValidationEnvelopeMiddleware(Middleware):
    """Catch pydantic ValidationError on tool input and emit a typed envelope.

    Aggregates every validation-error class in one envelope so the LLM can
    fix all hallucinated kwargs, missing required args, and value-shape
    issues on a single retry instead of one-class-at-a-time.

    The LLM-facing payload omits the tool name (the MCP protocol already
    associates a tool result with the call that produced it; including the
    name would also leak BM25-invisible tool names in some scenarios). The
    server-side log line is the only place the tool name appears.
    """

    async def on_call_tool(
        self,
        context: MiddlewareContext[mt.CallToolRequestParams],
        call_next: CallNext[mt.CallToolRequestParams, ToolResult],
    ) -> ToolResult:
        try:
            return await call_next(context)
        except ValidationError as exc:
            tool_name = getattr(context.message, "name", "<unknown>")
            unexpected_kwargs, missing_kwargs, other_errors = _classify_errors(exc)
            expected_kwargs = await _expected_kwargs_for_tool(context, tool_name)

            envelope: dict[str, Any] = {
                "error": _build_error_message(
                    unexpected_kwargs, missing_kwargs, other_errors
                ),
            }
            if unexpected_kwargs:
                envelope["unexpected_kwargs"] = unexpected_kwargs
            if missing_kwargs:
                envelope["missing_kwargs"] = missing_kwargs
            if other_errors:
                envelope["details"] = _summarize_errors(other_errors)
            if expected_kwargs:
                envelope["expected_kwargs"] = expected_kwargs
            envelope["fix_hint"] = _build_fix_hint(
                unexpected_kwargs, missing_kwargs, other_errors, expected_kwargs
            )

            LOGGER.warning(
                "tool input rejected: tool=%s unexpected=%s missing=%s other=%d",
                tool_name,
                unexpected_kwargs or "[]",
                missing_kwargs or "[]",
                len(other_errors),
            )

            return ToolResult(structured_content=envelope)


async def _expected_kwargs_for_tool(
    context: MiddlewareContext[Any], tool_name: str
) -> list[str]:
    """Return the sorted list of property names from the tool's input schema.

    Falls back to ``[]`` if the FastMCP context, registry lookup, or schema
    is unavailable / malformed — the envelope is still informative without
    `expected_kwargs`, just less helpful.
    """
    fastmcp_ctx = getattr(context, "fastmcp_context", None)
    if fastmcp_ctx is None:
        return []
    try:
        fastmcp = fastmcp_ctx.fastmcp
    except RuntimeError:
        # Context dereference race — server is shutting down or detached.
        return []
    try:
        tool = await fastmcp.get_tool(tool_name)
    except Exception:  # pragma: no cover — defensive
        return []
    if tool is None:
        return []
    params = getattr(tool, "parameters", None) or {}
    properties = params.get("properties") or {}
    return sorted(properties.keys())


def _classify_errors(
    exc: ValidationError,
) -> tuple[list[str], list[str], list[dict[str, Any]]]:
    """Split pydantic errors into (unexpected_kwargs, missing_kwargs, other_errors).

    Pydantic error-type codes used:
      - `unexpected_keyword_argument` — kwarg not in signature
      - `missing_argument` — required parameter not provided
      - everything else (type errors, value-out-of-range, etc.) → other_errors
    """
    unexpected_kwargs: list[str] = []
    missing_kwargs: list[str] = []
    other_errors: list[dict[str, Any]] = []
    for err in exc.errors():
        err_type = err.get("type")
        loc = err.get("loc") or ()
        if err_type == "unexpected_keyword_argument":
            if loc:
                unexpected_kwargs.append(str(loc[-1]))
        elif err_type == "missing_argument":
            if loc:
                missing_kwargs.append(str(loc[-1]))
        else:
            other_errors.append(err)
    return unexpected_kwargs, missing_kwargs, other_errors


def _build_error_message(
    unexpected: list[str],
    missing: list[str],
    others: list[dict[str, Any]],
) -> str:
    """Concise top-level error string naming the firing classes.

    LLMs often pattern-match on the prefix; keeping ``invalid_args:`` and
    listing only the firing classes preserves both the existing
    contract and the improved single-envelope-multi-class clarity.
    """
    parts: list[str] = []
    if unexpected:
        parts.append("unexpected keyword arguments")
    if missing:
        parts.append("missing required arguments")
    if others:
        parts.append("argument validation failed")
    if not parts:
        return "invalid_args: tool input failed validation"
    return "invalid_args: " + ", ".join(parts)


def _build_fix_hint(
    unexpected: list[str],
    missing: list[str],
    others: list[dict[str, Any]],
    expected: list[str],
) -> str:
    """Tailored natural-language recovery instruction.

    Names the specific kwargs to drop / provide so the LLM doesn't have
    to re-derive them from the bucket lists. Lists `expected_kwargs`
    last as the canonical reference.
    """
    bits: list[str] = []
    if unexpected:
        bits.append(f"Drop the unexpected kwargs: {unexpected}.")
    if missing:
        bits.append(f"Provide the missing required args: {missing}.")
    if others:
        bits.append(
            "Fix the type / value errors listed in `details` "
            "(field + pydantic error type)."
        )
    if expected:
        bits.append(f"Valid kwargs for this tool: {expected}.")
    if not bits:
        return "Re-call this tool with arguments matching the tool's schema."
    return " ".join(bits)


def _summarize_errors(errors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Strip pydantic error dicts to a stable, value-free summary.

    Names + types only; no input values. Avoids leaking user-supplied or
    LLM-generated content into the LLM-facing envelope.
    """
    summary: list[dict[str, Any]] = []
    for err in errors:
        loc = err.get("loc") or ()
        summary.append(
            {
                "field": ".".join(str(p) for p in loc) if loc else None,
                "type": err.get("type"),
            }
        )
    return summary
