"""Factory and helpers for the chat router."""

from __future__ import annotations
import threading

from tethysapp.tethysdash.plugin_helpers import send_websocket_message


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


def emit_progress(chat_id: str, message: str) -> None:
    if not chat_id:
        return
    threading.Thread(
        target=send_websocket_message,
        kwargs={"request_id": chat_id, "message": message},
        daemon=True,
    ).start()
