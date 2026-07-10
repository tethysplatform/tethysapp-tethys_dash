"""Tests for chat/tools/plugins_tools.py - add_visualization_from_plugin.

Current-API replacement for the deleted tethys-agents-era
test_agent_tools.py: the tool now takes ``args: dict`` (not a JSON
string) and session context via ``ChatDeps`` (not a contextvar).
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from pydantic_ai import ModelRetry

from tethysapp.tethysdash.chatbot.tools import add_visualization_from_plugin
from tethysapp.tethysdash.chatbot.validation import ChatDeps


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB helpers are mocked here."""
    yield


def _ctx(dashboard_id=6):
    return SimpleNamespace(
        deps=ChatDeps(user=MagicMock(), dashboard_id=dashboard_id, chat_id="")
    )


def _fake_plugin(args=("river_id",)):
    cls = MagicMock()
    cls.visualization_type = "plotly"
    cls.visualization_args = {a: "text" for a in args}
    cls.visualization_description = "A test plugin."
    return cls


_REGISTRY = "intake.source.registry"
_GET = "tethysapp.tethysdash.chatbot.tools.plugins_tools.get_dashboards"
_UPDATE = "tethysapp.tethysdash.chatbot.tools.plugins_tools.update_named_dashboard"


def test_unknown_source_raises_model_retry_with_catalog():
    with patch(_REGISTRY, {"known_plugin": _fake_plugin()}):
        with pytest.raises(ModelRetry) as exc:
            add_visualization_from_plugin(_ctx(), source="made_up_plugin", args={})
    # the retry message must let the LLM self-correct: name the bad value
    # and list what IS available
    assert "made_up_plugin" in str(exc.value)
    assert "known_plugin" in str(exc.value)


def test_non_dict_args_raises_model_retry():
    with pytest.raises(ModelRetry, match="object"):
        add_visualization_from_plugin(_ctx(), source="x", args=["not", "a", "dict"])


def test_missing_required_args_raises_model_retry_naming_them():
    with patch(_REGISTRY, {"p": _fake_plugin(args=("river_id", "station_id"))}):
        with pytest.raises(ModelRetry) as exc:
            add_visualization_from_plugin(
                _ctx(), source="p", args={"river_id": "610217883"}
            )
    assert "station_id" in str(exc.value)


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
