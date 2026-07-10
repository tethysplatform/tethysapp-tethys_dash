from .plugin import PLUGIN_CANDIDATES, plugin_agent
from .docs import docs_agent
from pydantic_ai import Agent, ModelSettings, RunContext, NativeOutput
from ..config import model
from ..validation import ChatDeps
from ..plugins import format_catalog_for_llm
from ..streaming import emit_progress


def _model_overrides(ctx: RunContext[ChatDeps]) -> dict:
    """model + model_settings from the request's resolved LLMProfile.
    Empty when no profile is set (agent construction defaults apply)."""
    profile = ctx.deps.profile
    if profile is None:
        return {}
    return {
        "model": profile.model,
        "model_settings": profile.model_settings,
    }


def _run_overrides(ctx: RunContext[ChatDeps], candidates: list) -> dict:
    """Per-run kwargs carrying the request's resolved LLMProfile into a
    delegated agent run, including the per-provider output wrapping."""
    overrides = _model_overrides(ctx)
    if overrides:
        overrides["output_type"] = ctx.deps.profile.wrap_output(candidates)
    return overrides


async def add_visualization(ctx: RunContext[ChatDeps]) -> str:
    """Delegate to the visualization-adder specialist. Use when the user
    asks to ADD, CREATE, or PLACE a visualization on the dashboard."""
    emit_progress(ctx.deps.chat_id, "Adding a visualization...")
    result = await plugin_agent.run(
        ctx.deps.original_prompt,
        deps=ctx.deps,
        **_run_overrides(ctx, PLUGIN_CANDIDATES),
    )
    return result.output


async def answer_docs_question(ctx: RunContext[ChatDeps]) -> str:
    """Delegate to the documentation Q&A specialist. Use when the user
    asks HOW something works, WHAT a feature is, or for help or
    instructions about TethysDash itself (not a request to add anything
    to the dashboard)."""
    from ..docs import retrieve_context

    emit_progress(ctx.deps.chat_id, "Searching the documentation...")
    # Plain-str output: no output_type override needed, any provider.
    result = await docs_agent.run(
        ctx.deps.original_prompt,
        deps=ctx.deps,
        **_model_overrides(ctx),
    )
    # Sources footer is DETERMINISTIC (readthedocs links from the same
    # cached retrieval the agent saw) - never LLM-composed, so URLs
    # can't be hallucinated or mangled. Markdown renders in the chatbox.
    _, sources = retrieve_context(ctx.deps.original_prompt)
    if not sources:
        return result.output
    links = " · ".join(f"[{s['title']}]({s['url']})" for s in sources)
    return f"{result.output}\n\n**Sources:** {links}"


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
        "I can only help with adding plugins for visualizations or listing what plugins are available. "
        "You can ask me to add a visualization to your dashboard, or you can ask what plugins are available."
    )


# Exported for the controller's per-run output override (same wrapping
# decision as PLUGIN_CANDIDATES - see LLMProfile.wrap_output).
ROUTER_CANDIDATES = [
    add_visualization,
    answer_docs_question,
    list_available_plugins,
    out_of_scope_reply,
]

router_agent = Agent(
    model,
    output_type=NativeOutput(ROUTER_CANDIDATES),
    deps_type=ChatDeps,
    retries=3,
    model_settings=ModelSettings(
        max_tokens=400,
    ),
    instructions=(
        "You handle user requests about a TethysDash dashboard by producing "
        "structured output that matches ONE of your available response schemas:\n"
        "  - add_visualization: user wants to ADD a visualization tile.\n"
        "  - answer_docs_question: user asks HOW or WHAT about TethysDash "
        "features (how do I..., what is..., help with...).\n"
        "  - list_available_plugins: user wants to KNOW what plugins exist.\n"
        "  - out_of_scope_reply: anything else.\n"
    ),
)


@router_agent.instructions
def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    from ..history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
