"""Contract tests for the generic update-protocol MCP tool `patch_visualization`.

Validates envelope shape, R5c multi-op array collision, per-viz path
whitelist, and R9 layer-construction boundary. The server does NOT apply
patches (client reducer owns that via rfc6902), so these tests cover the
validation pipeline only.

Layer 1 tests — no browser, no server, milliseconds per test.
"""

import uuid as uuid_mod

import pytest

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import patch_visualization


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------


def _fresh_uuid() -> str:
    return str(uuid_mod.uuid4())


# ---------------------------------------------------------------------------
# Happy paths — envelope passes validation + returns patch_update
# ---------------------------------------------------------------------------


class TestHappyPath:
    """Valid envelopes return {patch_update: {uuid, source, ops}}."""

    def test_single_replace_on_plot_title(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/args/inlineData/layout/title", "value": "Rainfall"}],
        )
        assert "patch_update" in result
        assert "error" not in result
        assert result["patch_update"]["source"] == "Inline Plotly"
        assert len(result["patch_update"]["ops"]) == 1

    def test_single_replace_on_map_legend(self):
        """R9 fixture: toggle layerControl on a map."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/layerControl", "value": True}],
        )
        assert "patch_update" in result

    def test_multi_op_with_test_guard(self):
        """R8: test op + replace in one envelope."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[
                {"op": "test", "path": "/args/inlineData/layout/title", "value": "Old"},
                {"op": "replace", "path": "/args/inlineData/layout/title", "value": "New"},
            ],
        )
        assert "patch_update" in result

    def test_literal_dotted_key_in_variable_input(self):
        """R2 literal-dot: /args/variable_options_source.metadata is a single segment."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Variable Input",
            patches=[{
                "op": "replace",
                "path": "/args/variable_options_source.metadata/outputFormat",
                "value": "{{n}}",
            }],
        )
        assert "patch_update" in result

    def test_deep_append_on_plot_data(self):
        """R9 fixture: /args/inlineData/data/0/x/- via `add` op."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "add", "path": "/args/inlineData/data/0/x/-", "value": 11}],
        )
        assert "patch_update" in result

    def test_remove_map_layer_at_index(self):
        """R9: single `remove` at /args/layers/N is permitted."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "remove", "path": "/args/layers/2"}],
        )
        assert "patch_update" in result

    def test_field_level_replace_inside_existing_map_layer(self):
        """R9: field-level patch under /args/layers/N is permitted."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{
                "op": "replace",
                "path": "/args/layers/2/configuration/props/opacity",
                "value": 0.5,
            }],
        )
        assert "patch_update" in result

    def test_description_field_accepted(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/args/inlineData/layout/title", "value": "X"}],
            description="Rename the rainfall plot",
        )
        assert "patch_update" in result


# ---------------------------------------------------------------------------
# Value coercion — keep patch vs create behavior symmetric
# ---------------------------------------------------------------------------


