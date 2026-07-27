from typing import Literal
from pydantic_ai import Agent
from dataclasses import dataclass
from .embedding_data import INTENT_ADD, INTENT_LIST, INTENT_OOS


IntentName = Literal[
    INTENT_ADD,
    INTENT_LIST,
    INTENT_OOS,
]

@dataclass
class AgentRegistry:
    add_plugin: Agent

    def get(self, intent: IntentName) -> Agent:
        return getattr(self, intent)