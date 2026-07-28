from pydantic_ai import Agent, ModelSettings, NativeOutput, RunContext

from ..config import model
from ..models import ChatDeps
from ..tools.patch import format_dashboard_state_for_llm, patch_visualization
from .instructions import recent_conversation


patch_agent = Agent(
    model,
    output_type=NativeOutput([patch_visualization]),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=512,
        extra_body={"reasoning_effort": "none"},
    ),
    instructions=(
        "You are a TethysDash chat agent that changes the arguments of "
        "visualizations already on the user's dashboard.\n"
        "\n"
        "To change a tile: call patch_visualization(source, args). 'source' is "
        "the plugin name of the tile, taken from the 'Current visualizations' "
        "list in this system prompt. 'args' is an object with only the "
        "arguments to change and their NEW values; other arguments are kept as "
        "they are. Never copy a tile's current value into 'args' - put only the "
        "value the user asked for.\n"
        "\n"
        "Do not use tile numbers or positions. Identify the tile by its source "
        "name only. If several tiles share that source, the tool will list them "
        "and ask you to narrow it down; on your next turn pass 'where' with one "
        "of that tile's current argument values to pick it.\n"
        "\n"
        "If a tool returns an error, read it and try again with corrected "
        "inputs.\n"
        "\n"
        "Reply to the user with a one-sentence confirmation of what changed."
    ),
)


@patch_agent.instructions
def dashboard_state(ctx: RunContext[ChatDeps]) -> str:
    """Expose the dashboard's current visualizations so the model can target one."""
    return (
        "Current visualizations:\n"
        f"{format_dashboard_state_for_llm(ctx.deps.user, ctx.deps.dashboard_id)}"
    )


patch_agent.instructions(recent_conversation)
