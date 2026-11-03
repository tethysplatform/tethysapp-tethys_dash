import logging
import sys
import threading
import time

from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import PersistentStoreDatabaseSetting, CustomSetting
from tethys_sdk.permissions import Permission

logger = logging.getLogger(__name__)


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


def _warm_visualization_plugins_in_background():
    """Import visualization plugins at startup, off the request path, so the
    first dashboard load does not wait on plugin imports. Best effort."""
    # Background work is wasted (and noisy) during tests, so skip it there.
    if "pytest" in sys.modules:
        return

    def _run():
        from django.apps import apps as django_apps

        # Plugins may import app modules, so wait until the app registry is
        # populated before importing them.
        for _ in range(600):
            if django_apps.ready:
                break
            time.sleep(0.05)
        try:
            from tethysapp.tethysdash.visualizations import warm_visualization_cache

            warm_visualization_cache()
        except Exception:
            logger.warning("Visualization plugin warm-up thread failed", exc_info=True)

    threading.Thread(
        target=_run, name="tethysdash-plugin-warmup", daemon=True
    ).start()


_warm_visualization_plugins_in_background()
