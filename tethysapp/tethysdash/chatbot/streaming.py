"""HTTP streaming for the chat endpoint.

Progress milestones, answer deltas, and the final reply are streamed back on
the chat POST as newline-delimited JSON, so the UI shows the answer building up
on the same request that is waiting for it.
"""
import asyncio
import json
import traceback

from django.http import StreamingHttpResponse

from .models import RoutedResponse
from .routing import LLMRouter
from .utils import (
    build_registry,
    emit_progress,
    register_progress_sink,
    unregister_progress_sink,
)

_ERROR_REPLY = "Chat backend error. Check the server logs for details."


class _AsyncSink:
    """Bridges sync emit_progress/emit_delta calls onto an asyncio queue."""

    def __init__(self, loop, aqueue):
        self._loop = loop
        self._aqueue = aqueue

    def put(self, event):
        """Schedule an event onto the queue, callable from any thread."""
        self._loop.call_soon_threadsafe(self._aqueue.put_nowait, event)


def _reply_text(result):
    """Return the reply string from a RoutedResponse or a plain-string result."""
    return result.response if isinstance(result, RoutedResponse) else result


def _log_request_error(exc, prompt, dashboard_id):
    """Log the real exception behind a user-facing error reply."""
    print(
        f"\n[chat_message] {type(exc).__name__}: {exc}\n"
        f"Prompt: {prompt!r}\n"
        f"Dashboard id: {dashboard_id}\n"
        f"{traceback.format_exc()}",
        flush=True,
    )


async def _run_router(router, deps, prompt, aqueue):
    """Run the router, pushing its reply, any error, then a sentinel onto the queue."""
    try:
        emit_progress(deps.chat_id, "Understanding your request...")
        result = await router.route(prompt)
        await aqueue.put(
            {
                "type": "done",
                "text": _reply_text(result),
                "changed": deps.dashboard_changed,
            }
        )
    except Exception as exc:
        _log_request_error(exc, prompt, deps.dashboard_id)
        await aqueue.put({"type": "error", "text": _ERROR_REPLY})
    finally:
        await aqueue.put(None)


async def _chat_events(router, deps, prompt):
    """Yield NDJSON event lines while the router runs on this event loop.

    An async generator is required: under ASGI, Django buffers sync generators
    until they finish but streams async ones chunk-by-chunk.
    """
    loop = asyncio.get_running_loop()
    aqueue = asyncio.Queue()
    register_progress_sink(deps.chat_id, _AsyncSink(loop, aqueue))
    task = asyncio.ensure_future(_run_router(router, deps, prompt, aqueue))
    try:
        while True:
            event = await aqueue.get()
            if event is None:
                break
            yield json.dumps(event) + "\n"
    finally:
        unregister_progress_sink(deps.chat_id)
        task.cancel()


def stream_chat_response(deps, prompt):
    """Return a StreamingHttpResponse that streams the chat reply as NDJSON."""
    router = LLMRouter(build_registry(), deps)
    response = StreamingHttpResponse(
        _chat_events(router, deps, prompt),
        content_type="application/x-ndjson",
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


def stream_immediate(text, event_type="done", changed=False):
    """Stream a single pre-computed NDJSON event.

    Used for deterministic pre-check results (a resolved disambiguation) that
    bypass the router but must still reach the frontend over the same envelope.
    ``changed`` mirrors the router path's ``done`` flag so a disambiguation that
    applied a change triggers a dashboard refetch, while a cancel does not.
    """

    async def _one_event():
        yield json.dumps({"type": event_type, "text": text, "changed": changed}) + "\n"

    response = StreamingHttpResponse(
        _one_event(), content_type="application/x-ndjson"
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response
