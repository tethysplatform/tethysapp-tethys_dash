"""Contract tests for add_map_service_layer across all source types.

Validates: layer_update return shape, correct OpenLayers layer type,
required source props per source type, GeoJSON placement, ESRI
attributeVariables key resolution, queryable flag, and error paths.

Layer 1 tests -- no browser, no server, milliseconds per test.
"""

from unittest.mock import patch

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
    add_dynamic_map_layer,
    add_map_service_layer,
    VALID_SOURCE_TYPES,
)
from tethysapp.tethysdash.plugin_helpers import LayerConfigurationBuilder
from tethysapp.tethysdash.tests.mcp.test_visualization_contracts import (
    assert_layer_update,
)


# Stable real UUID v4 used by every layer-contract test below.
# Plan 2026-05-07-002 added UUID-format validation to add_map_service_layer
# and add_dynamic_map_layer; the prior fake "test-map-uuid-1234" string
# would now be rejected at the new validator. The literal value here is
# arbitrary — fixtures only care that it parses as a UUID.
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

    # -- Plan 2026-05-07-003: producer/consumer shape asymmetry —
    # `params` MUST nest under `source.props.params` so the renderer
    # (`loadESRIJSON` in ModuleLoader.js) finds it. Pre-fix, the producer
    # flattened `extra_params` onto top-level source.props and the
    # WHERE / TIME clauses were silently ignored.

    def test_esri_feature_params_where_nested_under_source_props_params(self):
        """params={'WHERE': ...} must land at source.props.params.WHERE,
        not at source.props.WHERE — the renderer reads from the nested
        path."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="Colorado RFC Boundary",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="11",
            params={"WHERE": "rfc_name = 'Colorado Basin'"},
        )
        source = _get_source(result)
        assert source["props"]["params"] == {
            "WHERE": "rfc_name = 'Colorado Basin'"
        }
        # No top-level leakage — pre-fix, the value sat here.
        assert "WHERE" not in source["props"]

    def test_esri_feature_params_multiple_keys_all_nest(self):
        """Multiple params keys (e.g., WHERE + TIME) all land under
        source.props.params; none leak to top-level source.props."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
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

    def test_esri_feature_no_params_omits_params_key(self):
        """No `params` argument supplied → source.props has no `params`
        key (no empty {} scaffold). Mirrors ESRI Image and Map Service."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
        )
        source = _get_source(result)
        assert "params" not in source["props"]

    def test_esri_feature_empty_params_dict_omits_params_key(self):
        """params={} → source.props has no `params` key (consistent
        with `if extra_params:` semantics in the producer)."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="ESRI Feature Layer",
            url="https://example.com/arcgis/rest/services/MyService/FeatureServer",
            layer_id="0",
            params={},
        )
        source = _get_source(result)
        assert "params" not in source["props"]

    def test_esri_feature_params_does_not_clobber_url_or_layer(self):
        """Regression pin: with params supplied, url and layer keys still
        land at top-level source.props with their canonical values."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
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
# GeoTIFF
# ---------------------------------------------------------------------------

class TestGeoTIFF:
    """GeoTIFF source type contract tests."""

    def test_geotiff_returns_layer_update_shape(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF Layer",
            url="https://example.com/dem.tif",
        )
        assert_layer_update(result, expected_uuid=MAP_UUID)

    def test_geotiff_layer_type_is_webgl_tile(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF Layer",
            url="https://example.com/dem.tif",
        )
        config = _get_configuration(result)
        assert config["type"] == "WebGLTile"

    def test_geotiff_source_props_from_flat_url(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF Layer",
            url="https://example.com/dem.tif",
        )
        source = _get_source(result)
        assert source["type"] == "GeoTIFF"
        assert source["props"]["sources"] == [
            {"url": "https://example.com/dem.tif"}
        ]

    def test_geotiff_source_props_sources_array(self):
        sources = [
            {
                "url": "https://example.com/dem.tif",
                "bands": [1],
                "nodata": -9999,
            }
        ]
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF Layer",
            source_props={"sources": sources},
        )
        source = _get_source(result)
        assert source["props"]["sources"] == sources

    def test_geotiff_variable_url_preserved_in_sources(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF Layer",
            url="https://example.com/${dem_date}/dem.tif",
        )
        source = _get_source(result)
        assert source["props"]["sources"] == [
            {"url": "https://example.com/${dem_date}/dem.tif"}
        ]


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
        "GeoTIFF": dict(url="https://x.com/dem.tif"),
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
        "GeoTIFF": dict(sources=[{"url": "https://x.com/dem.tif"}]),
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

    def test_geotiff_returns_layer_update(self):
        self._assert_source_type_returns_layer_update("GeoTIFF")

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

    def test_geotiff_without_url_or_sources_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF No Source",
        )
        assert "error" in result

    def test_geotiff_empty_sources_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="GeoTIFF Empty Source",
            source_props={"sources": []},
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


# Plan-005 B2 — advanced metadata dicts (source_props / layer_props /
# popup_options) + first-class legend / style + conflict policy.
class TestAdvancedMetadata:
    SAMPLE_GEOJSON = {
        "type": "FeatureCollection",
        "features": [],
    }

    def test_source_props_merge_into_source_props(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Tiles With Projection",
            url="https://example.com/{z}/{x}/{y}.png",
            source_props={"projection": "EPSG:3857"},
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://example.com/{z}/{x}/{y}.png"
        assert source["props"]["projection"] == "EPSG:3857"

    def test_source_props_override_flat_for_overlapping_keys(self):
        # Source-level overlap is resolved by advanced-dict-wins (intentional;
        # caller-supplied data overrides derived defaults). Flat scalars
        # (opacity, min_zoom, max_zoom) trigger the conflict-rejection path
        # in TestLayerPropsConflict below — this test covers the source-prop
        # axis where merge-with-override is the intended semantics.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Override URL via source_props",
            url="https://example.com/{z}/{x}/{y}.png",
            source_props={"url": "https://override.example.com/{z}/{x}/{y}.png"},
        )
        source = _get_source(result)
        assert source["props"]["url"] == "https://override.example.com/{z}/{x}/{y}.png"

    def test_layer_props_persist_under_configuration_props(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
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
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bad Key",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"badKey": 1, "minZoom": 5},
        )
        assert "error" in result
        assert "badKey" in result["error"]

    def test_layer_props_wrong_type_returns_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bad Type",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"opacity": "not a number"},
        )
        assert "error" in result
        assert "opacity" in result["error"]

    def test_layer_props_conflicts_with_flat_param_returns_error(self):
        # Plan-005 K1: silent winners are bugs. Both flat opacity and
        # layer_props.opacity present → MCP returns a clear error.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
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
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Conflicting MinZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            min_zoom=2,
            layer_props={"minZoom": 5},
        )
        assert "error" in result
        assert "Conflicting" in result["error"]

    def test_max_zoom_conflict_with_layer_props_returns_error(self):
        # Symmetric coverage to opacity + min_zoom; pins the third entry
        # of the flat_to_dict_layer_props matrix.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Conflicting MaxZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            max_zoom=15,
            layer_props={"maxZoom": 10},
        )
        assert "error" in result
        assert "Conflicting" in result["error"]

    def test_legend_string_persists_at_top_level(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS With Legend",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            legend="default",
        )
        layer = result["layer_update"]["layer"]
        assert layer["legend"] == "default"

    def test_style_dict_persists_under_configuration_style(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Styled Cities",
            geojson=self.SAMPLE_GEOJSON,
            style={"version": 8, "sources": {}, "layers": []},
        )
        config = _get_configuration(result)
        assert config["style"]["version"] == 8

    def test_popup_options_aliases_persist_at_attribute_aliases(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Cities",
            geojson=self.SAMPLE_GEOJSON,
            popup_options={
                "aliases": {"Cities": {"pop": "Population"}},
            },
        )
        layer = result["layer_update"]["layer"]
        assert layer["attributeAliases"] == {"Cities": {"pop": "Population"}}

    def test_popup_options_omit_persist_at_omitted_popup_attributes(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Cities",
            geojson=self.SAMPLE_GEOJSON,
            popup_options={"omit": {"Cities": ["sensitive_field"]}},
        )
        layer = result["layer_update"]["layer"]
        assert layer["omittedPopupAttributes"] == {"Cities": ["sensitive_field"]}

    def test_advanced_dicts_accepted_as_json_strings(self):
        # Some LLM providers serialize dict args as JSON strings; the MCP
        # boundary coerces them. This pins that contract for the new dicts.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
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


# Plan-005 B3 — add_dynamic_map_layer (runtime plugin tool).
# Mocks the plugin-metadata resolver rather than the HTTP layer because
# the HTTP fetch belongs to a separate concern (covered by integration
# tests against the running Django server).
class TestAddDynamicMapLayer:
    @staticmethod
    def _stub_plugin_resolver(source, plugin_metadata):
        """Build a patcher that returns the given plugin_metadata dict for
        the matching source, or {"error": ...} otherwise."""
        def _stub(s):
            if s == source:
                return {"plugin": plugin_metadata}
            return {"error": f"Unknown plugin source: {s!r}"}
        return _stub

    def test_runtime_plugin_returns_pluginsource_layer(self):
        plugin = {
            "source": "streamflow_gauges",
            "type": "map_layer",
            "dynamic_map_layer": True,
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            side_effect=self._stub_plugin_resolver("streamflow_gauges", plugin),
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="streamflow_gauges",
                name="Gauges",
                args={"bbox": "-100,30,-90,40"},
            )
        assert "layer_update" in result
        layer = result["layer_update"]["layer"]
        plugin_block = layer["configuration"]["props"]["pluginSource"]
        assert plugin_block["source"] == "streamflow_gauges"
        assert plugin_block["args"] == {"bbox": "-100,30,-90,40"}
        # The scaffold is an empty FeatureCollection persisted at source.geojson.
        source_obj = layer["configuration"]["props"]["source"]
        assert source_obj["geojson"]["type"] == "FeatureCollection"
        assert source_obj["geojson"]["features"] == []

    def test_args_none_coerced_to_empty_dict(self):
        plugin = {
            "source": "no_args_plugin",
            "type": "map_layer",
            "dynamic_map_layer": True,
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            side_effect=self._stub_plugin_resolver("no_args_plugin", plugin),
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="no_args_plugin",
                name="No Args",
                args=None,
            )
        layer = result["layer_update"]["layer"]
        assert layer["configuration"]["props"]["pluginSource"]["args"] == {}

    def test_args_json_string_coerced(self):
        plugin = {
            "source": "string_args_plugin",
            "type": "map_layer",
            "dynamic_map_layer": True,
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            side_effect=self._stub_plugin_resolver("string_args_plugin", plugin),
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="string_args_plugin",
                name="String Args",
                args='{"bbox": "0,0,10,10"}',
            )
        layer = result["layer_update"]["layer"]
        assert layer["configuration"]["props"]["pluginSource"]["args"] == {
            "bbox": "0,0,10,10"
        }

    def test_variable_template_preserved_verbatim(self):
        plugin = {
            "source": "gauge_plugin",
            "type": "map_layer",
            "dynamic_map_layer": True,
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            side_effect=self._stub_plugin_resolver("gauge_plugin", plugin),
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="gauge_plugin",
                name="Gauges",
                args={"gauge_id": "${GaugeID}"},
            )
        layer = result["layer_update"]["layer"]
        # Verbatim — no interpolation at persist time.
        assert (
            layer["configuration"]["props"]["pluginSource"]["args"]["gauge_id"]
            == "${GaugeID}"
        )

    def test_non_map_layer_plugin_rejected(self):
        # Use the real resolver wrapped to return a non-map-layer result.
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            return_value={
                "error": (
                    "Plugin 'plotly_chart' is type 'plotly'; "
                    "add_dynamic_map_layer requires type=='map_layer'."
                )
            },
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="plotly_chart",
                name="Wrong Type",
            )
        assert "error" in result
        assert "map_layer" in result["error"]

    def test_static_map_layer_plugin_rejected(self):
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            return_value={
                "error": (
                    "Plugin 'static_overlay' is a static map_layer plugin "
                    "(dynamic_map_layer=False)."
                )
            },
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="static_overlay",
                name="Static Overlay",
            )
        assert "error" in result
        assert "static" in result["error"].lower()

    def test_unknown_source_rejected(self):
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "_resolve_dynamic_map_layer_plugin",
            return_value={"error": "Unknown plugin source: 'no_such_plugin'"},
        ):
            result = add_dynamic_map_layer(
                map_uuid=MAP_UUID,
                source="no_such_plugin",
                name="No Such",
            )
        assert "error" in result
        assert "Unknown" in result["error"]

    def test_args_non_dict_after_coercion_rejected(self):
        # JSON-string that decodes to a list, not a dict — boundary rejects.
        result = add_dynamic_map_layer(
            map_uuid=MAP_UUID,
            source="anything",
            name="Bad Args",
            args="[1, 2, 3]",
        )
        assert "error" in result
        assert "dict" in result["error"]


# Plan-005 S2 (cap only) — inline GeoJSON size cap.
class TestGeoJSONInlineSizeCap:
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
        # Comfortably under both default caps.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Small Cities",
            geojson={"type": "FeatureCollection", "features": self._features(100)},
        )
        assert "layer_update" in result

    def test_feature_count_over_cap_rejected(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Too Many Cities",
            geojson={
                "type": "FeatureCollection",
                "features": self._features(10_001),
            },
        )
        assert "error" in result
        assert "10001 features" in result["error"]

    def test_byte_size_over_cap_rejected(self, monkeypatch):
        # Lower the cap so the test stays fast; 1KB is plenty to trip with
        # a few hundred bytes of feature data.
        monkeypatch.setenv("TETHYSDASH_MCP_GEOJSON_MAX_BYTES", "1024")
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Too Big",
            geojson={
                "type": "FeatureCollection",
                "features": self._features(50),  # ~5KB serialized
            },
        )
        assert "error" in result
        assert "bytes" in result["error"]

    def test_env_var_override_raises_feature_cap(self, monkeypatch):
        # Operator override path — raise the feature cap so a previously-
        # rejected payload now passes.
        monkeypatch.setenv("TETHYSDASH_MCP_GEOJSON_MAX_FEATURES", "20000")
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Big But Allowed",
            geojson={
                "type": "FeatureCollection",
                "features": self._features(15_000),
            },
        )
        assert "layer_update" in result

    def test_geojson_url_path_unaffected_by_cap(self):
        # The cap only inspects inline dict payloads; geojson_url goes
        # through unchanged regardless of the eventual fetched size
        # (which is the browser's concern, not the server's).
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Hosted",
            geojson_url="https://example.com/huge.geojson",
        )
        assert "layer_update" in result

    def test_features_none_returns_validation_error_not_typeerror(self):
        # /ce:review #2 (P1): without the `or []` guard, features=None
        # caused len(None) → TypeError before validate_geojson could
        # produce a clean error. The fix should let the call proceed
        # past the cap (feature_count=0) and surface the actual error
        # from validate_geojson on the down-the-line path.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Bad Features",
            geojson={"type": "FeatureCollection", "features": None},
        )
        # Whichever validator catches it, the result must be a clean
        # MCP error envelope, not an unhandled exception.
        assert "error" in result


# /ce:review #5 (P1): module-load env-var int() must not crash imports.
class TestGeojsonCapEnvVarParsing:
    def test_invalid_env_value_falls_back_to_module_default(self, monkeypatch):
        # Simulate operator misconfig at call time. The fallback path
        # should kick in and the call should still succeed.
        monkeypatch.setenv("TETHYSDASH_MCP_GEOJSON_MAX_FEATURES", "ten thousand")
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="Resilient To Bad Env",
            geojson={"type": "FeatureCollection", "features": []},
        )
        assert "layer_update" in result


# /ce:review #18 (P3): bool is a subclass of int; layer_props={"opacity": True}
# must be rejected (not silently persisted as a JSON boolean).
class TestLayerPropsRejectsBoolean:
    def test_opacity_true_rejected(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bool Opacity",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"opacity": True},
        )
        assert "error" in result
        assert "opacity" in result["error"]

    def test_min_zoom_false_rejected(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bool MinZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minZoom": False},
        )
        assert "error" in result
        assert "minZoom" in result["error"]


# /ce:review #6 (P2): bare json.loads() on string-coerced params raised
# uncaught JSONDecodeError. Each new param must surface a clean MCP
# error for malformed JSON instead.
class TestMalformedJsonStringInputs:
    def test_malformed_layer_props_returns_clean_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bad JSON",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props='{"minZoom": 5',  # missing closing brace
        )
        assert "error" in result
        assert "layer_props" in result["error"]

    def test_malformed_source_props_returns_clean_error(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bad source_props JSON",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            source_props="{not valid json}",
        )
        assert "error" in result
        assert "source_props" in result["error"]

    def test_malformed_dynamic_layer_args_returns_clean_error(self):
        result = add_dynamic_map_layer(
            map_uuid=MAP_UUID,
            source="anything",
            name="Bad Args JSON",
            args='{"key": "value"',  # missing closing brace
        )
        assert "error" in result
        assert "args" in result["error"]


# /ce:review #10 (P2): list_intake_plugins compact output must surface
# dynamic_map_layer flag so the LLM can identify add_dynamic_map_layer-
# eligible plugins without speculative call.
class TestListIntakePluginsExposesDynamicFlag:
    def test_compact_entries_include_dynamic_map_layer_field(self):
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            list_intake_plugins,
        )
        fake_response = type("R", (), {})()
        fake_response.json = lambda: {
            "visualizations": [
                {
                    "label": "Group A",
                    "options": [
                        {
                            "source": "static_plug",
                            "label": "Static Plug",
                            "type": "map_layer",
                            "args": {"x": "text"},
                            "dynamic_map_layer": False,
                        },
                        {
                            "source": "runtime_plug",
                            "label": "Runtime Plug",
                            "type": "map_layer",
                            "args": {"y": "text"},
                            "dynamic_map_layer": True,
                        },
                    ],
                }
            ]
        }
        fake_response.raise_for_status = lambda: None
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=fake_response,
        ):
            result = list_intake_plugins()
        plugins = {p["source"]: p for p in result["intake_plugins"]}
        assert plugins["static_plug"]["dynamic_map_layer"] is False
        assert plugins["runtime_plug"]["dynamic_map_layer"] is True


# /ce:review #11 (P2): set_legend(None) on a fresh builder must not raise
# KeyError. Direct unit test of the builder method (not just the MCP path).
class TestSetLegendNoneIdempotent:
    def test_set_legend_none_on_fresh_builder_does_not_raise(self):
        builder = LayerConfigurationBuilder("test", "GeoJSON")
        # Must not raise — pop() over del.
        builder.set_legend(None)
        # Idempotent.
        builder.set_legend(None)


# /ce:review #1 (P1): _resolve_dynamic_map_layer_plugin must catch
# JSONDecodeError from response.json() (Django returning HTML on a 200,
# e.g. expired session redirect).
class TestResolveDynamicMapLayerPluginJsonError:
    def test_non_json_response_returns_clean_error(self):
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        fake_response = type("R", (), {})()
        fake_response.raise_for_status = lambda: None
        # Real requests would raise JSONDecodeError (a ValueError subclass).
        def _raise_json_error():
            raise ValueError("Expecting value: line 1 column 1 (char 0)")
        fake_response.json = _raise_json_error
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=fake_response,
        ):
            result = _resolve_dynamic_map_layer_plugin("anything")
        assert "error" in result
        assert "Failed to fetch plugin metadata" in result["error"]


# Todo #006: direct unit tests for _resolve_dynamic_map_layer_plugin's
# four internal branches. Previously every TestAddDynamicMapLayer test
# mocked the resolver at its boundary; the helper's internal logic
# (HTTP fetch, group → option iteration, type / dynamic-flag checks,
# and the four distinct error message strings) had only the JSON-error
# path directly covered. These tests pin the remaining branches.
class TestResolveDynamicMapLayerPluginBranches:
    @staticmethod
    def _make_response(payload):
        """Mock a successful 200 response that .json() returns `payload`."""
        import unittest.mock as mock
        resp = mock.MagicMock()
        resp.raise_for_status.return_value = None
        resp.json.return_value = payload
        return resp

    def test_request_exception_returns_clean_error(self):
        """Branch 1: HTTP-level failure (network unreachable, DNS fail,
        connection refused). RequestException must be caught and
        surfaced as the standard MCP error envelope."""
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        import requests as real_requests
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            side_effect=real_requests.exceptions.ConnectionError(
                "Connection refused"
            ),
        ):
            result = _resolve_dynamic_map_layer_plugin("any_plugin")
        assert "error" in result
        assert "Failed to fetch plugin metadata" in result["error"]
        assert "Connection refused" in result["error"]

    def test_source_absent_from_all_groups_returns_unknown_error(self):
        """Branch 2: 200 response, well-formed payload, but the
        requested source name doesn't appear in any group. Distinct
        error string from the wrong-type / static-plugin cases so the
        LLM can disambiguate."""
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        payload = {
            "visualizations": [
                {
                    "label": "Group A",
                    "options": [
                        {
                            "source": "some_other_plugin",
                            "type": "map_layer",
                            "dynamic_map_layer": True,
                        },
                    ],
                }
            ]
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=self._make_response(payload),
        ):
            result = _resolve_dynamic_map_layer_plugin("missing_plugin")
        assert "error" in result
        assert "Unknown plugin source" in result["error"]
        assert "missing_plugin" in result["error"]

    def test_wrong_type_plugin_returns_type_specific_error(self):
        """Branch 3: source resolves but plugin type != 'map_layer'.
        Error must name the actual type so the LLM understands why
        the call was rejected."""
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        payload = {
            "visualizations": [
                {
                    "label": "Group",
                    "options": [
                        {
                            "source": "plotly_plugin",
                            "type": "plotly",
                            "dynamic_map_layer": False,
                        },
                    ],
                }
            ]
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=self._make_response(payload),
        ):
            result = _resolve_dynamic_map_layer_plugin("plotly_plugin")
        assert "error" in result
        assert "type 'plotly'" in result["error"]
        assert "type=='map_layer'" in result["error"]

    def test_static_map_layer_plugin_returns_static_specific_error(self):
        """Branch 4: source resolves, type is 'map_layer', but
        dynamic_map_layer flag is False — caller wanted a runtime
        plugin, this is a static one. Error must clearly distinguish
        from the wrong-type case."""
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        payload = {
            "visualizations": [
                {
                    "label": "Group",
                    "options": [
                        {
                            "source": "static_overlay",
                            "type": "map_layer",
                            "dynamic_map_layer": False,
                        },
                    ],
                }
            ]
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=self._make_response(payload),
        ):
            result = _resolve_dynamic_map_layer_plugin("static_overlay")
        assert "error" in result
        assert "static map_layer plugin" in result["error"]
        assert "add_map_service_layer" in result["error"]

    def test_happy_path_returns_plugin_metadata(self):
        """Sanity: when the plugin resolves AND has the right type +
        flag, returns {'plugin': <metadata>}. Pins the success
        envelope shape."""
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        plugin_metadata = {
            "source": "good_plugin",
            "type": "map_layer",
            "dynamic_map_layer": True,
            "label": "Streamflow Gauges",
        }
        payload = {
            "visualizations": [
                {"label": "Group", "options": [plugin_metadata]}
            ]
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=self._make_response(payload),
        ):
            result = _resolve_dynamic_map_layer_plugin("good_plugin")
        assert "error" not in result
        assert result["plugin"] is plugin_metadata

    def test_iteration_traverses_multiple_groups(self):
        """The Django response groups plugins; the resolver flattens.
        Pin that a plugin in the second group is found just like one
        in the first."""
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _resolve_dynamic_map_layer_plugin,
        )
        target = {
            "source": "second_group_plugin",
            "type": "map_layer",
            "dynamic_map_layer": True,
        }
        payload = {
            "visualizations": [
                {"label": "First", "options": [
                    {"source": "first_group_plugin", "type": "plotly"}
                ]},
                {"label": "Second", "options": [target]},
            ]
        }
        with patch(
            "tethysapp.tethysdash.mcp.tethysdash_mcp_server."
            "http_requests.get",
            return_value=self._make_response(payload),
        ):
            result = _resolve_dynamic_map_layer_plugin("second_group_plugin")
        assert result.get("plugin") is target


# /ce:review #3 (P1): source_props per-source-type allowlist enforcement.
# The tool description promised it; this commit added it.
class TestSourcePropsAllowlist:
    def test_unknown_source_prop_key_rejected(self):
        # 'badKey' is not in WMS's available_source_properties allowlist
        # (which includes url, params, attributions, projection).
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bad Source Key",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            source_props={"badKey": "value"},
        )
        assert "error" in result
        assert "badKey" in result["error"]
        assert "WMS" in result["error"]

    def test_known_source_prop_key_accepted(self):
        # 'projection' IS in WMS's allowlist.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Good Source Key",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            source_props={"projection": "EPSG:4326"},
        )
        assert "layer_update" in result

    def test_unknown_source_prop_on_image_tile_rejected(self):
        # Image Tile only allows url, attributions, projection.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="Image Tile",
            name="Image Tile Bad Key",
            url="https://example.com/{z}/{x}/{y}.png",
            source_props={"tileSize": 512},  # PMTiles-only key
        )
        assert "error" in result
        assert "tileSize" in result["error"]


# /ce:review #4 (P1): set_legend now accepts URL strings (mirrors set_style).
class TestLegendUrlString:
    def test_legend_url_string_persists(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS URL Legend",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            legend="https://example.com/legend.png",
        )
        layer = result["layer_update"]["layer"]
        assert layer["legend"] == "https://example.com/legend.png"

    def test_legend_invalid_string_still_rejected(self):
        # A bare word with no slash is neither 'default' nor a URL.
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Bad Legend",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            legend="garbage",
        )
        assert "error" in result


# /ce:review #7 (P2): NaN/Infinity in numeric layer_props rejected at boundary.
class TestLayerPropsRejectsNonFinite:
    def test_nan_min_zoom_rejected(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS NaN MinZoom",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minZoom": float("nan")},
        )
        assert "error" in result
        assert "finite" in result["error"]

    def test_infinity_max_resolution_rejected(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Infinity MaxResolution",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"maxResolution": float("inf")},
        )
        assert "error" in result
        assert "finite" in result["error"]

    def test_negative_infinity_rejected(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS NegInf MinResolution",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            layer_props={"minResolution": float("-inf")},
        )
        assert "error" in result


# /ce:review #9 (P2): add_dynamic_map_layer registered in always_visible.
def test_add_dynamic_map_layer_in_always_visible():
    """Pin the BM25 visibility config so the new tool isn't accidentally
    dropped from always_visible during a future tool list refactor.

    FastMCP stores the configured `always_visible` list under the
    transform's private `_always_visible` attribute. Reading the
    private attribute is acceptable here because the public BM25
    transform API doesn't expose this list and the alternative is
    parsing source — this test exists specifically to guard the
    config value, so source-reading would defeat the purpose.
    """
    from tethysapp.tethysdash.mcp.tethysdash_mcp_server import mcp
    flat = []
    for t in mcp.transforms:
        always = getattr(t, "_always_visible", None)
        if always is not None:
            flat.extend(list(always))
    assert "add_dynamic_map_layer" in flat, (
        "add_dynamic_map_layer must be in BM25 always_visible so the LLM "
        "can find it for runtime-plugin queries; otherwise it competes "
        "for one of max_results=5 BM25 slots."
    )


# Todo #004: dispatch table is the SINGLE SOURCE of truth for which
# allowlist key maps to which builder method. Drift between the two
# was the original silent-no-op risk.
def test_layer_props_dispatch_covers_allowlist():
    """Pin: every LAYER_PROPERTIES_ALLOWLIST key has a corresponding
    entry in _LAYER_PROP_BUILDER_METHODS, and every builder-method
    name actually exists on LayerConfigurationBuilder. A future
    allowlist addition without a dispatch entry fails CI immediately.
    """
    from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
        _LAYER_PROP_BUILDER_METHODS,
    )
    from tethysapp.tethysdash.plugin_helpers import (
        LAYER_PROPERTIES_ALLOWLIST,
        LayerConfigurationBuilder,
    )
    assert set(_LAYER_PROP_BUILDER_METHODS) == set(LAYER_PROPERTIES_ALLOWLIST), (
        f"LAYER_PROPERTIES_ALLOWLIST keys "
        f"{sorted(LAYER_PROPERTIES_ALLOWLIST)} must match dispatch "
        f"{sorted(_LAYER_PROP_BUILDER_METHODS)} exactly."
    )
    # And the names actually resolve on the builder class.
    for key, method_name in _LAYER_PROP_BUILDER_METHODS.items():
        assert hasattr(LayerConfigurationBuilder, method_name), (
            f"LAYER_PROPERTIES_ALLOWLIST key {key!r} maps to method "
            f"{method_name!r} but the method does not exist on "
            f"LayerConfigurationBuilder."
        )


# Todo #005: direct unit tests for the extracted validation helper.
# Demonstrates that the helper is testable in isolation — exercising
# edge cases without building a full add_map_service_layer call.
class TestValidateAdvancedLayerDicts:
    @staticmethod
    def _call(**overrides):
        from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
            _validate_advanced_layer_dicts,
        )
        defaults = dict(
            source_type="WMS",
            layer_props=None,
            source_props=None,
            popup_options=None,
            opacity=None,
            min_zoom=None,
            max_zoom=None,
        )
        defaults.update(overrides)
        return _validate_advanced_layer_dicts(**defaults)

    def test_all_none_returns_none(self):
        assert self._call() is None

    def test_layer_props_unknown_key_returns_error(self):
        result = self._call(layer_props={"badKey": 1})
        assert result is not None
        assert "badKey" in result["error"]

    def test_conflict_returns_error(self):
        result = self._call(opacity=0.5, layer_props={"opacity": 0.6})
        assert result is not None
        assert "Conflicting" in result["error"]

    def test_source_props_unknown_key_returns_error(self):
        result = self._call(
            source_type="WMS",
            source_props={"badKey": "value"},
        )
        assert result is not None
        assert "badKey" in result["error"]

    def test_popup_options_aliases_non_dict_returns_error(self):
        result = self._call(popup_options={"aliases": "not a dict"})
        assert result is not None
        assert "aliases" in result["error"]

    def test_popup_options_omit_non_dict_returns_error(self):
        result = self._call(popup_options={"omit": ["bad shape"]})
        assert result is not None
        assert "omit" in result["error"]


# ---------------------------------------------------------------------------
# Plan 2026-05-07-002 Unit A: UUID format validation on map_uuid
# ---------------------------------------------------------------------------


class TestUuidValidationAddMapServiceLayer:
    """`map_uuid` must be a well-formed UUID string. The literal placeholder
    `{{last_map_uuid}}` (and other Mustache-style template forms) that some
    LLMs emit for chained tool args must be rejected with a structured
    `invalid_uuid:` envelope so the LLM gets an in-band fix-hint and retries
    with the actual UUID returned by `create_map_visualization`.
    """

    def _real_uuid_call(self, **overrides):
        kwargs = dict(
            map_uuid="33333333-3333-4333-8333-333333333333",
            source_type="WMS",
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        kwargs.update(overrides)
        return add_map_service_layer(**kwargs)

    def test_valid_uuid_v4_lowercase_accepted(self):
        result = self._real_uuid_call(map_uuid="11111111-1111-4111-8111-111111111111")
        assert "error" not in result, result
        assert "layer_update" in result

    def test_valid_uuid_uppercase_accepted(self):
        # uuid.UUID is case-insensitive — caps form must work.
        result = self._real_uuid_call(map_uuid="11111111-1111-4111-8111-111111111111".upper())
        assert "error" not in result, result
        assert "layer_update" in result

    def test_template_placeholder_rejected(self):
        result = self._real_uuid_call(map_uuid="{{last_map_uuid}}")
        assert "error" in result
        err = result["error"]
        assert err.startswith("invalid_uuid:"), err
        assert "map_uuid" in err
        assert "create_map_visualization" in err
        # Hint about templating — the LLM must learn this is not a templating engine.
        assert "template" in err.lower() or "literal" in err.lower()
        # Must NOT collide with the whitelist_rejected error class.
        assert "whitelist_rejected" not in err

    def test_dollar_brace_placeholder_rejected(self):
        result = self._real_uuid_call(map_uuid="${last_map_uuid}")
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_empty_string_rejected(self):
        result = self._real_uuid_call(map_uuid="")
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_garbage_string_rejected(self):
        result = self._real_uuid_call(map_uuid="not-a-uuid")
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_uuid_with_extra_hex_digit_rejected(self):
        result = self._real_uuid_call(
            map_uuid="11111111-1111-4111-8111-111111111111a"  # 33 hex chars
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_uuid_with_surrounding_whitespace_rejected(self):
        # Strict canonical form — caller must trim before passing.
        result = self._real_uuid_call(
            map_uuid=" 11111111-1111-4111-8111-111111111111 "
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")

    def test_validation_runs_before_other_checks(self):
        # A payload with both a malformed map_uuid AND a missing required
        # field (e.g., wms_layers) should report the UUID error first —
        # it's the more actionable issue for the LLM.
        result = add_map_service_layer(
            map_uuid="{{last_map_uuid}}",
            source_type="WMS",
            name="Layer",
            url="https://example.com/wms",
            # wms_layers omitted — would normally produce its own error.
        )
        assert "error" in result
        assert result["error"].startswith("invalid_uuid:")


class TestUuidValidationAddDynamicMapLayer:
    """`add_dynamic_map_layer` shares the same `map_uuid` contract — same
    helper, same rejection envelope.
    """

    def test_template_placeholder_rejected(self):
        # Minimal-args call; we only care about the map_uuid validator.
        result = add_dynamic_map_layer(
            map_uuid="{{last_map_uuid}}",
            source="some_intake_plugin",
            name="Layer",
        )
        assert "error" in result
        err = result["error"]
        assert err.startswith("invalid_uuid:")
        assert "map_uuid" in err

    def test_valid_uuid_passes_validation(self):
        # The plugin source itself may not exist (we don't care for this
        # test); we only assert that the UUID validator does NOT fire.
        # If it gets past the UUID validator, any subsequent error must
        # NOT be invalid_uuid:.
        result = add_dynamic_map_layer(
            map_uuid="11111111-1111-4111-8111-111111111111",
            source="some_intake_plugin",
            name="Layer",
        )
        if "error" in result:
            assert not result["error"].startswith("invalid_uuid:"), (
                "UUID validator must accept a real UUID; the error came from "
                "elsewhere in the tool body. " + result["error"]
            )


# ---------------------------------------------------------------------------
# Plan 2026-05-07-004 Unit A: explicit rejection of `params` for source types
# that don't consume it (close the silent-drop class)
# ---------------------------------------------------------------------------


class TestParamsRejection:
    """`params` is silently dropped for 7 of 11 source types pre-fix. The
    audit at the end of /ce:debug Phase 1 (this session) classified this
    as a Tier-1 silent semantic failure — the LLM's call succeeds with no
    indication the params it supplied went nowhere. This unit replaces
    the silent drop with a structured `invalid_source_params:` envelope
    for the 7 types that don't have server-side consumption today.
    """

    # Minimal valid call args per source type that DOESN'T accept params.
    # GeoTIFF requires either url or source_props.sources; we use url to
    # mirror the auto-canonicalization path the producer uses.
    _MIN_ARGS_BY_TYPE = {
        "GeoJSON": {
            "geojson": {
                "type": "FeatureCollection",
                "features": [],
            },
        },
        "KML": {"url": "https://example.com/data.kml"},
        "Image Tile": {"url": "https://example.com/{z}/{x}/{y}.png"},
        "Vector Tile": {"url": "https://example.com/{z}/{x}/{y}.pbf"},
        "PMTiles Vector": {"url": "https://example.com/data.pmtiles"},
        "PMTiles Raster": {"url": "https://example.com/data.pmtiles"},
        "GeoTIFF": {"url": "https://example.com/data.tif"},
    }

    def _call(self, source_type, params):
        kwargs = dict(
            map_uuid=MAP_UUID,
            source_type=source_type,
            name="Layer",
            **self._MIN_ARGS_BY_TYPE[source_type],
        )
        if params is not None:
            kwargs["params"] = params
        return add_map_service_layer(**kwargs)

    def test_each_dropping_type_rejects_non_empty_params(self):
        """Parametrized core test: each of the 7 source types that
        previously dropped params now returns a structured rejection
        envelope when supplied with a non-empty params dict."""
        for source_type in self._MIN_ARGS_BY_TYPE.keys():
            result = self._call(source_type, params={"foo": "bar"})
            assert "error" in result, (
                f"{source_type} should have rejected non-empty params, "
                f"got success result instead: {result}"
            )
            err = result["error"]
            assert err.startswith("invalid_source_params:"), (
                f"{source_type} rejection must use the canonical "
                f"`invalid_source_params:` class prefix. Got: {err}"
            )
            # The hint should name the source type so the LLM knows which
            # call it was.
            assert source_type in err, (
                f"Rejection hint for {source_type} should name the type. "
                f"Got: {err}"
            )

    def test_rejection_does_not_use_other_error_classes(self):
        """The rejection must NOT collide with other error class
        prefixes (whitelist_rejected, invalid_envelope, invalid_uuid).
        Each error class maps to one canonical recovery action per
        mcp-error-envelopes-not-found-vs-unsupported-state."""
        result = self._call("GeoJSON", params={"foo": "bar"})
        err = result.get("error", "")
        assert "whitelist_rejected" not in err
        assert "invalid_envelope" not in err
        assert "invalid_uuid" not in err

    def test_each_dropping_type_accepts_none_params(self):
        """params=None (the default) succeeds for all 7 types — no
        rejection fires. Implicit pin: the existing happy-path tests
        already cover this; here we make it explicit."""
        for source_type in self._MIN_ARGS_BY_TYPE.keys():
            result = self._call(source_type, params=None)
            assert "layer_update" in result, (
                f"{source_type} with params=None should succeed. "
                f"Got: {result}"
            )

    def test_each_dropping_type_accepts_empty_dict_params(self):
        """params={} (empty dict) is treated the same as None — the
        rejection fires only on a non-empty dict."""
        for source_type in self._MIN_ARGS_BY_TYPE.keys():
            result = self._call(source_type, params={})
            assert "layer_update" in result, (
                f"{source_type} with params=empty-dict should succeed. "
                f"Got: {result}"
            )

    def test_consuming_types_still_accept_params(self):
        """Regression pin: the 4 source types that DO consume params
        (WMS, ESRI Image and Map Service, ESRI Feature Service, Static
        Image) continue to succeed with non-empty params. Only the 7
        dropping types are subject to the new rejection."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="ESRI Feature Service",
            name="Boundary",
            url="https://example.com/arcgis/rest/services/X/FeatureServer",
            layer_id="0",
            params={"WHERE": "id = 1"},
        )
        assert "layer_update" in result, result

        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="WMS Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
            params={"STYLES": "default"},
        )
        assert "layer_update" in result, result

    def test_json_string_params_coerce_then_reject(self):
        """Calling order matters: the existing Union[Dict, str] coercion
        runs FIRST (mcp-tool-dict-parameter-coercion-2026-04-17), then
        the rejection check evaluates the parsed dict. A JSON-string
        params that parses to a non-empty dict is rejected with the
        same canonical class."""
        result = self._call("GeoJSON", params='{"foo": "bar"}')
        assert "error" in result
        assert result["error"].startswith("invalid_source_params:"), result

    def test_json_string_empty_dict_succeeds(self):
        """JSON-string `{}` coerces to empty dict, which is treated as
        no-params and succeeds (no rejection)."""
        result = self._call("KML", params="{}")
        assert "layer_update" in result, result


