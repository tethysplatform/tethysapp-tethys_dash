class VisualizationError(Exception):
    """
    Raised for custom visualization messaging errors.
    """

    pass


# The one answer a dashboard file endpoint gives for any refused or failed read, so
# the caller learns nothing about what is or is not there.
INVALID_FILE_PATH = "Invalid file path."

# The one answer for a dashboard that does not exist or that the caller may not view,
# so a refusal does not confirm that the ID exists.
DASHBOARD_NOT_FOUND = "Dashboard not found."


class UnsafePath(Exception):
    """
    Raised when an identifier cannot name a stored file: it would resolve outside its
    permitted folder, or, for a layer file, does not end in ``.json``.
    """

    def __init__(self, message=INVALID_FILE_PATH):
        super().__init__(message)


def _megabytes(size):
    return f"{size / (1024 * 1024):.1f} MB"


class LayerStorageQuotaExceeded(Exception):
    """
    Raised when storing layer files would take a user past their layer storage limit.

    The message is the one the user sees, so it says where they stand and how to free
    space: a layer's files are let go when the dashboard is saved without it.
    """

    def __init__(self, used, limit):
        super().__init__(
            f"This would exceed your layer storage limit: {_megabytes(used)} of "
            f"{_megabytes(limit)} is in use. Remove layers you no longer need and save "
            "the dashboard, or delete dashboards you no longer need, to free space."
        )
