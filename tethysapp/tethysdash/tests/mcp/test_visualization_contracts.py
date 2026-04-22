"""Contract tests for MCP visualization-creating tools.

Validates that each tool's output matches the data contract rules documented
in docs/solutions/best-practices/mcp-visualization-inline-data-vs-top-level-args.

Layer 1 tests — no browser, no server, milliseconds per test.
"""

import uuid as uuid_mod
from unittest.mock import patch

import pytest

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
    create_plotly_chart,
    create_data_table,
    create_card,
    create_text,
    create_custom_image,
    create_map_visualization,
    render_plugin,
    render_custom_visualization,
)


# ---------------------------------------------------------------------------
# Assertion helpers — encode the 7 data contract rules
# ---------------------------------------------------------------------------

VALID_INLINE_SOURCES = {"Inline Plotly", "Inline Table", "Inline Card"}
VALID_FLAT_ARGS_SOURCES = {"Map", "Text", "Custom Image"}
VALID_VARIABLE_INPUT_SOURCE = "Variable Input"


def assert_server_uuid(viz):
    """R3a: every create tool returns a top-level uuid in the visualization object.

    The uuid must be a valid UUID string (not nested under args or inlineData).
    """
    assert "uuid" in viz, (
        f"visualization.uuid missing for source '{viz.get('source')}' — "
        "R3a requires every create tool to return a server-assigned UUID"
    )
    assert isinstance(viz["uuid"], str), (
        f"visualization.uuid must be a string, got {type(viz['uuid']).__name__}"
    )
    try:
        uuid_mod.UUID(viz["uuid"])
    except (ValueError, AttributeError) as e:
        raise AssertionError(
            f"visualization.uuid is not a valid UUID string: {viz['uuid']!r} ({e})"
        )


def assert_inline_data_viz(result, expected_source, expected_viz_type):
    """Rule 1: Plotly, Table, Card use inlineData + vizType."""
    viz = result["visualization"]
    assert viz["source"] == expected_source, (
        f"Expected source '{expected_source}', got '{viz['source']}'"
    )
    assert "inlineData" in viz, f"inlineData missing for source '{expected_source}'"
    assert viz.get("vizType") == expected_viz_type, (
        f"Expected vizType '{expected_viz_type}', got '{viz.get('vizType')}'"
    )
    assert isinstance(viz["w"], int) and viz["w"] > 0
    assert isinstance(viz["h"], int) and viz["h"] > 0
    assert_server_uuid(viz)


def assert_flat_args_viz(result, expected_source):
    """Rule 1: Map, Text, Custom Image use flat top-level args (NOT inlineData)."""
    viz = result["visualization"]
    assert viz["source"] == expected_source, (
        f"Expected source '{expected_source}', got '{viz['source']}'"
    )
    assert "inlineData" not in viz, (
        f"inlineData found for source '{expected_source}' — "
        "this type should use flat top-level args, not inlineData"
    )
    args = viz.get("args", {})
    assert isinstance(args, dict), f"args should be a dict, got {type(args)}"
    assert isinstance(viz["w"], int) and viz["w"] > 0
    assert isinstance(viz["h"], int) and viz["h"] > 0
    assert_server_uuid(viz)


def assert_variable_input_viz(result):
    """Hybrid: Variable Input uses flat args AND vizType (but no inlineData)."""
    viz = result["visualization"]
    assert viz["source"] == VALID_VARIABLE_INPUT_SOURCE
    assert "inlineData" not in viz, "Variable Input should not use inlineData"
    assert viz.get("vizType") == "variableInput"
    args = viz.get("args", {})
    assert isinstance(args, dict)
    assert "variable_name" in args, "variable_name is required"
    assert "variable_options_source" in args, "variable_options_source is required"
    assert isinstance(viz["w"], int) and viz["w"] > 0
    assert isinstance(viz["h"], int) and viz["h"] > 0
    assert_server_uuid(viz)


def assert_no_null_args(result):
    """Rule 1 (null prevention): No null values in args for short-circuit types."""
    viz = result["visualization"]
    args = viz.get("args", {})
    null_keys = [k for k, v in args.items() if v is None]
    assert not null_keys, (
        f"Null args found: {null_keys}. Null values trigger 'All arguments "
        "must be filled out' validation in the edit modal."
    )


