"""Tests for chatbot/disambiguation.py - pending record store + resolver."""
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache

from tethysapp.tethysdash.chatbot.disambiguation import (
    PendingDisambiguation,
    _classify,
    clear_pending,
    get_pending,
    resolve_pending,
    set_pending,
)
from tethysapp.tethysdash.chatbot.models import ChatDeps
from tethysapp.tethysdash.chatbot.tools.dashboard import list_tiles
from tethysapp.tethysdash.chatbot.tools.patch import (
    _filter_by_where,
    _matching_tiles,
    candidate_signature,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture; isolate the cache between tests."""
    cache.clear()
    yield
    cache.clear()


def _deps(dashboard_id=6, owner=True):
    return ChatDeps(
        user=MagicMock(),
        dashboard_id=dashboard_id,
        chat_id="",
        can_add_visualizations=owner,
    )


def _tile(source, args):
    return {"uuid": "u", "i": "i", "source": source, "args_string": json.dumps(args)}


def _dash(*tiles):
    return {"tabs": [{"gridItems": list(tiles)}]}


def _fake_plugin(args=("river_id",)):
    return SimpleNamespace(
        visualization_type="plotly",
        visualization_args={a: "text" for a in args},
        visualization_description="d",
    )


_REGISTRY = "intake.source.registry"
_GET = "tethysapp.tethysdash.chatbot.tools.dashboard.get_dashboards"
_UPDATE = "tethysapp.tethysdash.chatbot.tools.dashboard.update_named_dashboard"


def _seed_record(deps, dash, source, args, where=None):
    """Store a pending record whose signature matches `dash` (no drift)."""
    matches = _matching_tiles(list_tiles(list(dash["tabs"])), source)
    if where:
        matches = _filter_by_where(matches, where)
    candidates, version = candidate_signature(matches)
    set_pending(
        deps.dashboard_id,
        deps.user,
        PendingDisambiguation(source, args, candidates, version, where or {}),
    )


# --------------------------------------------------------------------------
# Unit 3 - store
# --------------------------------------------------------------------------

def test_store_set_get_clear_roundtrip():
    d = _deps()
    set_pending(d.dashboard_id, d.user, PendingDisambiguation("p", {"river_id": "9"}, [[0, 0]], "v"))
    got = get_pending(d.dashboard_id, d.user)
    assert got.source == "p" and got.args == {"river_id": "9"}
    clear_pending(d.dashboard_id, d.user)
    assert get_pending(d.dashboard_id, d.user) is None


def test_get_with_no_record_is_none():
    assert get_pending(_deps().dashboard_id, _deps().user) is None


# --------------------------------------------------------------------------
# _classify - whole-message selection detection
# --------------------------------------------------------------------------

@pytest.mark.parametrize(
    "message,expected",
    [
        ("2", ("number", 2)),
        ("#3", ("number", 3)),
        ("number 1", ("number", 1)),
        ("2.", ("number", 2)),
        ("all", ("all", None)),
        ("all of them", ("all", None)),
        ("cancel", ("cancel", None)),
        ("never mind", ("cancel", None)),
        ("change all the rivers to 5", (None, None)),
        ("add 3 tiles", (None, None)),
        ("the second one", (None, None)),
        ("", (None, None)),
    ],
)
def test_classify(message, expected):
    assert _classify(message) == expected


# --------------------------------------------------------------------------
# Unit 5 - resolver
# --------------------------------------------------------------------------

def test_number_picks_nth_and_applies():
    d = _deps()
    dash = _dash(
        _tile("geoglows_forecast_viewer", {"river_id": "111"}),
        _tile("geoglows_forecast_viewer", {"river_id": "333"}),
    )
    _seed_record(d, dash, "geoglows_forecast_viewer", {"river_id": "999"})
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin()}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = resolve_pending(d, "2")
    _user, _id, payload = update.call_args[0]
    saved = [json.loads(g["args_string"]) for g in payload["tabs"][0]["gridItems"]]
    assert saved[1] == {"river_id": "999"} and saved[0] == {"river_id": "111"}
    assert "#2" in reply
    assert get_pending(d.dashboard_id, d.user) is None


def test_number_resolves_identical_tiles():
    d = _deps()
    dash = _dash(*[_tile("geoglows_forecast_viewer", {"river_id": "441057380"}) for _ in range(3)])
    _seed_record(d, dash, "geoglows_forecast_viewer", {"river_id": "999"})
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin()}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = resolve_pending(d, "3")
    _user, _id, payload = update.call_args[0]
    saved = [json.loads(g["args_string"]) for g in payload["tabs"][0]["gridItems"]]
    assert saved[2] == {"river_id": "999"} and saved[0] == {"river_id": "441057380"}
    assert "#3" in reply


def test_all_updates_every_candidate():
    d = _deps()
    dash = _dash(
        _tile("geoglows_forecast_viewer", {"river_id": "111"}),
        _tile("geoglows_forecast_viewer", {"river_id": "333"}),
    )
    _seed_record(d, dash, "geoglows_forecast_viewer", {"river_id": "999"})
    with (
        patch(_REGISTRY, {"geoglows_forecast_viewer": _fake_plugin()}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = resolve_pending(d, "all")
    _user, _id, payload = update.call_args[0]
    saved = [json.loads(g["args_string"]) for g in payload["tabs"][0]["gridItems"]]
    assert saved == [{"river_id": "999"}, {"river_id": "999"}]
    assert "all 2" in reply.lower()
    assert get_pending(d.dashboard_id, d.user) is None


def test_cancel_clears_and_writes_nothing():
    d = _deps()
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"river_id": "999"})
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        reply = resolve_pending(d, "cancel")
    assert "didn't change" in reply.lower()
    update.assert_not_called()
    assert get_pending(d.dashboard_id, d.user) is None


def test_out_of_range_number_reasks_and_keeps_record():
    d = _deps()
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"river_id": "999"})
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        reply = resolve_pending(d, "9")
    assert "not 1-2" in reply.lower()
    update.assert_not_called()
    assert get_pending(d.dashboard_id, d.user) is not None


def test_non_selection_falls_through_and_keeps_record():
    d = _deps()
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"river_id": "999"})
    assert resolve_pending(d, "change all the rivers to 5") is None
    assert get_pending(d.dashboard_id, d.user) is not None


def test_no_record_returns_none():
    assert resolve_pending(_deps(), "2") is None


def test_dashboard_drift_reasks_and_refreshes_record():
    d = _deps()
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"river_id": "999"})
    changed = _dash(
        _tile("p", {"river_id": "111"}),
        _tile("p", {"river_id": "333"}),
        _tile("p", {"river_id": "555"}),
    )
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=changed),
        patch(_UPDATE) as update,
    ):
        reply = resolve_pending(d, "2")
    assert "changed" in reply.lower()
    update.assert_not_called()
    assert get_pending(d.dashboard_id, d.user) is not None


def test_deleted_tiles_reports_gone_and_clears():
    d = _deps()
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"river_id": "999"})
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=_dash()),
        patch(_UPDATE) as update,
    ):
        reply = resolve_pending(d, "2")
    assert "no longer exist" in reply.lower()
    update.assert_not_called()
    assert get_pending(d.dashboard_id, d.user) is None


def test_non_owner_refused_no_write():
    d = _deps(owner=False)
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"river_id": "999"})
    with patch(_GET, return_value=dash), patch(_UPDATE) as update:
        reply = resolve_pending(d, "2")
    assert "owner" in reply.lower()
    update.assert_not_called()


def test_invalid_pending_args_fail_closed():
    d = _deps()
    dash = _dash(_tile("p", {"river_id": "111"}), _tile("p", {"river_id": "333"}))
    _seed_record(d, dash, "p", {"bogus": "x"})
    with (
        patch(_REGISTRY, {"p": _fake_plugin(args=("river_id",))}),
        patch(_GET, return_value=dash),
        patch(_UPDATE) as update,
    ):
        reply = resolve_pending(d, "2")
    assert "bogus" in reply
    update.assert_not_called()
