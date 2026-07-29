"""LLM router agent that classifies a chat message into one capability.

This replaces the embedding intent classifier. The agent's output type is a
fixed set of intents, so the model chooses which capability handles a message
but can never invent one the router does not dispatch - the LLM decides, the
schema keeps that decision deterministic.
"""
from typing import Literal

from pydantic import BaseModel
from pydantic_ai import Agent, ModelSettings

from ..config import model
from ..models import ChatDeps
from .instructions import recent_conversation
from .registry import IntentName


class Route(BaseModel):
    """The single capability that should handle the user's message.

    Reuses IntentName (the action intents) and adds the catch-all 'chat', so the
    intent set stays single-sourced in agents/registry.py.
    """

    intent: IntentName | Literal["chat"]


router_agent = Agent(
    model,
    output_type=Route,
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=64,
        extra_body={"reasoning_effort": "none"},
    ),
    instructions=(
        "You route a TethysDash user's message to exactly one capability. "
        "Choose the single best match:\n"
        "- 'add_plugin': the user wants to ADD a new visualization or plugin "
        "tile to the dashboard.\n"
        "- 'patch_visualization': the user wants to CHANGE, UPDATE, or EDIT an "
        "argument of a visualization that is ALREADY on the dashboard.\n"
        "- 'list_plugins': the user wants to SEE which plugins or "
        "visualizations are available to add.\n"
        "- 'chat': anything else - questions, help, greetings, or requests "
        "that do not fit the three actions above.\n"
        "Return only the chosen intent."
    ),
)


router_agent.instructions(recent_conversation)