def assert_layer_update(result, expected_uuid=None):
    """Rule 3: Layer tools return layer_update, NOT visualization."""
    assert "layer_update" in result, "Expected 'layer_update' key, not 'visualization'"
    assert "visualization" not in result, (
        "layer_update results must not also contain 'visualization'"
    )
    update = result["layer_update"]
    assert "map_uuid" in update, "layer_update must include map_uuid"
    assert "layer" in update, "layer_update must include layer config"
    if expected_uuid is not None:
        assert update["map_uuid"] == expected_uuid


# ---------------------------------------------------------------------------
# create_plotly_chart contract tests
# ---------------------------------------------------------------------------

class TestCreatePlotlyChart:
    """Contract tests for create_plotly_chart."""

    def test_returns_inline_data_viz_with_correct_source(self):
        result = create_plotly_chart(
            data=[{"x": [1, 2, 3], "y": [4, 5, 6], "type": "scatter"}]
        )
        assert_inline_data_viz(result, "Inline Plotly", "plotly")

    def test_inline_data_contains_traces(self):
        traces = [{"x": [1, 2], "y": [3, 4], "type": "scatter"}]
        result = create_plotly_chart(data=traces)
        assert result["visualization"]["inlineData"]["data"] == traces

    def test_title_added_to_layout(self):
        result = create_plotly_chart(
            data=[{"x": [1], "y": [1]}],
            title="Test Chart",
        )
        layout = result["visualization"]["inlineData"]["layout"]
        assert layout["title"] == "Test Chart"

    def test_explicit_layout_not_overridden_by_title(self):
        result = create_plotly_chart(
            data=[{"x": [1], "y": [1]}],
            layout={"title": "Explicit Title"},
            title="Shorthand Title",
        )
        layout = result["visualization"]["inlineData"]["layout"]
        assert layout["title"] == "Explicit Title"

    def test_default_dimensions(self):
        result = create_plotly_chart(data=[{"x": [1], "y": [1]}])
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 40

    def test_custom_dimensions(self):
        result = create_plotly_chart(data=[{"x": [1], "y": [1]}], w=75, h=60)
        viz = result["visualization"]
        assert viz["w"] == 75
        assert viz["h"] == 60

    def test_default_config_is_responsive(self):
        result = create_plotly_chart(data=[{"x": [1], "y": [1]}])
        config = result["visualization"]["inlineData"]["config"]
        assert config["responsive"] is True
        assert config["displaylogo"] is False

    def test_flat_args_assertion_fails_for_plotly(self):
        """Verify assert_flat_args_viz correctly rejects inlineData types."""
        result = create_plotly_chart(data=[{"x": [1], "y": [1]}])
        with pytest.raises(AssertionError, match="inlineData found"):
            assert_flat_args_viz(result, "Inline Plotly")

    def test_json_string_data_is_coerced(self):
        """Some LLMs serialize list args as JSON strings. Parity with
        patch_visualization, add_map_service_layer, create_variable_input,
        and create_card — all of which already coerce.
        """
        result = create_plotly_chart(
            data='[{"x": [1, 2, 3], "y": [4, 5, 6]}]'
        )
        inline = result["visualization"]["inlineData"]
        assert inline["data"] == [{"x": [1, 2, 3], "y": [4, 5, 6]}]

    def test_malformed_json_string_data_returns_error(self):
        result = create_plotly_chart(data="not json at all")
        assert "error" in result
        assert "invalid_args" in result["error"]


# ---------------------------------------------------------------------------
# create_data_table contract tests
# ---------------------------------------------------------------------------

