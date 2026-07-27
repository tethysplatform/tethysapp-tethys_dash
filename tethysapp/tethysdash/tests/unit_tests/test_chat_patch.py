"""Tests for chatbot/tools/patch.py - patch_visualization + dashboard state."""
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import ModelRetry

from tethysapp.tethysdash.chatbot.models import ChatDeps
from tethysapp.tethysdash.chatbot.tools.patch import (
    ask_which_visualization,
    format_dashboard_state_for_llm,
    patch_visualization,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB helpers are mocked here."""
    yield


def _ctx(dashboard_id=6, owner=True):
    """Build a RunContext-like stub with ChatDeps."""
    return SimpleNamespace(
        deps=ChatDeps(
            user=MagicMock(),
            dashboard_id=dashboard_id,
            chat_id="",
            can_add_visualizations=owner,
        ),
        retry=0,
        max_retries=3,
    )


def _tile(source, args):
    """Build a stored grid-item tile with a JSON args_string."""
    return {"uuid": "u", "i": "i1", "source": source, "args_string": json.dumps(args)}


def _dashboard(*tiles):
    """Wrap tiles in a single-tab dashboard."""
    return {"tabs": [{"gridItems": list(tiles)}]}


def _fake_plugin(args=("river_id",)):
    """Build a stub visualization plugin exposing the visualization_* attributes."""
    return SimpleNamespace(
        visualization_type="plotly",
        visualization_args={a: "text" for a in args},
        visualization_description="d",
    )


_REGISTRY = "intake.source.registry"
_GET = "tethysapp.tethysdash.chatbot.tools.dashboard.get_dashboards"
_UPDATE = "tethysapp.tethysdash.chatbot.tools.dashboard.update_named_dashboard"


def test_refuses_non_owner():
    with patch(_UPDATE) as update:
        reply = patch_visualization(_ctx(owner=False), target=1, args={"a": 9})
    assert "owner" in reply.lower()
    update.assert_not_called()


def test_empty_dashboard_reports_nothing_to_change():
    with patch(_GET, return_value={"tabs": []}), patch(_UPDATE) as update:
        reply = patch_visualization(_ctx(), target=1, args={"a": 9})
    assert "no visualizations" in reply.lower()
    update.assert_not_called()


def test_out_of_range_target_raises_model_retry():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        with pytest.raises(ModelRetry, match="between 1 and 1"):
            patch_visualization(_ctx(), target=2, args={"river_id": 9})
    update.assert_not_called()


def test_empty_args_raises_model_retry():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        with pytest.raises(ModelRetry, match="args"):
            patch_visualization(_ctx(), target=1, args={})
    update.assert_not_called()


def test_invalid_arg_name_reply_lists_valid_args():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(args=("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(_ctx(), target=1, args={"bogus": 1})
    assert "bogus" in reply and "river_id" in reply
    update.assert_not_called()


def test_corrupted_arg_names_ask_for_clean_restatement():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(args=("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            _ctx(),
            target=1,
            args={"river_id':640255643'}}}": 1, "-1344891178": 2},
        )
    assert "couldn't read" in reply.lower()
    assert "river_id" in reply
    assert "}}}" not in reply
    update.assert_not_called()


def test_happy_path_merges_and_persists():
    dash = _dashboard(_tile("geoglows", {"river_id": 8, "keep": "x"}))
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(args=("river_id", "keep"))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(_ctx(dashboard_id=4), target=1, args={"river_id": 9})
    update.assert_called_once()
    _user, dash_id, payload = update.call_args[0]
    assert dash_id == 4
    saved = json.loads(payload["tabs"][0]["gridItems"][0]["args_string"])
    assert saved == {"river_id": 9, "keep": "x"}
    assert "geoglows" in reply and "river_id=9" in reply


def test_index_targets_correct_tile_across_tabs():
    dash = {
        "tabs": [
            {"gridItems": [_tile("a", {"x": 1})]},
            {"gridItems": [_tile("b", {"y": 2})]},
        ]
    }
    with (
        patch(_REGISTRY, {"b": _fake_plugin(args=("y",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        patch_visualization(_ctx(), target=2, args={"y": 5})
    _user, _id, payload = update.call_args[0]
    assert json.loads(payload["tabs"][1]["gridItems"][0]["args_string"]) == {"y": 5}
    assert json.loads(payload["tabs"][0]["gridItems"][0]["args_string"]) == {"x": 1}


def test_dashboard_state_is_numbered():
    dash = _dashboard(_tile("a", {"x": 1}), _tile("b", {}))
    with patch(_GET, return_value=dash):
        state = format_dashboard_state_for_llm(MagicMock(), 6)
    assert state.startswith("1. a")
    assert "2. b" in state
    assert "(none)" in state


def test_dashboard_state_empty():
    with patch(_GET, return_value={"tabs": []}):
        state = format_dashboard_state_for_llm(MagicMock(), 6)
    assert "no visualizations" in state.lower()


def test_ask_which_visualization_echoes_numbered_candidates():
    dash = _dashboard(
        _tile("geoglows", {"river_id": 8}),
        _tile("geoglows", {"river_id": 15}),
    )
    with patch(_GET, return_value=dash):
        reply = ask_which_visualization(
            _ctx(), candidates=[1, 2], reason="There are two geoglows tiles."
        )
    assert "1 or 2" in reply
    assert "river_id=8" in reply and "river_id=15" in reply
    assert "which one" in reply.lower()


def test_ask_which_visualization_needs_two_valid_candidates():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with patch(_GET, return_value=dash):
        with pytest.raises(ModelRetry, match="at least two"):
            ask_which_visualization(_ctx(), candidates=[1], reason="ambiguous")
        with pytest.raises(ModelRetry, match="at least two"):
            ask_which_visualization(_ctx(), candidates=[5, 6], reason="ambiguous")
