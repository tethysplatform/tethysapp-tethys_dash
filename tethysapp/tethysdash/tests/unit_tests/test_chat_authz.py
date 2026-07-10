"""Owner-only gating for mutating chat actions.

Two layers, both tested:
1. UX steering - candidates_for drops owner-only candidates from the
   per-run output schema, so the model cannot select them.
2. Enforcement - the tool itself refuses when ChatDeps says the
   requester is not the owner (the schema is not a security boundary).
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from tethysapp.tethysdash.chatbot.agents.router import (
    OWNER_ONLY_CANDIDATE_NAMES,
    ROUTER_CANDIDATES,
    _CANDIDATE_DESCRIPTIONS,
    candidates_for,
)
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


def test_owner_sees_all_candidates():
    assert candidates_for(_deps(owner=True)) == ROUTER_CANDIDATES


def test_non_owner_loses_exactly_the_mutating_candidates():
    names = [c.__name__ for c in candidates_for(_deps(owner=False))]
    assert "add_visualization" not in names
    # nothing else is dropped
    expected = [
        c.__name__ for c in ROUTER_CANDIDATES
        if c.__name__ not in OWNER_ONLY_CANDIDATE_NAMES
    ]
    assert names == expected


def test_every_candidate_has_a_description():
    """The dynamic instruction enumerates candidates from
    _CANDIDATE_DESCRIPTIONS - a candidate without a description would
    KeyError at request time, and a described-but-removed candidate
    would desync prose from schema."""
    assert {c.__name__ for c in ROUTER_CANDIDATES} == set(
        _CANDIDATE_DESCRIPTIONS
    )


def test_tool_refuses_non_owner_even_if_schema_bypassed():
    ctx = SimpleNamespace(deps=_deps(owner=False))
    with patch(
        "tethysapp.tethysdash.chat.tools.plugins_tools.update_named_dashboard"
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
            "tethysapp.tethysdash.chat.tools.plugins_tools.get_dashboards",
            return_value={"tabs": [{"gridItems": []}]},
         ), \
         patch(
            "tethysapp.tethysdash.chat.tools.plugins_tools.update_named_dashboard"
         ) as update:
        reply = add_visualization_from_plugin(
            ctx, source="p", args={"river_id": "1"}
        )
    assert "Added" in reply
    update.assert_called_once()
