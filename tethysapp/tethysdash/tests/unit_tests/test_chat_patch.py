"""Tests for chatbot/tools/patch.py - source-targeted patch + dashboard state."""
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import ModelRetry

from tethysapp.tethysdash.chatbot.models import ChatDeps
from tethysapp.tethysdash.chatbot.tools.patch import (
    format_dashboard_state_for_llm,
    patch_visualization,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB helpers are mocked here."""
    from django.core.cache import cache

    cache.clear()  # isolate the pending-disambiguation record between tests
    yield
    cache.clear()


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
        reply = patch_visualization(_ctx(owner=False), source="geoglows", args={"a": 9})
    assert "owner" in reply.lower()
    update.assert_not_called()


def test_empty_dashboard_reports_nothing_to_change():
    with patch(_GET, return_value={"tabs": []}), patch(_UPDATE) as update:
        reply = patch_visualization(_ctx(), source="geoglows", args={"a": 9})
    assert "no visualizations" in reply.lower()
    update.assert_not_called()


def test_unknown_source_raises_model_retry_listing_available():
    dash = _dashboard(_tile("geoglows_forecast_viewer", {"river_id": 8}))
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        with pytest.raises(ModelRetry, match="No visualization named"):
            patch_visualization(_ctx(), source="nonexistent", args={"river_id": 9})
    update.assert_not_called()


def test_empty_args_raises_model_retry():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        with pytest.raises(ModelRetry, match="args"):
            patch_visualization(_ctx(), source="geoglows", args={})
    update.assert_not_called()


def test_single_source_match_patches_by_fuzzy_name():
    dash = _dashboard(_tile("geoglows_forecast_viewer", {"river_id": 8, "keep": "x"}))
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin(("river_id", "keep"))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            _ctx(dashboard_id=4), source="forecast viewer", args={"river_id": 9}
        )
    update.assert_called_once()
    _user, dash_id, payload = update.call_args[0]
    assert dash_id == 4
    saved = json.loads(payload["tabs"][0]["gridItems"][0]["args_string"])
    assert saved == {"river_id": 9, "keep": "x"}
    assert "geoglows_forecast_viewer" in reply and "river_id=9" in reply


def test_source_match_targets_correct_tile_across_tabs():
    dash = {
        "tabs": [
            {"gridItems": [_tile("a_plugin", {"x": 1})]},
            {"gridItems": [_tile("b_plugin", {"y": 2})]},
        ]
    }
    with (
        patch(_REGISTRY, {"b_plugin": _fake_plugin(("y",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        patch_visualization(_ctx(), source="b_plugin", args={"y": 5})
    _user, _id, payload = update.call_args[0]
    assert json.loads(payload["tabs"][1]["gridItems"][0]["args_string"]) == {"y": 5}
    assert json.loads(payload["tabs"][0]["gridItems"][0]["args_string"]) == {"x": 1}


def test_multiple_same_source_asks_with_numbered_list():
    from tethysapp.tethysdash.chatbot.disambiguation import get_pending

    dash = _dashboard(
        _tile("geoglows_forecast_viewer", {"river_id": "111"}),
        _tile("geoglows_forecast_viewer", {"river_id": "333"}),
    )
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        ctx = _ctx()
        reply = patch_visualization(
            ctx, source="geoglows_forecast_viewer", args={"river_id": "999"}
        )
    assert "which one" in reply.lower() and "number" in reply.lower()
    assert "1. geoglows_forecast_viewer" in reply and "2. geoglows_forecast_viewer" in reply
    assert "river_id='111'" in reply and "river_id='333'" in reply
    update.assert_not_called()
    record = get_pending(ctx.deps.dashboard_id, ctx.deps.user)
    assert record is not None
    assert record.args == {"river_id": "999"} and len(record.candidates) == 2


def test_where_selects_one_among_same_source():
    dash = _dashboard(
        _tile("geoglows_forecast_viewer", {"river_id": "111"}),
        _tile("geoglows_forecast_viewer", {"river_id": "333"}),
    )
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            _ctx(),
            source="geoglows_forecast_viewer",
            args={"river_id": 999},
            where={"river_id": "333"},
        )
    _user, _id, payload = update.call_args[0]
    saved = [json.loads(g["args_string"]) for g in payload["tabs"][0]["gridItems"]]
    assert {"river_id": 999} in saved and {"river_id": "111"} in saved
    assert "Updated" in reply


def test_auto_selects_tile_whose_current_value_is_named_in_prompt():
    dash = _dashboard(
        _tile("geoglows_forecast_viewer", {"river_id": "111"}),
        _tile("geoglows_forecast_viewer", {"river_id": "333"}),
    )
    ctx = _ctx()
    ctx.deps.original_prompt = "change the forecast viewer for river 111 to 999"
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            ctx, source="geoglows_forecast_viewer", args={"river_id": 999}
        )
    _user, _id, payload = update.call_args[0]
    saved = [json.loads(g["args_string"]) for g in payload["tabs"][0]["gridItems"]]
    assert {"river_id": 999} in saved and {"river_id": "333"} in saved
    assert "Updated" in reply


def test_auto_select_ignores_new_value_that_collides_with_other_tiles():
    # New value 441057380 already exists on other tiles; selector is 710462910.
    dash = _dashboard(
        _tile("geoglows_forecast_viewer", {"river_id": "160064246"}),
        _tile("geoglows_forecast_viewer", {"river_id": "710462910"}),
        _tile("geoglows_forecast_viewer", {"river_id": "441057380"}),
        _tile("geoglows_forecast_viewer", {"river_id": "441057380"}),
    )
    ctx = _ctx()
    ctx.deps.original_prompt = (
        "change the geoglows_forecast_viewer with river_id 710462910 to 441057380"
    )
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            ctx, source="geoglows_forecast_viewer", args={"river_id": "441057380"}
        )
    _user, _id, payload = update.call_args[0]
    saved = [json.loads(g["args_string"]) for g in payload["tabs"][0]["gridItems"]]
    assert saved[1] == {"river_id": "441057380"}  # the 710462910 tile was updated
    assert saved[0] == {"river_id": "160064246"}  # others untouched
    assert "Updated" in reply


def test_auto_select_ignores_value_that_is_substring_of_new_value():
    # New value "3005" contains tile #1's current value "300"; that must NOT
    # count as a selector, so the request stays ambiguous instead of silently
    # patching the wrong tile.
    dash = _dashboard(
        _tile("gauge", {"threshold": "300"}),
        _tile("gauge", {"threshold": "999"}),
    )
    ctx = _ctx()
    ctx.deps.original_prompt = "change the gauge threshold to 3005"
    with (
        patch(_REGISTRY, {"gauge": _fake_plugin(("threshold",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(ctx, source="gauge", args={"threshold": "3005"})
    assert "which one" in reply.lower()
    update.assert_not_called()


def test_successful_patch_clears_matching_pending_record():
    from tethysapp.tethysdash.chatbot.disambiguation import (
        PendingDisambiguation,
        get_pending,
        set_pending,
    )

    dash = _dashboard(_tile("geoglows", {"river_id": "111"}))
    ctx = _ctx()
    set_pending(
        ctx.deps.dashboard_id,
        ctx.deps.user,
        PendingDisambiguation("geoglows", {"river_id": "1"}, [[0, 0]], "v"),
    )
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE),
    ):
        patch_visualization(ctx, source="geoglows", args={"river_id": "222"})
    assert get_pending(ctx.deps.dashboard_id, ctx.deps.user) is None


def test_successful_patch_keeps_unrelated_pending_record():
    from tethysapp.tethysdash.chatbot.disambiguation import (
        PendingDisambiguation,
        get_pending,
        set_pending,
    )

    dash = _dashboard(
        _tile("geoglows", {"river_id": "111"}),
        _tile("other_plugin", {"a": "9"}),
    )
    ctx = _ctx()
    set_pending(
        ctx.deps.dashboard_id,
        ctx.deps.user,
        PendingDisambiguation("other_plugin", {"a": "1"}, [[0, 1]], "v"),
    )
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE),
    ):
        patch_visualization(ctx, source="geoglows", args={"river_id": "222"})
    assert get_pending(ctx.deps.dashboard_id, ctx.deps.user) is not None


def test_where_matching_nothing_reports_and_lists_tiles():
    dash = _dashboard(
        _tile("geoglows_forecast_viewer", {"river_id": "111"}),
        _tile("geoglows_forecast_viewer", {"river_id": "333"}),
    )
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        reply = patch_visualization(
            _ctx(),
            source="geoglows_forecast_viewer",
            args={"river_id": 9},
            where={"river_id": "999"},
        )
    assert "matches" in reply.lower()
    assert "river_id='111'" in reply
    update.assert_not_called()


def test_invalid_arg_name_reply_lists_valid_args():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(_ctx(), source="geoglows", args={"bogus": 1})
    assert "bogus" in reply and "river_id" in reply
    update.assert_not_called()


def test_corrupted_arg_names_ask_for_clean_restatement():
    dash = _dashboard(_tile("geoglows", {"river_id": 8}))
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            _ctx(),
            source="geoglows",
            args={"river_id':640255643'}}}": 1, "-1344891178": 2},
        )
    assert "couldn't read" in reply.lower()
    assert "river_id" in reply
    assert "}}}" not in reply
    update.assert_not_called()


def test_noop_when_value_matches_current_is_flagged_not_updated():
    dash = _dashboard(_tile("geoglows", {"river_id": "610448527"}))
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = patch_visualization(
            _ctx(), source="geoglows", args={"river_id": "610448527"}
        )
    assert "already has" in reply.lower()
    assert "nothing changed" in reply.lower()
    update.assert_not_called()


def test_successful_patch_flags_dashboard_changed():
    """A patch that saves flags deps so the UI refetches; a no-op leaves it False."""
    dash = _dashboard(_tile("geoglows", {"river_id": "111"}))
    ctx = _ctx()
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE),
    ):
        patch_visualization(ctx, source="geoglows", args={"river_id": 999})
    assert ctx.deps.dashboard_changed is True


def test_noop_patch_leaves_dashboard_changed_false():
    dash = _dashboard(_tile("geoglows", {"river_id": "610448527"}))
    ctx = _ctx()
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE),
    ):
        patch_visualization(ctx, source="geoglows", args={"river_id": "610448527"})
    assert ctx.deps.dashboard_changed is False


def test_dashboard_state_lists_sources_without_index_numbers():
    dash = _dashboard(_tile("a_plugin", {"x": 1}), _tile("b_plugin", {}))
    with patch(_GET, return_value=dash):
        state = format_dashboard_state_for_llm(MagicMock(), 6)
    assert "a_plugin" in state and "b_plugin" in state
    assert "(none)" in state
    assert "1." not in state and "2." not in state


def test_dashboard_state_empty():
    with patch(_GET, return_value={"tabs": []}):
        state = format_dashboard_state_for_llm(MagicMock(), 6)
    assert "no visualizations" in state.lower()
