"""Containment rules for paths built from caller-supplied dashboard identifiers.

A dashboard's files live in a folder named after its uuid under the app
workspace. Both the uuid and the filename originate with the caller -- the uuid
arrives in the create request and is then stored, so it keeps arriving from the
database long after the request that supplied it. Joining either into a path
unchecked lets a request walk out of the workspace two different ways: a
relative ``../`` chain, and an absolute path, which makes the join discard the
base entirely. Rejecting ``..`` alone would miss the second, so containment is
checked on the fully resolved path instead. Resolving also collapses symlinks,
so a link inside a folder cannot point outward.

This lives apart from both callers because the request path and the cleanup
sweep in the model layer need the same rule, and the sweep deletes files.
"""

import uuid as uuid_module
from pathlib import Path


class UnsafePath(Exception):
    """A caller-supplied identifier resolved outside its permitted folder.

    Carries a deliberately uniform message: the caller learns nothing about
    what is or is not there.
    """

    def __init__(self, message="Invalid file path."):
        super().__init__(message)


def is_valid_dashboard_uuid(value):
    """True when ``value`` is a well-formed UUID and therefore path-safe.

    A conforming uuid cannot contain a separator or a dot segment, so this is
    the cheapest place to stop a traversal -- before the value is ever stored
    and replayed into a path by something that deletes files.
    """
    if not isinstance(value, str):
        return False
    try:
        uuid_module.UUID(value)
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def resolve_dashboard_folder(workspace_path, dashboard_uuid):
    """Resolve a dashboard's folder, or raise :class:`UnsafePath`.

    The folder must sit strictly inside the workspace -- equal to the root is
    refused too, since an empty or ``.`` uuid would otherwise place a
    dashboard's files directly in the shared workspace.
    """
    workspace_root = Path(workspace_path).resolve()
    try:
        dashboard_folder = (workspace_root / str(dashboard_uuid)).resolve()
    except (ValueError, TypeError, OSError):
        # Embedded null bytes and non-path-like values land here.
        raise UnsafePath()

    if (
        not dashboard_folder.is_relative_to(workspace_root)
        or dashboard_folder == workspace_root
    ):
        raise UnsafePath()

    return dashboard_folder


def resolve_dashboard_file(workspace_path, dashboard_uuid, filename):
    """Resolve a file inside a dashboard's folder, or raise :class:`UnsafePath`.

    Returns the folder as well, because the write path needs it to create the
    directory once the name has been cleared.
    """
    dashboard_folder = resolve_dashboard_folder(workspace_path, dashboard_uuid)
    try:
        dashboard_file = (dashboard_folder / str(filename)).resolve()
    except (ValueError, TypeError, OSError):
        raise UnsafePath()

    if (
        not dashboard_file.is_relative_to(dashboard_folder)
        or dashboard_file == dashboard_folder
    ):
        raise UnsafePath()

    return dashboard_folder, dashboard_file
