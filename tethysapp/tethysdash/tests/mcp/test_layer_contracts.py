"""Contract tests for the dynamic-only MCP layer surface.

After plan 2026-05-07-007 (T3) replaced the umbrella ``add_map_service_layer``
with 11 per-source-type tools, this file scopes down to the dynamic /
runtime-plugin layer surface plus shared validation helpers that don't
belong to any single source type. The per-source-type oracle tests live
in ``test_per_source_type_layer_tools.py``.

What lives here:
  - ``add_dynamic_map_layer`` happy + error paths (``TestAddDynamicMapLayer``)
  - ``_resolve_dynamic_map_layer_plugin`` direct unit tests (Json error +
    the four internal branches)
  - ``add_dynamic_map_layer`` UUID-format validation
  - ``list_intake_plugins`` compact-output ``dynamic_map_layer`` flag
  - BM25 ``always_visible`` config pin for ``add_dynamic_map_layer``
  - ``_LAYER_PROP_BUILDER_METHODS`` ↔ ``LAYER_PROPERTIES_ALLOWLIST`` dispatch
    coverage (Todo #004)
  - ``_validate_advanced_layer_dicts`` direct unit tests (Todo #005)
  - Malformed JSON-string args on ``add_dynamic_map_layer``

Layer 1 tests -- no browser, no server, milliseconds per test.
"""

from unittest.mock import patch

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import (
    add_dynamic_map_layer,
)


# Stable real UUID v4 used by every layer-contract test below.
# Plan 2026-05-07-002 added UUID-format validation to add_dynamic_map_layer;
# the prior fake "test-map-uuid-1234" string would now be rejected at the
# new validator. The literal value here is arbitrary — fixtures only care
# that it parses as a UUID.
MAP_UUID = "11111111-1111-4111-8111-111111111111"


# ---------------------------------------------------------------------------
# Plan-005 B3 — add_dynamic_map_layer (runtime plugin tool).
# Mocks the plugin-metadata resolver rather than the HTTP layer because
# the HTTP fetch belongs to a separate concern (covered by integration
# tests against the running Django server).
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# /ce:review #6 (P2): bare json.loads() on string-coerced `args` raised
# uncaught JSONDecodeError. Surfaces a clean MCP error envelope instead.
# ---------------------------------------------------------------------------


def test_malformed_dynamic_layer_args_returns_clean_error():
    result = add_dynamic_map_layer(
        map_uuid=MAP_UUID,
        source="anything",
        name="Bad Args JSON",
        args='{"key": "value"',  # missing closing brace
    )
    assert "error" in result
    assert "args" in result["error"]


# ---------------------------------------------------------------------------
# /ce:review #10 (P2): list_intake_plugins compact output must surface
# dynamic_map_layer flag so the LLM can identify add_dynamic_map_layer-
# eligible plugins without speculative call.
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# /ce:review #1 (P1): _resolve_dynamic_map_layer_plugin must catch
# JSONDecodeError from response.json() (Django returning HTML on a 200,
# e.g. expired session redirect).
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Todo #006: direct unit tests for _resolve_dynamic_map_layer_plugin's
# four internal branches.
# ---------------------------------------------------------------------------


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
        requested source name doesn't appear in any group."""
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
        """Branch 3: source resolves but plugin type != 'map_layer'."""
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
        dynamic_map_layer flag is False."""
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
        assert "add_*_layer" in result["error"]

    def test_happy_path_returns_plugin_metadata(self):
        """Sanity: when the plugin resolves AND has the right type +
        flag, returns {'plugin': <metadata>}."""
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
        """The Django response groups plugins; the resolver flattens."""
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


# ---------------------------------------------------------------------------
# /ce:review #9 (P2): add_dynamic_map_layer registered in always_visible.
# ---------------------------------------------------------------------------


def test_add_dynamic_map_layer_reachable_in_default_list_tools():
    """Pin that ``add_dynamic_map_layer`` is reachable by chatbox-core's
    default ``list_tools()`` call.

    Original 2026-05-07 form of this test asserted that the tool was in
    ``BM25SearchTransform.always_visible``. As of the 2026-05-10 Phase 3c
    probe, BM25SearchTransform has been removed entirely — the chatbox-core
    engine's per-prompt semantic-similarity ranker (engine/embeddings.js)
    handles tool selection client-side instead. The underlying intent of
    this test ("the LLM must be able to reach this tool for runtime-plugin
    queries") is preserved by checking the canonical reachability surface:
    ``Client(mcp).list_tools()``.
    """
    import asyncio
    from fastmcp import Client
    from tethysapp.tethysdash.mcp.tethysdash_mcp_server import mcp

    async def go():
        async with Client(mcp) as c:
            return await c.list_tools()

    tools = asyncio.new_event_loop().run_until_complete(go())
    visible = {t.name for t in tools}
    assert "add_dynamic_map_layer" in visible, (
        "add_dynamic_map_layer must be reachable in the default "
        "list_tools() output so chatbox-core's tool registry has it "
        f"available for runtime-plugin queries. Currently visible: "
        f"{sorted(visible)}"
    )


# ---------------------------------------------------------------------------
# Todo #004: dispatch table is the SINGLE SOURCE of truth for which
# allowlist key maps to which builder method.
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Todo #005: direct unit tests for the extracted validation helper.
# Demonstrates that the helper is testable in isolation.
# ---------------------------------------------------------------------------


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
# Plan 2026-05-07-002 Unit A: UUID format validation on map_uuid for
# add_dynamic_map_layer. (The per-source-type variants live in
# test_per_source_type_layer_tools.py — they share the same _validate_uuid_arg.)
# ---------------------------------------------------------------------------


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