class TestCreateDataTable:
    """Contract tests for create_data_table."""

    def test_returns_inline_data_viz_with_correct_source(self):
        result = create_data_table(
            data=[{"col1": "a", "col2": "b"}, {"col1": "c", "col2": "d"}]
        )
        assert_inline_data_viz(result, "Inline Table", "table")

    def test_inline_data_contains_rows(self):
        rows = [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]
        result = create_data_table(data=rows)
        assert result["visualization"]["inlineData"]["data"] == rows

    def test_title_and_subtitle_in_inline_data(self):
        result = create_data_table(
            data=[{"x": 1}],
            title="My Table",
            subtitle="Some subtitle",
        )
        inline = result["visualization"]["inlineData"]
        assert inline["title"] == "My Table"
        assert inline["subtitle"] == "Some subtitle"

    def test_default_dimensions(self):
        result = create_data_table(data=[{"x": 1}])
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 35

    def test_custom_dimensions(self):
        result = create_data_table(data=[{"x": 1}], w=80, h=50)
        viz = result["visualization"]
        assert viz["w"] == 80
        assert viz["h"] == 50

    def test_missing_title_defaults_to_empty_string(self):
        result = create_data_table(data=[{"x": 1}])
        inline = result["visualization"]["inlineData"]
        assert inline["title"] == ""
        assert inline["subtitle"] == ""

    def test_json_string_data_is_coerced(self):
        """Parity with create_card, create_variable_input, and the patch
        protocol — LLMs sometimes serialize the row array as a JSON string.
        """
        result = create_data_table(
            data='[{"station":"Main","flow":120}]',
            title="Stations",
        )
        inline = result["visualization"]["inlineData"]
        assert inline["data"] == [{"station": "Main", "flow": 120}]

    def test_malformed_json_string_data_returns_error(self):
        result = create_data_table(data="definitely not json")
        assert "error" in result
        assert "invalid_args" in result["error"]


# ---------------------------------------------------------------------------
# create_card contract tests
# ---------------------------------------------------------------------------

class TestCreateCard:
    """Contract tests for create_card."""

    def test_returns_inline_data_viz_with_correct_source(self):
        result = create_card(title="Revenue")
        assert_inline_data_viz(result, "Inline Card", "card")

    def test_inline_data_contains_title_and_description(self):
        result = create_card(title="Users", description="Total active users")
        inline = result["visualization"]["inlineData"]
        assert inline["title"] == "Users"
        assert inline["description"] == "Total active users"

    def test_scalar_data_is_coerced_to_list_of_dicts(self):
        # Card renderer (Card.js:100) calls `data.map(...)`; it requires a
        # list of {label?, value?, color?, icon?} dicts. LLMs naturally pass
        # a scalar when the user says "card with value 42" — coerce at the
        # tool boundary (see docs/solutions/best-practices/mcp-tool-dict-parameter-coercion).
        result = create_card(title="Count", data=42)
        assert result["visualization"]["inlineData"]["data"] == [{"value": "42"}]

    def test_string_scalar_data_is_coerced(self):
        result = create_card(title="Status", data="Operational")
        assert result["visualization"]["inlineData"]["data"] == [
            {"value": "Operational"}
        ]

    def test_missing_data_defaults_to_empty_list(self):
        # Card.js:96 checks `data.length === 0` to render the empty placeholder;
        # None must become [] so the renderer's guard works.
        result = create_card(title="Empty")
        assert result["visualization"]["inlineData"]["data"] == []

    def test_single_dict_data_is_wrapped_in_list(self):
        result = create_card(title="One", data={"label": "Flow", "value": 120})
        assert result["visualization"]["inlineData"]["data"] == [
            {"label": "Flow", "value": 120}
        ]

    def test_list_of_dicts_passes_through_unchanged(self):
        data = [{"label": "A", "value": 1}, {"label": "B", "value": 2}]
        result = create_card(title="Multi", data=data)
        assert result["visualization"]["inlineData"]["data"] == data

    def test_list_of_scalars_wraps_each_item(self):
        result = create_card(title="Values", data=[10, "twenty"])
        assert result["visualization"]["inlineData"]["data"] == [
            {"value": "10"},
            {"value": "twenty"},
        ]

    def test_json_string_data_is_coerced(self):
        # Project dict-coercion pattern: some LLMs serialize complex args as
        # JSON strings. The tool accepts that too.
        result = create_card(title="Stringy", data='[{"label": "A", "value": 1}]')
        assert result["visualization"]["inlineData"]["data"] == [
            {"label": "A", "value": 1}
        ]

    def test_malformed_json_array_string_returns_error(self):
        # Review finding COR-06 / REL-009: a string that clearly looks like
        # JSON (leading `[`) but is malformed must NOT fall through to scalar
        # handling and become the card's metric text. Matches the behavior
        # of create_plotly_chart, create_data_table, patch_visualization.
        result = create_card(title="Oops", data='[{"label": "A"')
        assert "error" in result
        assert "invalid_args" in result["error"]

    def test_malformed_json_object_string_returns_error(self):
        result = create_card(title="Oops", data='{"label": "A"')
        assert "error" in result
        assert "invalid_args" in result["error"]

    def test_plain_scalar_string_still_wraps_as_value(self):
        # Strings that DON'T look like JSON (no leading `[` or `{`) remain
        # scalar values — no error, just a single-entry wrapped stat.
        result = create_card(title="Count", data="not json at all")
        assert result["visualization"]["inlineData"]["data"] == [
            {"value": "not json at all"}
        ]

    def test_default_dimensions(self):
        result = create_card(title="Test")
        viz = result["visualization"]
        assert viz["w"] == 25
        assert viz["h"] == 15

    def test_custom_dimensions(self):
        result = create_card(title="Test", w=40, h=20)
        viz = result["visualization"]
        assert viz["w"] == 40
        assert viz["h"] == 20

    def test_missing_description_defaults_to_empty_string(self):
        result = create_card(title="Test")
        assert result["visualization"]["inlineData"]["description"] == ""


