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

from tethysapp.tethysdash.chatbot.agents.registry import INTENT_ADD, INTENT_PATCH
from tethysapp.tethysdash.chatbot.tools import add_visualizations_from_plugin
from tethysapp.tethysdash.chatbot.models import (
    ChatDeps,
    PluginRequest,
    RoutedResponse,
)
from tethysapp.tethysdash.chatbot.routing import LLMRouter


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB access is mocked here."""
    yield


def _deps(owner: bool) -> ChatDeps:
    return ChatDeps(
        user=MagicMock(), dashboard_id=6, can_add_visualizations=owner
    )


def _registry_routing_to(intent: str) -> MagicMock:
    """Registry stub whose router agent classifies every message to `intent`."""
    registry = MagicMock()
    registry.router_agent.run = AsyncMock(
        return_value=SimpleNamespace(output=SimpleNamespace(intent=intent))
    )
    return registry


class _FakeStreamResult:
    """Stand-in for a pydantic-ai StreamedRunResult yielding one text delta."""

    def __init__(self, text):
        self._text = text

    async def stream_text(self, delta=True):
        yield self._text


class _FakeRunStream:
    """Async context manager returned by a stubbed ``agent.run_stream``."""

    def __init__(self, text):
        self._text = text

    async def __aenter__(self):
        return _FakeStreamResult(self._text)

    async def __aexit__(self, *exc):
        return False


def _streaming_chat_agent(text):
    """Chat-agent stub whose run_stream streams `text` as a single delta."""
    agent = MagicMock()
    agent.run_stream = MagicMock(return_value=_FakeRunStream(text))
    return agent


# --------------------------------------------------------------------------
# Router-level gate
# --------------------------------------------------------------------------

def test_route_refuses_add_for_non_owner_without_running_agent():
    registry = _registry_routing_to(INTENT_ADD)
    router = LLMRouter(registry, _deps(owner=False))
    reply = async_to_sync(router.route)("add a plugin")
    assert isinstance(reply, str) and "owner" in reply.lower()
    registry.get.assert_not_called()


def test_route_runs_agent_for_owner():
    agent = MagicMock()
    agent.run = AsyncMock(return_value=SimpleNamespace(output="Added."))
    registry = _registry_routing_to(INTENT_ADD)
    registry.get.return_value = agent

    router = LLMRouter(registry, _deps(owner=True))
    result = async_to_sync(router.route)("add a plugin")

    registry.get.assert_called_once_with(INTENT_ADD)
    assert isinstance(result, RoutedResponse)
    assert result.response == "Added."


def test_route_refuses_patch_for_non_owner_without_running_agent():
    registry = _registry_routing_to(INTENT_PATCH)
    router = LLMRouter(registry, _deps(owner=False))
    reply = async_to_sync(router.route)("change arg a to 9")
    assert isinstance(reply, str) and "owner" in reply.lower()
    registry.get.assert_not_called()


def test_route_returns_graceful_message_when_agent_exhausts_retries():
    from pydantic_ai.exceptions import UnexpectedModelBehavior

    agent = MagicMock()
    agent.run = AsyncMock(side_effect=UnexpectedModelBehavior("Exceeded maximum output retries (3)"))
    registry = _registry_routing_to(INTENT_ADD)
    registry.get.return_value = agent

    router = LLMRouter(registry, _deps(owner=True))
    result = async_to_sync(router.route)("add something")

    assert isinstance(result, RoutedResponse)
    assert "couldn't complete" in result.response.lower()
    assert "rephrase" in result.response.lower()


def test_route_surfaces_tool_retry_detail_when_agent_exhausts_retries():
    """An exhausted specialist surfaces its last actionable tool-retry message,
    not the generic fallback, so the user sees why the action failed."""
    from pydantic_ai import Agent, ModelRetry
    from pydantic_ai.models.test import TestModel

    def reject(name: str) -> str:
        """Output function that always rejects with an actionable message."""
        raise ModelRetry(
            "No visualization named 'ideadm_observed'. The dashboard has: "
            "`geoglows_forecast_viewer`"
        )

    agent = Agent(TestModel(), output_type=reject, retries=1)
    registry = _registry_routing_to(INTENT_ADD)
    registry.get.return_value = agent

    router = LLMRouter(registry, _deps(owner=True))
    result = async_to_sync(router.route)("add ideadm_observed")

    assert isinstance(result, RoutedResponse)
    assert "No visualization named 'ideadm_observed'" in result.response
    assert "geoglows_forecast_viewer" in result.response


def test_route_falls_back_to_chat_when_router_errors():
    from pydantic_ai.exceptions import UnexpectedModelBehavior

    chat_agent = _streaming_chat_agent("Here is some help.")
    registry = MagicMock()
    registry.router_agent.run = AsyncMock(
        side_effect=UnexpectedModelBehavior("Exceeded maximum output retries (3)")
    )
    registry.chat_agent = chat_agent

    router = LLMRouter(registry, _deps(owner=True))
    result = async_to_sync(router.route)("how does tethysdash work?")

    chat_agent.run_stream.assert_called_once()
    registry.get.assert_not_called()
    assert isinstance(result, RoutedResponse)
    assert result.intent == "fallback"
    assert result.response == "Here is some help."


def test_route_runs_chat_agent_when_router_picks_chat():
    chat_agent = _streaming_chat_agent("Here is some help.")
    registry = _registry_routing_to("chat")
    registry.chat_agent = chat_agent

    router = LLMRouter(registry, _deps(owner=True))
    result = async_to_sync(router.route)("how does tethysdash work?")

    chat_agent.run_stream.assert_called_once()
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
        "tethysapp.tethysdash.chatbot.tools.dashboard.update_named_dashboard"
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
            "tethysapp.tethysdash.chatbot.tools.dashboard.get_dashboards",
            return_value={"tabs": [{"gridItems": []}]},
         ), \
         patch(
            "tethysapp.tethysdash.chatbot.tools.dashboard.update_named_dashboard"
         ) as update:
        reply = add_visualizations_from_plugin(
            ctx, [PluginRequest(source="p", args={"river_id": "1"})]
        )
    assert "Added" in reply
    update.assert_called_once()
