"""Contract tests for create_variable_input MCP tool.

Validates all 8 variable input subtypes produce the correct output shape,
including the dotted key metadata pattern for slider, array-based
variable_options_source for dropdown, and minimum viable dimensions.

Layer 1 tests -- no browser, no server, milliseconds per test.
"""

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import create_variable_input
from tethysapp.tethysdash.tests.mcp.test_visualization_contracts import (
    assert_variable_input_viz,
)


# ---------------------------------------------------------------------------
# Helper: assert minimum viable dimensions for variable inputs
# ---------------------------------------------------------------------------

MIN_W = 25
MIN_H = 12


def assert_minimum_dimensions(result):
    """Variable inputs must be at least w=25, h=12 to be usable."""
    viz = result["visualization"]
    assert viz["w"] >= MIN_W, (
        f"w={viz['w']} is below minimum {MIN_W}"
    )
    assert viz["h"] >= MIN_H, (
        f"h={viz['h']} is below minimum {MIN_H}"
    )


# ---------------------------------------------------------------------------
# Simple subtypes: text, number, checkbox, date, date-range, csv-uploader
# ---------------------------------------------------------------------------

class TestSimpleSubtypes:
    """Subtypes that set variable_options_source to a string matching the type."""

    def test_text(self):
        result = create_variable_input(
            variable_name="my_text",
            variable_type="text",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "text"
        assert args["variable_name"] == "my_text"

    def test_number(self):
        result = create_variable_input(
            variable_name="my_number",
            variable_type="number",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "number"
        assert args["variable_name"] == "my_number"

    def test_checkbox(self):
        result = create_variable_input(
            variable_name="my_checkbox",
            variable_type="checkbox",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "checkbox"

    def test_date(self):
        result = create_variable_input(
            variable_name="my_date",
            variable_type="date",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "date"

    def test_date_range(self):
        result = create_variable_input(
            variable_name="my_date_range",
            variable_type="date-range",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "date-range"

    def test_csv_uploader(self):
        result = create_variable_input(
            variable_name="my_csv",
            variable_type="csv-uploader",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "csv-uploader"


# ---------------------------------------------------------------------------
# Dropdown: variable_options_source must be an array, not a string
# ---------------------------------------------------------------------------

class TestDropdown:
    """Dropdown subtype uses array-based variable_options_source."""

    def test_dropdown_options_is_array(self):
        result = create_variable_input(
            variable_name="my_dropdown",
            variable_type="dropdown",
            options=["A", "B", "C"],
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert isinstance(args["variable_options_source"], list), (
            f"Expected list, got {type(args['variable_options_source'])}"
        )
        assert args["variable_options_source"] == ["A", "B", "C"]

    def test_dropdown_options_not_string(self):
        """Dropdown must NOT set variable_options_source to the string 'dropdown'."""
        result = create_variable_input(
            variable_name="my_dropdown",
            variable_type="dropdown",
            options=["X", "Y"],
        )
        args = result["visualization"]["args"]
        assert args["variable_options_source"] != "dropdown", (
            "Dropdown variable_options_source must be the options array, not the string 'dropdown'"
        )

    def test_dropdown_string_options_coerced_to_list(self):
        """LLMs may pass comma-separated string instead of list."""
        result = create_variable_input(
            variable_name="my_dropdown",
            variable_type="dropdown",
            options="Red, Green, Blue",
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert isinstance(args["variable_options_source"], list)
        assert args["variable_options_source"] == ["Red", "Green", "Blue"]

    def test_dropdown_requires_options(self):
        """Dropdown without options should return an error."""
        result = create_variable_input(
            variable_name="my_dropdown",
            variable_type="dropdown",
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# Slider: dotted key metadata with all 6 required fields
# ---------------------------------------------------------------------------

SLIDER_METADATA_FIELDS = {"min", "max", "step", "dataType", "initialValue", "outputFormat"}


class TestSlider:
    """Slider subtype uses dotted key metadata pattern."""

    def test_slider_variable_options_source_is_string(self):
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=100,
            slider_step=5,
        )
        assert_variable_input_viz(result)
        args = result["visualization"]["args"]
        assert args["variable_options_source"] == "slider"

    def test_slider_dotted_key_exists(self):
        """The dotted key 'variable_options_source.metadata' must be a literal dict key."""
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=100,
        )
        args = result["visualization"]["args"]
        assert "variable_options_source.metadata" in args, (
            "Missing dotted key 'variable_options_source.metadata' -- "
            "this is a literal JavaScript property name that Base.js reads"
        )

    def test_slider_metadata_has_all_six_fields(self):
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=100,
            slider_step=5,
        )
        metadata = result["visualization"]["args"]["variable_options_source.metadata"]
        missing = SLIDER_METADATA_FIELDS - set(metadata.keys())
        assert not missing, f"Missing metadata fields: {missing}"

    def test_slider_metadata_values(self):
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=10,
            slider_max=200,
            slider_step=10,
            initial_value="50",
        )
        metadata = result["visualization"]["args"]["variable_options_source.metadata"]
        assert metadata["min"] == 10
        assert metadata["max"] == 200
        assert metadata["step"] == 10
        assert metadata["dataType"] == "Number"
        assert metadata["initialValue"] == 50.0
        assert metadata["outputFormat"] == "{{n}}"

    def test_slider_output_format_uses_double_braces(self):
        """outputFormat must be '{{n}}' -- double curly braces for Mustache template."""
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=1,
        )
        metadata = result["visualization"]["args"]["variable_options_source.metadata"]
        assert metadata["outputFormat"] == "{{n}}", (
            f"Expected '{{{{n}}}}', got '{metadata['outputFormat']}'"
        )

    def test_slider_default_step_is_one(self):
        """Step defaults to 1 when not provided."""
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=10,
        )
        metadata = result["visualization"]["args"]["variable_options_source.metadata"]
        assert metadata["step"] == 1

    def test_slider_initial_value_from_param(self):
        """initialValue in metadata should use the initial_value param when provided."""
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=100,
            initial_value="42",
        )
        metadata = result["visualization"]["args"]["variable_options_source.metadata"]
        assert metadata["initialValue"] == 42.0

    def test_slider_initial_value_defaults_to_min(self):
        """initialValue in metadata should default to slider_min when initial_value is empty."""
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
            slider_min=5,
            slider_max=50,
        )
        metadata = result["visualization"]["args"]["variable_options_source.metadata"]
        assert metadata["initialValue"] == 5

    def test_slider_requires_min_and_max(self):
        """Slider without min/max should return an error."""
        result = create_variable_input(
            variable_name="my_slider",
            variable_type="slider",
        )
        assert "error" in result


# ---------------------------------------------------------------------------
# Minimum viable dimensions: all subtypes must have w >= 25, h >= 12
# ---------------------------------------------------------------------------

class TestMinimumDimensions:
    """All variable input subtypes must meet minimum dimensions for usability."""

    SIMPLE_TYPES = ["text", "number", "checkbox", "date", "date-range", "csv-uploader"]

    def test_simple_types_default_dimensions(self):
        for vtype in self.SIMPLE_TYPES:
            result = create_variable_input(
                variable_name=f"dim_test_{vtype}",
                variable_type=vtype,
            )
            assert_minimum_dimensions(result)

    def test_dropdown_default_dimensions(self):
        result = create_variable_input(
            variable_name="dim_test_dropdown",
            variable_type="dropdown",
            options=["A", "B"],
        )
        assert_minimum_dimensions(result)

    def test_slider_default_dimensions(self):
        result = create_variable_input(
            variable_name="dim_test_slider",
            variable_type="slider",
            slider_min=0,
            slider_max=100,
        )
        assert_minimum_dimensions(result)


# ---------------------------------------------------------------------------
# Invalid type handling
# ---------------------------------------------------------------------------

class TestInvalidType:
    """Invalid variable_type should return an error, not crash."""

    def test_invalid_type_returns_error(self):
        result = create_variable_input(
            variable_name="bad",
            variable_type="invalid_type",
        )
        assert "error" in result

    def test_invalid_type_error_message(self):
        result = create_variable_input(
            variable_name="bad",
            variable_type="radio",
        )
        assert "Invalid variable_type" in result["error"]
