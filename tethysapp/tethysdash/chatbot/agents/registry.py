from typing import Literal
from pydantic_ai import Agent
from dataclasses import dataclass
from .embedding_data import INTENT_ADD, INTENT_LIST


IntentName = Literal[
    INTENT_ADD,
    INTENT_LIST,
]


@dataclass
class AgentRegistry:
    """Specialist agents keyed by intent, plus the general fallback agent."""

    add_plugin: Agent
    chat_agent: Agent

    def get(self, intent: IntentName) -> Agent:
        """Return the specialist agent registered for an intent."""
        return getattr(self, intent)