class TestValueCoercion:
    """Value-level transformations that mirror what create tools do.

    LLMs naturally reuse shorthand they learned from create tools (e.g.,
    `baseMap: "imagery"` accepted by ``create_map_visualization``). Without
    mirroring the coercion here, patches written in that shorthand silently
    break the renderer.
    """

    def test_basemap_shorthand_resolved_to_full_url(self):
        """Mirror create_map_visualization's BASE_MAPS resolution."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/baseMap", "value": "imagery"}],
        )
        assert "patch_update" in result
        resolved = result["patch_update"]["ops"][0]["value"]
        assert resolved.startswith("https://server.arcgisonline.com/")
        assert "World_Imagery" in resolved

    def test_basemap_full_url_passes_through_unchanged(self):
        """Full URLs (the value the frontend persists) must not be mangled."""
        full_url = (
            "https://server.arcgisonline.com/arcgis/rest/services/"
            "World_Topo_Map/MapServer"
        )
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/baseMap", "value": full_url}],
        )
        assert "patch_update" in result
        assert result["patch_update"]["ops"][0]["value"] == full_url

    def test_basemap_unknown_value_passes_through_unchanged(self):
        """Don't clobber arbitrary URLs the user might paste in directly."""
        custom_url = "https://custom-tile-server.example.com/MapServer"
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/baseMap", "value": custom_url}],
        )
        assert result["patch_update"]["ops"][0]["value"] == custom_url

    def test_coercion_does_not_touch_non_basemap_paths(self):
        """The shorthand map must not accidentally rewrite unrelated values."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/layerControl", "value": True}],
        )
        assert result["patch_update"]["ops"][0]["value"] is True


# ---------------------------------------------------------------------------
# Value-shape validation — contract parity between create and patch paths
# ---------------------------------------------------------------------------


class TestValueShapeValidation:
    """Some paths require a specific value shape the renderer depends on.

    Create tools enforce these via Pydantic; the patch tool must reject
    them too so a well-formed envelope can't crash the renderer with
    TypeErrors like ``data.length is undefined``.
    """

    def test_plotly_inline_data_must_be_a_list(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/args/inlineData/data", "value": 42}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_table_inline_data_must_be_a_list(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Table",
            patches=[{"op": "replace", "path": "/args/inlineData/data", "value": "rows"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_card_inline_data_must_be_a_list(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Card",
            patches=[{"op": "replace", "path": "/args/inlineData/data", "value": {"value": 1}}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_plotly_inline_layout_must_be_a_dict(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/args/inlineData/layout", "value": "bad"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]
        # Pin the source name in the error so future whitelist-clear regressions
        # are caught (review finding KP-08: assertions that only check the class
        # prefix pass even when the rules dict is empty).
        assert "Inline Plotly" in result["error"]
        assert "/args/inlineData/layout" in result["error"]

    def test_plotly_inline_config_must_be_a_dict(self):
        # _VALUE_SHAPE_RULES includes ("Inline Plotly", "/args/inlineData/config").
        # Missing negative coverage would mean a non-dict config passes the
        # server and crashes the Plotly renderer (review finding T-03).
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/args/inlineData/config", "value": "bad"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]
        assert "/args/inlineData/config" in result["error"]

    def test_valid_list_value_still_accepted(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{
                "op": "replace",
                "path": "/args/inlineData/data",
                "value": [{"x": [1, 2], "y": [3, 4]}],
            }],
        )
        assert "patch_update" in result

    def test_deep_path_below_a_rule_is_not_validated(self):
        """Only the exact path triggers validation; deeper ops inside the
        same subtree use whatever value type RFC 6902 says is valid.
        """
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            # Writing a scalar at .../layout/title is fine — the title itself
            # IS a string. The rule is on /args/inlineData/layout as a whole.
            patches=[{
                "op": "replace",
                "path": "/args/inlineData/layout/title",
                "value": "Rainfall",
            }],
        )
        assert "patch_update" in result

    def test_remove_op_skips_value_shape_check(self):
        """`remove` has no value — shape check must not spuriously fire."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "remove", "path": "/args/inlineData/data"}],
        )
        assert "patch_update" in result


# ---------------------------------------------------------------------------
# Dict-coercion — LLMs that serialize lists as JSON strings
# ---------------------------------------------------------------------------


class TestDictCoercion:
    """LLMs sometimes serialize the patches array as a JSON string."""

    def test_json_string_patches_are_coerced(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches='[{"op":"replace","path":"/args/inlineData/layout/title","value":"X"}]',
        )
        assert "patch_update" in result

    def test_malformed_json_string_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches="not json",
        )
        assert "error" in result
        assert result["error"].startswith("invalid_envelope:")


# ---------------------------------------------------------------------------
# Envelope shape validation (R1/R2)
# ---------------------------------------------------------------------------


class TestEnvelopeShape:
    """Structural validation of each op."""

    def test_empty_patches_list_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[],
        )
        assert "error" in result
        assert result["error"].startswith("invalid_envelope:")

    def test_copy_op_rejected(self):
        """`copy` is intentionally excluded from the supported op set."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "copy", "from": "/args/title", "path": "/args/description"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]
        assert "copy" in result["error"]

    def test_unknown_op_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "patch", "path": "/args/inlineData/layout/title", "value": "X"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_missing_op_field_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"path": "/args/inlineData/layout/title", "value": "X"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_missing_path_field_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "value": "X"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_relative_path_rejected(self):
        """Paths must be absolute JSON Pointers starting with '/'."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "args/title", "value": "X"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_add_without_value_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "add", "path": "/args/inlineData/layout/title"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_move_without_from_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "move", "path": "/args/layers/0"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_non_dict_op_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=["not a dict"],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]


# ---------------------------------------------------------------------------
# R5c multi-op array collision
# ---------------------------------------------------------------------------


