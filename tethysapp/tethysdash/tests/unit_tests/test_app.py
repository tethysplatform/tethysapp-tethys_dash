"""Tests for the startup plugin warm-up in app.py.

The module-level call runs whenever Tethys imports app.py, so these drive the
pieces directly: which processes warm, how the thread starts, and what the
thread does once the app registry is (or is not) ready.
"""

import importlib
import sys

import pytest

from tethysapp.tethysdash import app


@pytest.mark.parametrize(
    "argv, environ, expected",
    [
        (["/opt/conda/bin/daphne", "-u", "/run/a.sock", "x.asgi:app"], {}, True),
        (["/opt/conda/lib/site-packages/uvicorn/__main__.py", "x.asgi:app"], {}, True),
        (["/opt/conda/bin/gunicorn", "x.wsgi"], {}, True),
        (["manage.py", "runserver"], {"RUN_MAIN": "true"}, True),
        (["manage.py", "runserver", "--noreload"], {}, True),
        (["manage.py", "runserver"], {}, False),
        (["manage.py", "shell"], {}, False),
        (["manage.py", "collectstatic", "--noinput"], {}, False),
        (["/opt/conda/lib/site-packages/pytest/__main__.py", "--reuse-db"], {}, False),
        ([], {}, False),
    ],
    ids=[
        "daphne",
        "python-m-uvicorn",
        "gunicorn",
        "runserver-child",
        "runserver-noreload",
        "runserver-reloader-parent",
        "shell",
        "collectstatic",
        "python-m-pytest",
        "no-argv",
    ],
)
def test_is_serving_process(argv, environ, expected):
    assert app._is_serving_process(argv, environ) is expected


def test_warm_up_skipped_outside_a_serving_process(mocker):
    mocker.patch.object(app, "_is_serving_process", return_value=False)
    threading = mocker.patch.object(app, "threading")

    app._warm_visualization_plugins_in_background()

    threading.Thread.assert_not_called()


def test_warm_up_starts_a_daemon_thread_in_a_serving_process(mocker):
    mocker.patch.object(app, "_is_serving_process", return_value=True)
    threading = mocker.patch.object(app, "threading")

    app._warm_visualization_plugins_in_background()

    threading.Thread.assert_called_once_with(
        target=app._warm_when_ready, name="tethysdash-plugin-warmup", daemon=True
    )
    threading.Thread.return_value.start.assert_called_once_with()


def test_warm_up_thread_start_failure_is_logged_not_raised(mocker):
    mocker.patch.object(app, "_is_serving_process", return_value=True)
    threading = mocker.patch.object(app, "threading")
    threading.Thread.return_value.start.side_effect = RuntimeError("no threads")
    logger = mocker.patch.object(app, "logger")

    app._warm_visualization_plugins_in_background()

    logger.warning.assert_called_once()


def test_reloading_app_starts_only_one_warm_up_thread(mocker):
    # Tethys reloads app.py while registering controllers; restore the original
    # App class afterwards so other tests keep patching the class in use.
    mocker.patch.object(app, "App", app.App)
    mocker.patch.object(sys, "argv", ["/opt/conda/bin/daphne", "x.asgi:application"])
    thread = mocker.patch("threading.Thread")
    mocker.patch.object(app, "_warmup_requested", False)

    importlib.reload(app)
    importlib.reload(app)

    thread.assert_called_once()
    thread.return_value.start.assert_called_once_with()


def test_warm_when_ready_warms_once_the_registry_is_ready(mocker):
    mocker.patch("django.apps.apps.ready_event.wait", return_value=True)
    warm = mocker.patch("tethysapp.tethysdash.visualizations.warm_visualization_cache")

    app._warm_when_ready()

    warm.assert_called_once_with()


def test_warm_when_ready_skips_when_the_registry_never_becomes_ready(mocker):
    wait = mocker.patch("django.apps.apps.ready_event.wait", return_value=False)
    warm = mocker.patch("tethysapp.tethysdash.visualizations.warm_visualization_cache")
    logger = mocker.patch.object(app, "logger")

    app._warm_when_ready()

    wait.assert_called_once_with(timeout=app._WARMUP_READY_TIMEOUT)
    warm.assert_not_called()
    logger.warning.assert_called_once()


def test_warm_when_ready_logs_a_failed_warm_up(mocker):
    mocker.patch("django.apps.apps.ready_event.wait", return_value=True)
    mocker.patch(
        "tethysapp.tethysdash.visualizations.warm_visualization_cache",
        side_effect=ImportError("broken plugin"),
    )
    logger = mocker.patch.object(app, "logger")

    app._warm_when_ready()

    logger.warning.assert_called_once()
