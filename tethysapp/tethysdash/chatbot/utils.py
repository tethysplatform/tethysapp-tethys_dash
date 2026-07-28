"""Singletons for the chat router.
"""

from __future__ import annotations
import threading
from typing import TYPE_CHECKING

from tethysapp.tethysdash.plugin_helpers import send_websocket_message

if TYPE_CHECKING:  # runtime import would form a cycle (see below)
    from .agents.embedder import EmbeddingIntentClassifier

classifier: EmbeddingIntentClassifier | None = None


def get_classifier() -> EmbeddingIntentClassifier:
    """Return the process-wide intent classifier, building it once."""
    global classifier
    from .agents.embedder import EmbeddingIntentClassifier
    from .agents.embedding_data import INTENTS

    if classifier is None:
        classifier = EmbeddingIntentClassifier(INTENTS)
    return classifier


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
