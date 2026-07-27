"""Owner-only gating for adding visualizations.

Two layers, both tested:
1. Router gate - LLMRouter.route refuses the add intent for non-owners
   before running the specialist agent.
2. Enforcement - the tool itself refuses when ChatDeps says the
   requester is not the owner (defense in depth at the DB layer).
"""
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from asgiref.sync import async_to_sync

from tethysapp.tethysdash.chatbot.agents.embedder import IntentPrediction
from tethysapp.tethysdash.chatbot.agents.embedding_data import INTENT_ADD
from tethysapp.tethysdash.chatbot.tools import add_visualizations_from_plugin
from tethysapp.tethysdash.chatbot.models import (
    ChatDeps,
    LLMRouter,
    PluginRequest,
    RoutedResponse,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB access is mocked here."""
    yield


def _deps(owner: bool) -> ChatDeps:
    return ChatDeps(
        user=MagicMock(), dashboard_id=6, can_add_visualizations=owner
    )


class _FixedClassifier:
    """Classifier stub that always predicts the add intent."""

    def classify(self, _text):
        return IntentPrediction(
            intent=INTENT_ADD,
            score=0.9,
            second_best_score=0.1,
            margin=0.8,
            accepted=True,
        )


class _FallbackClassifier:
    """Classifier stub that finds no confident intent."""

    def classify(self, _text):
        return IntentPrediction(
            intent=None,
            score=0.1,
            second_best_score=0.05,
            margin=0.05,
            accepted=False,
        )


# --------------------------------------------------------------------------
# Router-level gate
# --------------------------------------------------------------------------

def test_route_refuses_add_for_non_owner_without_running_agent():
    registry = MagicMock()
    router = LLMRouter(_FixedClassifier(), registry, _deps(owner=False))
    reply = async_to_sync(router.route)("add a plugin")
    assert isinstance(reply, str) and "owner" in reply.lower()
    registry.get.assert_not_called()


def test_route_runs_agent_for_owner():
    agent = MagicMock()
    agent.run = AsyncMock(return_value=SimpleNamespace(output="Added."))
    registry = MagicMock()
    registry.get.return_value = agent

    router = LLMRouter(_FixedClassifier(), registry, _deps(owner=True))
    result = async_to_sync(router.route)("add a plugin")

    registry.get.assert_called_once_with(INTENT_ADD)
    assert isinstance(result, RoutedResponse)
    assert result.response == "Added."


def test_route_runs_chat_agent_when_no_confident_intent():
    chat_agent = MagicMock()
    chat_agent.run = AsyncMock(
        return_value=SimpleNamespace(output="Here is some help.")
    )
    registry = MagicMock()
    registry.chat_agent = chat_agent

    router = LLMRouter(_FallbackClassifier(), registry, _deps(owner=True))
    result = async_to_sync(router.route)("how does tethysdash work?")

    chat_agent.run.assert_awaited_once()
    registry.get.assert_not_called()
    assert isinstance(result, RoutedResponse)
    assert result.intent == "fallback"
    assert result.response == "Here is some help."


# --------------------------------------------------------------------------
# Tool-level enforcement (defense in depth)
# --------------------------------------------------------------------------

def test_tool_refuses_non_owner_even_if_router_bypassed():
    ctx = SimpleNamespace(deps=_deps(owner=False))
    with patch(
        "tethysapp.tethysdash.chatbot.tools.plugins.update_named_dashboard"
    ) as update:
        reply = add_visualizations_from_plugin(
            ctx, [PluginRequest(source="anything", args={"river_id": "1"})]
        )
    assert "owner" in reply.lower()
    update.assert_not_called()


def test_tool_allows_owner():
    ctx = SimpleNamespace(deps=_deps(owner=True))
    plugin_cls = MagicMock()
    plugin_cls.visualization_type = "plotly"
    plugin_cls.visualization_args = {"river_id": "text"}
    plugin_cls.visualization_description = "d"
    with patch("intake.source.registry", {"p": plugin_cls}), \
         patch(
            "tethysapp.tethysdash.chatbot.tools.plugins.get_dashboards",
            return_value={"tabs": [{"gridItems": []}]},
         ), \
         patch(
            "tethysapp.tethysdash.chatbot.tools.plugins.update_named_dashboard"
         ) as update:
        reply = add_visualizations_from_plugin(
            ctx, [PluginRequest(source="p", args={"river_id": "1"})]
        )
    assert "Added" in reply
    update.assert_called_once()
