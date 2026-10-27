"""Path rules for a dashboard's files in the app workspace.

A dashboard's files live in a folder named by its canonical uuid, directly under
the app workspace, which is shared with plugins. Paths are checked after they
are resolved, so ``..`` segments, absolute names and symlinks are all held to
the same rule. The request handlers and the model's cleanup sweeps share these
helpers.
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


def _resolve_contained(parent, name):
    """Resolve ``name`` under ``parent``, or raise :class:`UnsafePath`.

    Rejects a name that is not a string rather than coercing it: coercion turns
    a null or structured value into a literal folder called ``None`` or
    ``{'a': 1}``, which succeeds silently instead of failing loudly.

    Equality with the parent is refused alongside containment, because a path
    is relative to itself -- without it an empty or ``.`` name would resolve
    onto the parent and address the folder rather than something inside it.
    """
    if not isinstance(name, str) or not name:
        raise UnsafePath()
    try:
        resolved = (parent / name).resolve()
    except (ValueError, OSError):
        # Embedded null bytes land here.
        raise UnsafePath()

    if not resolved.is_relative_to(parent) or resolved == parent:
        raise UnsafePath()

    return resolved


def resolve_dashboard_folder(workspace_path, dashboard_uuid):
    """Resolve a dashboard's folder, or raise :class:`UnsafePath`.

    The uuid must already be canonical, not merely convertible: an uppercase or
    braced spelling would name a different folder from the one the dashboard's
    stored uuid names.
    """
    try:
        is_canonical = canonical_dashboard_uuid(dashboard_uuid) == dashboard_uuid
    except ValueError:
        is_canonical = False
    if not is_canonical:
        raise UnsafePath()
    return _resolve_contained(Path(workspace_path).resolve(), dashboard_uuid)


def resolve_dashboard_file(workspace_path, dashboard_uuid, filename):
    """Resolve a file inside a dashboard's folder, or raise :class:`UnsafePath`.

    Returns the folder as well, because the write path needs it to create the
    directory once the name has been cleared.
    """
    dashboard_folder = resolve_dashboard_folder(workspace_path, dashboard_uuid)
    return dashboard_folder, _resolve_contained(dashboard_folder, filename)
