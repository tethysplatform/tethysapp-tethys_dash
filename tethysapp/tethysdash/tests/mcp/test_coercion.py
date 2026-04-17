"""Contract tests for dict/list parameter coercion in MCP tools.

LLMs sometimes pass dict-typed arguments as JSON strings instead of parsed
objects.  MCP tools that accept Union[Dict, str] must coerce strings via
json.loads and produce identical output to dict inputs.

Tests exercise add_map_service_layer with params, geojson, and
attribute_variables as both dict and JSON string inputs.

Layer 1 tests -- no browser, no server, milliseconds per test.
"""

import json

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import add_map_service_layer
from tethysapp.tethysdash.tests.mcp.test_visualization_contracts import (
    assert_layer_update,
)


TEST_MAP_UUID = "coercion-test-uuid-1234"


# ---------------------------------------------------------------------------
# params coercion (WMS layer -- no external calls needed)
# ---------------------------------------------------------------------------

class TestParamsCoercion:
    """params can be passed as dict or JSON string with identical results."""

    def _make_wms_layer(self, params_value):
        return add_map_service_layer(
            map_uuid=TEST_MAP_UUID,
            source_type="WMS",
            name="Test WMS",
            url="https://example.com/wms",
            wms_layers="workspace:layer",
            params=params_value,
        )

    def test_params_as_dict(self):
        result = self._make_wms_layer({"TIME": "${d}"})
        assert_layer_update(result, expected_uuid=TEST_MAP_UUID)

    def test_params_as_string(self):
        result = self._make_wms_layer('{"TIME": "${d}"}')
        assert_layer_update(result, expected_uuid=TEST_MAP_UUID)

    def test_params_dict_and_string_produce_same_output(self):
        dict_result = self._make_wms_layer({"TIME": "${d}"})
        str_result = self._make_wms_layer('{"TIME": "${d}"}')
        assert dict_result == str_result, (
            f"Dict result:\n{json.dumps(dict_result, indent=2)}\n\n"
            f"String result:\n{json.dumps(str_result, indent=2)}"
        )

    def test_params_merged_into_wms_source_props(self):
        """Extra params are merged into the WMS source params alongside LAYERS."""
        result = self._make_wms_layer({"TIME": "2024-01-01"})
        source_params = (
            result["layer_update"]["layer"]["configuration"]["props"]
            ["source"]["props"]["params"]
        )
        assert source_params["LAYERS"] == "workspace:layer"
        assert source_params["TIME"] == "2024-01-01"


# ---------------------------------------------------------------------------
# geojson coercion (GeoJSON layer -- no external calls needed)
# ---------------------------------------------------------------------------

SAMPLE_GEOJSON = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [-105.0, 40.0]},
            "properties": {"name": "Test Point"},
        }
    ],
}


class TestGeojsonCoercion:
    """geojson can be passed as dict or JSON string with identical results."""

    def _make_geojson_layer(self, geojson_value):
        return add_map_service_layer(
            map_uuid=TEST_MAP_UUID,
            source_type="GeoJSON",
            name="Test GeoJSON",
            geojson=geojson_value,
        )

    def test_geojson_as_dict(self):
        result = self._make_geojson_layer(geojson_value=SAMPLE_GEOJSON)
        assert_layer_update(result, expected_uuid=TEST_MAP_UUID)

    def test_geojson_as_string(self):
        result = self._make_geojson_layer(geojson_value=json.dumps(SAMPLE_GEOJSON))
        assert_layer_update(result, expected_uuid=TEST_MAP_UUID)

    def test_geojson_dict_and_string_produce_same_output(self):
        dict_result = self._make_geojson_layer(geojson_value=SAMPLE_GEOJSON)
        str_result = self._make_geojson_layer(
            geojson_value=json.dumps(SAMPLE_GEOJSON)
        )
        assert dict_result == str_result, (
            f"Dict result:\n{json.dumps(dict_result, indent=2)}\n\n"
            f"String result:\n{json.dumps(str_result, indent=2)}"
        )

    def test_geojson_crs_auto_assigned(self):
        """GeoJSON without a CRS should get EPSG:4326 auto-assigned."""
        result = self._make_geojson_layer(geojson_value=SAMPLE_GEOJSON)
        geojson_data = (
            result["layer_update"]["layer"]["configuration"]["props"]["source"]["geojson"]
        )
        assert "crs" in geojson_data
        assert geojson_data["crs"]["properties"]["name"] == "EPSG:4326"

    def test_geojson_at_source_level_not_props(self):
        """GeoJSON data must be at source.geojson, NOT source.props.geojson."""
        result = self._make_geojson_layer(geojson_value=SAMPLE_GEOJSON)
        source = (
            result["layer_update"]["layer"]["configuration"]["props"]["source"]
        )
        assert "geojson" in source, "GeoJSON data must be at source.geojson"
        assert "geojson" not in source.get("props", {}), (
            "GeoJSON data must NOT be at source.props.geojson"
        )


# ---------------------------------------------------------------------------
# attribute_variables coercion (GeoJSON layer with queryable -- no ESRI
# resolution needed since we use GeoJSON source type)
# ---------------------------------------------------------------------------

SAMPLE_ATTR_VARS = {"COMID": "selected_comid", "NAME": "selected_name"}


class TestAttributeVariablesCoercion:
    """attribute_variables can be passed as dict or JSON string."""

    def _make_queryable_layer(self, attr_vars_value):
        return add_map_service_layer(
            map_uuid=TEST_MAP_UUID,
            source_type="GeoJSON",
            name="Queryable GeoJSON",
            geojson=SAMPLE_GEOJSON,
            queryable=True,
            attribute_variables=attr_vars_value,
        )

    def test_attribute_variables_as_dict(self):
        result = self._make_queryable_layer(attr_vars_value=SAMPLE_ATTR_VARS)
        assert_layer_update(result, expected_uuid=TEST_MAP_UUID)

    def test_attribute_variables_as_string(self):
        result = self._make_queryable_layer(
            attr_vars_value=json.dumps(SAMPLE_ATTR_VARS)
        )
        assert_layer_update(result, expected_uuid=TEST_MAP_UUID)

    def test_attribute_variables_dict_and_string_produce_same_output(self):
        dict_result = self._make_queryable_layer(attr_vars_value=SAMPLE_ATTR_VARS)
        str_result = self._make_queryable_layer(
            attr_vars_value=json.dumps(SAMPLE_ATTR_VARS)
        )
        assert dict_result == str_result, (
            f"Dict result:\n{json.dumps(dict_result, indent=2)}\n\n"
            f"String result:\n{json.dumps(str_result, indent=2)}"
        )

    def test_attribute_variables_keyed_by_layer_name(self):
        """For non-ESRI types, attributeVariables key should be the display name."""
        result = self._make_queryable_layer(attr_vars_value=SAMPLE_ATTR_VARS)
        layer = result["layer_update"]["layer"]
        assert "attributeVariables" in layer
        assert "Queryable GeoJSON" in layer["attributeVariables"]
        assert layer["attributeVariables"]["Queryable GeoJSON"] == SAMPLE_ATTR_VARS
