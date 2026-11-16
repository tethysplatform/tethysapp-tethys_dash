"""Direct contract tests for the shared naming and path-containment rules.

Everything else exercises these through a controller, the storage helpers or the
workspace sweeps, so a refactor could change the contract while every
integration test stayed green.
"""

import pytest

from tethysapp.tethysdash.exceptions import UnsafePath
from tethysapp.tethysdash.paths import (
    require_canonical_dashboard_uuid,
    require_layer_filename,
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


@pytest.mark.parametrize("target", ["outside", "workspace"])
def test_resolve_dashboard_folder_refuses_a_uuid_symlinked_out_of_the_workspace(
    tmp_path, target
):
    """The uuid is canonical but names a symlink: to a folder outside the workspace,
    or to the workspace itself."""
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (tmp_path / "outside").mkdir()
    (workspace / VALID_UUID).symlink_to(tmp_path / target)

    with pytest.raises(UnsafePath):
        resolve_dashboard_folder(workspace, VALID_UUID)


@pytest.mark.parametrize(
    "filename",
    [
        "../escape.json",
        "/etc/passwd",
        "sub/../../out.json",
        "sub/layer.json",
        "..\\escape.json",
        "a\0b.json",
        "",
        ".",
        "..",
        None,
        {},
        "page.html",
        "layer.geojson",
        "layer.json.html",
    ],
)
def test_require_layer_filename_refuses_anything_but_one_json_entry(filename):
    """A remote storage takes any of these as a key, so the rule is the only guard; and
    a web-served one takes the content type from the name, so it must end in .json."""
    with pytest.raises(UnsafePath):
        require_layer_filename(filename)


@pytest.mark.parametrize("filename", ["layer.json", "chart.v2.data.json", "..json"])
def test_require_layer_filename_accepts_dots_inside_a_name(filename):
    assert require_layer_filename(filename) == filename


@pytest.mark.parametrize(
    "dashboard_uuid",
    [
        f"{VALID_UUID}/sub",
        VALID_UUID.upper(),
        "{" + VALID_UUID + "}",
        "geoglows_plots_cache",
        "ab\0cd",
        None,
        123,
    ],
    ids=[
        "nested_in_a_dashboard",
        "uppercase",
        "braced",
        "plugin_folder",
        "null_byte",
        "none",
        "integer",
    ],
)
def test_require_canonical_dashboard_uuid_refuses_any_other_spelling(dashboard_uuid):
    with pytest.raises(UnsafePath):
        require_canonical_dashboard_uuid(dashboard_uuid)


def test_require_canonical_dashboard_uuid_accepts_the_canonical_form():
    assert require_canonical_dashboard_uuid(VALID_UUID) == VALID_UUID


@pytest.mark.parametrize("bad", ["a\0b.json", "ab\0cd"])
def test_embedded_null_bytes_are_refused_not_raised_raw(tmp_path, bad):
    """Refused as UnsafePath by the uuid parse, before the path is ever resolved, so
    no raw 'embedded null byte' ValueError reaches the caller."""
    with pytest.raises(UnsafePath):
        resolve_dashboard_folder(tmp_path, bad)


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
