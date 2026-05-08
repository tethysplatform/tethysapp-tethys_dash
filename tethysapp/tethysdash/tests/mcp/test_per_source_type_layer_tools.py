"""Per-source-type layer tool contract tests.

Plan 2026-05-07-007 (T3) replaced the umbrella ``add_map_service_layer``
tool with 11 narrow tools — one per source type. The persisted shape is
byte-identical for equivalent input across umbrella vs per-tool. These
tests are the migrated oracle suite that pins that invariant.

Layer 1 tests -- no browser, no server, milliseconds per test.
"""

import inspect

import pytest
from unittest.mock import patch

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
    add_wms_layer,
    add_esri_image_layer,
    add_esri_feature_layer,
    add_geojson_layer,
    add_kml_layer,
    add_image_tile_layer,
    add_vector_tile_layer,
    add_pmtiles_vector_layer,
    add_pmtiles_raster_layer,
    add_geotiff_layer,
    add_static_image_layer,
    VALID_SOURCE_TYPES,
)
from tethysapp.tethysdash.plugin_helpers import LayerConfigurationBuilder
from tethysapp.tethysdash.tests.mcp.test_visualization_contracts import (
    assert_layer_update,
)


# Stable real UUID v4 used by every layer-contract test below.
MAP_UUID = "11111111-1111-4111-8111-111111111111"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_layer_config(result):
    """Extract the layer config from a successful result."""
    return result["layer_update"]["layer"]


def _get_configuration(result):
    """Extract the layer configuration (type + props) from a successful result."""
    return _get_layer_config(result)["configuration"]


def _get_source(result):
    """Extract the source dict from a successful result."""
    return _get_configuration(result)["props"]["source"]


# All 11 per-source-type tools, indexed by source_type string. Used by the
# parametrized cross-tool tests below.
ALL_TOOLS = {
    "WMS": add_wms_layer,
    "ESRI Image and Map Service": add_esri_image_layer,
    "ESRI Feature Service": add_esri_feature_layer,
    "GeoJSON": add_geojson_layer,
    "KML": add_kml_layer,
    "Image Tile": add_image_tile_layer,
    "Vector Tile": add_vector_tile_layer,
    "PMTiles Vector": add_pmtiles_vector_layer,
    "PMTiles Raster": add_pmtiles_raster_layer,
    "GeoTIFF": add_geotiff_layer,
    "Static Image": add_static_image_layer,
}


# Minimal valid kwargs (excluding map_uuid + name) per source type — the
# smallest call that produces a successful layer_update.
_MINIMAL_ARGS = {
    "WMS": dict(url="https://x.com/wms", wms_layers="ws:layer"),
    "ESRI Image and Map Service": dict(url="https://x.com/esri"),
    "ESRI Feature Service": dict(url="https://x.com/esri", layer_id="0"),
    "GeoJSON": dict(geojson={"type": "FeatureCollection", "features": []}),
    "KML": dict(url="https://x.com/data.kml"),
    "Image Tile": dict(url="https://x.com/tiles/{z}/{x}/{y}.png"),
    "Vector Tile": dict(url="https://x.com/tiles/{z}/{x}/{y}.pbf"),
    "PMTiles Vector": dict(url="https://x.com/data.pmtiles"),
    "PMTiles Raster": dict(url="https://x.com/data.pmtiles"),
    "GeoTIFF": dict(url="https://x.com/dem.tif"),
    "Static Image": dict(
        url="https://x.com/image.png",
        projection="EPSG:4326",
        image_extent="0,0,10,10",
    ),
}


# Minimal source-prop kwargs to satisfy the builder's required-field
# validation when probing the source_type → layer_type mapping.
_MINIMAL_BUILDER_PROPS = {
    "WMS": dict(url="https://x.com/wms", params={"LAYERS": "ws:layer"}),
    "ESRI Image and Map Service": dict(url="https://x.com/esri"),
    "ESRI Feature Service": dict(url="https://x.com/esri", layer=0),
    "KML": dict(url="https://x.com/data.kml"),
    "Image Tile": dict(url="https://x.com/tiles/{z}/{x}/{y}.png"),
    "Vector Tile": dict(urls="https://x.com/tiles/{z}/{x}/{y}.pbf"),
    "PMTiles Vector": dict(url="https://x.com/data.pmtiles"),
    "PMTiles Raster": dict(url="https://x.com/data.pmtiles"),
    "GeoTIFF": dict(sources=[{"url": "https://x.com/dem.tif"}]),
    "Static Image": dict(
        url="https://x.com/image.png",
        projection="EPSG:4326",
        imageExtent="0,0,10,10",
    ),
}


def _call_minimal(source_type, **overrides):
    """Issue the minimal valid call for a source type with optional overrides."""
    tool = ALL_TOOLS[source_type]
    kwargs = dict(_MINIMAL_ARGS[source_type])
    kwargs.update(overrides)
    return tool(map_uuid=MAP_UUID, name=f"Test {source_type}", **kwargs)


# ---------------------------------------------------------------------------
# WMS
# ---------------------------------------------------------------------------

