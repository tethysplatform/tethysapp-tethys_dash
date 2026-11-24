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

# The answer to a data request that does not fit the dashboard's saved settings: the
# tile or layer it names is gone, runs another plugin, or was saved differently. Only a
# caller who may view the dashboard gets it, so it confirms nothing they cannot see.
DASHBOARD_CHANGED = "This dashboard has changed. Reload it to see the latest version."

# The answer to a viewer's data request for a tile whose secret arg holds no value, or
# one that cannot be read. The viewer cannot enter one, so nothing more is said.
SECRET_NOT_SET_UP = "This tile needs a secret that hasn't been set up yet."

# The answer to an editor's data request for a tile whose secret arg holds no value:
# none was typed into its settings, and none is stored for it.
SECRET_NEEDED = "This tile needs a secret. Enter it in the tile's settings."

# The answer to an editor's data request for a tile whose stored secret cannot be read
# (see tile_secrets.SecretUnavailable): the keys it was stored with are gone, or it no
# longer matches its place.
SECRET_UNREADABLE = (
    "The secret saved for this tile can't be read. Enter it again in the tile's "
    "settings."
)

# The answer to a data request whose plugin returned the value of one of its secret
# args, in any form. The result is not sent.
SECRET_RETURNED = "The plugin returned a secret, so its result was not sent."

# The answer to a dashboard save that sets a secret for a setting the saved dashboard
# does not have as a secret one: its tile, layer or arg is gone, or its plugin does
# not declare the arg secret.
SECRET_SETTING_GONE = (
    "A secret was entered for a setting this dashboard no longer has as a secret one. "
    "Reload the dashboard and enter it again."
)

# The answer to a dashboard save whose secret changes are not in the expected form.
SECRET_CHANGES_MALFORMED = "The secret changes sent are not in the expected form."

# The answer to a data request sent other than as a POST, which only a page loaded
# before data requests became POSTs sends.
PAGE_OUT_OF_DATE = "This page is out of date. Reload it to see the latest version."

# The answer to a data request that failed for any reason not named to the caller.
DATA_REQUEST_FAILED = "Failed to retrieve data"


class DashboardNotFound(Exception):
    """
    Raised for a dashboard that does not exist or that the caller may not view. Both
    carry the same message, :data:`DASHBOARD_NOT_FOUND`.
    """

    def __init__(self, message=DASHBOARD_NOT_FOUND):
        super().__init__(message)


class DataRequestRefused(Exception):
    """
    Raised when the server will not run a data request for the caller. The message is
    the one the browser shows.
    """


class DashboardUpdateRefused(Exception):
    """
    Raised when a dashboard save is refused for a reason the editor can act on: a
    permission they lack, or a user or group its permissions name that does not exist.
    The message is the one the editor sees.
    """


class SecretChangeRefused(Exception):
    """
    Raised when a dashboard save's secret changes cannot all be applied, which
    refuses the whole save. The message is the one the editor sees, and never holds
    a secret's value.
    """


class UnsafePath(Exception):
    """
    Raised when an identifier cannot name a stored file: it would resolve outside its
    permitted folder, or, for a layer file, does not end in ``.json``.
    """

    def __init__(self, message=INVALID_FILE_PATH):
        super().__init__(message)


def _megabytes(size):
    return f"{size / (1024 * 1024):.1f} MB"


def request_too_large_message(limit):
    """The answer to a request whose body is over the portal's limit, in bytes."""
    return (
        f"The values sent are too large. A request must be smaller than "
        f"{_megabytes(limit)}."
    )


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
