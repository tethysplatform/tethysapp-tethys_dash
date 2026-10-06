from functools import cache
from importlib.metadata import PackageNotFoundError, version

from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting, CustomSetting
from tethys_sdk.permissions import Permission


@cache
def get_app_version():
    """
    The installed TethysDash version, or None when it cannot be determined.

    Read from the installed distribution rather than from a constant in the
    source, so it is the version actually running. Plugin authors are shown it
    in the app info modal, because the documentation they need is the
    documentation for this version and nothing in the app otherwise says which
    that is.

    None when TethysDash is being run from a source tree that was never
    installed; the caller leaves the version out rather than showing a
    placeholder that would be worse than silence.

    Returns:
        str | None: e.g. ``"0.20.0"``.
    """
    try:
        # The distribution name in pyproject.toml, which is not the package
        # name on disk ("tethysapp.tethysdash").
        return version("tethysdash")
    except PackageNotFoundError:  # pragma: no cover - needs an uninstalled tree
        return None


class App(TethysAppBase):
    """
    Tethys app class for TethysDash.
    """

    name = "TethysDash"
    description = ""
    package = "tethysdash"  # WARNING: Do not change this value
    index = "home"
    icon = f"{package}/images/tethys_dash.png"
    catch_all = "home"  # required for react browser routing
    root_url = "tethysdash"
    color = ""  # Don't set color here, set it in reactapp/custom-bootstrap.scss
    tags = ""
    enable_feedback = False
    feedback_emails = []

    def persistent_store_settings(self):
        """
        Define Persistent Store Settings.
        """
        ps_settings = (
            PersistentStoreDatabaseSetting(
                name="primary_db",
                description="primary database",
                initializer="tethysdash.model.init_primary_db",
                required=True,
            ),
        )

        return ps_settings

    def permissions(self):
        """
        Define app-level permissions.

        Returns:
            tuple: Permissions available in this app. ``manage_visualizations``
            grants access to view and edit which users/groups may access
            restricted visualization plugins.
        """
        manage_visualizations = Permission(
            name="manage_visualizations", description="Manage visualizations"
        )

        permissions = (manage_visualizations,)

        return permissions

    def custom_settings(self):
        """
        Define custom app settings.

        Returns:
            tuple: Optional settings configurable by administrators:
            ``support_email`` is displayed to users on support pages;
            ``support_github`` is the URL of the project's GitHub repository.
        """
        custom_settings = (
            CustomSetting(
                name="support_email",
                type=CustomSetting.TYPE_STRING,
                description="Support email address",
                required=False,
            ),
            CustomSetting(
                name="support_github",
                type=CustomSetting.TYPE_STRING,
                description="Support GitHub URL",
                required=False,
            ),
        )

        return custom_settings
