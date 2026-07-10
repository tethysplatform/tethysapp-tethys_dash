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

# Candidates that mutate the dashboard - available to the dashboard
# OWNER only. Removing them from the per-run output schema is UX
# steering (the model literally cannot select them); the authoritative
# gate is the deterministic check inside the tool itself
# (plugins_tools.add_visualization_from_plugin) plus the model layer's
# own permission enforcement in update_named_dashboard.
OWNER_ONLY_CANDIDATE_NAMES = {"add_visualization"}

# One description per candidate, keyed by name, so the prose the model
# reads always matches the schema it is given (a described-but-absent
# candidate makes small models emit schema-invalid picks).
_CANDIDATE_DESCRIPTIONS = {
    # add vs docs have overlapping trigger words ("create", "add", "map") -
    # each carries an explicit do-NOT clause pointing at the other, or the
    # model fires the wrong one (mutual-exclusion pattern).
    "add_visualization": (
        "add_visualization: user COMMANDS adding a tile right now, giving "
        "concrete values (e.g. 'add the forecast plugin for river 123'). "
        "Do NOT use for questions - if the message asks HOW to do "
        "something, use answer_docs_question."
    ),
    "answer_docs_question": (
        "answer_docs_question: user asks a QUESTION about TethysDash - "
        "how do I..., what is..., can I... This includes questions like "
        "'how do I create a map?' - asking HOW is a documentation "
        "question, NOT a command to add anything."
    ),
    "list_available_plugins": (
        "list_available_plugins: user wants to KNOW what plugins exist."
    ),
    "out_of_scope_reply": "out_of_scope_reply: anything else.",
}


def candidates_for(deps: ChatDeps) -> list:
    """The router candidates available to THIS request.

    Owner-only candidates are dropped when the requester doesn't own
    the dashboard. Used by the controller to build the per-run
    output_type and by the dynamic instruction below, so schema and
    prose can't drift.
    """
    if deps.can_add_visualizations:
        return ROUTER_CANDIDATES
    return [
        c for c in ROUTER_CANDIDATES
        if c.__name__ not in OWNER_ONLY_CANDIDATE_NAMES
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
        "structured output that matches ONE of your available response "
        "schemas, listed below."
    ),
)


@router_agent.instructions
def available_actions(ctx: RunContext[ChatDeps]) -> str:
    lines = [
        f"  - {_CANDIDATE_DESCRIPTIONS[c.__name__]}"
        for c in candidates_for(ctx.deps)
    ]
    note = ""
    if not ctx.deps.can_add_visualizations:
        note = (
            "\nNote: this user is not the dashboard owner, so adding "
            "visualizations is unavailable. If they ask to add one, use "
            "out_of_scope_reply and explain that only the owner can add "
            "visualizations."
        )
    return "Available response schemas:\n" + "\n".join(lines) + note


@router_agent.instructions
def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    from ..history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
