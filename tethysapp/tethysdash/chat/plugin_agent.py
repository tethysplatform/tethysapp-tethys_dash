from pydantic_ai import Agent, ModelSettings, RunContext, NativeOutput

from .config import model
from .plugins import format_catalog_for_llm
from .tools import add_visualization_from_plugin
from .validation import ChatDeps


STATIC_INSTRUCTIONS = (
    "You are a TethysDash chat agent that adds visualization tiles to "
    "the user's active dashboard.\n"
    "\n"
    "To add a tile: call add_visualization_from_plugin(source, args). "
    "The 'source' argument must be a plugin name from the 'Available plugins' "
    "list included in this system prompt. 'args' is an object whose keys and "
    "values are defined by that plugin's own arg schema (also shown in the "
    "list). Pass {} for plugins with no required args.\n"
    "\n"
    "If a tool returns an error, read it and try again on your next turn "
    "with corrected inputs.\n"
    "\n"
    "Reply to the user with a one-sentence confirmation of what was added."
)

plugin_agent = Agent(
    model,
    output_type=NativeOutput([add_visualization_from_plugin]),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=400,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    ),
    instructions=STATIC_INSTRUCTIONS,
)

@plugin_agent.instructions
def available_plugins(ctx: RunContext[ChatDeps]) -> str:
    return f"Available plugins on this server:\n{format_catalog_for_llm()}"