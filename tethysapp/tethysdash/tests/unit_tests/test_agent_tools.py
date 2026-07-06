"""Tests for the dashboard-manipulation tools used by the chat_agent endpoint.

These tools are discovered by tethys-agents via convention: any public,
type-annotated function in `tethysapp.tethysdash.tools` becomes a tool the
LLM can call. The two we ship are intentionally generic:

* ``add_visualization_from_plugin(source, args_json)`` — works against any
  intake-registered visualization plugin without per-plugin glue.
* ``list_available_plugins()`` — surfaces the catalog the LLM should pick
  ``source`` values from.

Both rely on a ``contextvars.ContextVar`` (``current_dashboard``) that the
chat_agent controller sets before invoking the agent. Tests cover the
happy path, the missing-context path, and the input-validation paths so
that the LLM gets a useful self-correction message rather than an opaque
500.
"""

import json
from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# add_visualization_from_plugin
# ---------------------------------------------------------------------------


def test_add_visualization_returns_no_dashboard_when_context_unset():
    """With no contextvar set the tool returns a self-correcting string."""
    from tethysapp.tethysdash.chat import (
        add_visualization_from_plugin,
        current_dashboard,
    )
    current_dashboard.set(None)
    result = add_visualization_from_plugin(
        source="geoglows_forecast_viewer",
        args_json='{"river_id": "610217883"}',
    )
    assert "No active dashboard" in result


def test_add_visualization_rejects_unknown_source():
    """Unknown plugin source returns the known-source list for self-correction."""
    from tethysapp.tethysdash.chat import (
        add_visualization_from_plugin,
        current_dashboard,
    )
    current_dashboard.set({"user": MagicMock(), "dashboard_id": 1})

    plugin_cls = MagicMock()
    plugin_cls.visualization_type = "plotly"
    registry = {"known_plugin": plugin_cls}

    with patch("intake.source.registry", registry):
        result = add_visualization_from_plugin(
            source="totally_made_up_plugin",
            args_json="{}",
        )

    assert "Unknown plugin" in result
    assert "known_plugin" in result


def test_add_visualization_rejects_invalid_json():
    """Malformed args_json returns a parseable error, never raises."""
    from tethysapp.tethysdash.chat import (
        add_visualization_from_plugin,
        current_dashboard,
    )
    current_dashboard.set({"user": MagicMock(), "dashboard_id": 1})

    plugin_cls = MagicMock()
    plugin_cls.visualization_type = "plotly"
    registry = {"geoglows_forecast_viewer": plugin_cls}

    with patch("intake.source.registry", registry):
        result = add_visualization_from_plugin(
            source="geoglows_forecast_viewer",
            args_json="not-json{",
        )

    assert "Invalid args_json" in result


def test_add_visualization_rejects_non_dict_json():
    """args_json that decodes to a list returns a clear type-mismatch message."""
    from tethysapp.tethysdash.chat import (
        add_visualization_from_plugin,
        current_dashboard,
    )
    current_dashboard.set({"user": MagicMock(), "dashboard_id": 1})

    plugin_cls = MagicMock()
    plugin_cls.visualization_type = "plotly"
    registry = {"geoglows_forecast_viewer": plugin_cls}

    with patch("intake.source.registry", registry):
        result = add_visualization_from_plugin(
            source="geoglows_forecast_viewer",
            args_json="[1, 2, 3]",
        )

    assert "must decode to a dict" in result


