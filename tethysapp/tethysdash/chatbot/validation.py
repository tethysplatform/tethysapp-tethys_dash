from dataclasses import dataclass
from .agents.registry import IntentName
from typing import Literal
from pydantic import BaseModel
from .agents.embedder import EmbeddingIntentClassifier
from .agents.registry import AgentRegistry
from .streaming import emit_progress
from .agents.embedding_data import (
    INTENT_ADD,
    INTENT_DOCS,
    INTENT_LIST,
    INTENT_OOS,
)


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
    profile: object = None
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
            return (
                "I can help with three things: answering questions about TethysDash "
                "from the documentation, adding a visualization to your dashboard, or "
                "listing the available plugins. Try one of those."
            )

        # Owner gate: refuse the add intent upfront for non-owners, before
        # spending an LLM call. The tool enforces this again at the DB
        # layer (defense in depth).
        if (
            prediction.intent == INTENT_ADD
            and not self.deps.can_add_visualizations
        ):
            return (
                "Only the dashboard owner can add visualizations to this "
                "dashboard. I can still answer documentation questions or "
                "list the available plugins."
            )

        elif prediction.intent == INTENT_LIST:
            # Lazy import: plugins_tools imports ChatDeps from this module,
            # so a top-level import here would be a circular dependency.
            from .tools.plugins_tools import format_catalog_for_llm

            emit_progress(self.deps.chat_id, "Fetching available plugins...")
            return format_catalog_for_llm()
        else:
            selected_intent = prediction.intent  # type: ignore[assignment]
            public_intent = selected_intent

        selected_agent = self.agents.get(selected_intent)
        result = await selected_agent.run(request, deps=self.deps)
        response_text = result.output

        if selected_intent == INTENT_DOCS:
            from .docs import retrieve_context

            _, sources = retrieve_context(request)
            if sources:
                links = " · ".join(
                    f"[{s['title']}]({s['url']})" for s in sources
                )
                response_text = f"{response_text}\n\n**Sources:** {links}"

        return RoutedResponse(
            intent=public_intent,
            similarity=prediction.score,
            margin=prediction.margin,
            response=response_text,
        )

    