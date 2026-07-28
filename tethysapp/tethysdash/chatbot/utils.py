"""Factory and helpers for the chat router."""

from __future__ import annotations
import queue
import threading

_PROGRESS_SINKS: dict[str, "queue.Queue"] = {}
_PROGRESS_LOCK = threading.Lock()


def register_progress_sink(chat_id: str, sink: "queue.Queue") -> None:
    """Route a request's progress events to `sink` until it is unregistered."""
    if not chat_id:
        return
    with _PROGRESS_LOCK:
        _PROGRESS_SINKS[chat_id] = sink


def unregister_progress_sink(chat_id: str) -> None:
    """Stop routing progress once a request's stream has finished."""
    with _PROGRESS_LOCK:
        _PROGRESS_SINKS.pop(chat_id, None)


def build_registry():
    """Registry of specialist agents plus the router and general fallback agents."""
    from .agents.chat import chat_agent
    from .agents.patch import patch_agent
    from .agents.plugin import plugin_agent
    from .agents.router import router_agent
    from .agents.registry import AgentRegistry

    return AgentRegistry(
        add_plugin=plugin_agent,
        patch_visualization=patch_agent,
        chat_agent=chat_agent,
        router_agent=router_agent,
    )


def _emit(chat_id: str, event: dict) -> None:
    """Put an event on the request's stream sink, if one is listening."""
    if not chat_id:
        return
    with _PROGRESS_LOCK:
        sink = _PROGRESS_SINKS.get(chat_id)
    if sink is not None:
        sink.put(event)


def emit_progress(chat_id: str, message: str) -> None:
    """Push a progress milestone (replaces the bubble text) onto the stream."""
    _emit(chat_id, {"type": "progress", "text": message})


def emit_delta(chat_id: str, text: str) -> None:
    """Append a streamed answer token to the request's stream."""
    _emit(chat_id, {"type": "delta", "text": text})
