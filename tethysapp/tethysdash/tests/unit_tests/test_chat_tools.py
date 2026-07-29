"""Tests for chatbot/tools/plugins.py - add_visualizations_from_plugin."""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import ModelRetry

from tethysapp.tethysdash.chatbot.models import ChatDeps, PluginRequest
from tethysapp.tethysdash.chatbot.tools import add_visualizations_from_plugin


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB helpers are mocked here."""
    yield


def _ctx(dashboard_id=6, retry=0, max_retries=3):
    """Build a RunContext-like stub with ChatDeps and retry counters."""
    return SimpleNamespace(
        deps=ChatDeps(user=MagicMock(), dashboard_id=dashboard_id, chat_id=""),
        retry=retry,
        max_retries=max_retries,
    )


def _fake_plugin(args=("river_id",)):
    """Build a stub visualization plugin exposing the visualization_* attributes."""
    return SimpleNamespace(
        visualization_type="plotly",
        visualization_args={a: "text" for a in args},
        visualization_description="A test plugin.",
    )


def _reqs(*pairs):
    """Build a list of PluginRequest from (source, args) pairs."""
    return [PluginRequest(source=source, args=args) for source, args in pairs]


_REGISTRY = "intake.source.registry"
_GET = "tethysapp.tethysdash.chatbot.tools.dashboard.get_dashboards"
_UPDATE = "tethysapp.tethysdash.chatbot.tools.dashboard.update_named_dashboard"


def test_unknown_source_returns_did_you_mean_with_catalog():
    """An unresolvable identifier is reported (with the catalog) - not guessed."""
    with patch(_REGISTRY, {"known_plugin": _fake_plugin()}):
        reply = add_visualizations_from_plugin(_ctx(), _reqs(("made_up_plugin", {})))
    assert "made_up_plugin" in reply
    assert "known_plugin" in reply


def test_unknown_source_on_final_attempt_returns_message():
    with patch(_REGISTRY, {"known_plugin": _fake_plugin()}):
        reply = add_visualizations_from_plugin(
            _ctx(retry=3, max_retries=3), _reqs(("text/plain", {}))
        )
    assert "text/plain" in reply and "known_plugin" in reply
    assert "raise" not in reply.lower()


def test_empty_visualizations_raises_model_retry():
    with pytest.raises(ModelRetry, match="at least one"):
        add_visualizations_from_plugin(_ctx(), [])


def test_missing_arg_asks_immediately_naming_them():
    with (
        patch(_REGISTRY, {"p": _fake_plugin(args=("river_id", "station_id"))}),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(retry=0), _reqs(("p", {"river_id": "610217883"}))
        )
    assert "station_id" in reply and "need" in reply
    update.assert_not_called()


def test_blank_arg_values_count_as_missing():
    for blank in ["", "   ", {}, []]:
        with (
            patch(_REGISTRY, {"p": _fake_plugin(args=("station_id",))}),
            patch(_GET, return_value={"tabs": [{"gridItems": []}]}),
            patch(_UPDATE) as update,
        ):
            reply = add_visualizations_from_plugin(
                _ctx(retry=0), _reqs(("p", {"station_id": blank}))
            )
        assert "station_id" in reply and "need" in reply, f"blank={blank!r}"
        update.assert_not_called()


def test_dashboard_without_tabs_raises_model_retry():
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value={"tabs": []}),
        patch(_UPDATE) as update,
    ):
        with pytest.raises(ModelRetry, match="no tabs"):
            add_visualizations_from_plugin(_ctx(), _reqs(("p", {"river_id": "1"})))
    update.assert_not_called()


def test_happy_path_appends_tile_and_persists():
    dashboard = {"tabs": [{"gridItems": [{"i": "existing"}]}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(dashboard_id=42), _reqs(("p", {"river_id": "610217883"}))
        )
    assert "p" in reply and "42" in reply
    update.assert_called_once()
    _user, dashboard_id, payload = update.call_args[0]
    assert dashboard_id == 42
    items = payload["tabs"][0]["gridItems"]
    assert len(items) == 2, "existing tile must be preserved"
    tile = items[-1]
    assert tile["source"] == "p"
    assert '"river_id"' in tile["args_string"]
    assert tile["uuid"] and tile["i"]


def test_multiple_plugins_persist_in_one_write_with_own_args():
    dashboard = {"tabs": [{"gridItems": []}]}
    registry = {
        "a": _fake_plugin(args=("river_id",)),
        "b": _fake_plugin(args=("station_id",)),
    }
    with (
        patch(_REGISTRY, registry),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(dashboard_id=7),
            _reqs(("a", {"river_id": "1"}), ("b", {"station_id": "2"})),
        )
    update.assert_called_once()
    _user, _id, payload = update.call_args[0]
    items = payload["tabs"][0]["gridItems"]
    assert [t["source"] for t in items] == ["a", "b"]
    assert '"river_id"' in items[0]["args_string"]
    assert '"station_id"' in items[1]["args_string"]
    assert "'a'" in reply and "'b'" in reply


def test_one_unknown_source_blocks_all_before_persisting():
    with (
        patch(_REGISTRY, {"a": _fake_plugin(args=())}),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(retry=0), _reqs(("a", {}), ("nope", {}))
        )
    assert "nope" in reply
    update.assert_not_called()


def test_add_normalizes_int_arg_to_declared_text_type():
    import json

    dashboard = {"tabs": [{"gridItems": []}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        add_visualizations_from_plugin(_ctx(), _reqs(("p", {"river_id": 441057380})))
    _user, _id, payload = update.call_args[0]
    saved = json.loads(payload["tabs"][0]["gridItems"][-1]["args_string"])
    assert saved == {"river_id": "441057380"}


def test_number_arg_nan_string_not_coerced_to_invalid_json():
    import json

    dashboard = {"tabs": [{"gridItems": []}]}
    plug = SimpleNamespace(
        visualization_type="plotly",
        visualization_args={"threshold": "number"},
        visualization_description="d",
    )
    with (
        patch(_REGISTRY, {"p": plug}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        add_visualizations_from_plugin(_ctx(), _reqs(("p", {"threshold": "nan"})))
    args_string = update.call_args[0][2]["tabs"][0]["gridItems"][-1]["args_string"]
    assert "NaN" not in args_string  # bare NaN token would break the frontend JSON.parse
    assert json.loads(args_string) == {"threshold": "nan"}


def test_date_range_dict_value_passed_through_unchanged():
    import json

    dashboard = {"tabs": [{"gridItems": []}]}
    plug = SimpleNamespace(
        visualization_type="plotly",
        visualization_args={"range": "date-range"},
        visualization_description="d",
    )
    date_range = {"start": "2023-01-01", "end": "2023-02-01"}
    with (
        patch(_REGISTRY, {"p": plug}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        add_visualizations_from_plugin(_ctx(), _reqs(("p", {"range": date_range})))
    saved = json.loads(update.call_args[0][2]["tabs"][0]["gridItems"][-1]["args_string"])
    assert saved == {"range": date_range}


def test_dedupe_skips_identical_tile():
    existing = {"source": "p", "args_string": '{"river_id": "441057380"}'}
    dashboard = {"tabs": [{"gridItems": [existing]}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(), _reqs(("p", {"river_id": "441057380"}))
        )
    assert "already" in reply.lower()
    update.assert_not_called()


def test_dedupe_matches_across_int_and_str_via_normalization():
    existing = {"source": "p", "args_string": '{"river_id": 441057380}'}  # stored int
    dashboard = {"tabs": [{"gridItems": [existing]}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(), _reqs(("p", {"river_id": 441057380}))  # int input
        )
    assert "already" in reply.lower()
    update.assert_not_called()


def test_batch_duplicate_added_only_once():
    dashboard = {"tabs": [{"gridItems": []}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(), _reqs(("p", {"river_id": "1"}), ("p", {"river_id": "1"}))
        )
    _user, _id, payload = update.call_args[0]
    assert len(payload["tabs"][0]["gridItems"]) == 1
    assert "already" in reply.lower()


def test_new_value_not_treated_as_duplicate():
    existing = {"source": "p", "args_string": '{"river_id": "111"}'}
    dashboard = {"tabs": [{"gridItems": [existing]}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin()}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        add_visualizations_from_plugin(_ctx(), _reqs(("p", {"river_id": "222"})))
    _user, _id, payload = update.call_args[0]
    assert len(payload["tabs"][0]["gridItems"]) == 2


def test_no_arg_plugin_added_with_empty_args():
    dashboard = {"tabs": [{"gridItems": []}]}
    with (
        patch(_REGISTRY, {"p": _fake_plugin(args=())}),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(_ctx(), _reqs(("p", {})))
    assert "p" in reply
    update.assert_called_once()


def test_add_path_reads_dashboard_exactly_once():
    """The TOCTOU fix collapses dedupe + write into a single dashboard read.

    A regression to the old two-read pattern (a separate dedupe read plus an
    append read) would reopen the race, so pin the read count at one.
    """
    dash = {"tabs": [{"gridItems": []}]}
    with (
        patch(_REGISTRY, {"geoglows": _fake_plugin(("river_id",))}),
        patch(_GET, return_value=dash) as get,
        patch(_UPDATE),
    ):
        add_visualizations_from_plugin(_ctx(), _reqs(("geoglows", {"river_id": "1"})))
    assert get.call_count == 1


def _viz(label, args):
    """A stub plugin whose display label differs from its registry source."""
    return SimpleNamespace(
        visualization_type="plotly",
        visualization_args={a: "text" for a in args},
        visualization_description="d",
        visualization_label=label,
    )


def test_add_resolves_display_name_to_the_right_source():
    """A user naming the plugin by its display name adds the correct source."""
    import json

    dashboard = {"tabs": [{"gridItems": []}]}
    registry = {"nwmp_reaches_series": _viz("NWMP Reaches Time Series", ("reach_id",))}
    with (
        patch(_REGISTRY, registry),
        patch(_GET, return_value=dashboard),
        patch(_UPDATE) as update,
    ):
        add_visualizations_from_plugin(
            _ctx(), _reqs(("NWMP Reaches Time Series", {"reach_id": "8075804"}))
        )
    _user, _id, payload = update.call_args[0]
    tile = payload["tabs"][0]["gridItems"][-1]
    assert tile["source"] == "nwmp_reaches_series"
    assert json.loads(tile["args_string"]) == {"reach_id": "8075804"}


def test_add_offers_candidates_and_adds_nothing_when_ambiguous():
    registry = {
        "nwmp_reaches_v1": _viz("NWMP Reaches One", ("reach_id",)),
        "nwmp_reaches_v2": _viz("NWMP Reaches Two", ("reach_id",)),
    }
    with (
        patch(_REGISTRY, registry),
        patch(_GET, return_value={"tabs": [{"gridItems": []}]}),
        patch(_UPDATE) as update,
    ):
        reply = add_visualizations_from_plugin(
            _ctx(), _reqs(("NWMP Reaches", {"reach_id": "1"}))
        )
    assert "nwmp_reaches_v1" in reply and "nwmp_reaches_v2" in reply
    update.assert_not_called()
