"""Progress-message streaming for the chat agent.
"""
from __future__ import annotations

import threading

from tethysapp.tethysdash.plugin_helpers import send_websocket_message


def emit_progress(chat_id: str, message: str) -> None:
    """Push a chat progress marker to the frontend over the shared WS group.

    Dispatches from a fresh daemon thread so the call is safe from any
    context - sync Django views, async pydantic-ai output functions, or
    sync tools running on an async loop's executor. ``send_websocket_message``
    uses ``async_to_sync`` internally, which raises when called from a
    thread that already has a running event loop; running it on a fresh
    thread avoids that entirely.

    Safe to call with an empty ``chat_id`` - the message is silently
    dropped, matching the pre-streaming behavior for legacy callers.
    """
    if not chat_id:
        return
    threading.Thread(
        target=send_websocket_message,
        kwargs={"request_id": chat_id, "message": message},
        daemon=True,
    ).start()