def test_add_visualization_appends_tile_to_first_tab_and_persists():
    """Happy path: appends the new grid item to the first tab's gridItems
    and sends the full ``tabs`` structure to update_named_dashboard.

    Why ``tabs`` (not top-level ``gridItems``): update_named_dashboard
    (model.py:801) only processes a known set of keys — ``name``,
    ``description``, ``notes``, ``public``, ``unrestrictedPlacement``,
    ``permissions``, ``tabs``, ``image``. A top-level ``gridItems`` is
    silently ignored, which would make the tool a no-op even though it
    returns success.
    """
    from tethysapp.tethysdash.chat import (
        add_visualization_from_plugin,
        current_dashboard,
    )

    user = MagicMock()
    dashboard_id = 42
    current_dashboard.set({"user": user, "dashboard_id": dashboard_id})

    plugin_cls = MagicMock()
    plugin_cls.visualization_type = "plotly"
    registry = {"geoglows_forecast_viewer": plugin_cls}

    existing_tab = {
        "id": 7,
        "name": "Default",
        "gridItems": [
            {
                "id": 100,
                "uuid": "existing-uuid",
                "i": "1",
                "source": "Text",
                "args_string": '{"text": "hi"}',
                "metadata_string": "{}",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 2,
            },
        ],
    }
    existing_dashboard = {
        "id": dashboard_id,
        "uuid": "dashboard-uuid",
        "tabs": [existing_tab],
    }

    with (
        patch("intake.source.registry", registry),
        patch(
            "tethysapp.tethysdash.tools.get_dashboards",
            return_value=existing_dashboard,
        ),
        patch(
            "tethysapp.tethysdash.tools.update_named_dashboard"
        ) as mock_update,
    ):
        result = add_visualization_from_plugin(
            source="geoglows_forecast_viewer",
            args_json='{"river_id": "610217883"}',
        )

    assert mock_update.called
    call_user, call_id, call_updates = mock_update.call_args[0]
    assert call_user is user
    assert call_id == dashboard_id

    # The update payload must carry the FULL tabs structure (not a
    # top-level gridItems), so update_named_dashboard's tabs branch fires.
    assert "tabs" in call_updates
    assert "gridItems" not in call_updates
    sent_tabs = call_updates["tabs"]
    assert len(sent_tabs) == 1
    sent_tab = sent_tabs[0]
    assert sent_tab["id"] == 7  # existing tab id preserved
    assert sent_tab["name"] == "Default"

    grid_items = sent_tab["gridItems"]
    assert len(grid_items) == 2  # existing + new

    new_tile = grid_items[-1]
    assert new_tile["source"] == "geoglows_forecast_viewer"
    assert json.loads(new_tile["args_string"]) == {"river_id": "610217883"}
    # All fields update_named_dashboard reads unconditionally must be present:
    for required in ("uuid", "i", "x", "y", "w", "h", "source",
                     "args_string", "metadata_string"):
        assert required in new_tile, f"new tile missing {required!r}"

    # Existing tile is preserved.
    existing = grid_items[0]
    assert existing["uuid"] == "existing-uuid"

    # Return message is informative for the LLM.
    assert "geoglows_forecast_viewer" in result
    assert "river_id" in result


def test_add_visualization_returns_error_when_dashboard_has_no_tabs():
    """If get_dashboards returns a dashboard with an empty tabs list, the
    tool returns a clear LLM-readable error rather than crashing on
    ``tabs[0]`` indexing."""
    from tethysapp.tethysdash.chat import (
        add_visualization_from_plugin,
        current_dashboard,
    )

    current_dashboard.set({"user": MagicMock(), "dashboard_id": 1})

    plugin_cls = MagicMock()
    plugin_cls.visualization_type = "plotly"
    registry = {"geoglows_forecast_viewer": plugin_cls}

    with (
        patch("intake.source.registry", registry),
        patch(
            "tethysapp.tethysdash.tools.get_dashboards",
            return_value={"id": 1, "tabs": []},
        ),
        patch("tethysapp.tethysdash.tools.update_named_dashboard") as mock_update,
    ):
        result = add_visualization_from_plugin(
            source="geoglows_forecast_viewer",
            args_json='{"river_id": "610217883"}',
        )

    assert "no tabs" in result.lower()
    assert not mock_update.called


# ---------------------------------------------------------------------------
# list_available_plugins
# ---------------------------------------------------------------------------


def test_list_available_plugins_skips_non_visualization_drivers():
    """Generic intake drivers (csv, json, parquet, …) are filtered out."""
    from tethysapp.tethysdash.chat import list_available_plugins

    csv_driver = MagicMock(spec=[])  # no visualization_type / type attrs
    viz_plugin = MagicMock()
    viz_plugin.visualization_type = "plotly"
    viz_plugin.visualization_args = {"river_id": "text"}
    viz_plugin.visualization_description = "GEOGloWS forecast viewer."

    registry = {
        "csv": csv_driver,
        "geoglows_forecast_viewer": viz_plugin,
    }

    with patch("intake.source.registry", registry):
        result = list_available_plugins()

    assert "geoglows_forecast_viewer" in result
    assert "river_id" in result
    assert "plotly" in result
    assert "GEOGloWS forecast viewer" in result
    assert "csv" not in result.split("\n")[0]


def test_list_available_plugins_empty_registry():
    """With nothing installed the tool returns a clear empty message."""
    from tethysapp.tethysdash.chat import list_available_plugins
    with patch("intake.source.registry", {}):
        result = list_available_plugins()
    assert "No visualization plugins" in result


def test_list_available_plugins_handles_legacy_attribute_names():
    """Plugins using short names (`type`, `args`, `description`) — per main's
    TethysDashPlugin base — surface the same way as legacy `visualization_*`
    aliases."""
    from tethysapp.tethysdash.chat import list_available_plugins

    plugin = MagicMock(spec=["type", "args", "description"])
    plugin.type = "map"
    plugin.args = {"region": "dropdown"}
    plugin.description = "RFC precipitation map."

    with patch("intake.source.registry", {"rfc_precip": plugin}):
        result = list_available_plugins()

    assert "rfc_precip" in result
    assert "map" in result
    assert "region" in result
