"""Owner-only gating for mutating chat actions.

Two layers, both tested:
1. Dispatch gate - run_intent refuses the add intent for non-owners
   without ever invoking the specialist LLM.
2. Enforcement - the tool itself refuses when ChatDeps says the
   requester is not the owner (defense in depth; the dispatch gate is
   not the only boundary).
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from asgiref.sync import async_to_sync

from tethysapp.tethysdash.chatbot.dispatch import run_intent
from tethysapp.tethysdash.chatbot.routing import INTENT_ADD, INTENT_LIST
from tethysapp.tethysdash.chatbot.tools import add_visualization_from_plugin
from tethysapp.tethysdash.chatbot.validation import ChatDeps


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB access is mocked here."""
    yield


def _deps(owner: bool) -> ChatDeps:
    return ChatDeps(
        user=MagicMock(), dashboard_id=6, can_add_visualizations=owner
    )


def test_dispatch_refuses_add_for_non_owner_without_running_specialist():
    with patch(
        "tethysapp.tethysdash.chatbot.dispatch.plugin_agent"
    ) as plugin_agent:
        reply = async_to_sync(run_intent)(INTENT_ADD, _deps(owner=False))
    assert "owner" in reply.lower()
    plugin_agent.run.assert_not_called()


def test_dispatch_allows_non_owner_to_list_plugins():
    with patch(
        "tethysapp.tethysdash.chatbot.dispatch.format_catalog_for_llm",
        return_value="catalog",
    ):
        reply = async_to_sync(run_intent)(INTENT_LIST, _deps(owner=False))
    assert reply == "catalog"


def test_tool_refuses_non_owner_even_if_dispatch_bypassed():
    ctx = SimpleNamespace(deps=_deps(owner=False))
    with patch(
        "tethysapp.tethysdash.chatbot.tools.plugins_tools.update_named_dashboard"
    ) as update:
        reply = add_visualization_from_plugin(
            ctx, source="anything", args={"river_id": "1"}
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
            "tethysapp.tethysdash.chatbot.tools.plugins_tools.get_dashboards",
            return_value={"tabs": [{"gridItems": []}]},
         ), \
         patch(
            "tethysapp.tethysdash.chatbot.tools.plugins_tools.update_named_dashboard"
         ) as update:
        reply = add_visualization_from_plugin(
            ctx, source="p", args={"river_id": "1"}
        )
    assert "Added" in reply
    update.assert_called_once()
