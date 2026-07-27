from pydantic_ai import Agent, ModelSettings, RunContext

from ..config import model
from ..models import ChatDeps
from ..tools import format_catalog_for_llm


chat_agent = Agent(
    model,
    output_type=str,
    deps_type=ChatDeps,
    retries=2,
    model_settings=ModelSettings(
        max_tokens=1024,
        extra_body={"reasoning_effort": "none"},
    ),
    instructions=(
        "You are the TethysDash assistant, embedded in a no-code dashboard "
        "builder. Answer the user's message helpfully and concisely in plain "
        "text. You do not perform dashboard actions yourself in this reply: if "
        "the user wants to add a visualization or list plugins, tell them to "
        "ask directly (for example 'add the <plugin> plugin' or 'list "
        "plugins'). Prefer TethysDash topics; if the question is unrelated, "
        "answer briefly and steer back to how you can help with their "
        "dashboard."
    ),
)


@chat_agent.instructions
def available_plugins(ctx: RunContext[ChatDeps]) -> str:
    """Expose the installed plugin catalog so the assistant can answer about it."""
    return f"Available plugins on this server:\n{format_catalog_for_llm()}"


@chat_agent.instructions
def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    """Provide recent conversation history for reference resolution."""
    from ..messages.history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