# ---------------------------------------------------------------------------
# create_text contract tests
# ---------------------------------------------------------------------------

class TestCreateText:
    """Contract tests for create_text."""

    def test_returns_flat_args_viz_with_correct_source(self):
        result = create_text(text="Hello world")
        assert_flat_args_viz(result, "Text")

    def test_no_null_args(self):
        result = create_text(text="Hello world")
        assert_no_null_args(result)

    def test_args_text_present(self):
        result = create_text(text="Some content")
        args = result["visualization"]["args"]
        assert args["text"] == "Some content"

    def test_default_dimensions(self):
        result = create_text(text="test")
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 15

    def test_custom_dimensions(self):
        result = create_text(text="test", w=30, h=10)
        viz = result["visualization"]
        assert viz["w"] == 30
        assert viz["h"] == 10

    def test_no_viz_type_key(self):
        """Text uses flat args path — no vizType needed."""
        result = create_text(text="test")
        assert "vizType" not in result["visualization"]


# ---------------------------------------------------------------------------
# create_custom_image contract tests
# ---------------------------------------------------------------------------

class TestCreateCustomImage:
    """Contract tests for create_custom_image."""

    def test_returns_flat_args_viz_with_correct_source(self):
        result = create_custom_image(image_url="https://example.com/img.png")
        assert_flat_args_viz(result, "Custom Image")

    def test_no_null_args(self):
        result = create_custom_image(image_url="https://example.com/img.png")
        assert_no_null_args(result)

    def test_args_image_source_present(self):
        result = create_custom_image(image_url="https://example.com/img.png")
        args = result["visualization"]["args"]
        assert args["image_source"] == "https://example.com/img.png"

    def test_no_map_drawing_null(self):
        """Edge case: args must NOT contain mapDrawing: null or similar nulls."""
        result = create_custom_image(image_url="https://example.com/img.png")
        args = result["visualization"]["args"]
        assert "mapDrawing" not in args or args["mapDrawing"] is not None

    def test_default_dimensions(self):
        result = create_custom_image(image_url="https://example.com/img.png")
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 30

    def test_custom_dimensions(self):
        result = create_custom_image(
            image_url="https://example.com/img.png", w=60, h=40
        )
        viz = result["visualization"]
        assert viz["w"] == 60
        assert viz["h"] == 40

    def test_no_viz_type_key(self):
        """Custom Image uses flat args path — no vizType needed."""
        result = create_custom_image(image_url="https://example.com/img.png")
        assert "vizType" not in result["visualization"]


# ---------------------------------------------------------------------------
# create_map_visualization contract tests
# ---------------------------------------------------------------------------

