"""Specialist agent: answer questions about the TethysDash documentation.

Retrieval is DETERMINISTIC (chat/docs.py keyword scoring over
docs/source) and injected via a dynamic instruction - the same pattern
plugin_agent uses for the plugin catalog. One LLM call per question, no
tool round-trips, so it works identically on small local models and
paid providers.

Output is plain ``str`` - no NativeOutput - so no per-provider output
wrapping is needed; dispatch only threads model/model_settings.
"""
from __future__ import annotations

from pydantic_ai import Agent, ModelSettings, RunContext

from ..config import model
from ..tools.docs import retrieve_context
from ..utils import emit_progress
from ..models import ChatDeps


docs_agent = Agent(
    model,
    output_type=str,
    deps_type=ChatDeps,
    retries=2,
    model_settings=ModelSettings(
        max_tokens=1024,
        extra_body={"reasoning_effort": "none"},
    ),
    instructions=(
        "You answer questions about TethysDash using ONLY the "
        "documentation excerpts provided below. Be concise and practical. "
        "If the excerpts do not cover the question, say so plainly - do "
        "not invent behavior. Do NOT add a source, link, or citation "
        "line - documentation links are appended automatically.\n"
        "Formatting: the answer renders in a narrow chat bubble. Use "
        "short paragraphs and numbered/bullet lists with **bold** for "
        "key terms. Do NOT use Markdown headings (#, ##)."
    ),
)


@docs_agent.instructions
def documentation_excerpts(ctx: RunContext[ChatDeps]) -> str:
    context, sources = retrieve_context(ctx.deps.original_prompt)
    if not context:
        return (
            "No documentation excerpts matched the question. Tell the "
            "user the docs don't appear to cover it."
        )
    emit_progress(
        ctx.deps.chat_id,
        f"Reading {', '.join(s['file'] for s in sources)}...",
    )
    return f"Documentation excerpts:\n\n{context}"


@docs_agent.instructions
def recent_conversation(ctx: RunContext[ChatDeps]) -> str:
    from ..messages.history import format_history_instruction

    return format_history_instruction(ctx.deps.history)
