"""Intent dispatch — run the specialist for a classified intent.

The deterministic router (``routing.classify``) decides WHICH capability
a request needs; this module executes it. The LLM only runs inside the
specialist agents (plugin, docs), where it interprets and executes
within the already-chosen capability. Two intents (list, out-of-scope)
need no LLM at all.

Owner gating lives here as a plain guard: adding visualizations is
owner-only. The tool-level check in plugins_tools remains as
defense-in-depth.
"""
from __future__ import annotations

from .agents.docs import docs_agent
from .agents.plugin import PLUGIN_CANDIDATES, plugin_agent
from .docs import retrieve_context
from .plugins import format_catalog_for_llm
from .routing import INTENT_ADD, INTENT_DOCS, INTENT_LIST
from .streaming import emit_progress
from .validation import ChatDeps

_OWNER_ONLY = {INTENT_ADD}

_NOT_OWNER_MSG = (
    "Only the dashboard owner can add visualizations to this dashboard. "
    "I can still answer documentation questions or list the available "
    "plugins."
)

_OOS_MSG = (
    "I can help with three things: answering questions about TethysDash "
    "from the documentation, adding a visualization to your dashboard, or "
    "listing the available plugins. Try one of those."
)


def _model_overrides(deps: ChatDeps) -> dict:
    """model + model_settings from the request's resolved LLMProfile."""
    profile = deps.profile
    if profile is None:
        return {}
    return {"model": profile.model, "model_settings": profile.model_settings}


async def _run_add(deps: ChatDeps) -> str:
    emit_progress(deps.chat_id, "Adding a visualization...")
    overrides = _model_overrides(deps)
    if overrides:
        # per-provider output wrapping (NativeOutput local / tools paid)
        overrides["output_type"] = deps.profile.wrap_output(PLUGIN_CANDIDATES)
    result = await plugin_agent.run(deps.original_prompt, deps=deps, **overrides)
    return result.output


async def _run_docs(deps: ChatDeps) -> str:
    emit_progress(deps.chat_id, "Searching the documentation...")
    result = await docs_agent.run(
        deps.original_prompt, deps=deps, **_model_overrides(deps)
    )
    # Deterministic readthedocs sources footer, never LLM-composed.
    _, sources = retrieve_context(deps.original_prompt)
    if not sources:
        return result.output
    links = " · ".join(f"[{s['title']}]({s['url']})" for s in sources)
    return f"{result.output}\n\n**Sources:** {links}"


async def run_intent(intent: str, deps: ChatDeps) -> str:
    """Execute the handler for a classified intent and return the reply."""
    if intent in _OWNER_ONLY and not deps.can_add_visualizations:
        return _NOT_OWNER_MSG

    if intent == INTENT_ADD:
        return await _run_add(deps)
    if intent == INTENT_DOCS:
        return await _run_docs(deps)
    if intent == INTENT_LIST:
        emit_progress(deps.chat_id, "Fetching available plugins...")
        return format_catalog_for_llm()
    return _OOS_MSG
