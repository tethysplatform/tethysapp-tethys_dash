from typing import Literal
from pydantic_ai import Agent
from dataclasses import dataclass
from .embedding_data import INTENT_ADD, INTENT_LIST, INTENT_PATCH


IntentName = Literal[
    INTENT_ADD,
    INTENT_LIST,
    INTENT_PATCH,
]


@dataclass
class AgentRegistry:
    """Specialist agents keyed by intent, plus the router and fallback agents."""

    add_plugin: Agent
    patch_visualization: Agent
    chat_agent: Agent
    router_agent: Agent

    def get(self, intent: IntentName) -> Agent:
        """Return the specialist agent registered for an intent."""
        return getattr(self, intent)
