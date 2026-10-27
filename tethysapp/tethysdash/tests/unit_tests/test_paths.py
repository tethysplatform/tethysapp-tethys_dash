"""Direct contract tests for the shared path-containment rules.

Everything else exercises these through a controller or the cleanup sweep, so
a refactor could change the contract while every integration test stayed green.
"""

import pytest

from tethysapp.tethysdash.exceptions import UnsafePath
from tethysapp.tethysdash.paths import (
    resolve_dashboard_file,
    resolve_dashboard_folder,
)

VALID_UUID = "123e4567-e89b-12d3-a456-426614174000"


@pytest.mark.parametrize(
    "dashboard_uuid",
    ["../escape", "/etc", "", ".", "..", None, 123],
)
def test_resolve_dashboard_folder_refuses_escapes(tmp_path, dashboard_uuid):
    with pytest.raises(UnsafePath):
        resolve_dashboard_folder(tmp_path, dashboard_uuid)


def test_resolve_dashboard_folder_accepts_a_contained_name(tmp_path):
    folder = resolve_dashboard_folder(tmp_path, VALID_UUID)
    assert folder == (tmp_path / VALID_UUID).resolve()


@pytest.mark.parametrize(
    "filename",
    ["../escape.json", "/etc/passwd", "sub/../../out.json", "", ".", "..", None, {}],
)
def test_resolve_dashboard_file_refuses_escapes(tmp_path, filename):
    with pytest.raises(UnsafePath):
        resolve_dashboard_file(tmp_path, VALID_UUID, filename)


def test_resolve_dashboard_file_accepts_a_contained_name(tmp_path):
    folder, path = resolve_dashboard_file(tmp_path, VALID_UUID, "layer.v2.json")
    assert folder == (tmp_path / VALID_UUID).resolve()
    assert path == (tmp_path / VALID_UUID / "layer.v2.json").resolve()


@pytest.mark.parametrize("bad", ["a\0b.json", "ab\0cd"])
def test_embedded_null_bytes_are_refused_not_raised_raw(tmp_path, bad):
    """Pins the except arm: without it a raw ValueError escapes to the generic
    handler and the response message becomes 'embedded null byte'."""
    with pytest.raises(UnsafePath):
        resolve_dashboard_file(tmp_path, VALID_UUID, bad)
    with pytest.raises(UnsafePath):
        resolve_dashboard_folder(tmp_path, bad)


def test_a_symlink_inside_the_folder_cannot_point_outward(tmp_path):
    workspace = tmp_path / "workspace"
    folder = workspace / VALID_UUID
    folder.mkdir(parents=True)
    outside = tmp_path / "outside.json"
    outside.write_text("{}")
    (folder / "link.json").symlink_to(outside)

    with pytest.raises(UnsafePath):
        resolve_dashboard_file(workspace, VALID_UUID, "link.json")


def test_non_string_identifiers_are_refused_rather_than_coerced(tmp_path):
    """A coerced None would resolve to a literal folder named 'None' and
    succeed silently instead of failing."""
    with pytest.raises(UnsafePath):
        resolve_dashboard_file(tmp_path, None, None)
    assert not (tmp_path / "None").exists()


@pytest.mark.parametrize(
    "dashboard_uuid",
    [
        f"{VALID_UUID}/sub",
        VALID_UUID.upper(),
        "{" + VALID_UUID + "}",
        "geoglows_plots_cache",
    ],
    ids=["nested_in_a_dashboard", "uppercase", "braced", "plugin_folder"],
)
def test_resolve_dashboard_folder_refuses_a_contained_but_non_canonical_uuid(
    tmp_path, dashboard_uuid
):
    """Each of these stays inside the workspace but is not a canonical uuid."""
    (tmp_path / VALID_UUID).mkdir()
    (tmp_path / "geoglows_plots_cache").mkdir()

    with pytest.raises(UnsafePath):
        resolve_dashboard_folder(tmp_path, dashboard_uuid)
