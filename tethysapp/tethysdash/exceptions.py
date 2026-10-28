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
    Raised when a caller-supplied identifier resolves outside its permitted folder.
    """

    def __init__(self, message=INVALID_FILE_PATH):
        super().__init__(message)