# ---------------------------------------------------------------------------
# Plan 2026-05-07-004 Unit B: surface GeoTIFF renderer-consumed keys
# ---------------------------------------------------------------------------


class TestGeoTIFFRendererKeys:
    """The GeoTIFF source-props allowlist pre-fix only included `sources`
    (required) and `attributions` (optional). The renderer consumes more:

      - `bands`, `nodata`, `min`, `max` — passed to OL GeoTIFF source
        constructor; persisted under source.props (existing
        set_source_properties flow).
      - `rampName`, `rampMin`, `rampMax` — read by Map.js auto-legend
        at source.<key> directly (siblings to `type`/`props`); persisted
        at source-top-level.

    Both groups are expanded by Unit B. The allowlist gate
    (get_allowed_source_prop_keys -> available_source_properties) accepts
    the new keys; the GeoTIFF branch of add_map_service_layer routes
    rampName/rampMin/rampMax to source-top-level via the new builder
    method.
    """

    def test_bands_string_persists_under_source_props(self):
        """`bands` is a comma-string consumed by ModuleLoader.js's
        resolveProps which parses it to int array at render time."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"bands": "1,2,3"},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"]["bands"] == "1,2,3"

    def test_nodata_persists_under_source_props(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"nodata": -9999},
        )
        assert "error" not in result, result
        assert _get_source(result)["props"]["nodata"] == -9999

    def test_min_max_persist_under_source_props(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"min": 0, "max": 100},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"]["min"] == 0
        assert source["props"]["max"] == 100

    def test_rampname_persists_at_source_top_level(self):
        """`rampName` is read by Map.js auto-legend at source.rampName
        (one level above props). Must persist there, not at
        source.props.rampName."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"rampName": "viridis"},
        )
        assert "error" not in result, result
        source = _get_source(result)
        # Top-level on the source object, NOT under props.
        assert source.get("rampName") == "viridis"
        assert "rampName" not in source["props"]

    def test_rampmin_rampmax_persist_at_source_top_level(self):
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
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
        """A single source_props dict mixing both groups routes each
        key to its correct persisted location."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={
                "bands": "1",
                "rampName": "viridis",
            },
        )
        assert "error" not in result, result
        source = _get_source(result)
        # bands stays under props (OL constructor option).
        assert source["props"]["bands"] == "1"
        # rampName moves to top-level (TethysDash auto-legend metadata).
        assert source.get("rampName") == "viridis"

    def test_unknown_key_still_rejected(self):
        """The expansion adds 7 specific keys, doesn't open the gate.
        Unrecognized keys still get rejected by the allowlist."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"some_unknown_key": "x"},
        )
        assert "error" in result, result
        # The error here comes from the allowlist gate — distinct from
        # invalid_source_params (which is for the `params` argument).
        assert "some_unknown_key" in result["error"]

    def test_existing_attributions_still_works(self):
        """Negative regression: pre-existing GeoTIFF allowlist entries
        (sources via flat `url`, `attributions`) continue to work."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            source_props={"attributions": "USGS"},
        )
        assert "error" not in result, result
        source = _get_source(result)
        assert source["props"].get("attributions") == "USGS"


# ---------------------------------------------------------------------------
# Plan 2026-05-07-004 Unit C: `visible` flat parameter
# ---------------------------------------------------------------------------


class TestLayerVisibility:
    """Pre-fix, the LLM cannot create an initially-hidden layer.
    LayerConfigurationBuilder.set_layer_visibility writes
    configuration.layerVisibility (read by Map.js:335-340 to start
    layers hidden when False) but add_map_service_layer never calls it.
    Unit C surfaces it as a flat `visible: Optional[bool]` parameter
    that dispatches through _LAYER_PROP_BUILDER_METHODS like opacity /
    min_zoom / max_zoom.
    """

    def _call(self, **overrides):
        kwargs = dict(
            map_uuid=MAP_UUID,
            source_type="WMS",
            name="Layer",
            url="https://example.com/wms",
            wms_layers="ws:layer",
        )
        kwargs.update(overrides)
        return add_map_service_layer(**kwargs)

    def test_visible_false_persists_layer_visibility_false(self):
        """The load-bearing case: visible=False persists at
        configuration.layerVisibility = False so Map.js starts the
        layer hidden."""
        result = self._call(visible=False)
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False

    def test_visible_true_persists_layer_visibility_true(self):
        result = self._call(visible=True)
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is True

    def test_visible_omitted_no_layer_visibility_key(self):
        """When visible is omitted (None default), the persisted config
        does NOT contain a layerVisibility key — the builder default
        applies and Map.js renders the layer visible (its consumer only
        hides on === false)."""
        result = self._call()
        assert "error" not in result, result
        config = _get_configuration(result)
        assert "layerVisibility" not in config

    def test_visible_works_for_geojson(self):
        """Visibility is layer-level, not source-specific. Pin it for a
        non-WMS type to confirm the flat parameter applies uniformly."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoJSON",
            name="GeoJSON Layer",
            geojson={"type": "FeatureCollection", "features": []},
            visible=False,
        )
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False

    def test_visible_works_for_geotiff(self):
        """And for GeoTIFF — Unit B's source-prop routing must not
        interfere with Unit C's layer-level visibility."""
        result = add_map_service_layer(
            map_uuid=MAP_UUID,
            source_type="GeoTIFF",
            name="DEM",
            url="https://example.com/dem.tif",
            visible=False,
        )
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False

    def test_visible_combined_with_other_layer_props(self):
        """Sanity check: visible composes with opacity / queryable /
        zoom limits without conflict (each goes to a distinct path)."""
        result = self._call(
            visible=False,
            opacity=0.5,
            queryable=True,
        )
        assert "error" not in result, result
        config = _get_configuration(result)
        assert config.get("layerVisibility") is False
        assert config["props"]["opacity"] == 0.5
