"""
Server-protocol middleware that converts pydantic ValidationError raised
during tool input validation into a structured tool-result envelope.

Without this middleware, a hallucinated kwarg like
``create_plotly_chart(..., height=80)`` causes pydantic's TypeAdapter to
raise ``ValidationError`` inside ``Tool._run`` (FastMCP 3.2.x), which
propagates out as an MCP-protocol error and produces a server traceback
the chatbox-core engine cannot recover from cleanly.

With this middleware in the FastMCP server's middleware stack, the same
call returns a structured ``{"error": "...", "unexpected_kwargs": [...]}``
envelope as a normal tool result. The chatbox-core engine forwards it to
the LLM as tool input on the next conversation turn.

# FastMCP 3.2.x-specific. Re-validate on FastMCP upgrade.
See ``docs/plans/2026-05-08-001-fix-mcp-validation-and-streamable-http-migration-plan.md``
Unit 1 for the full rationale and the spike that selected this mechanism.
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

    Aggregates multiple validation errors in one envelope so the LLM can fix
    every hallucinated kwarg on a single retry instead of one-at-a-time.

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
            unexpected_kwargs, other_errors = _classify_errors(exc)

            if unexpected_kwargs:
                LOGGER.warning(
                    "tool input rejected (unexpected kwargs): tool=%s kwargs=%s",
                    tool_name,
                    unexpected_kwargs,
                )
                return ToolResult(
                    structured_content={
                        "error": "invalid_args: unexpected keyword arguments",
                        "unexpected_kwargs": unexpected_kwargs,
                    }
                )

            LOGGER.warning(
                "tool input rejected (validation error): tool=%s errors=%d",
                tool_name,
                len(other_errors),
            )
            return ToolResult(
                structured_content={
                    "error": "invalid_args: tool input failed validation",
                    "details": _summarize_errors(other_errors),
                }
            )


def _classify_errors(exc: ValidationError) -> tuple[list[str], list[dict[str, Any]]]:
    """Split pydantic errors into (unexpected_kwargs, other_errors)."""
    unexpected_kwargs: list[str] = []
    other_errors: list[dict[str, Any]] = []
    for err in exc.errors():
        if err.get("type") == "unexpected_keyword_argument":
            loc = err.get("loc") or ()
            if loc:
                unexpected_kwargs.append(str(loc[-1]))
        else:
            other_errors.append(err)
    return unexpected_kwargs, other_errors


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
