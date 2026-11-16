"""Name rules for a dashboard's layer files.

A dashboard's layer files are stored through the default storage under a
directory named by its canonical uuid, and each file is named by a single
component ending in ``.json``: a remote backend takes "../other/file" as a key
like any other, so a name is held to the rule before it is built rather than
checked after it is resolved.

They used to live in a folder of the same name directly under the app
workspace, which is shared with plugins. The workspace rule remains for the
sweeps that move those folders' files into the storage: there, a folder is
checked after it is resolved, so a symlink cannot carry it out of the
workspace.
"""

from pathlib import Path
from uuid import UUID

from tethysapp.tethysdash.exceptions import UnsafePath


def canonical_dashboard_uuid(value):
    """Return value as a canonical UUID string; raise ValueError if it is not a UUID.

    A dashboard uuid becomes a storage name, so one taken from a request has to be a
    UUID and nothing that could also be read as a path.
    """
    return str(UUID(str(value)))


def require_canonical_dashboard_uuid(dashboard_uuid):
    """Return the uuid if it is already canonical, or raise :class:`UnsafePath`.

    Canonical, not merely convertible: an uppercase or braced spelling would name a
    different directory from the one the dashboard's stored uuid names.
    """
    try:
        is_canonical = canonical_dashboard_uuid(dashboard_uuid) == dashboard_uuid
    except ValueError:
        is_canonical = False
    if not is_canonical:
        raise UnsafePath()
    return dashboard_uuid


def require_layer_filename(filename):
    """Return the filename if it can name a layer file, or raise :class:`UnsafePath`.

    That is one entry -- a non-empty string holding no path separator or null byte
    that is not ``.`` or ``..`` -- ending in ``.json``. The ending matters because a
    web-served media storage takes a file's content type from it: stored as
    ``page.html``, a layer file would be served as a page from the portal's own
    domain. A name that is not a string is refused rather than coerced: coercion
    turns a null or structured value into a literal file called ``None`` or
    ``{'a': 1}``, which succeeds silently instead of failing loudly.
    """
    if (
        not isinstance(filename, str)
        or filename in ("", ".", "..")
        or any(character in filename for character in ("/", "\\", "\x00"))
        or not filename.endswith(".json")
    ):
        raise UnsafePath()
    return filename


def resolve_dashboard_folder(workspace_path, dashboard_uuid):
    """Resolve a dashboard's workspace folder, or raise :class:`UnsafePath`.

    A canonical uuid names one entry directly under the workspace, but that entry
    may be a symlink, so the folder is checked once resolved: it must still lie
    inside the workspace, and must not be the workspace itself, which a path is
    always relative to.
    """
    workspace = Path(workspace_path).resolve()
    resolved = (workspace / require_canonical_dashboard_uuid(dashboard_uuid)).resolve()
    if not resolved.is_relative_to(workspace) or resolved == workspace:
        raise UnsafePath()
    return resolved
