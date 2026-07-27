from pydantic_ai import Agent, ModelSettings, NativeOutput, RunContext

from ..config import model
from ..models import ChatDeps
from ..tools.patch import (
    ask_which_visualization,
    format_dashboard_state_for_llm,
    patch_visualization,
)


patch_agent = Agent(
    model,
    output_type=NativeOutput([patch_visualization, ask_which_visualization]),
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
        "To change a tile: call patch_visualization(target, args). 'target' is "
        "the number of the visualization from the 'Current visualizations' "
        "list in this system prompt. 'args' is an object containing only the "
        "arguments to change and their new values; other arguments are kept "
        "as they are.\n"
        "\n"
        "The 'Current visualizations' list shows each tile's CURRENT argument "
        "values. Put the user's NEW value in 'args' - never copy the current "
        "value from the list.\n"
        "\n"
        "If the user's description matches more than one visualization in the "
        "list (for example two tiles of the same plugin), do NOT guess - call "
        "ask_which_visualization with their numbers so the user can choose.\n"
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


@patch_agent.instructions
def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    """Provide recent conversation history for reference resolution."""
    from ..messages.history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