class TestAddWmsLayer:
    """Contract tests for add_wms_layer."""

    def test_returns_layer_update_shape(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_image_layer(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        config = _get_configuration(result)
        assert config["type"] == "ImageLayer"

    def test_source_type(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        source = _get_source(result)
        assert source["type"] == "WMS"

    def test_source_props_url_and_layers(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://example.com/wms"
        assert source["props"]["params"]["LAYERS"] == "workspace:layer_name"


# ---------------------------------------------------------------------------
# ESRI Image and Map Service
# ---------------------------------------------------------------------------

class TestAddEsriImageLayer:
    """Contract tests for add_esri_image_layer."""

    def test_returns_layer_update_shape(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_image_layer(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        config = _get_configuration(result)
        assert config["type"] == "ImageLayer"

    def test_source_params_layers(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    @patch(
        "tethysapp.tethysdash.mcp.tethysdash_mcp_server._resolve_esri_layer_name",
        return_value="River Gauges",
    )
    def test_attribute_variables_key_resolved(self, mock_resolve):
        """Attribute-variables key uses ESRI service layer name, not display name."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        assert "attributeVariables" in layer
        assert "River Gauges" in layer["attributeVariables"]
        assert "My Display Name" not in layer["attributeVariables"]
        assert layer["attributeVariables"]["River Gauges"] == {"STAGE": "stage_var"}

    @patch(
        "tethysapp.tethysdash.mcp.tethysdash_mcp_server._resolve_esri_layer_name",
        return_value=None,
    )
    def test_attribute_variables_fallback_to_display_name(self, mock_resolve):
        """When _resolve_esri_layer_name fails, falls back to display name."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        assert "attributeVariables" in layer
        assert "My Display Name" in layer["attributeVariables"]

    # LAYERS canonicalization (plan 2026-05-05-001 Unit 5).

    def test_canonicalizes_bare_layer_id(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_canonicalizes_bare_layer_id_comma_list(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0,1",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0,1"

    def test_passes_through_show_layer_id(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_passes_through_hide_layer_id(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="hide:1",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "hide:1"

    def test_passes_through_include_and_exclude_directives(self):
        for directive in ("include:0", "exclude:1"):
            result = add_esri_image_layer(
                map_uuid=MAP_UUID,
                name="ESRI Image Layer",
                url="https://example.com/arcgis/rest/services/MyService/MapServer",
                layer_id=directive,
            )
            source = _get_source(result)
            assert source["props"]["params"]["LAYERS"] == directive

    def test_no_layer_id_no_layers_key(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
        )
        source = _get_source(result)
        assert (
            "params" not in source["props"]
            or "LAYERS" not in source["props"].get("params", {})
        )

    def test_canonicalizes_bare_llm_supplied_params_layers(self):
        """LLM uses params={'LAYERS': '0'} instead of layer_id='0'."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "0"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_canonicalizes_bare_llm_supplied_comma_list(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "0,1,2"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0,1,2"

    def test_passes_through_canonical_llm_supplied_params(self):
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "hide:1"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "hide:1"

    def test_llm_supplied_params_wins_then_canonicalized(self):
        """LLM-supplied params overrides layer_id-derived; result canonicalized."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",
            params={"LAYERS": "1,2"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:1,2"

    def test_other_params_keys_pass_through_unchanged(self):
        """Canonicalization is narrowly scoped to LAYERS."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",
            params={"TIME": "2026-01-01,2026-12-31", "LAYERDEFS": "raw_filter"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"
        assert source["props"]["params"]["TIME"] == "2026-01-01,2026-12-31"
        assert source["props"]["params"]["LAYERDEFS"] == "raw_filter"

    @patch(
        "tethysapp.tethysdash.mcp.tethysdash_mcp_server._resolve_esri_layer_name",
        return_value="River Gauges",
    )
    def test_resolve_layer_name_works_post_canonicalization(self, mock_resolve):
        """_resolve_esri_layer_name is called with the canonicalized LAYERS value."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        assert layer["configuration"]["props"]["source"]["props"]["params"]["LAYERS"] == "show:0"
        assert "River Gauges" in layer["attributeVariables"]
        mock_resolve.assert_called_once_with(
            "https://example.com/arcgis/rest/services/MyService/MapServer", "show:0"
        )

    @patch(
        "tethysapp.tethysdash.mcp.tethysdash_mcp_server._resolve_esri_layer_name",
        return_value="River Gauges",
    )
    def test_params_path_resolves_attribute_variables_correctly(self, mock_resolve):
        """params={'LAYERS': '0'} (no layer_id) + attribute_variables resolves correctly."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "0"},
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        assert layer["configuration"]["props"]["source"]["props"]["params"]["LAYERS"] == "show:0"
        mock_resolve.assert_called_once_with(
            "https://example.com/arcgis/rest/services/MyService/MapServer", "show:0"
        )
        assert "River Gauges" in layer["attributeVariables"]
        assert "My Display Name" not in layer["attributeVariables"]
        assert layer["attributeVariables"]["River Gauges"] == {"STAGE": "stage_var"}

    def test_canonicalizes_integer_layers_value(self):
        """Non-string LAYERS value (e.g., LLM passing integer) is coerced and canonicalized."""
        result = add_esri_image_layer(
            map_uuid=MAP_UUID,
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": 0},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"


# ---------------------------------------------------------------------------
# ESRI Feature Service
# ---------------------------------------------------------------------------

class TestAddEsriFeatureLayer:
    """Contract tests for add_esri_feature_layer."""

    def test_returns_layer_update_shape(self):
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_vector_layer(self):
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorLayer"

    def test_source_props_layer_is_integer(self):
        """layer_id is coerced to int in source.props.layer."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        source = _get_source(result)
        assert source["props"]["layer"] == 0
        assert isinstance(source["props"]["layer"], int)

    # `params` MUST nest under `source.props.params` so the renderer
    # (`loadESRIJSON` in ModuleLoader.js) finds it.

    def test_params_where_nested_under_source_props_params(self):
        """params={'WHERE': ...} must land at source.props.params.WHERE."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="Colorado RFC Boundary",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="11",
            params={"WHERE": "rfc_name = 'Colorado Basin'"},
        )
        source = _get_source(result)
        assert source["props"]["params"] == {
            "WHERE": "rfc_name = 'Colorado Basin'"
        }
        assert "WHERE" not in source["props"]

    def test_params_multiple_keys_all_nest(self):
        """Multiple params keys all land under source.props.params."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
            params={
                "WHERE": "STATE = 'TX'",
                "TIME": "2024-01-01,2024-12-31",
            },
        )
        source = _get_source(result)
        assert source["props"]["params"] == {
            "WHERE": "STATE = 'TX'",
            "TIME": "2024-01-01,2024-12-31",
        }
        assert "WHERE" not in source["props"]
        assert "TIME" not in source["props"]

    def test_no_params_omits_params_key(self):
        """No params arg → source.props has no `params` key."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        source = _get_source(result)
        assert "params" not in source["props"]

    def test_empty_params_dict_omits_params_key(self):
        """params={} → source.props has no `params` key."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
            params={},
        )
        source = _get_source(result)
        assert "params" not in source["props"]

    def test_params_does_not_clobber_url_or_layer(self):
        """With params supplied, url and layer keys still land at top-level source.props."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="3",
            params={"WHERE": "x = 1"},
        )
        source = _get_source(result)
        assert source["props"]["url"] == (
            "https://example.com/arcgis/rest/services/MyService/FeatureServer"
        )
        assert source["props"]["layer"] == 3
        assert isinstance(source["props"]["layer"], int)


# ---------------------------------------------------------------------------
# GeoJSON
# ---------------------------------------------------------------------------

class TestAddGeojsonLayer:
    """Contract tests for add_geojson_layer."""

    SAMPLE_GEOJSON = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [-95.7, 29.7]},
                "properties": {"name": "Houston"},
            }
        ],
    }

    def test_inline_returns_layer_update_shape(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_inline_layer_type_is_vector_layer(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorLayer"

    def test_inline_data_at_source_top_level(self):
        """GeoJSON data must be at source.geojson, NOT source.props.geojson."""
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        source = _get_source(result)
        assert "geojson" in source, "GeoJSON data must be at source.geojson"
        assert source["geojson"]["type"] == "FeatureCollection"
        assert "geojson" not in source["props"], (
            "GeoJSON data must NOT be at source.props.geojson"
        )

    def test_inline_crs_auto_assigned(self):
        """CRS is auto-assigned when missing from inline GeoJSON."""
        geojson_no_crs = dict(self.SAMPLE_GEOJSON)
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Inline GeoJSON",
            geojson=geojson_no_crs,
        )
        source = _get_source(result)
        crs = source["geojson"]["crs"]
        assert crs["type"] == "name"
        assert crs["properties"]["name"] == "EPSG:4326"

    def test_inline_preserves_existing_crs(self):
        """If GeoJSON already has a CRS, it is preserved."""
        geojson_with_crs = dict(self.SAMPLE_GEOJSON)
        geojson_with_crs["crs"] = {
            "type": "name",
            "properties": {"name": "EPSG:3857"},
        }
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Inline GeoJSON",
            geojson=geojson_with_crs,
        )
        source = _get_source(result)
        assert source["geojson"]["crs"]["properties"]["name"] == "EPSG:3857"

    def test_url_at_source_top_level(self):
        """GeoJSON URL is a string at source.geojson (top level)."""
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="URL GeoJSON",
            geojson_url="https://example.com/data.geojson",
        )
        source = _get_source(result)
        assert source["geojson"] == "https://example.com/data.geojson"
        assert "geojson" not in source["props"]

    def test_source_props_is_empty(self):
        """GeoJSON source.props should be empty dict (data is at top level)."""
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        source = _get_source(result)
        assert source["props"] == {}

    def test_attribute_variables_key_is_display_name(self):
        """Non-ESRI types use the display name as attributeVariables key."""
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="City Points",
            geojson=self.SAMPLE_GEOJSON,
            attribute_variables={"name": "city_var"},
        )
        layer = _get_layer_config(result)
        assert "attributeVariables" in layer
        assert "City Points" in layer["attributeVariables"]
        assert layer["attributeVariables"]["City Points"] == {"name": "city_var"}

    def test_error_without_data_or_url(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Missing GeoJSON",
        )
        assert "error" in result
        assert "geojson" in result["error"].lower()


# ---------------------------------------------------------------------------
# KML
# ---------------------------------------------------------------------------

class TestAddKmlLayer:
    """Contract tests for add_kml_layer."""

    def test_returns_layer_update_shape(self):
        result = add_kml_layer(
            map_uuid=MAP_UUID,
            name="KML Layer",
            url="https://example.com/data.kml",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_vector_layer(self):
        result = add_kml_layer(
            map_uuid=MAP_UUID,
            name="KML Layer",
            url="https://example.com/data.kml",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorLayer"

    def test_source_props_url(self):
        result = add_kml_layer(
            map_uuid=MAP_UUID,
            name="KML Layer",
            url="https://example.com/data.kml",
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://example.com/data.kml"


# ---------------------------------------------------------------------------
# Image Tile
# ---------------------------------------------------------------------------

class TestAddImageTileLayer:
    """Contract tests for add_image_tile_layer."""

    def test_returns_layer_update_shape(self):
        result = add_image_tile_layer(
            map_uuid=MAP_UUID,
            name="Image Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.png",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_tile_layer(self):
        result = add_image_tile_layer(
            map_uuid=MAP_UUID,
            name="Image Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.png",
        )
        config = _get_configuration(result)
        assert config["type"] == "TileLayer"

    def test_source_type(self):
        result = add_image_tile_layer(
            map_uuid=MAP_UUID,
            name="Image Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.png",
        )
        source = _get_source(result)
        assert source["type"] == "Image Tile"


# ---------------------------------------------------------------------------
# Vector Tile
# ---------------------------------------------------------------------------

class TestAddVectorTileLayer:
    """Contract tests for add_vector_tile_layer."""

    def test_returns_layer_update_shape(self):
        result = add_vector_tile_layer(
            map_uuid=MAP_UUID,
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_vector_tile_layer(self):
        result = add_vector_tile_layer(
            map_uuid=MAP_UUID,
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorTileLayer"

    def test_source_type(self):
        result = add_vector_tile_layer(
            map_uuid=MAP_UUID,
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        source = _get_source(result)
        assert source["type"] == "Vector Tile"

    def test_source_props_uses_urls_key(self):
        """Vector Tile uses 'urls' (plural) in source.props, not 'url'."""
        result = add_vector_tile_layer(
            map_uuid=MAP_UUID,
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        source = _get_source(result)
        assert source["props"]["urls"] == "https://example.com/tiles/{z}/{x}/{y}.pbf"


# ---------------------------------------------------------------------------
# PMTiles Vector
# ---------------------------------------------------------------------------

class TestAddPmtilesVectorLayer:
    """Contract tests for add_pmtiles_vector_layer."""

    def test_returns_layer_update_shape(self):
        result = add_pmtiles_vector_layer(
            map_uuid=MAP_UUID,
            name="PMTiles Vector Layer",
            url="https://example.com/data.pmtiles",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_vector_tile_layer(self):
        result = add_pmtiles_vector_layer(
            map_uuid=MAP_UUID,
            name="PMTiles Vector Layer",
            url="https://example.com/data.pmtiles",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorTileLayer"

    def test_source_type(self):
        result = add_pmtiles_vector_layer(
            map_uuid=MAP_UUID,
            name="PMTiles Vector Layer",
            url="https://example.com/data.pmtiles",
        )
        source = _get_source(result)
        assert source["type"] == "PMTiles Vector"


# ---------------------------------------------------------------------------
# PMTiles Raster
# ---------------------------------------------------------------------------

class TestAddPmtilesRasterLayer:
    """Contract tests for add_pmtiles_raster_layer."""

    def test_returns_layer_update_shape(self):
        result = add_pmtiles_raster_layer(
            map_uuid=MAP_UUID,
            name="PMTiles Raster Layer",
            url="https://example.com/data.pmtiles",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_webgl_tile(self):
        result = add_pmtiles_raster_layer(
            map_uuid=MAP_UUID,
            name="PMTiles Raster Layer",
            url="https://example.com/data.pmtiles",
        )
        config = _get_configuration(result)
        assert config["type"] == "WebGLTile"

    def test_source_type(self):
        result = add_pmtiles_raster_layer(
            map_uuid=MAP_UUID,
            name="PMTiles Raster Layer",
            url="https://example.com/data.pmtiles",
        )
        source = _get_source(result)
        assert source["type"] == "PMTiles Raster"


# ---------------------------------------------------------------------------
# GeoTIFF
# ---------------------------------------------------------------------------

class TestAddGeotiffLayer:
    """Contract tests for add_geotiff_layer."""

    def test_returns_layer_update_shape(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF Layer",
            url="https://example.com/dem.tif",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_layer_type_is_webgl_tile(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF Layer",
            url="https://example.com/dem.tif",
        )
        config = _get_configuration(result)
        assert config["type"] == "WebGLTile"

    def test_source_props_from_flat_url(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF Layer",
            url="https://example.com/dem.tif",
        )
        source = _get_source(result)
        assert source["type"] == "GeoTIFF"
        assert source["props"]["sources"] == [
            {"url": "https://example.com/dem.tif"}
        ]

    def test_source_props_sources_array(self):
        sources = [
            {
                "url": "https://example.com/dem.tif",
                "bands": [1],
                "nodata": -9999,
            }
        ]
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF Layer",
            source_props={"sources": sources},
        )
        source = _get_source(result)
        assert source["props"]["sources"] == sources

    def test_variable_url_preserved_in_sources(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF Layer",
            url="https://example.com/${dem_date}/dem.tif",
        )
        source = _get_source(result)
        assert source["props"]["sources"] == [
            {"url": "https://example.com/${dem_date}/dem.tif"}
        ]

    def test_without_url_or_sources_returns_error(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF No Source",
        )
        assert "error" in result

    def test_empty_sources_returns_error(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="GeoTIFF Empty Source",
            source_props={"sources": []},
        )
        assert "error" in result

    # Plan 2026-05-07-004 Unit B — renderer-consumed source-prop keys.

    def test_bands_string_persists_under_source_props(self):
        """`bands` is a comma-string consumed by ModuleLoader.js."""
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"bands": "1,2,3"},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"]["bands"] == "1,2,3"

    def test_nodata_persists_under_source_props(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"nodata": -9999},
        )
        assert "error" not in result, result
        assert _get_source(result)["props"]["nodata"] == -9999

    def test_min_max_persist_under_source_props(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"min": 0, "max": 100},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"]["min"] == 0
        assert source["props"]["max"] == 100

    def test_rampname_persists_at_source_top_level(self):
        """`rampName` persists at source.rampName (one level above props)."""
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"rampName": "viridis"},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source.get("rampName") == "viridis"
        assert "rampName" not in source["props"]

    def test_rampmin_rampmax_persist_at_source_top_level(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={
                "rampName": "viridis",
                "rampMin": "0",
                "rampMax": "100",
            },
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source.get("rampName") == "viridis"
        assert source.get("rampMin") == "0"
        assert source.get("rampMax") == "100"
        assert "rampName" not in source["props"]
        assert "rampMin" not in source["props"]
        assert "rampMax" not in source["props"]

    def test_mixed_keys_route_correctly(self):
        """A single source_props mixing both groups routes each key correctly."""
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={
                "bands": "1",
                "rampName": "viridis",
            },
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"]["bands"] == "1"
        assert source.get("rampName") == "viridis"

    def test_unknown_key_still_rejected(self):
        """Unrecognized keys still get rejected by the allowlist."""
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"some_unknown_key": "x"},
        )
        assert "error" in result, result
        assert "some_unknown_key" in result["error"]

    def test_existing_attributions_still_works(self):
        """Pre-existing GeoTIFF allowlist entries continue to work."""
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"attributions": "USGS"},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"].get("attributions") == "USGS"


# ---------------------------------------------------------------------------
# Static Image
# ---------------------------------------------------------------------------

class TestAddStaticImageLayer:
    """Contract tests for add_static_image_layer.

    The umbrella accepted projection / imageExtent through `params={...}`;
    the per-tool surface promotes them to flat parameters (`projection`,
    `image_extent`). Persisted shape is identical (`source.props.projection`,
    `source.props.imageExtent`).
    """

    def test_minimal(self):
        result = add_static_image_layer(
            map_uuid=MAP_UUID,
            name="Aerial Photo",
            url="https://example.com/aerial.png",
            projection="EPSG:4326",
            image_extent="-180,-90,180,90",
        )
        config = _get_configuration(result)
        assert config["type"] == "ImageLayer"
        source = config["props"]["source"]
        assert source["type"] == "Static Image"
        assert source["props"]["url"] == "https://example.com/aerial.png"
        assert source["props"]["projection"] == "EPSG:4326"
        # imageExtent persists as a string — ModuleLoader.js:35-41 splits it.
        assert source["props"]["imageExtent"] == "-180,-90,180,90"

    def test_returns_layer_update_shape(self):
        result = add_static_image_layer(
            map_uuid=MAP_UUID,
            name="Aerial Photo",
            url="https://example.com/aerial.png",
            projection="EPSG:4326",
            image_extent="-180,-90,180,90",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_with_none_extent_returns_error(self):
        """An LLM passing image_extent=None must surface a clean error."""
        result = add_static_image_layer(
            map_uuid=MAP_UUID,
            name="Aerial None Extent",
            url="https://example.com/aerial.png",
            projection="EPSG:4326",
            image_extent=None,
        )
        assert "error" in result

    def test_with_empty_string_extent_returns_error(self):
        result = add_static_image_layer(
            map_uuid=MAP_UUID,
            name="Aerial Empty Extent",
            url="https://example.com/aerial.png",
            projection="EPSG:4326",
            image_extent="",
        )
        assert "error" in result

    def test_with_none_projection_returns_error(self):
        result = add_static_image_layer(
            map_uuid=MAP_UUID,
            name="Aerial No Projection",
            url="https://example.com/aerial.png",
            projection=None,
            image_extent="0,0,10,10",
        )
        assert "error" in result

    def test_with_empty_string_projection_returns_error(self):
        result = add_static_image_layer(
            map_uuid=MAP_UUID,
            name="Aerial Empty Projection",
            url="https://example.com/aerial.png",
            projection="",
            image_extent="0,0,10,10",
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# Cross-cutting: queryable
# ---------------------------------------------------------------------------

class TestQueryablePerSourceTypeTools:
    """Queryable flag contract — representative tools."""

    def test_queryable_true_sets_flag_wms(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="Queryable WMS",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
            queryable=True,
        )
        layer = _get_layer_config(result)
        assert layer["queryable"] is True

    def test_queryable_false_omits_flag_wms(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="Non-Queryable WMS",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
            queryable=False,
        )
        layer = _get_layer_config(result)
        assert "queryable" not in layer

    def test_queryable_true_sets_flag_geojson(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Queryable GeoJSON",
            geojson={"type": "FeatureCollection", "features": []},
            queryable=True,
        )
        layer = _get_layer_config(result)
        assert layer["queryable"] is True


# ---------------------------------------------------------------------------
# Cross-cutting: every per-tool returns layer_update
# ---------------------------------------------------------------------------

class TestAllSourceTypesReturnLayerUpdate:
    """Every per-tool function must return layer_update with the correct OL layer type."""

    def test_minimal_args_covers_all_valid_source_types(self):
        """Verify our test data covers all VALID_SOURCE_TYPES."""
        assert set(_MINIMAL_ARGS.keys()) == set(VALID_SOURCE_TYPES)
        assert set(ALL_TOOLS.keys()) == set(VALID_SOURCE_TYPES)

    @pytest.mark.parametrize("source_type", list(_MINIMAL_ARGS.keys()))
    def test_returns_layer_update_with_expected_layer_type(self, source_type):
        result = _call_minimal(source_type)
        assert_layer_update(result, expected_uuid=MAP_UUID)
        config = _get_configuration(result)

        # Derive the expected layer type from the builder so this test
        # never drifts from the actual source_type → layer_type mapping.
        probe = LayerConfigurationBuilder(f"probe {source_type}", source_type)
        if source_type == "GeoJSON":
            probe.set_geojson({
                "type": "FeatureCollection",
                "features": [],
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
            })
        else:
            probe.set_source_properties(**_MINIMAL_BUILDER_PROPS[source_type])
        expected_layer_type = probe.build()["configuration"]["type"]
        assert config["type"] == expected_layer_type


# ---------------------------------------------------------------------------
# Cross-cutting: optional layer props (opacity/min_zoom/max_zoom)
# ---------------------------------------------------------------------------

class TestOptionalLayerPropsPerSourceTypeTools:
    """Optional layer properties — representative tool (add_wms_layer)."""

    def _wms(self, **overrides):
        kwargs = dict(
            map_uuid=MAP_UUID,
            name="WMS",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        kwargs.update(overrides)
        return add_wms_layer(**kwargs)

    def test_opacity_set(self):
        result = self._wms(opacity=0.5)
        props = _get_configuration(result)["props"]
        assert props["opacity"] == 0.5

    def test_min_zoom_set(self):
        result = self._wms(min_zoom=5)
        props = _get_configuration(result)["props"]
        assert props["minZoom"] == 5

    def test_max_zoom_set(self):
        result = self._wms(max_zoom=15)
        props = _get_configuration(result)["props"]
        assert props["maxZoom"] == 15

    def test_optional_props_omitted_when_not_set(self):
        result = self._wms()
        props = _get_configuration(result)["props"]
        assert "opacity" not in props
        assert "minZoom" not in props
        assert "maxZoom" not in props


# ---------------------------------------------------------------------------
# attributeVariables shape (ESRI vs non-ESRI keying)
# ---------------------------------------------------------------------------

class TestAttributeVariablesShape:
    """Multi- and single-entry attribute_variables persisted shape."""

    def test_multi_entry_attribute_variables_persist_correctly(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Cities",
            geojson={"type": "FeatureCollection", "features": []},
            attribute_variables={
                "name": "city_var",
                "population": "pop_var",
            },
        )
        layer = result["layer_update"]["layer"]
        assert layer["attributeVariables"] == {
            "Cities": {
                "name": "city_var",
                "population": "pop_var",
            }
        }

    def test_single_entry_attribute_variables_persist_correctly(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Cities",
            geojson={"type": "FeatureCollection", "features": []},
            attribute_variables={"name": "city_var"},
        )
        layer = result["layer_update"]["layer"]
        assert layer["attributeVariables"] == {
            "Cities": {"name": "city_var"}
        }


# ---------------------------------------------------------------------------
# Advanced metadata (source_props / layer_props / popup_options / legend / style)
# ---------------------------------------------------------------------------

class TestAdvancedMetadata:
    """Advanced metadata dicts and conflict policy — representative tools."""

    SAMPLE_GEOJSON = {
        "type": "FeatureCollection",
        "features": [],
    }

    def test_source_props_merge_into_source_props(self):
        result = add_image_tile_layer(
            map_uuid=MAP_UUID,
            name="Tiles With Projection",
            url="https://example.com/{z}/{x}/{y}.png",
            source_props={"projection": "EPSG:3857"},
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://example.com/{z}/{x}/{y}.png"
        assert source["props"]["projection"] == "EPSG:3857"

    def test_source_props_override_flat_for_overlapping_keys(self):
        # Source-level overlap is resolved by advanced-dict-wins.
        result = add_image_tile_layer(
            map_uuid=MAP_UUID,
            name="Override URL via source_props",
            url="https://example.com/{z}/{x}/{y}.png",
            source_props={"url": "https://override.example.com/{z}/{x}/{y}.png"},
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://override.example.com/{z}/{x}/{y}.png"

    def test_layer_props_persist_under_configuration_props(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="Zoom-Bounded WMS",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minResolution": 10, "maxResolution": 1000, "minZoomQuery": 8},
        )
        config = _get_configuration(result)
        assert config["props"]["minResolution"] == 10
        assert config["props"]["maxResolution"] == 1000
        assert config["props"]["minZoomQuery"] == 8

    def test_layer_props_unknown_key_returns_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bad Key",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"badKey": 1, "minZoom": 5},
        )
        assert "error" in result
        assert "badKey" in result["error"]

    def test_layer_props_wrong_type_returns_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bad Type",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"opacity": "not a number"},
        )
        assert "error" in result
        assert "opacity" in result["error"]

    def test_layer_props_conflicts_with_flat_param_returns_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Conflicting Opacity",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            opacity=0.5,
            layer_props={"opacity": 0.6},
        )
        assert "error" in result
        assert "Conflicting" in result["error"]
        assert "opacity" in result["error"]

    def test_min_zoom_conflict_with_layer_props_returns_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Conflicting MinZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            min_zoom=2,
            layer_props={"minZoom": 5},
        )
        assert "error" in result
        assert "Conflicting" in result["error"]

    def test_max_zoom_conflict_with_layer_props_returns_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Conflicting MaxZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            max_zoom=15,
            layer_props={"maxZoom": 10},
        )
        assert "error" in result
        assert "Conflicting" in result["error"]

    def test_legend_string_persists_at_top_level(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS With Legend",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            legend="default",
        )
        layer = result["layer_update"]["layer"]
        assert layer["legend"] == "default"

    def test_style_dict_persists_under_configuration_style(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Styled Cities",
            geojson=self.SAMPLE_GEOJSON,
            style={"version": 8, "sources": {}, "layers": []},
        )
        config = _get_configuration(result)
        assert config["style"]["version"] == 8

    def test_popup_options_aliases_persist_at_attribute_aliases(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Cities",
            geojson=self.SAMPLE_GEOJSON,
            popup_options={
                "aliases": {"Cities": {"pop": "Population"}},
            },
        )
        layer = result["layer_update"]["layer"]
        assert layer["attributeAliases"] == {"Cities": {"pop": "Population"}}

    def test_popup_options_omit_persist_at_omitted_popup_attributes(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Cities",
            geojson=self.SAMPLE_GEOJSON,
            popup_options={"omit": {"Cities": ["sensitive_field"]}},
        )
        layer = result["layer_update"]["layer"]
        assert layer["omittedPopupAttributes"] == {"Cities": ["sensitive_field"]}

    def test_advanced_dicts_accepted_as_json_strings(self):
        """LLM providers may serialize dict args as JSON strings — boundary coerces."""
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS JSON-String Dicts",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props='{"minZoom": 3}',
            source_props='{"projection": "EPSG:4326"}',
            popup_options='{"omit": {"WMS JSON-String Dicts": ["x"]}}',
        )
        config = _get_configuration(result)
        assert config["props"]["minZoom"] == 3
        assert config["props"]["source"]["props"]["projection"] == "EPSG:4326"
        assert result["layer_update"]["layer"]["omittedPopupAttributes"] == {
            "WMS JSON-String Dicts": ["x"]
        }


# ---------------------------------------------------------------------------
# source_props per-source-type allowlist
# ---------------------------------------------------------------------------

class TestSourcePropsAllowlist:
    """Per-source-type source_props allowlist enforcement."""

    def test_unknown_source_prop_key_rejected_wms(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bad Source Key",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            source_props={"badKey": "value"},
        )
        assert "error" in result
        assert "badKey" in result["error"]
        assert "WMS" in result["error"]

    def test_known_source_prop_key_accepted_wms(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Good Source Key",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            source_props={"projection": "EPSG:4326"},
        )
        assert "layer_update" in result

    def test_unknown_source_prop_on_image_tile_rejected(self):
        # Image Tile only allows url, attributions, projection.
        result = add_image_tile_layer(
            map_uuid=MAP_UUID,
            name="Image Tile Bad Key",
            url="https://example.com/{z}/{x}/{y}.png",
            source_props={"tileSize": 512},  # PMTiles-only key
        )
        assert "error" in result
        assert "tileSize" in result["error"]


# ---------------------------------------------------------------------------
# Legend URL string (mirrors set_style)
# ---------------------------------------------------------------------------

class TestLegendUrlString:
    """set_legend accepts URL strings (mirrors set_style)."""

    def test_legend_url_string_persists(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS URL Legend",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            legend="https://example.com/legend.png",
        )
        layer = result["layer_update"]["layer"]
        assert layer["legend"] == "https://example.com/legend.png"

    def test_legend_invalid_string_still_rejected(self):
        # A bare word with no slash is neither 'default' nor a URL.
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bad Legend",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            legend="garbage",
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# set_legend(None) idempotent on fresh builder
# ---------------------------------------------------------------------------

class TestSetLegendNoneIdempotent:
    """set_legend(None) on a fresh builder must not raise KeyError."""

    def test_set_legend_none_on_fresh_builder_does_not_raise(self):
        builder = LayerConfigurationBuilder("test", "GeoJSON")
        builder.set_legend(None)
        builder.set_legend(None)


# ---------------------------------------------------------------------------
# layer_props rejects boolean values for numeric keys
# ---------------------------------------------------------------------------

class TestLayerPropsRejectsBoolean:
    """bool is a subclass of int — layer_props={'opacity': True} must be rejected."""

    def test_opacity_true_rejected(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bool Opacity",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"opacity": True},
        )
        assert "error" in result
        assert "opacity" in result["error"]

    def test_min_zoom_false_rejected(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bool MinZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minZoom": False},
        )
        assert "error" in result
        assert "minZoom" in result["error"]


# ---------------------------------------------------------------------------
# layer_props rejects NaN / Infinity
# ---------------------------------------------------------------------------

class TestLayerPropsRejectsNonFinite:
    """NaN / Infinity in numeric layer_props rejected at boundary."""

    def test_nan_min_zoom_rejected(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS NaN MinZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minZoom": float("nan")},
        )
        assert "error" in result
        assert "finite" in result["error"]

    def test_infinity_max_resolution_rejected(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Infinity MaxResolution",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"maxResolution": float("inf")},
        )
        assert "error" in result
        assert "finite" in result["error"]

    def test_negative_infinity_rejected(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS NegInf MinResolution",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minResolution": float("-inf")},
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# Malformed JSON-string inputs surface clean MCP errors
# ---------------------------------------------------------------------------

class TestMalformedJsonStringInputs:
    """Each JSON-coercible param must surface a clean error for malformed JSON."""

    def test_malformed_layer_props_returns_clean_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bad JSON",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props='{"minZoom": 5',  # missing closing brace
        )
        assert "error" in result
        assert "layer_props" in result["error"]

    def test_malformed_source_props_returns_clean_error(self):
        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Bad source_props JSON",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            source_props="{not valid json}",
        )
        assert "error" in result
        assert "source_props" in result["error"]


# ---------------------------------------------------------------------------
# Inline GeoJSON size cap
# ---------------------------------------------------------------------------

class TestGeoJSONInlineSizeCap:
    """Inline GeoJSON feature-count and byte-size caps."""

    @staticmethod
    def _features(n):
        return [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [0, 0]},
                "properties": {"i": i},
            }
            for i in range(n)
        ]

    def test_within_cap_accepted(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Small Cities",
            geojson={"type": "FeatureCollection", "features": self._features(100)},
        )
        assert "layer_update" in result

    def test_feature_count_over_cap_rejected(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Too Many Cities",
            geojson={
                "type": "FeatureCollection",
                "features": self._features(10_001),
            },
        )
        assert "error" in result
        # Per-tool error format pins the count + the cap so the LLM has
        # the exact numbers it needs to either downsample or override.
        assert "10001" in result["error"]
        assert "feature cap" in result["error"]

    def test_byte_size_over_cap_rejected(self, monkeypatch):
        monkeypatch.setenv("TETHYSDASH_MCP_GEOJSON_MAX_BYTES", "1024")
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Too Big",
            geojson={
                "type": "FeatureCollection",
                "features": self._features(50),
            },
        )
        assert "error" in result
        assert "byte cap" in result["error"]

    def test_env_var_override_raises_feature_cap(self, monkeypatch):
        monkeypatch.setenv("TETHYSDASH_MCP_GEOJSON_MAX_FEATURES", "20000")
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Big But Allowed",
            geojson={
                "type": "FeatureCollection",
                "features": self._features(15_000),
            },
        )
        assert "layer_update" in result

    def test_geojson_url_path_unaffected_by_cap(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Hosted",
            geojson_url="https://example.com/huge.geojson",
        )
        assert "layer_update" in result

    def test_features_none_returns_validation_error_not_typeerror(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Bad Features",
            geojson={"type": "FeatureCollection", "features": None},
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# GeoJSON cap env-var parsing — invalid values fall back to module default
# ---------------------------------------------------------------------------

class TestGeojsonCapEnvVarParsing:
    """Operator misconfig of cap env vars must not crash imports."""

    def test_invalid_env_value_falls_back_to_module_default(self, monkeypatch):
        monkeypatch.setenv("TETHYSDASH_MCP_GEOJSON_MAX_FEATURES", "ten thousand")
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="Resilient To Bad Env",
            geojson={"type": "FeatureCollection", "features": []},
        )
        assert "layer_update" in result


# ---------------------------------------------------------------------------
# Layer visibility (Plan 2026-05-07-004 Unit C)
# ---------------------------------------------------------------------------

class TestLayerVisibility:
    """Flat `visible` parameter dispatches to layerVisibility."""

    def _wms(self, **overrides):
        kwargs = dict(
            map_uuid=MAP_UUID,
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        kwargs.update(overrides)
        return add_wms_layer(**kwargs)

    def test_visible_false_persists_layer_visibility_false(self):
        result = self._wms(visible=False)
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False

    def test_visible_true_persists_layer_visibility_true(self):
        result = self._wms(visible=True)
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is True

    def test_visible_omitted_no_layer_visibility_key(self):
        result = self._wms()
        assert "error" not in result, result
        config = _get_configuration(result)
        assert "layerVisibility" not in config

    def test_visible_works_for_geojson(self):
        result = add_geojson_layer(
            map_uuid=MAP_UUID,
            name="GeoJSON Layer",
            geojson={"type": "FeatureCollection", "features": []},
            visible=False,
        )
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False

    def test_visible_works_for_geotiff(self):
        result = add_geotiff_layer(
            map_uuid=MAP_UUID,
            name="DEM",
            url="https://example.com/dem.tif",
            visible=False,
        )
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False

    def test_visible_combined_with_other_layer_props(self):
        result = self._wms(
            visible=False,
            opacity=0.5,
            queryable=True,
        )
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False
        assert config["props"]["opacity"] == 0.5


# ---------------------------------------------------------------------------
# UUID validation across all 11 per-source-type tools
# ---------------------------------------------------------------------------

class TestUuidValidationPerSourceTypeTools:
    """`map_uuid` must be a well-formed UUID string. The literal placeholder
    `{{last_map_uuid}}` (and other Mustache-style template forms) that some
    LLMs emit for chained tool args must be rejected with a structured
    `invalid_uuid:` envelope so the LLM gets an in-band fix-hint.

    Same _validate_uuid_arg helper is used by all 11 per-tool functions.
    """

    @pytest.mark.parametrize("source_type", list(_MINIMAL_ARGS.keys()))
    def test_template_placeholder_rejected_per_tool(self, source_type):
        tool = ALL_TOOLS[source_type]
        result = tool(
            map_uuid="{{last_map_uuid}}",
            name="Layer",
            **_MINIMAL_ARGS[source_type],
        )
        assert "error" in result
        err = result["error"]
        assert err.startswith("invalid_uuid:"), (source_type, err)
        assert "map_uuid" in err
        assert "create_map_visualization" in err

    @pytest.mark.parametrize("source_type", list(_MINIMAL_ARGS.keys()))
    def test_dollar_brace_placeholder_rejected_per_tool(self, source_type):
        tool = ALL_TOOLS[source_type]
        result = tool(
            map_uuid="${last_map_uuid}",
            name="Layer",
            **_MINIMAL_ARGS[source_type],
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    @pytest.mark.parametrize("source_type", list(_MINIMAL_ARGS.keys()))
    def test_empty_string_rejected_per_tool(self, source_type):
        tool = ALL_TOOLS[source_type]
        result = tool(
            map_uuid="",
            name="Layer",
            **_MINIMAL_ARGS[source_type],
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    @pytest.mark.parametrize("source_type", list(_MINIMAL_ARGS.keys()))
    def test_garbage_string_rejected_per_tool(self, source_type):
        tool = ALL_TOOLS[source_type]
        result = tool(
            map_uuid="not-a-uuid",
            name="Layer",
            **_MINIMAL_ARGS[source_type],
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_valid_uuid_v4_lowercase_accepted(self):
        result = add_wms_layer(
            map_uuid="11111111-1111-4111-8111-111111111111",
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        assert "error" not in result, result
        assert "layer_update" in result

    def test_valid_uuid_uppercase_accepted(self):
        result = add_wms_layer(
            map_uuid="11111111-1111-4111-8111-111111111111".upper(),
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        assert "error" not in result, result
        assert "layer_update" in result

    def test_uuid_with_extra_hex_digit_rejected(self):
        result = add_wms_layer(
            map_uuid="11111111-1111-4111-8111-111111111111a",
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_uuid_with_surrounding_whitespace_rejected(self):
        result = add_wms_layer(
            map_uuid=" 11111111-1111-4111-8111-111111111111 ",
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_template_hint_mentions_template_or_literal(self):
        """The error message must hint the LLM about templating."""
        result = add_wms_layer(
            map_uuid="{{last_map_uuid}}",
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        err = result["error"]
        assert "template" in err.lower() or "literal" in err.lower()
        assert "whitelist_rejected" not in err

    def test_validation_runs_before_other_checks(self):
        """A malformed map_uuid surfaces the UUID error even when other
        required args are missing."""
        # add_geojson_layer is convenient: omitting both geojson and
        # geojson_url is its own error path; with bad map_uuid, the
        # UUID error must win.
        result = add_geojson_layer(
            map_uuid="{{last_map_uuid}}",
            name="Layer",
            # geojson and geojson_url omitted — would normally produce its own error.
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")


# ---------------------------------------------------------------------------
# Per-tool params rejection — types that don't accept params have NO
# `params` keyword argument in their signature
# ---------------------------------------------------------------------------

class TestParamsRejection:
    """The 7 source types that don't consume `params` server-side are
    enforced at the tool's signature level — the per-tool function does
    NOT accept a `params` keyword argument. This makes the no-params
    contract a TypeError at call-time rather than a runtime envelope.

    The 4 source types that DO consume `params` (WMS, ESRI Image,
    ESRI Feature, Static Image) are checked separately — but Static
    Image promotes its old `params={projection, imageExtent}` to flat
    `projection`/`image_extent`, so it also has no `params` parameter.
    """

    # Tools that accept a `params` keyword argument.
    TOOLS_ACCEPT_PARAMS = {
        "WMS": add_wms_layer,
        "ESRI Image and Map Service": add_esri_image_layer,
        "ESRI Feature Service": add_esri_feature_layer,
    }

    # Tools that do NOT accept a `params` keyword argument.
    TOOLS_REJECT_PARAMS = {
        "GeoJSON": add_geojson_layer,
        "KML": add_kml_layer,
        "Image Tile": add_image_tile_layer,
        "Vector Tile": add_vector_tile_layer,
        "PMTiles Vector": add_pmtiles_vector_layer,
        "PMTiles Raster": add_pmtiles_raster_layer,
        "GeoTIFF": add_geotiff_layer,
        "Static Image": add_static_image_layer,
    }

    @pytest.mark.parametrize(
        "source_type,tool",
        sorted(TOOLS_REJECT_PARAMS.items()),
    )
    def test_tool_signature_omits_params(self, source_type, tool):
        """params is not in the signature of tools that don't consume it."""
        sig = inspect.signature(tool)
        assert "params" not in sig.parameters, (
            f"{tool.__name__} ({source_type}) must NOT accept a `params` "
            f"keyword argument; the renderer for this source type does "
            f"not consume it. Found params in signature."
        )

    @pytest.mark.parametrize(
        "source_type,tool",
        sorted(TOOLS_ACCEPT_PARAMS.items()),
    )
    def test_consuming_tool_signature_has_params(self, source_type, tool):
        """Counter-test: the 3 tools that DO consume `params` accept it."""
        sig = inspect.signature(tool)
        assert "params" in sig.parameters, (
            f"{tool.__name__} ({source_type}) MUST accept a `params` "
            f"keyword argument."
        )

    @pytest.mark.parametrize(
        "source_type,tool",
        sorted(TOOLS_REJECT_PARAMS.items()),
    )
    def test_calling_with_params_raises_typeerror(self, source_type, tool):
        """Calling a non-accepting tool with params= raises TypeError."""
        kwargs = dict(_MINIMAL_ARGS[source_type])
        with pytest.raises(TypeError):
            tool(
                map_uuid=MAP_UUID,
                name="Layer",
                params={"foo": "bar"},
                **kwargs,
            )

    def test_consuming_types_still_accept_params(self):
        """Regression pin: WMS / ESRI Image / ESRI Feature accept params."""
        result = add_esri_feature_layer(
            map_uuid=MAP_UUID,
            name="Boundary",
            url="https://example.com/arcgis/rest/services/X/FeatureServer",
            layer_id="0",
            params={"WHERE": "id = 1"},
        )
        assert "layer_update" in result, result

        result = add_wms_layer(
            map_uuid=MAP_UUID,
            name="WMS Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            params={"STYLES": "default"},
        )
        assert "layer_update" in result, result