class TestCreateMapVisualization:
    """Contract tests for create_map_visualization."""

    def test_returns_flat_args_viz_with_correct_source(self):
        result = create_map_visualization()
        assert_flat_args_viz(result, "Map")

    def test_no_null_args(self):
        result = create_map_visualization()
        assert_no_null_args(result)

    def test_map_uuid_returned(self):
        result = create_map_visualization()
        assert "map_uuid" in result, "map_uuid must be returned at top level"
        assert isinstance(result["map_uuid"], str)
        assert len(result["map_uuid"]) > 0

    def test_uuid_matches_visualization_uuid(self):
        result = create_map_visualization()
        assert result["map_uuid"] == result["visualization"]["uuid"]

    def test_args_base_map_present(self):
        result = create_map_visualization()
        args = result["visualization"]["args"]
        assert "baseMap" in args

    def test_args_layers_present(self):
        result = create_map_visualization()
        args = result["visualization"]["args"]
        assert "layers" in args
        assert isinstance(args["layers"], list)

    def test_defaults_base_map_streets(self):
        """Edge case: no params → baseMap defaults to 'streets' resolved URL."""
        result = create_map_visualization()
        args = result["visualization"]["args"]
        assert "streets" in args["baseMap"].lower() or "Street_Map" in args["baseMap"]

    def test_defaults_empty_layers(self):
        """No markers → empty layers list."""
        result = create_map_visualization()
        args = result["visualization"]["args"]
        assert args["layers"] == []

    def test_markers_create_vector_layer(self):
        markers = [{"lon": -111.0, "lat": 40.0, "label": "Test"}]
        result = create_map_visualization(markers=markers)
        args = result["visualization"]["args"]
        assert len(args["layers"]) == 1
        layer = args["layers"][0]
        assert layer["configuration"]["type"] == "VectorLayer"

    def test_markers_geojson_has_features(self):
        markers = [
            {"lon": -111.0, "lat": 40.0, "label": "A"},
            {"lon": -112.0, "lat": 41.0, "label": "B"},
        ]
        result = create_map_visualization(markers=markers)
        layer = result["visualization"]["args"]["layers"][0]
        geojson = layer["configuration"]["props"]["source"]["geojson"]
        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) == 2

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._geocode")
    def test_center_geocodes_and_sets_extent(self, mock_geocode):
        mock_geocode.return_value = (-111.89, 40.76)
        result = create_map_visualization(center="Salt Lake City")
        mock_geocode.assert_called_once_with("Salt Lake City")
        args = result["visualization"]["args"]
        assert "map_extent" in args
        assert "-111.89" in args["map_extent"]["extent"]
        assert "40.76" in args["map_extent"]["extent"]

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._geocode")
    def test_center_geocode_failure_returns_error(self, mock_geocode):
        mock_geocode.return_value = None
        result = create_map_visualization(center="Nonexistent Place XYZ")
        assert "error" in result

    def test_map_extent_overrides_center(self):
        """map_extent takes precedence; center is NOT geocoded."""
        result = create_map_visualization(
            map_extent="-112,40,-110,42",
            center="should be ignored",
        )
        args = result["visualization"]["args"]
        assert args["map_extent"]["extent"] == "-112,40,-110,42"

    def test_no_drawing_tools_means_no_map_drawing(self):
        """No drawing_tools → mapDrawing key should not appear (no null)."""
        result = create_map_visualization()
        args = result["visualization"]["args"]
        assert "mapDrawing" not in args

    def test_drawing_tools_creates_map_drawing(self):
        result = create_map_visualization(drawing_tools=["Point", "Polygon"])
        args = result["visualization"]["args"]
        assert "mapDrawing" in args
        assert args["mapDrawing"]["options"] == ["Point", "Polygon"]

    def test_default_dimensions(self):
        result = create_map_visualization()
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 45

    def test_custom_dimensions(self):
        result = create_map_visualization(w=80, h=60)
        viz = result["visualization"]
        assert viz["w"] == 80
        assert viz["h"] == 60


# ---------------------------------------------------------------------------
# render_plugin contract tests
# ---------------------------------------------------------------------------

class TestRenderPlugin:
    """Contract tests for render_plugin."""

    def test_source_matches_parameter(self):
        result = render_plugin(source="my_intake_driver", args={"key": "val"})
        viz = result["visualization"]
        assert viz["source"] == "my_intake_driver"

    def test_viz_type_is_intake_plugin(self):
        result = render_plugin(source="test_plugin", args={})
        assert result["visualization"]["vizType"] == "intake_plugin"

    def test_args_passed_through(self):
        test_args = {"gauge_id": "12345", "start_date": "2025-01-01"}
        result = render_plugin(source="test_plugin", args=test_args)
        assert result["visualization"]["args"] == test_args

    def test_default_dimensions(self):
        result = render_plugin(source="test_plugin", args={})
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 25

    def test_custom_dimensions(self):
        result = render_plugin(source="test_plugin", args={}, w=70, h=40)
        viz = result["visualization"]
        assert viz["w"] == 70
        assert viz["h"] == 40

    def test_variable_reference_in_args(self):
        """Args with ${variable_name} syntax should pass through unchanged."""
        test_args = {"gauge_id": "${my_gauge}", "date": "${start_date}"}
        result = render_plugin(source="test_plugin", args=test_args)
        assert result["visualization"]["args"]["gauge_id"] == "${my_gauge}"
        assert result["visualization"]["args"]["date"] == "${start_date}"

    def test_r3a_returns_server_uuid(self):
        """R3a: every create tool returns a top-level uuid in the visualization object."""
        result = render_plugin(source="test_plugin", args={})
        assert_server_uuid(result["visualization"])

    def test_r3a_uuids_are_unique(self):
        """R3a: consecutive calls produce distinct UUIDs."""
        r1 = render_plugin(source="test_plugin", args={})
        r2 = render_plugin(source="test_plugin", args={})
        assert r1["visualization"]["uuid"] != r2["visualization"]["uuid"]


