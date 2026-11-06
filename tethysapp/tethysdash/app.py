import logging
import os
import sys
import threading

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


# How long the warm-up waits for the Django app registry before giving up.
_WARMUP_READY_TIMEOUT = 30

# Executables whose processes serve requests. Anything else that imports this
# module (a management command, the test runner) has no use for warm plugins.
_SERVING_EXECUTABLES = {"daphne", "uvicorn", "gunicorn"}


def _is_serving_process(argv=None, environ=None):
    """Whether this process serves requests, so warming its plugins pays off.

    True for a known ASGI/WSGI server and for runserver's serving process (the
    autoreloader's child, or --noreload). False for everything else, including
    other management commands, the autoreloader's parent and the test runner.
    """
    argv = sys.argv if argv is None else argv
    environ = os.environ if environ is None else environ
    if not argv:
        return False

    # "python -m uvicorn" runs uvicorn/__main__.py, so name it by its package.
    name = os.path.splitext(os.path.basename(argv[0]))[0]
    if name == "__main__":
        name = os.path.basename(os.path.dirname(argv[0]))
    if name in _SERVING_EXECUTABLES:
        return True

    if argv[1:2] == ["runserver"]:
        return environ.get("RUN_MAIN") == "true" or "--noreload" in argv
    return False


def _warm_when_ready():
    """Import the visualization plugins once the Django app registry is ready."""
    from django.apps import apps as django_apps

    # Plugins may import app modules, so they can only be imported once the app
    # registry is populated. Without it, skip: discovery imports them later.
    if not django_apps.ready_event.wait(timeout=_WARMUP_READY_TIMEOUT):
        logger.warning(
            "App registry not ready after %ss; skipping visualization plugin warm-up",
            _WARMUP_READY_TIMEOUT,
        )
        return
    try:
        from tethysapp.tethysdash.visualizations import warm_visualization_cache

        warm_visualization_cache()
    except Exception:
        logger.warning("Visualization plugin warm-up thread failed", exc_info=True)


def _warm_visualization_plugins_in_background():
    """Import visualization plugins at startup, off the request path, so the
    first dashboard load does not wait on plugin imports. Best effort."""
    if not _is_serving_process():
        return
    try:
        threading.Thread(
            target=_warm_when_ready, name="tethysdash-plugin-warmup", daemon=True
        ).start()
    except Exception:
        # Never let this fail the import: Tethys removes an app from its
        # database when this module raises while it registers controllers.
        logger.warning("Could not start the plugin warm-up thread", exc_info=True)


# Tethys imports this module, then reloads it to register its controllers. A
# reload re-runs this code but keeps the module's globals, so the flag limits
# the warm-up to one thread per process.
if not globals().get("_warmup_requested"):
    _warmup_requested = True
    _warm_visualization_plugins_in_background()
