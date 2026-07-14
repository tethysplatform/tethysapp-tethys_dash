"""Singletons for the chat router.
"""
from __future__ import annotations

from .agents.docs import docs_agent
from .agents.embedder import EmbeddingIntentClassifier
from .agents.embedding_data import INTENTS
from .agents.plugin import plugin_agent
from .agents.registry import AgentRegistry

classifier: EmbeddingIntentClassifier | None = None


def get_classifier() -> EmbeddingIntentClassifier:
    """Return the process-wide intent classifier, building it once."""
    global classifier
    if classifier is None:
        classifier = EmbeddingIntentClassifier(INTENTS)
    return classifier


def build_registry() -> AgentRegistry:
    """Registry mapping intents to their specialist agents."""
    return AgentRegistry(
        add_plugin=plugin_agent,
        answer_docs_question=docs_agent,
    )
