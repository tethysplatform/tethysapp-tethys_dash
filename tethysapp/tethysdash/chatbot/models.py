from __future__ import annotations
from dataclasses import dataclass
from .agents.registry import IntentName
from typing import Literal, Any
from pydantic import BaseModel
from .agents.embedder import EmbeddingIntentClassifier
from .agents.registry import AgentRegistry
from .utils import emit_progress
from .agents.embedding_data import (
    INTENT_ADD,
    INTENT_LIST,
    INTENT_OOS,
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
    similarity: float
    margin: float
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

class LLMRouter:
    def __init__(
        self,
        classifier: EmbeddingIntentClassifier,
        agents: AgentRegistry,
        deps: ChatDeps,
    ) -> None:
        self.classifier = classifier
        self.agents = agents
        self.deps = deps

    async def route(self, request: str) -> RoutedResponse | str:
        prediction = self.classifier.classify(request)
        if prediction.intent is None or prediction.intent == INTENT_OOS:
            emit_progress(self.deps.chat_id, "Thinking...")
            result = await self.agents.chat_agent.run(request, deps=self.deps)
            return RoutedResponse(
                intent="fallback",
                similarity=prediction.score,
                margin=prediction.margin,
                response=result.output,
            )

        if (
            prediction.intent == INTENT_ADD
            and not self.deps.can_add_visualizations
        ):
            return (
                "Only the dashboard owner can add visualizations to this "
                "dashboard. I can still list the available plugins."
            )

        elif prediction.intent == INTENT_LIST:
            from .tools.catalog import format_catalog_for_llm

            emit_progress(self.deps.chat_id, "Fetching available plugins...")
            return format_catalog_for_llm()
        else:
            selected_intent = prediction.intent  # type: ignore[assignment]
            public_intent = selected_intent

        selected_agent = self.agents.get(selected_intent)
        result = await selected_agent.run(request, deps=self.deps)
        response_text = result.output


        return RoutedResponse(
            intent=public_intent,
            similarity=prediction.score,
            margin=prediction.margin,
            response=response_text,
        )

 