from .viz_agent import grid_item_builder_agent
from pydantic_ai import Agent, ModelSettings, RunContext, NativeOutput
from .config import model
from .validation import ChatDeps
from .plugins import format_catalog_for_llm


async def add_visualization(ctx: RunContext[ChatDeps], prompt: str) -> str:
    """Delegate to the visualization-adder specialist. Use when the user
    asks to ADD, CREATE, or PLACE a visualization on the dashboard."""
    result = await grid_item_builder_agent.run(prompt, deps=ctx.deps)
    return result.output


def list_available_plugins(ctx: RunContext[ChatDeps]) -> str:
    """Return the catalog of plugins available on this
    server. Use when the user asks what plugins exist, what they
    can add, or what plugins are available."""
    return format_catalog_for_llm()

def out_of_scope_reply(ctx: RunContext[ChatDeps], reason: str) -> str:
    """Call this when the user's request is unrelated to adding visualizations
    or listing what's available. Reply politely explaining what you can help with."""
    return "I can only help with adding visualizations or listing what's available."


router_agent = Agent(
    model,
    output_type=NativeOutput([
        add_visualization,
        list_available_plugins,
        out_of_scope_reply,
    ]),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=400,
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
    ),
    instructions=(
        "You handle user requests about a TethysDash dashboard by producing "
        "structured output that matches ONE of your available response schemas:\n"
        "  - add_visualization: user wants to ADD a visualization tile.\n"
        "  - list_available_plugins: user wants to KNOW what plugins exist.\n"
        "  - out_of_scope_reply: anything else.\n"
    ),
)