# ---------------------------------------------------------------------------
# render_custom_visualization contract tests
# ---------------------------------------------------------------------------

class TestRenderCustomVisualization:
    """Contract tests for render_custom_visualization."""

    MOCK_BUILD_TIME_PLUGIN = {
        "source": "TestCustomPanel",
        "label": "Test Custom Panel",
        "type": "client_custom",
        "group": "Custom",
        "args": {},
    }

    MOCK_RUNTIME_PLUGIN = {
        "source": "RuntimePanel",
        "label": "Runtime Panel",
        "type": "client_custom_remote",
        "group": "Custom",
        "url": "http://localhost:5173/assets/remoteEntry.js",
        "scope": "runtimeScope",
        "module": "./RuntimePanel",
        "remoteType": "vite-esm",
        "dataKey": "",
        "args": {},
    }

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_build_time_plugin_returns_correct_source(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(source="TestCustomPanel")
        viz = result["visualization"]
        assert viz["source"] == "TestCustomPanel"

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_build_time_plugin_viz_type(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(source="TestCustomPanel")
        assert result["visualization"]["vizType"] == "client_custom"

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_runtime_plugin_returns_client_custom_source(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_RUNTIME_PLUGIN]
        result = render_custom_visualization(source="RuntimePanel")
        viz = result["visualization"]
        assert viz["source"] == "Client Custom"

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_runtime_plugin_viz_type(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_RUNTIME_PLUGIN]
        result = render_custom_visualization(source="RuntimePanel")
        assert result["visualization"]["vizType"] == "custom"

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_runtime_plugin_includes_mfe_coordinates(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_RUNTIME_PLUGIN]
        result = render_custom_visualization(source="RuntimePanel")
        viz = result["visualization"]
        assert viz["scope"] == "runtimeScope"
        assert viz["module"] == "./RuntimePanel"
        assert viz["remoteType"] == "vite-esm"

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_props_passed_as_args(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(
            source="TestCustomPanel", props={"color": "blue"}
        )
        assert result["visualization"]["args"] == {"color": "blue"}

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_unknown_source_returns_error(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(source="NonexistentPlugin")
        assert "error" in result

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_default_dimensions(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(source="TestCustomPanel")
        viz = result["visualization"]
        assert viz["w"] == 50
        assert viz["h"] == 30

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_custom_dimensions(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(
            source="TestCustomPanel", w=60, h=45
        )
        viz = result["visualization"]
        assert viz["w"] == 60
        assert viz["h"] == 45

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_no_props_defaults_to_empty_dict(self, mock_plugins):
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(source="TestCustomPanel")
        assert result["visualization"]["args"] == {}

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_r3a_build_time_plugin_returns_server_uuid(self, mock_plugins):
        """R3a: build-time plugin path returns a server uuid."""
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        result = render_custom_visualization(source="TestCustomPanel")
        assert_server_uuid(result["visualization"])

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_r3a_runtime_plugin_returns_server_uuid(self, mock_plugins):
        """R3a: runtime (MFE) plugin path returns a server uuid."""
        mock_plugins.return_value = [self.MOCK_RUNTIME_PLUGIN]
        result = render_custom_visualization(source="RuntimePanel")
        assert_server_uuid(result["visualization"])

    @patch("tethysapp.tethysdash.mcp.tethysdash_mcp_server._get_all_plugins")
    def test_r3a_uuids_are_unique(self, mock_plugins):
        """R3a: consecutive calls produce distinct UUIDs."""
        mock_plugins.return_value = [self.MOCK_BUILD_TIME_PLUGIN]
        r1 = render_custom_visualization(source="TestCustomPanel")
        r2 = render_custom_visualization(source="TestCustomPanel")
        assert r1["visualization"]["uuid"] != r2["visualization"]["uuid"]
