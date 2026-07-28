from __future__ import annotations
from dataclasses import dataclass
from .agents.registry import IntentName
from typing import Literal, Any
from pydantic import BaseModel
from pydantic_ai.exceptions import UnexpectedModelBehavior
from .agents.registry import AgentRegistry
from .utils import emit_progress
from .agents.embedding_data import (
    INTENT_ADD,
    INTENT_LIST,
    INTENT_PATCH,
)


@dataclass(frozen=True)
class PluginSpec:
    name: str
    source: str
    viz_type: str
    args: dict[str, Any]
    description: str


class PluginRequest(BaseModel):
    """A single plugin to add: its catalog source name and argument object."""

    source: str
    args: dict[str, Any] = {}


class RoutedResponse(BaseModel):
    intent: IntentName | Literal["fallback"]
    response: str

@dataclass
class ChatDeps:
    """Session context passed via ``agent.run(prompt, deps=ChatDeps(...))``.
    Every tool receives this via ``ctx.deps.<field>``.

    ``chat_id`` is a per-request UUID from the frontend; tools use it as
    the ``requestId`` when pushing progress messages over the WebSocket.
    """
    user: object
    dashboard_id: int
    original_prompt: str = ""
    chat_id: str = ""
    history: list = None
    can_add_visualizations: bool = True

_RETRY_EXHAUSTED_MESSAGE = (
    "I couldn't complete that request - the model kept producing an invalid "
    "action. Please rephrase or add detail (for example, name the plugin and "
    "the argument values)."
)


class LLMRouter:
    def __init__(self, agents: AgentRegistry, deps: ChatDeps) -> None:
        self.agents = agents
        self.deps = deps

    async def _classify(self, request: str) -> str:
        """Ask the router agent which capability should handle the message.

        The router's output type is a fixed set of intents, so it can only
        pick a capability the router dispatches. On retry exhaustion, fall
        back to free-form chat rather than surfacing an error.
        """
        try:
            result = await self.agents.router_agent.run(request, deps=self.deps)
            return result.output.intent
        except UnexpectedModelBehavior:
            return "chat"

    async def _run_agent(self, agent, request: str) -> str:
        """Run a specialist agent, returning a graceful message on retry exhaustion."""
        try:
            result = await agent.run(request, deps=self.deps)
            return result.output
        except UnexpectedModelBehavior:
            return _RETRY_EXHAUSTED_MESSAGE

    async def route(self, request: str) -> RoutedResponse | str:
        intent = await self._classify(request)

        if intent == "chat":
            emit_progress(self.deps.chat_id, "Thinking...")
            response_text = await self._run_agent(self.agents.chat_agent, request)
            return RoutedResponse(intent="fallback", response=response_text)

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

 