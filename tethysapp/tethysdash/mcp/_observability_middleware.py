"""Per-tool-call observability middleware.

Emits a single structured log line per ``tools/call`` request on the
``tethysdash.mcp`` logger. The line collapses entry + exit into one
record so a debugger reading server logs can see at a glance which
tool ran, what kwargs the LLM supplied (key names only — no values
to avoid leaking user input), whether it succeeded, what error class
fired if not, and how long it took.

Pre-fix (debug session 2026-05-09), the server logs were dominated by
HTTP-level noise (`OPTIONS`, `POST`, `GET`) and FastMCP's protocol-
layer `Processing request of type CallToolRequest` lines that didn't
name the tool. Diagnosing a slow turn required cross-referencing
multiple logs and reading verbose Pydantic tracebacks. This middleware
adds the missing summary signal.

Format:

    tool-call session=<short_session_id> tool=<name> arg_keys=[<keys>]
    status=<ok|error|invalid_args> [error_class=<envelope error>]
    duration_ms=<ms> [extra_kvs...]

Status values:
- ``ok`` — tool executed and returned a non-error envelope.
- ``error`` — tool returned ``{"error": "..."}`` envelope (business-logic
  rejection: invalid_uuid, whitelist_rejected, invalid_envelope, etc.).
- ``invalid_args`` — input-validation middleware caught a Pydantic
  ValidationError; envelope shape is the
  ``InputValidationEnvelopeMiddleware`` typed envelope.

Arg values are NEVER logged — only the sorted list of arg keys. This
keeps secrets, large payloads, and PII out of the log surface.

Sibling to ``_input_validation_middleware.py``. Both should be
registered on the FastMCP server's middleware list. Order matters:
this middleware should be OUTSIDE (i.e., earlier in the list /
listed later in `middleware=[...]` so its `try` wraps everything)
so it observes the final envelope after the validation middleware
has already converted ValidationError to a structured tool result.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from fastmcp.server.middleware.middleware import (
    CallNext,
    Middleware,
    MiddlewareContext,
)
from fastmcp.tools.base import ToolResult
import mcp.types as mt


LOGGER = logging.getLogger("tethysdash.mcp")


class ToolCallObservabilityMiddleware(Middleware):
    """Single structured log line per ``tools/call`` request.

    Catches exceptions from inner middleware/tool execution so the log
    line is emitted even when the call doesn't return cleanly — then
    re-raises so error semantics are unchanged. The log line is the
    only side-effect of this middleware; it does NOT modify the
    request, response, or exception.
    """

    async def on_call_tool(
        self,
        context: MiddlewareContext[mt.CallToolRequestParams],
        call_next: CallNext[mt.CallToolRequestParams, ToolResult],
    ) -> ToolResult:
        tool_name = getattr(context.message, "name", "<unknown>")
        arguments = getattr(context.message, "arguments", None) or {}
        arg_keys = sorted(arguments.keys()) if isinstance(arguments, dict) else []
        session_id = _short_session_id(context)
        start = time.perf_counter()

        try:
            result = await call_next(context)
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            LOGGER.warning(
                "tool-call session=%s tool=%s arg_keys=%s status=raised "
                "exc_class=%s duration_ms=%d",
                session_id,
                tool_name,
                arg_keys,
                type(exc).__name__,
                duration_ms,
            )
            raise

        duration_ms = int((time.perf_counter() - start) * 1000)
        status, error_class, extras = _classify_result(result)
        extra_kv = " ".join(f"{k}={v}" for k, v in extras.items())
        if error_class:
            LOGGER.info(
                "tool-call session=%s tool=%s arg_keys=%s status=%s "
                "error_class=%s duration_ms=%d%s",
                session_id,
                tool_name,
                arg_keys,
                status,
                error_class,
                duration_ms,
                f" {extra_kv}" if extra_kv else "",
            )
        else:
            LOGGER.info(
                "tool-call session=%s tool=%s arg_keys=%s status=%s "
                "duration_ms=%d%s",
                session_id,
                tool_name,
                arg_keys,
                status,
                duration_ms,
                f" {extra_kv}" if extra_kv else "",
            )
        return result


def _short_session_id(context: MiddlewareContext[Any]) -> str:
    """8-char prefix of the session ID for log compactness, or '-' on miss."""
    fastmcp_ctx = getattr(context, "fastmcp_context", None)
    if fastmcp_ctx is None:
        return "-"
    try:
        sid = fastmcp_ctx.session_id
    except Exception:  # pragma: no cover — defensive
        return "-"
    if not sid:
        return "-"
    return str(sid)[:8]


def _classify_result(result: ToolResult) -> tuple[str, str | None, dict[str, Any]]:
    """Inspect the structured tool result and derive (status, error_class, extras).

    Returns:
      status:       "ok" | "error" | "invalid_args"
      error_class:  the top-level error label when present (e.g.,
                    "invalid_args: unexpected keyword arguments",
                    "whitelist_rejected: ...", "invalid_uuid: ..."),
                    truncated to 80 chars; None on success
      extras:       small dict of useful summary fields (e.g., counts
                    of unexpected/missing kwargs) for the log line tail.
    """
    payload = getattr(result, "structured_content", None)
    if not isinstance(payload, dict):
        return "ok", None, {}

    err = payload.get("error")
    if not isinstance(err, str):
        return "ok", None, {}

    error_class = err[:80]
    if err.startswith("invalid_args:"):
        status = "invalid_args"
    else:
        status = "error"

    extras: dict[str, Any] = {}
    if "unexpected_kwargs" in payload:
        extras["unexpected"] = payload["unexpected_kwargs"]
    if "missing_kwargs" in payload:
        extras["missing"] = payload["missing_kwargs"]
    return status, error_class, extras
