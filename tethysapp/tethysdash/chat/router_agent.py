from .viz_agent import grid_item_builder_agent
from .map_agent import map_builder_agent
from pydantic_ai import Agent, ModelSettings, RunContext, NativeOutput
from .config import model
from .validation import ChatDeps
from .plugins import format_catalog_for_llm
from .streaming import emit_progress


async def add_visualization(ctx: RunContext[ChatDeps]) -> str:
    """Delegate to the visualization-adder specialist. Use when the user
    asks to ADD, CREATE, or PLACE a chart, table, text tile, or other
    non-map visualization on the dashboard."""
    emit_progress(ctx.deps.chat_id, "Adding a visualization...")
    result = await grid_item_builder_agent.run(ctx.deps.original_prompt, deps=ctx.deps)
    return result.output


async def add_map(ctx: RunContext[ChatDeps]) -> str:
    """Delegate to the map-builder specialist. Use when the user asks to
    ADD or SHOW a MAP with WMS/geographic LAYERS. The specialist stages
    the map for user approval instead of committing directly."""
    emit_progress(ctx.deps.chat_id, "Building a map proposal...")
    result = await map_builder_agent.run(ctx.deps.original_prompt, deps=ctx.deps)
    return result.output


def list_available_plugins(ctx: RunContext[ChatDeps]) -> str:
    """Return the catalog of plugins available on this
    server. Use when the user asks what plugins exist, what they
    can add, or what plugins are available."""
    emit_progress(ctx.deps.chat_id, "Fetching available plugins...")
    return format_catalog_for_llm()


def out_of_scope_reply(ctx: RunContext[ChatDeps]) -> str:
    """Call this when the user's request is unrelated to adding plugins 
    or listing what plugins are available. Reply politely explaining what you can help with."""
    return (
        "I can only help with adding plugins for visualizations or listing what plugins are available."
        "You can ask me to add a visualization to your dashboard, or you can ask what plugins are available."
        )


router_agent = Agent(
    model,
    output_type=NativeOutput([
        add_visualization,
        add_map,
        list_available_plugins,
        out_of_scope_reply,
    ]),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=400,
    ),
    instructions=(
        "You handle user requests about a TethysDash dashboard by producing "
        "structured output that matches ONE of your available response schemas:\n"
        "  - add_visualization: user wants to ADD a chart / table / text / "
        "plugin-driven visualization tile (NOT a map).\n"
        "  - add_map: user wants to ADD a MAP with WMS/geographic layers. "
        "Signal words: 'map', 'layer', 'WMS', 'geographic', 'basemap'.\n"
        "  - list_available_plugins: user wants to KNOW what plugins exist.\n"
        "  - out_of_scope_reply: anything else.\n"
    ),
)
