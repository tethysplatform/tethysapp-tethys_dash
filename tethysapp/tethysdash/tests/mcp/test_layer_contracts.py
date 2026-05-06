"""Contract tests for add_map_service_layer across all 9 source types.

Validates: layer_update return shape, correct OpenLayers layer type,
required source props per source type, GeoJSON placement, ESRI
attributeVariables key resolution, queryable flag, and error paths.

Layer 1 tests -- no browser, no server, milliseconds per test.
"""

from unittest.mock import patch

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
    add_map_service_layer,
    VALID_SOURCE_TYPES,
)
from tethysapp.tethysdash.plugin_helpers import LayerConfigurationBuilder
from tethysapp.tethysdash.tests.mcp.test_visualization_contracts import (
    assert_layer_update,
)


MAP_UUID = "test-map-uuid-1234"


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


# ---------------------------------------------------------------------------
# WMS
# ---------------------------------------------------------------------------

class TestWMS:
    """WMS source type contract tests."""

    def test_wms_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_wms_layer_type_is_image_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        config = _get_configuration(result)
        assert config["type"] == "ImageLayer"

    def test_wms_source_type(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        source = _get_source(result)
        assert source["type"] == "WMS"

    def test_wms_source_props_params_layers(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="My WMS Layer",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://example.com/wms"
        assert source["props"]["params"]["LAYERS"] == "workspace:layer_name"

    def test_wms_error_without_wms_layers(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="My WMS Layer",
            url="https://example.com/wms",
        )
        assert "error" in result
        assert "wms_layers" in result["error"]


# ---------------------------------------------------------------------------
# ESRI Image and Map Service
# ---------------------------------------------------------------------------

class TestESRIImage:
    """ESRI Image and Map Service source type contract tests."""

    def test_esri_image_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_esri_image_layer_type_is_image_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        config = _get_configuration(result)
        assert config["type"] == "ImageLayer"

    def test_esri_image_source_params_layers(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_esri_image_error_without_url(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
        )
        assert "error" in result
        assert "url" in result["error"]

    @patch(
        "tethysapp.tethysdash.mcp.tethysdash_mcp_server._resolve_esri_layer_name",
        return_value="River Gauges",
    )
    def test_esri_image_attribute_variables_key_resolved(self, mock_resolve):
        """ESRI Image attributeVariables key uses service layer name, not display name."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
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
    def test_esri_image_attribute_variables_fallback_to_display_name(self, mock_resolve):
        """When _resolve_esri_layer_name fails, falls back to display name."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        assert "attributeVariables" in layer
        assert "My Display Name" in layer["attributeVariables"]

    # -----------------------------------------------------------------------
    # LAYERS canonicalization (plan 2026-05-05-001 Unit 5).
    # Bare `layer_id` and bare LLM-supplied `params={"LAYERS": ...}` both get
    # normalized to `show:` form post-overlay so the persisted-shape invariant
    # is uniform regardless of input path.
    # -----------------------------------------------------------------------

    def test_esri_image_canonicalizes_bare_layer_id(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_esri_image_canonicalizes_bare_layer_id_comma_list(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0,1",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0,1"

    def test_esri_image_passes_through_show_layer_id(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="show:0",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_esri_image_passes_through_hide_layer_id(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="hide:1",
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "hide:1"

    def test_esri_image_passes_through_include_and_exclude_directives(self):
        for directive in ("include:0", "exclude:1"):
            result = add_map_service_layer(
                map_uuid=MAP_UUID,
                source_type="ESRI Image and Map Service",
                name="ESRI Image Layer",
                url="https://example.com/arcgis/rest/services/MyService/MapServer",
                layer_id=directive,
            )
            source = _get_source(result)
            assert source["props"]["params"]["LAYERS"] == directive

    def test_esri_image_no_layer_id_no_layers_key(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
        )
        source = _get_source(result)
        # No layer_id and no params supplied → no LAYERS key in resulting source props.
        assert "params" not in source["props"] or "LAYERS" not in source["props"].get("params", {})

    def test_esri_image_canonicalizes_bare_llm_supplied_params_layers(self):
        """Closes the regression vector where the LLM uses params={'LAYERS': '0'}
        instead of layer_id='0'. Post-overlay canonicalization catches both paths."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "0"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0"

    def test_esri_image_canonicalizes_bare_llm_supplied_comma_list(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "0,1,2"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "show:0,1,2"

    def test_esri_image_passes_through_canonical_llm_supplied_params(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "hide:1"},
        )
        source = _get_source(result)
        assert source["props"]["params"]["LAYERS"] == "hide:1"

    def test_esri_image_llm_supplied_params_wins_then_canonicalized(self):
        """Existing precedence: LLM-supplied params overrides layer_id-derived value.
        New behavior: the winning value is then canonicalized post-overlay. Bare
        LLM-supplied LAYERS gets `show:` prefix even when layer_id was also supplied."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",
            params={"LAYERS": "1,2"},
        )
        source = _get_source(result)
        # LLM-supplied params={"LAYERS": "1,2"} won over layer_id="0", then got canonicalized.
        assert source["props"]["params"]["LAYERS"] == "show:1,2"

    def test_esri_image_other_params_keys_pass_through_unchanged(self):
        """Canonicalization is narrowly scoped to LAYERS. Other LLM-supplied keys
        continue to pass through verbatim per existing semantics."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
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
    def test_esri_image_resolve_layer_name_works_post_canonicalization(self, mock_resolve):
        """_resolve_esri_layer_name handles both '0' and 'show:0' via split(':')[-1].
        Lock-in test: canonicalization runs before attributeVariables resolution and
        the helper still returns the correct service layer name."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            layer_id="0",  # bare → canonicalized to "show:0"
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        # Canonicalized LAYERS value persisted.
        assert layer["configuration"]["props"]["source"]["props"]["params"]["LAYERS"] == "show:0"
        # _resolve_esri_layer_name still resolved correctly (mock returned "River Gauges").
        assert "River Gauges" in layer["attributeVariables"]
        # The resolver is called with the post-canonicalization LAYERS value
        # (`"show:0"`), not the raw `layer_id` argument. This catches both
        # input paths (layer_id and params={"LAYERS": ...}) uniformly. The
        # resolver itself handles "show:0" via split(":")[-1] (line 685).
        mock_resolve.assert_called_once_with(
            "https://example.com/arcgis/rest/services/MyService/MapServer", "show:0"
        )

    @patch(
        "tethysapp.tethysdash.mcp.tethysdash_mcp_server._resolve_esri_layer_name",
        return_value="River Gauges",
    )
    def test_esri_image_params_path_resolves_attribute_variables_correctly(self, mock_resolve):
        """When the LLM uses `params={"LAYERS": "0"}` (no `layer_id`) together with
        `attribute_variables`, the canonicalization writes `show:0` to params.LAYERS AND
        the attributeVariables key resolves to the ESRI service layer name (not the
        display name). Closes the params-path gap surfaced by ce:review (Finding 1):
        before the fix, `_resolve_esri_layer_name` received the raw `layer_id=None` and
        returned None, falling back to the display name. After the fix, the resolver is
        called with the post-canonicalization LAYERS value, so both input paths produce
        the same ESRI-service-name key."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="My Display Name",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": "0"},  # params path — no `layer_id` argument
            attribute_variables={"STAGE": "stage_var"},
        )
        layer = _get_layer_config(result)
        # Canonicalization fired for params.LAYERS persistence.
        assert layer["configuration"]["props"]["source"]["props"]["params"]["LAYERS"] == "show:0"
        # Resolver was called with the canonicalized value (the same shape as the
        # layer_id path). attributeVariables key is the ESRI service layer name.
        mock_resolve.assert_called_once_with(
            "https://example.com/arcgis/rest/services/MyService/MapServer", "show:0"
        )
        assert "River Gauges" in layer["attributeVariables"]
        assert "My Display Name" not in layer["attributeVariables"]
        assert layer["attributeVariables"]["River Gauges"] == {"STAGE": "stage_var"}

    def test_esri_image_canonicalizes_integer_layers_value(self):
        """Closes review Finding 3: a non-string LAYERS value (e.g. an LLM passing
        `params={"LAYERS": 0}` as an integer) is coerced to string and canonicalized.
        Before the fix, the `isinstance(..., str)` guard caused integer values to bypass
        canonicalization entirely — persisting `params.LAYERS = 0` (integer), which the
        frontend's `normalizeLayersParam` correctly rejects as non-string and falls back
        to defaultVisibility. The silent semantic miss is closed by str() coercion."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Image and Map Service",
            name="ESRI Image Layer",
            url="https://example.com/arcgis/rest/services/MyService/MapServer",
            params={"LAYERS": 0},  # integer, not string
        )
        source = _get_source(result)
        # Coerced to "0" then canonicalized to "show:0".
        assert source["props"]["params"]["LAYERS"] == "show:0"


# ---------------------------------------------------------------------------
# ESRI Feature Service
# ---------------------------------------------------------------------------

class TestESRIFeature:
    """ESRI Feature Service source type contract tests."""

    def test_esri_feature_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_esri_feature_layer_type_is_vector_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorLayer"

    def test_esri_feature_source_props_layer_is_integer(self):
        """layer_id is coerced to int in source.props.layer."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        source = _get_source(result)
        assert source["props"]["layer"] == 0
        assert isinstance(source["props"]["layer"], int)

    def test_esri_feature_error_without_layer_id(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
        )
        assert "error" in result
        assert "layer_id" in result["error"]


# ---------------------------------------------------------------------------
# GeoJSON
# ---------------------------------------------------------------------------

class TestGeoJSON:
    """GeoJSON source type contract tests."""

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

    def test_geojson_inline_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_geojson_inline_layer_type_is_vector_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorLayer"

    def test_geojson_inline_data_at_source_top_level(self):
        """GeoJSON data must be at source.geojson, NOT source.props.geojson."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        source = _get_source(result)
        # Data at source.geojson (top level on source object)
        assert "geojson" in source, "GeoJSON data must be at source.geojson"
        assert source["geojson"]["type"] == "FeatureCollection"
        # NOT at source.props.geojson
        assert "geojson" not in source["props"], (
            "GeoJSON data must NOT be at source.props.geojson"
        )

    def test_geojson_inline_crs_auto_assigned(self):
        """CRS is auto-assigned when missing from inline GeoJSON."""
        geojson_no_crs = dict(self.SAMPLE_GEOJSON)  # no crs key
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Inline GeoJSON",
            geojson=geojson_no_crs,
        )
        source = _get_source(result)
        crs = source["geojson"]["crs"]
        assert crs["type"] == "name"
        assert crs["properties"]["name"] == "EPSG:4326"

    def test_geojson_inline_preserves_existing_crs(self):
        """If GeoJSON already has a CRS, it is preserved."""
        geojson_with_crs = dict(self.SAMPLE_GEOJSON)
        geojson_with_crs["crs"] = {
            "type": "name",
            "properties": {"name": "EPSG:3857"},
        }
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Inline GeoJSON",
            geojson=geojson_with_crs,
        )
        source = _get_source(result)
        assert source["geojson"]["crs"]["properties"]["name"] == "EPSG:3857"

    def test_geojson_url_at_source_top_level(self):
        """GeoJSON URL is a string at source.geojson (top level)."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="URL GeoJSON",
            geojson_url="https://example.com/data.geojson",
        )
        source = _get_source(result)
        assert source["geojson"] == "https://example.com/data.geojson"
        assert "geojson" not in source["props"]

    def test_geojson_source_props_is_empty(self):
        """GeoJSON source.props should be empty dict (data is at top level)."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Inline GeoJSON",
            geojson=self.SAMPLE_GEOJSON,
        )
        source = _get_source(result)
        assert source["props"] == {}

    def test_geojson_attribute_variables_key_is_display_name(self):
        """Non-ESRI types use the display name as attributeVariables key."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="City Points",
            geojson=self.SAMPLE_GEOJSON,
            attribute_variables={"name": "city_var"},
        )
        layer = _get_layer_config(result)
        assert "attributeVariables" in layer
        assert "City Points" in layer["attributeVariables"]
        assert layer["attributeVariables"]["City Points"] == {"name": "city_var"}

    def test_geojson_error_without_data_or_url(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Missing GeoJSON",
        )
        assert "error" in result
        assert "geojson" in result["error"].lower()


# ---------------------------------------------------------------------------
# KML
# ---------------------------------------------------------------------------

class TestKML:
    """KML source type contract tests."""

    def test_kml_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="KML",
            name="KML Layer",
            url="https://example.com/data.kml",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_kml_layer_type_is_vector_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="KML",
            name="KML Layer",
            url="https://example.com/data.kml",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorLayer"

    def test_kml_source_props_url(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="KML",
            name="KML Layer",
            url="https://example.com/data.kml",
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://example.com/data.kml"


# ---------------------------------------------------------------------------
# Image Tile
# ---------------------------------------------------------------------------

class TestImageTile:
    """Image Tile source type contract tests."""

    def test_image_tile_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Image Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.png",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_image_tile_layer_type_is_tile_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Image Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.png",
        )
        config = _get_configuration(result)
        assert config["type"] == "TileLayer"

    def test_image_tile_source_type(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Image Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.png",
        )
        source = _get_source(result)
        assert source["type"] == "Image Tile"


# ---------------------------------------------------------------------------
# Vector Tile
# ---------------------------------------------------------------------------

class TestVectorTile:
    """Vector Tile source type contract tests."""

    def test_vector_tile_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Vector Tile",
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_vector_tile_layer_type_is_vector_tile_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Vector Tile",
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorTileLayer"

    def test_vector_tile_source_type(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Vector Tile",
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        source = _get_source(result)
        assert source["type"] == "Vector Tile"

    def test_vector_tile_source_props_uses_urls_key(self):
        """Vector Tile uses 'urls' (plural), not 'url'."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Vector Tile",
            name="Vector Tile Layer",
            url="https://example.com/tiles/{z}/{x}/{y}.pbf",
        )
        source = _get_source(result)
        assert source["props"]["urls"] == "https://example.com/tiles/{z}/{x}/{y}.pbf"


# ---------------------------------------------------------------------------
# PMTiles Vector
# ---------------------------------------------------------------------------

class TestPMTilesVector:
    """PMTiles Vector source type contract tests."""

    def test_pmtiles_vector_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Vector",
            name="PMTiles Vector Layer",
            url="https://example.com/data.pmtiles",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_pmtiles_vector_layer_type_is_vector_tile_layer(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Vector",
            name="PMTiles Vector Layer",
            url="https://example.com/data.pmtiles",
        )
        config = _get_configuration(result)
        assert config["type"] == "VectorTileLayer"

    def test_pmtiles_vector_source_type(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Vector",
            name="PMTiles Vector Layer",
            url="https://example.com/data.pmtiles",
        )
        source = _get_source(result)
        assert source["type"] == "PMTiles Vector"


# ---------------------------------------------------------------------------
# PMTiles Raster
# ---------------------------------------------------------------------------

class TestPMTilesRaster:
    """PMTiles Raster source type contract tests."""

    def test_pmtiles_raster_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Raster",
            name="PMTiles Raster Layer",
            url="https://example.com/data.pmtiles",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_pmtiles_raster_layer_type_is_webgl_tile(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Raster",
            name="PMTiles Raster Layer",
            url="https://example.com/data.pmtiles",
        )
        config = _get_configuration(result)
        assert config["type"] == "WebGLTile"

    def test_pmtiles_raster_source_type(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Raster",
            name="PMTiles Raster Layer",
            url="https://example.com/data.pmtiles",
        )
        source = _get_source(result)
        assert source["type"] == "PMTiles Raster"


# ---------------------------------------------------------------------------
# Cross-cutting: queryable flag
# ---------------------------------------------------------------------------

class TestQueryable:
    """Queryable flag contract tests."""

    def test_queryable_true_sets_flag(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="Queryable WMS",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
            queryable=True,
        )
        layer = _get_layer_config(result)
        assert layer["queryable"] is True

    def test_queryable_false_omits_flag(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="Non-Queryable WMS",
            url="https://example.com/wms",
            wms_layers="workspace:layer_name",
            queryable=False,
        )
        layer = _get_layer_config(result)
        assert "queryable" not in layer


# ---------------------------------------------------------------------------
# Cross-cutting: all source types return layer_update shape
# ---------------------------------------------------------------------------

class TestAllSourceTypesReturnLayerUpdate:
    """Every valid source type must return layer_update, NOT visualization."""

    # Minimal valid args for each source type
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
        "Static Image": dict(
            url="https://x.com/image.png",
            params={"projection": "EPSG:4326", "imageExtent": "0,0,10,10"},
        ),
    }

    # Minimal source-prop kwargs to satisfy the builder's required-field
    # validation when probing the source_type → layer_type mapping.
    # GeoJSON is handled separately via set_geojson.
    _MINIMAL_BUILDER_PROPS = {
        "WMS": dict(url="https://x.com/wms", params={"LAYERS": "ws:layer"}),
        "ESRI Image and Map Service": dict(url="https://x.com/esri"),
        "ESRI Feature Service": dict(url="https://x.com/esri", layer=0),
        "KML": dict(url="https://x.com/data.kml"),
        "Image Tile": dict(url="https://x.com/tiles/{z}/{x}/{y}.png"),
        "Vector Tile": dict(urls="https://x.com/tiles/{z}/{x}/{y}.pbf"),
        "PMTiles Vector": dict(url="https://x.com/data.pmtiles"),
        "PMTiles Raster": dict(url="https://x.com/data.pmtiles"),
        "Static Image": dict(
            url="https://x.com/image.png",
            projection="EPSG:4326",
            imageExtent="0,0,10,10",
        ),
    }

    def test_all_valid_source_types_covered(self):
        """Verify our test data covers all VALID_SOURCE_TYPES."""
        assert set(self._MINIMAL_ARGS.keys()) == set(VALID_SOURCE_TYPES)

    def test_wms_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("WMS")

    def test_esri_image_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("ESRI Image and Map Service")

    def test_esri_feature_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("ESRI Feature Service")

    def test_geojson_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("GeoJSON")

    def test_kml_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("KML")

    def test_image_tile_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("Image Tile")

    def test_vector_tile_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("Vector Tile")

    def test_pmtiles_vector_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("PMTiles Vector")

    def test_pmtiles_raster_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("PMTiles Raster")

    def test_static_image_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("Static Image")

    def _assert_source_type_returns_layer_update(self, source_type):
        args = self._MINIMAL_ARGS[source_type]
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type=source_type,
            name=f"Test {source_type}",
            **args,
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)
        # Also verify correct OL layer type. The builder owns the
        # source_type → layer_type mapping; deriving the expected value
        # from the builder (rather than a duplicate Python constant)
        # ensures this test never drifts from the actual mapping.
        config = _get_configuration(result)
        # LayerConfigurationBuilder.build() emits the layer type at
        # configuration.type — same path the assertion checks. Construct
        # a probe builder to read the mapping for this source_type.
        # Use minimal source props that satisfy the builder's required-
        # field validation; the layer type is independent of source props.
        probe = LayerConfigurationBuilder(f"probe {source_type}", source_type)
        if source_type == "GeoJSON":
            probe.set_geojson({
                "type": "FeatureCollection",
                "features": [],
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
            })
        else:
            probe.set_source_properties(**self._MINIMAL_BUILDER_PROPS[source_type])
        expected_layer_type = probe.build()["configuration"]["type"]
        assert config["type"] == expected_layer_type


