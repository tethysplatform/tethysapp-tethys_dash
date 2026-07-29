"""The deterministic LLM router: classify a message, dispatch to a capability.

The router agent picks the intent from a fixed set, then the specialist LLM (or
the plugin catalog) handles it. On retry exhaustion each path returns a graceful
message and logs the real error rather than surfacing a 500.
"""
import re

from pydantic_ai import capture_run_messages
from pydantic_ai.exceptions import UnexpectedModelBehavior
from pydantic_ai.messages import RetryPromptPart

from .agents.registry import (
    INTENT_ADD,
    INTENT_CHAT,
    INTENT_FALLBACK,
    INTENT_LIST,
    INTENT_PATCH,
    AgentRegistry,
)
from .models import ChatDeps, RoutedResponse
from .utils import emit_delta, emit_progress, log_chat_error

_RETRY_EXHAUSTED_MESSAGE = (
    "I couldn't complete that request - the model kept producing an invalid "
    "action. Please rephrase or add detail (for example, name the plugin and "
    "the argument values)."
)


def _last_retry_detail(messages) -> str | None:
    """Return the most recent tool-retry text from a captured agent run.

    Each ModelRetry a specialist tool raises becomes a RetryPromptPart whose
    string content is that human-facing message; the last one is why the run
    finally gave up. Non-string content (raw schema-validation errors) is left
    to the generic fallback, since it is not written for a user to read.
    """
    for message in reversed(messages):
        for part in reversed(getattr(message, "parts", ())):
            if isinstance(part, RetryPromptPart) and isinstance(part.content, str):
                return part.content
    return None


# High-precision intent patterns, keyed to the shapes the slash-template menu
# emits ("Add <name> with <arg> = ...", "Change <src> where <arg> is <v> to
# <arg> = ...", "What/which/list ... plugins ..."). They match the template
# grammar, not loose keywords, so free-typed prose (e.g. "add more detail about
# the forecast") does not match and is deferred to the LLM router.
_ADD_RE = re.compile(r"^\s*add\b.+\bwith\b.+=", re.IGNORECASE | re.DOTALL)
_PATCH_RE = re.compile(
    r"^\s*change\b.+\bwhere\b.+\bto\b.+=", re.IGNORECASE | re.DOTALL
)
_LIST_RE = re.compile(r"^\s*(what|which|list)\b.{0,40}\bplugins?\b", re.IGNORECASE)


def deterministic_route(message: str) -> str | None:
    """Classify a message by the slash-template grammar, or None to defer.

    Precision over recall: it only returns an intent for the unambiguous shapes
    the template menu generates, so a wrong guess is near-impossible. Everything
    else returns None and falls through to the LLM router. Even a misroute is
    self-correcting downstream - add/patch with no resolvable target return a
    "did you mean" / no-op reply, never a wrong action.
    """
    text = (message or "").strip()
    if _ADD_RE.match(text):
        return INTENT_ADD
    if _PATCH_RE.match(text):
        return INTENT_PATCH
    if _LIST_RE.match(text):
        return INTENT_LIST
    return None


class LLMRouter:
    def __init__(self, agents: AgentRegistry, deps: ChatDeps) -> None:
        self.agents = agents
        self.deps = deps

    async def _classify(self, request: str) -> str:
        """Ask the router agent which capability should handle the message.

        A deterministic pre-check handles the unambiguous template shapes with
        no inference; only what it defers reaches the router agent. Its output
        type is a fixed set of intents, so it can only pick a capability the
        router dispatches. On retry exhaustion, fall back to free-form chat
        rather than surfacing an error.
        """
        hit = deterministic_route(request)
        if hit is not None:
            return hit
        try:
            result = await self.agents.router_agent.run(request, deps=self.deps)
            return result.output.intent
        except UnexpectedModelBehavior as exc:
            log_chat_error("router classification failed", exc)
            return INTENT_CHAT

    async def _run_agent(self, agent, request: str) -> str:
        """Run a specialist agent, returning a graceful message on retry exhaustion.

        On exhaustion the raised UnexpectedModelBehavior carries only a generic
        "exceeded retries" note; the specialist tool's own actionable message
        (e.g. "No visualization named X. The dashboard has: ...") survives only
        as a RetryPromptPart in the captured run, so recover and surface that.
        """
        with capture_run_messages() as messages:
            try:
                result = await agent.run(request, deps=self.deps)
                return result.output
            except UnexpectedModelBehavior as exc:
                log_chat_error("specialist agent retry exhausted", exc)
                return _last_retry_detail(messages) or _RETRY_EXHAUSTED_MESSAGE

    async def _stream_chat(self, request: str) -> str:
        """Stream the chat agent's reply token-by-token, returning the full text.

        Each delta is pushed onto the request's stream as it arrives so the UI
        shows the answer building up; the joined text is still returned as the
        final reply for the ``done`` event.
        """
        parts: list[str] = []
        try:
            async with self.agents.chat_agent.run_stream(
                request, deps=self.deps
            ) as result:
                async for delta in result.stream_text(delta=True):
                    parts.append(delta)
                    emit_delta(self.deps.chat_id, delta)
            return "".join(parts)
        except UnexpectedModelBehavior as exc:
            log_chat_error("chat stream retry exhausted", exc)
            return _RETRY_EXHAUSTED_MESSAGE

    async def route(self, request: str) -> RoutedResponse | str:
        intent = await self._classify(request)

        if intent == INTENT_CHAT:
            emit_progress(self.deps.chat_id, "Thinking...")
            response_text = await self._stream_chat(request)
            return RoutedResponse(intent=INTENT_FALLBACK, response=response_text)

        if (
            intent in (INTENT_ADD, INTENT_PATCH)
            and not self.deps.can_add_visualizations
        ):
            return (
                "Only the dashboard owner can add or change visualizations on "
                "this dashboard. I can still list the available plugins."
            )

        if intent == INTENT_LIST:
            from .tools.catalog import format_catalog_for_llm

            emit_progress(self.deps.chat_id, "Fetching available plugins...")
            return format_catalog_for_llm()

        response_text = await self._run_agent(self.agents.get(intent), request)
        return RoutedResponse(intent=intent, response=response_text)
