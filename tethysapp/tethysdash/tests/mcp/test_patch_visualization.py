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
            patches=[{"op": "replace", "path": "/args/title", "value": "Rainfall"}],
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
                {"op": "test", "path": "/args/title", "value": "Old"},
                {"op": "replace", "path": "/args/title", "value": "New"},
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
            patches=[{"op": "replace", "path": "/args/title", "value": "X"}],
            description="Rename the rainfall plot",
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
            patches='[{"op":"replace","path":"/args/title","value":"X"}]',
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
            patches=[{"op": "patch", "path": "/args/title", "value": "X"}],
        )
        assert "error" in result
        assert "invalid_envelope" in result["error"]

    def test_missing_op_field_rejected(self):
        result = patch_visualization(
            target_uuid=_fresh_uuid(),
            source="Inline Plotly",
            patches=[{"path": "/args/title", "value": "X"}],
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
            patches=[{"op": "add", "path": "/args/title"}],
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
            patches=[{"op": "replace", "path": "/args/title", "value": "X"}],
        )
        assert "error" in result
        assert "whitelist_rejected" in result["error"]


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
            patches=[{"op": "replace", "path": "/args/title", "value": "X"}],
        )
        assert result == {
            "patch_update": {
                "uuid": u,
                "source": "Inline Plotly",
                "ops": [{"op": "replace", "path": "/args/title", "value": "X"}],
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
