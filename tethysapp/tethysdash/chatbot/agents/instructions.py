"""Instruction functions shared across the chat agents.

Registered on each agent with ``agent.instructions(fn)`` so the same dynamic
system-prompt logic is defined once instead of copied per agent.
"""
from pydantic_ai import RunContext

from ..models import ChatDeps


def available_plugins(ctx: RunContext[ChatDeps]) -> str:
    """Expose the installed plugin catalog so the agent can answer about it."""
    from ..tools import format_catalog_for_llm

    return f"Available plugins on this server:\n{format_catalog_for_llm()}"


def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    """Provide recent conversation history for reference resolution."""
    from ..messages.history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
