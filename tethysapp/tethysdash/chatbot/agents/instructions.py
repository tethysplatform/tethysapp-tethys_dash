"""Instruction functions shared across the chat agents.

Registered on each agent with ``agent.instructions(fn)`` so the same dynamic
system-prompt logic is defined once instead of copied per agent.
"""
from pydantic_ai import RunContext

from ..models import ChatDeps


def available_plugins(ctx: RunContext[ChatDeps]) -> str:
    """Expose a compact plugin catalog (names + arg keys) to the add agent.

    Brief, not the full descriptioned list: the add agent only needs to pick a
    plugin and its args, and the deterministic resolver forgives near-miss
    names, so keeping this small trims the prompt. The full catalog is served
    verbatim by the deterministic ``list_plugins`` reply.
    """
    from ..tools import format_catalog_brief

    return f"Available plugins on this server:\n{format_catalog_brief()}"


def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    """Provide recent conversation history for reference resolution."""
    from ..messages.history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
