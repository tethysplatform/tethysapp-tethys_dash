"""Contract tests for the R7 LLM-editable-path whitelist.

Validates that the schema at ``reactapp/config/editableSchemas.json`` covers
every path explicitly listed in R9 of the origin requirements doc (those are
the required test fixtures per R7), plus per-behavior assertions for the
prefix-matching semantics and the literal-dotted-key hazard.

Layer 1 tests — no browser, no server, milliseconds per test.
"""

import pytest

from tethysapp.tethysdash.editable_schemas import (
    LLM_EDITABLE_PATHS,
    is_path_allowed,
    validate_path_against_whitelist,
)


# ---------------------------------------------------------------------------
# R9 required fixtures — every path in this table must be whitelisted
# ---------------------------------------------------------------------------

R9_FIXTURES = {
    # Inline viz types persist their title/subtitle/description inside
    # `inlineData`, not at top-level args. See create_plotly_chart /
    # create_data_table / create_card for the ground-truth persisted shape.
    "Inline Plotly": [
        "/args/inlineData/layout/title",
        "/args/inlineData/data",
        "/args/inlineData/data/0/x",
        "/args/inlineData/layout",
        "/args/inlineData/config",
    ],
    "Inline Table": [
        "/args/inlineData/title",
        "/args/inlineData/subtitle",
        "/args/inlineData/data",
        "/args/inlineData/data/-",
    ],
    "Inline Card": [
        "/args/inlineData/title",
        "/args/inlineData/data",
        "/args/inlineData/data/0/value",
        "/args/inlineData/data/0/color",
    ],
    "Variable Input": [
        "/args/initial_value",
        "/args/variable_options_source",
        "/args/variable_options_source.metadata",
        "/args/variable_options_source.metadata/outputFormat",
    ],
    "Map": [
        "/args/baseMap",
        "/args/layerControl",
        "/args/layers",
        "/args/layers/0",
        "/args/layers/2/configuration/props/opacity",
        "/args/map_extent",
        "/args/map_extent/variable",
        "/args/mapDrawing",
        "/args/mapDrawing/options",
        "/args/mapDrawing/limit",
        "/args/mapDrawing/variable_name",
    ],
}


# ---------------------------------------------------------------------------
# Schema shape
# ---------------------------------------------------------------------------


class TestSchemaShape:
    """The JSON file has the expected top-level shape."""

    def test_has_five_in_scope_viz_types(self):
        expected = {"Inline Plotly", "Inline Table", "Inline Card", "Variable Input", "Map"}
        assert set(LLM_EDITABLE_PATHS.keys()) == expected

    def test_every_value_is_a_nonempty_list_of_strings(self):
        for source, prefixes in LLM_EDITABLE_PATHS.items():
            assert isinstance(prefixes, list), f"{source!r} value must be a list"
            assert prefixes, f"{source!r} must have at least one whitelist entry"
            for prefix in prefixes:
                assert isinstance(prefix, str), (
                    f"{source!r} contains non-string entry {prefix!r}"
                )
                assert prefix.startswith("/"), (
                    f"{source!r} entry {prefix!r} must be an absolute JSON Pointer"
                )


# ---------------------------------------------------------------------------
# R9 required-fixture coverage (is_path_allowed)
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "source,path",
    [(s, p) for s, paths in R9_FIXTURES.items() for p in paths],
)
def test_r9_fixture_is_whitelisted(source, path):
    """Every path listed in R9 must be allowed by is_path_allowed."""
    assert is_path_allowed(source, path), (
        f"R9 required fixture not whitelisted: source={source!r} path={path!r}"
    )


# ---------------------------------------------------------------------------
# Prefix-matching semantics
# ---------------------------------------------------------------------------


class TestPrefixMatching:
    """Structural segment matching — not raw string prefix."""

    def test_exact_match_is_allowed(self):
        assert is_path_allowed("Map", "/args/baseMap")

    def test_child_path_via_segment_separator_is_allowed(self):
        # /args/layers matches /args/layers/2 via the "/" boundary
        assert is_path_allowed("Map", "/args/layers/2")
        assert is_path_allowed("Map", "/args/layers/2/configuration/props/opacity")

    def test_sibling_paths_via_dot_are_NOT_raw_string_matches(self):
        # /args/variable_options_source must NOT match /args/variable_options_source.metadata
        # by structural rules — they're distinct sibling keys.
        # This only fails if the matcher naively uses str.startswith without the "/" guard.
        # Both prefixes happen to be in the Variable Input whitelist, so both paths are
        # allowed — but the test pins the matcher's shape via a synthetic case below.
        assert is_path_allowed("Variable Input", "/args/variable_options_source")
        assert is_path_allowed("Variable Input", "/args/variable_options_source.metadata")

    def test_nonwhitelisted_path_is_rejected(self):
        assert not is_path_allowed("Map", "/args/secret_internal_field")

    def test_unknown_source_rejects_everything(self):
        # Fail-closed for non-in-scope viz types (Text, Custom Image, etc.)
        assert not is_path_allowed("Text", "/args/text")
        assert not is_path_allowed("Custom Image", "/args/image_source")
        assert not is_path_allowed("Nonexistent Viz Type", "/args/title")


# ---------------------------------------------------------------------------
# Literal-dotted-key hazard
# ---------------------------------------------------------------------------


class TestLiteralDottedKey:
    """RFC 6901 does not special-case '.' — variable_options_source.metadata is a
    single segment containing a literal dot, NOT a nested path split on dot.
    """

    def test_dotted_key_sibling_is_distinct_from_nondotted_key(self):
        # Both must be allowed; they're peer keys at /args/
        assert is_path_allowed("Variable Input", "/args/variable_options_source")
        assert is_path_allowed("Variable Input", "/args/variable_options_source.metadata")

    def test_dotted_key_children_are_allowed_via_segment_separator(self):
        # Slider case: /args/variable_options_source.metadata/outputFormat must work
        assert is_path_allowed(
            "Variable Input",
            "/args/variable_options_source.metadata/outputFormat",
        )

    def test_prefix_matcher_does_NOT_split_on_dot(self):
        # Synthetic: a source with ONLY /args/foo in its whitelist must NOT
        # allow /args/foo.bar (that's a sibling key, not a sub-path).
        # Confirm via the matcher's behavior against our real Variable Input:
        # /args/variable_name is whitelisted — /args/variable_name.metadata must NOT be.
        assert is_path_allowed("Variable Input", "/args/variable_name")
        assert not is_path_allowed("Variable Input", "/args/variable_name.metadata")


# ---------------------------------------------------------------------------
# validate_path_against_whitelist
# ---------------------------------------------------------------------------


class TestValidatePathAgainstWhitelist:
    def test_allowed_path_does_not_raise(self):
        validate_path_against_whitelist("Map", "/args/baseMap")

    def test_rejected_path_raises_value_error_with_structured_message(self):
        with pytest.raises(ValueError, match="whitelist_rejected"):
            validate_path_against_whitelist("Map", "/args/secret_field")

    def test_rejected_message_includes_path_and_source(self):
        with pytest.raises(ValueError) as excinfo:
            validate_path_against_whitelist("Map", "/args/secret_field")
        msg = str(excinfo.value)
        assert "/args/secret_field" in msg
        assert "Map" in msg
