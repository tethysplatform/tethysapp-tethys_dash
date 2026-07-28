from typing import Literal
from pydantic_ai import Agent
from dataclasses import dataclass

INTENT_ADD = "add_plugin"
INTENT_LIST = "list_plugins"
INTENT_PATCH = "patch_visualization"
INTENT_CHAT = "chat"
INTENT_FALLBACK = "fallback"


# String literals (not the constants) because PEP 586 requires literal values
# inside Literal[...]; keep these in sync with the INTENT_* constants above.
IntentName = Literal["add_plugin", "list_plugins", "patch_visualization"]


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