# ---------------------------------------------------------------------------
# Error paths
# ---------------------------------------------------------------------------

class TestErrors:
    """Error path contract tests."""

    def test_invalid_source_type_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="InvalidType",
            name="Bad Layer",
            url="https://example.com",
        )
        assert "error" in result
        assert "Invalid source_type" in result["error"]
        # Error message should list valid types
        for st in VALID_SOURCE_TYPES:
            assert st in result["error"]

    def test_wms_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS No URL",
            wms_layers="workspace:layer_name",
        )
        assert "error" in result

    def test_esri_feature_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI No URL",
            layer_id="0",
        )
        assert "error" in result

    def test_kml_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="KML",
            name="KML No URL",
        )
        assert "error" in result

    def test_image_tile_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Image Tile No URL",
        )
        assert "error" in result

    def test_vector_tile_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Vector Tile",
            name="Vector Tile No URL",
        )
        assert "error" in result

    def test_pmtiles_vector_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Vector",
            name="PMTiles Vector No URL",
        )
        assert "error" in result

    def test_pmtiles_raster_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="PMTiles Raster",
            name="PMTiles Raster No URL",
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# Optional layer properties
# ---------------------------------------------------------------------------

class TestOptionalLayerProps:
    """Optional layer properties (opacity, minZoom, maxZoom)."""

    def test_opacity_set(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="Opacity WMS",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            opacity=0.5,
        )
        props = _get_configuration(result)["props"]
        assert props["opacity"] == 0.5

    def test_min_zoom_set(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="MinZoom WMS",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            min_zoom=5,
        )
        props = _get_configuration(result)["props"]
        assert props["minZoom"] == 5

    def test_max_zoom_set(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="MaxZoom WMS",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            max_zoom=15,
        )
        props = _get_configuration(result)["props"]
        assert props["maxZoom"] == 15

    def test_optional_props_omitted_when_not_set(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="Minimal WMS",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        props = _get_configuration(result)["props"]
        assert "opacity" not in props
        assert "minZoom" not in props
        assert "maxZoom" not in props


# Plan 004 R2 — Static Image is the canonical "missing source type" the
# refactor closes. These tests pin the persisted shape against the
# renderer-side contract (ModuleLoader.js:35 special-cases imageExtent
# string → numeric array, so a string is the right persisted form).
class TestStaticImage:
    def test_static_image_minimal(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Static Image",
            name="Aerial Photo",
            url="https://example.com/aerial.png",
            params={"projection": "EPSG:4326", "imageExtent": "-180,-90,180,90"},
        )
        config = _get_configuration(result)
        assert config["type"] == "ImageLayer"
        source = config["props"]["source"]
        assert source["type"] == "Static Image"
        assert source["props"]["url"] == "https://example.com/aerial.png"
        assert source["props"]["projection"] == "EPSG:4326"
        # imageExtent persists as a string — ModuleLoader.js:35-41 splits
        # it to a numeric array at render time. Verifying the persisted
        # form here would be too strict if the renderer's contract changes.
        assert source["props"]["imageExtent"] == "-180,-90,180,90"

    def test_static_image_without_url_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Static Image",
            name="Aerial No URL",
        )
        assert "error" in result

    def test_static_image_without_required_extent_returns_error(self):
        # The builder validates required source props (url, projection,
        # imageExtent) per available_source_properties. Missing
        # imageExtent should surface as an MCP error, not a stack trace.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Static Image",
            name="Aerial Partial",
            url="https://example.com/aerial.png",
            params={"projection": "EPSG:4326"},
        )
        assert "error" in result

    def test_static_image_without_required_projection_returns_error(self):
        # Symmetric coverage: projection missing while imageExtent present.
        # The original Static Image guard tests only exercised the missing-
        # imageExtent half of the OR condition; this pins the other half.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Static Image",
            name="Aerial No Projection",
            url="https://example.com/aerial.png",
            params={"imageExtent": "0,0,10,10"},
        )
        assert "error" in result

    def test_static_image_with_none_extent_returns_error(self):
        # Plan-004 review finding #6: an LLM passing imageExtent=None would
        # otherwise pass the MCP guard (key present) AND _validate_required_fields
        # (key in dict), persisting None to source.props.imageExtent and
        # crashing the renderer. Both layers now treat None as missing.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Static Image",
            name="Aerial None Extent",
            url="https://example.com/aerial.png",
            params={"projection": "EPSG:4326", "imageExtent": None},
        )
        assert "error" in result

    def test_static_image_with_empty_string_extent_returns_error(self):
        # Same defense as the None case for empty-string values.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Static Image",
            name="Aerial Empty Extent",
            url="https://example.com/aerial.png",
            params={"projection": "EPSG:4326", "imageExtent": ""},
        )
        assert "error" in result


# Plan-004 review finding #5: pin the persisted-shape contract for
# multi-entry attribute_variables. The refactor changed
# `attributeVariables = {attr_key: attribute_variables}` (single assignment)
# into a per-(key, variable) loop calling `builder.add_attribute_variable`.
# These tests verify the persisted shape is identical for the flat
# {str: str} input that the type annotation declares.
class TestAttributeVariablesShape:
    def test_multi_entry_attribute_variables_persist_correctly(self):
        # Two attribute fields mapped to two different dashboard variables;
        # the persisted shape must place both under the same attr_key
        # (the layer's display name for non-ESRI sources).
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Cities",
            geojson={
                "type": "FeatureCollection",
                "features": [],
            },
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
        # The before-refactor case: one (field, variable) pair lands at
        # the same persisted shape as the multi-entry case.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Cities",
            geojson={
                "type": "FeatureCollection",
                "features": [],
            },
            attribute_variables={"name": "city_var"},
        )
        layer = result["layer_update"]["layer"]
        assert layer["attributeVariables"] == {
            "Cities": {"name": "city_var"}
        }
