"""Singletons for the chat router.
"""

from __future__ import annotations
import threading
from typing import TYPE_CHECKING

from tethysapp.tethysdash.plugin_helpers import send_websocket_message

if TYPE_CHECKING:  # runtime import would form a cycle (see below)
    from .agents.embedder import EmbeddingIntentClassifier

classifier: EmbeddingIntentClassifier | None = None


# The agent modules (agents/docs.py, agents/plugin.py -> tools/plugins.py)
# import ``emit_progress`` from THIS module. Importing them at module scope
# would form a circular import (utils -> agents -> utils, hit before
# emit_progress is defined), so both builders import lazily at call time,
# once utils is fully initialized.
def get_classifier() -> EmbeddingIntentClassifier:
    """Return the process-wide intent classifier, building it once."""
    global classifier
    from .agents.embedder import EmbeddingIntentClassifier
    from .agents.embedding_data import INTENTS

    if classifier is None:
        classifier = EmbeddingIntentClassifier(INTENTS)
    return classifier


def build_registry():
    """Registry mapping intents to their specialist agents."""
    from .agents.plugin import plugin_agent
    from .agents.registry import AgentRegistry

    return AgentRegistry(
        add_plugin=plugin_agent,
    )


def emit_progress(chat_id: str, message: str) -> None:
    if not chat_id:
        return
    threading.Thread(
        target=send_websocket_message,
        kwargs={"request_id": chat_id, "message": message},
        daemon=True,
    ).start()
