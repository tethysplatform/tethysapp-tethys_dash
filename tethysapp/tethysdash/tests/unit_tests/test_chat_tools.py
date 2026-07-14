"""Tests for chat/tools/plugins.py - add_visualization_from_plugin.

Current-API replacement for the deleted tethys-agents-era
test_agent_tools.py: the tool now takes ``args: dict`` (not a JSON
string) and session context via ``ChatDeps`` (not a contextvar).
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import ModelRetry

from tethysapp.tethysdash.chatbot.tools import add_visualization_from_plugin
from tethysapp.tethysdash.chatbot.models import ChatDeps


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB helpers are mocked here."""
    yield


def _ctx(dashboard_id=6, retry=0, max_retries=3):
    # retry/max_retries drive the missing-args behavior: raise ModelRetry
    # while retries remain, return an ask message once exhausted.
    return SimpleNamespace(
        deps=ChatDeps(user=MagicMock(), dashboard_id=dashboard_id, chat_id=""),
        retry=retry,
        max_retries=max_retries,
    )


def _fake_plugin(args=("river_id",)):
    cls = MagicMock()
    cls.visualization_type = "plotly"
    cls.visualization_args = {a: "text" for a in args}
    cls.visualization_description = "A test plugin."
    return cls


_REGISTRY = "intake.source.registry"
_GET = "tethysapp.tethysdash.chatbot.tools.plugins.get_dashboards"
_UPDATE = "tethysapp.tethysdash.chatbot.tools.plugins.update_named_dashboard"


def test_unknown_source_raises_model_retry_with_catalog():
    with patch(_REGISTRY, {"known_plugin": _fake_plugin()}):
        with pytest.raises(ModelRetry) as exc:
            add_visualization_from_plugin(_ctx(), source="made_up_plugin", args={})
    # the retry message must let the LLM self-correct: name the bad value
    # and list what IS available
    assert "made_up_plugin" in str(exc.value)
    assert "known_plugin" in str(exc.value)


def test_unknown_source_on_final_attempt_returns_message():
    # retries exhausted on a bad source -> graceful ask, not a raise that
    # would bubble up as "Exceeded maximum output retries" and a 503
    with patch(_REGISTRY, {"known_plugin": _fake_plugin()}):
        reply = add_visualization_from_plugin(
            _ctx(retry=3, max_retries=3), source="text/plain", args={}
        )
    assert "text/plain" in reply and "known_plugin" in reply
    assert "raise" not in reply.lower()  # it's a message, not an exception


def test_non_dict_args_raises_model_retry():
    with pytest.raises(ModelRetry, match="object"):
        add_visualization_from_plugin(_ctx(), source="x", args=["not", "a", "dict"])


def test_missing_arg_asks_immediately_naming_them():
    # missing arg -> ask the user right away (NOT ModelRetry, which would
    # pressure a weak model into fabricating a bogus value that then slips
    # through and creates a broken tile)
    with patch(_REGISTRY, {"p": _fake_plugin(args=("river_id", "station_id"))}), \
         patch(_UPDATE) as update:
        reply = add_visualization_from_plugin(
            _ctx(retry=0), source="p", args={"river_id": "610217883"}
        )
    assert "station_id" in reply and "needs" in reply
    update.assert_not_called()  # nothing persisted


def test_blank_arg_values_count_as_missing():
    # weak models include the required key with an empty placeholder
    # ("", whitespace, {}, []) instead of omitting it - still missing, so
    # ask rather than persist a tile that fails at render time
    for blank in ["", "   ", {}, []]:
        with patch(_REGISTRY, {"p": _fake_plugin(args=("station_id",))}), \
             patch(_GET, return_value={"tabs": [{"gridItems": []}]}), \
             patch(_UPDATE) as update:
            reply = add_visualization_from_plugin(
                _ctx(retry=0), source="p", args={"station_id": blank}
            )
        assert "station_id" in reply and "needs" in reply, f"blank={blank!r}"
        update.assert_not_called()


def test_dashboard_without_tabs_raises_model_retry():
    with patch(_REGISTRY, {"p": _fake_plugin()}), \
         patch(_GET, return_value={"tabs": []}), \
         patch(_UPDATE) as update:
        with pytest.raises(ModelRetry, match="no tabs"):
            add_visualization_from_plugin(
                _ctx(), source="p", args={"river_id": "1"}
            )
    update.assert_not_called()


def test_happy_path_appends_tile_and_persists():
    dashboard = {"tabs": [{"gridItems": [{"i": "existing"}]}]}
    with patch(_REGISTRY, {"p": _fake_plugin()}), \
         patch(_GET, return_value=dashboard), \
         patch(_UPDATE) as update:
        reply = add_visualization_from_plugin(
            _ctx(dashboard_id=42), source="p", args={"river_id": "610217883"}
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


def test_none_args_treated_as_empty_for_no_arg_plugins():
    dashboard = {"tabs": [{"gridItems": []}]}
    with patch(_REGISTRY, {"p": _fake_plugin(args=())}), \
         patch(_GET, return_value=dashboard), \
         patch(_UPDATE):
        reply = add_visualization_from_plugin(_ctx(), source="p", args=None)
    assert "p" in reply
