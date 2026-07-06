from pydantic_ai import Agent, ModelSettings, RunContext

from .config import model
from .plugins import format_catalog_for_llm
from .tools import add_visualization_from_plugin
from .validation import ChatDeps


STATIC_INSTRUCTIONS = (
    "You are a TethysDash chat agent that adds visualization tiles to "
    "the user's active dashboard.\n"
    "\n"
    "To add a tile: call add_visualization_from_plugin(source, args_json). "
    "The 'source' argument must be a plugin name from the 'Available plugins' "
    "list included in this system prompt. 'args_json' is a JSON string of the "
    "plugin's expected args.\n"
    "\n"
    "If a tool returns an error, read it and try again on your next turn "
    "with corrected inputs.\n"
    "\n"
    "Reply to the user with a one-sentence confirmation of what was added."
)


grid_item_builder_agent = Agent(
    model,
    output_type=str,
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(max_tokens=400),
    tools=[add_visualization_from_plugin],
    instructions=STATIC_INSTRUCTIONS,
)


@grid_item_builder_agent.instructions
def avaialble_plugins(ctx: RunContext[ChatDeps]) -> str:
    return f"Available plugins on this server:\n{format_catalog_for_llm()}"