class TestR5cArrayCollision:
    """Reject envelopes with >1 add/remove against the same array parent."""

    def test_two_removes_at_same_array_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[
                {"op": "remove", "path": "/args/layers/2"},
                {"op": "remove", "path": "/args/layers/3"},
            ],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]
        assert "/args/layers" in result["error"]

    def test_two_adds_at_same_array_rejected(self):
        """(Even though /args/layers/- is layer-banned, R5c fires first on multi-op.)"""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[
                {"op": "add", "path": "/args/layers/-", "value": {}},
                {"op": "add", "path": "/args/layers/-", "value": {}},
            ],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_add_plus_remove_at_same_array_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[
                {"op": "remove", "path": "/args/layers/0"},
                {"op": "add", "path": "/args/layers/-", "value": {}},
            ],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_nested_array_collision_also_rejected(self):
        """R5c applies to any array parent, not just /args/layers."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[
                {"op": "remove", "path": "/args/inlineData/data/0/x/0"},
                {"op": "remove", "path": "/args/inlineData/data/0/x/1"},
            ],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_two_replaces_at_same_array_NOT_rejected(self):
        """R5c only flags add+add, add+remove, remove+remove. `replace` is index-stable."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[
                {"op": "replace", "path": "/args/layers/0/visible", "value": False},
                {"op": "replace", "path": "/args/layers/1/visible", "value": True},
            ],
        )
        # These are field-level replaces under existing layers — R9 permits,
        # R5c doesn't fire on replace.
        assert "patch_update" in result

    def test_single_remove_at_array_NOT_rejected(self):
        """R5c only fires when >1 ops target the same parent."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "remove", "path": "/args/layers/2"}],
        )
        assert "patch_update" in result

    def test_move_plus_remove_at_same_array_rejected(self):
        # `move` is semantically `remove(from) + add(path)`. Pairing it with
        # another remove (or add) at the same array parent produces the same
        # index-shift corruption R5c was designed to prevent. Review
        # finding COR-04 / ADV-002 — the earlier check only flagged
        # add/remove, letting move slip past.
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[
                {"op": "remove", "path": "/args/layers/2"},
                {"op": "move", "from": "/args/layers/3", "path": "/args/layers/4"},
            ],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]
        assert "/args/layers" in result["error"]

    def test_move_both_endpoints_on_same_array_rejected(self):
        # A single `move` op from/to the same indexed array parent already
        # shifts indices — reject on its own.
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[
                {"op": "move", "from": "/args/layers/0", "path": "/args/layers/2"},
                {"op": "remove", "path": "/args/layers/3"},
            ],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]


# ---------------------------------------------------------------------------
# R7 whitelist (fail-closed)
# ---------------------------------------------------------------------------


class TestWhitelist:
    """Paths outside the per-viz whitelist are rejected."""

    def test_unknown_path_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/secret_internal_field", "value": 1}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]

    def test_plot_path_rejected_on_map_source(self):
        """Source-specific whitelist — /args/inlineData is not a Map path."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "replace", "path": "/args/inlineData/data", "value": []}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]

    def test_out_of_scope_source_rejects_all(self):
        """Fail-closed for viz types not in the in-scope 5 (Text, Custom Image, ...)."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Text",
            patches=[{"op": "replace", "path": "/args/text", "value": "hi"}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]

    def test_unknown_source_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Totally Made Up Source",
            patches=[{"op": "replace", "path": "/args/inlineData/layout/title", "value": "X"}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]

    def test_error_lists_allowed_prefixes_so_llm_can_recover(self):
        """The error must surface the allowed prefixes for the source so the
        LLM can retry with a valid path in one round — the initial
        dashboard_state injection may have been dropped or truncated.
        """
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            # Plotly-native path without the /args/ prefix — exactly what
            # gemini-flash-preview, Claude, and GPT tried in R15 validation
            # before this fix. The error must tell them "/args/inlineData"
            # is an allowed prefix so the retry converges.
            patches=[{"op": "replace", "path": "/layout/title", "value": "X"}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]
        # Allowed prefix for Inline Plotly must appear in the error so the
        # LLM can compose /args/inlineData/layout/title on retry.
        assert "/args/inlineData" in result["error"]
        # Explicit "paths start with /args/" guidance must appear too — the
        # LLM's observed failure mode was trying viz-native paths with no
        # /args prefix at all.
        assert "/args/" in result["error"]

    def test_move_from_outside_whitelist_rejected(self):
        # Review finding COR-01 / ADV-001 / SEC-001 (cross-reviewer
        # convergence, P1). A `move` op reads from `op["from"]` and writes
        # to `op["path"]`. Before this fix, only `path` was whitelist-checked,
        # so the LLM could pluck a value from an unlisted field and surface
        # it into a user-visible whitelisted field (e.g., move internal
        # attribution string into /args/baseMap).
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{
                "op": "move",
                "from": "/args/secret_internal_field",
                "path": "/args/baseMap",
            }],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]
        # Error specifically identifies the `from` field as the rejection reason.
        assert "from" in result["error"]

    def test_move_both_endpoints_whitelisted_accepted(self):
        # Sanity check: when both from and path fall under allowed prefixes,
        # the op is accepted (subject to other checks like R5c).
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{
                "op": "move",
                "from": "/args/layerControl",
                "path": "/args/baseMap",
            }],
        )
        # Both sides are valid Map paths — whitelist check passes. (Semantic
        # validity is separate; this test pins the whitelist-check contract.)
        assert "patch_update" in result

    def test_move_from_missing_rejected_at_shape_check(self):
        # R1/R2: shape validation rejects a `move` without `from` BEFORE
        # whitelist check runs, so the error class is invalid_envelope.
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "move", "path": "/args/baseMap"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_move_from_non_string_rejected_at_shape_check(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "move", "from": 42, "path": "/args/baseMap"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_move_from_relative_path_rejected_at_shape_check(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "move", "from": "args/baseMap", "path": "/args/layerControl"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_error_mentions_prefix_extensibility(self):
        """The error must communicate the extensibility guidance so the LLM
        doesn't think listed entries are the only addressable paths.
        """
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/title", "value": "X"}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]
        # The guidance phrase that unlocks retry: prefixes can be extended.
        assert "prefix" in result["error"].lower()


# ---------------------------------------------------------------------------
# R9/R10 layer-construction boundary (Map only)
# ---------------------------------------------------------------------------


class TestLayerConstructionBoundary:
    """Layer construction is reserved for add_map_service_layer."""

    def test_add_at_layers_dash_rejected(self):
        """`add` at /args/layers/- creates a new layer — banned."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "add", "path": "/args/layers/-", "value": {"name": "new"}}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]
        assert "add_map_service_layer" in result["error"]

    def test_add_at_layers_index_rejected(self):
        """`add` at /args/layers/N inserts a new layer — banned."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{"op": "add", "path": "/args/layers/0", "value": {"name": "new"}}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]
        assert "add_map_service_layer" in result["error"]

    def test_replace_whole_layer_at_index_rejected(self):
        """`replace` at /args/layers/N replaces a whole layer object — banned."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{
                "op": "replace",
                "path": "/args/layers/0",
                "value": {"name": "replacement"},
            }],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]

    def test_field_level_replace_under_layer_allowed(self):
        """`replace` at /args/layers/N/field is permitted — field edit, not layer construction."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{
                "op": "replace",
                "path": "/args/layers/2/configuration/props/opacity",
                "value": 0.5,
            }],
        )
        assert "patch_update" in result

    def test_add_field_under_existing_layer_allowed(self):
        """`add` at /args/layers/N/field adds a field to an existing layer — allowed."""
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Map",
            patches=[{
                "op": "add",
                "path": "/args/layers/0/visible",
                "value": True,
            }],
        )
        assert "patch_update" in result

    def test_layer_boundary_does_not_apply_to_nonmap(self):
        """Non-Map sources don't get the layer-construction check."""
        # Inline Plotly has no /args/layers, so this hits whitelist_rejected,
        # not the layer-boundary check. Verify the error is whitelist_rejected
        # without the add_map_service_layer hint.
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"op": "add", "path": "/args/layers/-", "value": {}}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]
        # Hint is only emitted by the Map-specific check
        assert "add_map_service_layer" not in result["error"]


# ---------------------------------------------------------------------------
# Return envelope shape
# ---------------------------------------------------------------------------


class TestReturnEnvelope:
    """Successful responses carry patch_update with the expected keys."""

    def test_return_shape_on_success(self):
        u = _fresh_uuid()
        result = patch_visualization(
            target_uuid=u,
            source="Inline Plotly",
            patches=[{"op": "replace", "path": "/args/inlineData/layout/title", "value": "X"}],
        )
        assert result == {
            "patch_update": {
                "uuid": u,
                "source": "Inline Plotly",
                "ops": [{"op": "replace", "path": "/args/inlineData/layout/title", "value": "X"}],
            }
        }

    def test_return_shape_on_error_has_no_patch_update(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[],
        )
        assert "patch_update" not in result
        assert "error" in result
