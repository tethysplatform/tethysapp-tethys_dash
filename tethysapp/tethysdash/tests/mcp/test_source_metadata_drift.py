"""Cross-language drift guard — Python half.

Asserts that ``plugin_helpers.available_source_properties`` covers every
JS-side ``sourcePropertiesOptions`` source type (modulo deferred entries
listed in the fixture). When this test fails, the JS side gained a
source type that backend hasn't caught up to — exactly the failure mode
that motivated plan 004.

See ``reactapp/__tests__/scripts/sourcePropertiesOptionsDrift.test.js``
for the JS-side guard that asserts the fixture matches the JS keys.
"""

import json
from pathlib import Path

from tethysapp.tethysdash.plugin_helpers import (
    LayerConfigurationBuilder,
    available_source_properties,
)


FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent
    / "fixtures"
    / "source_properties_options.json"
)


def _load_fixture():
    with FIXTURE_PATH.open() as f:
        return json.load(f)


def test_backend_metadata_covers_js_source_types():
    fixture = _load_fixture()
    js_keys = set(fixture["source_types"])
    deferred = set(fixture["deferred_in_backend"])
    expected_in_backend = js_keys - deferred

    backend_keys = set(available_source_properties.keys())
    missing = expected_in_backend - backend_keys
    assert missing == set(), (
        f"Backend available_source_properties missing source types present "
        f"in JS sourcePropertiesOptions: {sorted(missing)}. Either add the "
        f"metadata in plugin_helpers.py, or move the type to "
        f"deferred_in_backend in the fixture with reasoning."
    )


def test_builder_accepts_every_backend_source_type():
    # If a source type exists in available_source_properties but the
    # builder rejects it, MCP delegation will silently fail for that
    # type. Both halves must stay aligned.
    for source_type in available_source_properties:
        try:
            LayerConfigurationBuilder("test layer", source_type)
        except ValueError as err:
            raise AssertionError(
                f"LayerConfigurationBuilder rejects '{source_type}' but "
                f"available_source_properties claims to support it: {err}"
            ) from err


def test_static_image_specifically_present():
    # Spot-check for the canonical example from plan 004 — Static Image
    # was missing from MCP for months while present in the UI. Keep this
    # explicit so a future regression names the right culprit.
    assert "Static Image" in available_source_properties
    static_image = available_source_properties["Static Image"]
    assert "url" in static_image["required"]
    assert "projection" in static_image["required"]
    assert "imageExtent" in static_image["required"]
