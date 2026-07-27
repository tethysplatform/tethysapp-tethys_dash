from pydantic_ai import Agent, ModelSettings, RunContext, NativeOutput

from ..config import model
from ..tools import add_visualizations_from_plugin, format_catalog_for_llm
from ..models import ChatDeps


plugin_agent = Agent(
    model,
    output_type=NativeOutput([add_visualizations_from_plugin]),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=512,
        extra_body={"reasoning_effort": "none"},
    ),
    instructions=(
        "You are a TethysDash chat agent that adds visualization tiles to "
        "the user's active dashboard.\n"
        "\n"
        "To add tiles: call add_visualizations_from_plugin(visualizations), "
        "where 'visualizations' is a list of objects, each with a 'source' (a "
        "plugin name from the 'Available plugins' list in this system prompt) "
        "and an 'args' object whose keys and values follow that plugin's own "
        "arg schema (also shown in the list). Use {} for args when a plugin "
        "needs none. Include one object per plugin the user asked for.\n"
        "\n"
        "If a tool returns an error, read it and try again on your next turn "
        "with corrected inputs.\n"
        "\n"
        "Reply to the user with a one-sentence confirmation of what was added."
    ),
)


@plugin_agent.instructions
def available_plugins(ctx: RunContext[ChatDeps]) -> str:
    return f"Available plugins on this server:\n{format_catalog_for_llm()}"

@plugin_agent.instructions
def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    from ..messages.history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
