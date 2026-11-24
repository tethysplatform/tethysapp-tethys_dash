import ast
import pytest
import json
import re
from pathlib import Path
from sqlalchemy.exc import IntegrityError
import tethysapp.tethysdash.controllers as controllers_module
from django.urls import reverse
from tethysapp.tethysdash.model import (
    Dashboard,
    DashboardPermission,
    GridItem,
    Message,
    PermissionGroup,
    PermissionGroupUser,
    TileSecret,
    VisualizationPermission,
    layer_file_name,
    store_layer_file,
)
from tethysapp.tethysdash import tile_secrets
from tethysapp.tethysdash.tile_secrets import REDACTED, SecretIdentity, decrypt
from tethysapp.tethysdash.plugin_helpers import TethysDashPlugin
from unittest.mock import MagicMock, mock_open, patch
import os
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from tethysapp.tethysdash.model import save_thumbnail, thumbnail_name
from django.conf import settings
from django.shortcuts import render
from django.test import Client, override_settings
from datetime import datetime, timedelta
import types
from tethysapp.tethysdash.exceptions import (
    DASHBOARD_CHANGED,
    DASHBOARD_NOT_FOUND,
    DATA_REQUEST_FAILED,
    INVALID_FILE_PATH,
    PAGE_OUT_OF_DATE,
    SECRET_NEEDED,
    SECRET_NOT_SET_UP,
    SECRET_RETURNED,
    SECRET_SETTING_GONE,
    SECRET_UNREADABLE,
    DashboardNotFound,
    DashboardUpdateRefused,
    LayerStorageQuotaExceeded,
    SecretChangeRefused,
    VisualizationError,
)
import uuid
from tethysapp.tethysdash.controllers import (
    VisualizationConsumer,
    _get_main_bundle_path,
    _is_blocked_image_host,
    _connected_peer_is_blocked,
    _is_blocked_address,
    _rate_limit_retry_after,
    _image_proxy_client_address,
    _redacted_url,
    UPDATE_FAILED,
)
import requests
import socket
from channels.layers import get_channel_layer
import hashlib
from urllib.parse import quote
from tethysapp.tethysdash.plugin_helpers import LayerConfigurationBuilder
from tethysapp.tethysdash.plugin_helpers import geotiff_source


# Fake plugins taking a secret, for the tests below. A result carries its
# secret's sha256 and length, never the secret. The ``site`` arg switches each
# into a path that puts the secret where it must not go: ``raise`` raises a
# VisualizationError quoting it, ``crash`` a RuntimeError, ``progress`` sends a
# progress message quoting it, and ``leak`` returns it (the raster URL-quoted in
# the URL it names). FakeSecretEarlyPlugin sends progress quoting it while it is
# constructed, before TethysDashPlugin.__init__ runs.


FAKE_SECRET_ARGS = {"api_key": "secret", "site": "text"}


def secret_proof(value):
    """What a result carries to show the plugin received ``value``."""
    return {
        "key_sha256": hashlib.sha256(value.encode("utf-8")).hexdigest(),
        "key_length": len(value),
    }


class _FakeSecret:
    """The switches both plugins share."""

    def _answer(self):
        """The fields a result carries: the site, and the secret's proof or value."""
        api_key = self.get_arg("api_key")
        site = self.get_arg("site")
        if site == "raise":
            raise VisualizationError(f"Could not sign in to {site} with {api_key}")
        if site == "crash":
            raise RuntimeError(f"Connection refused for {api_key}")
        if site == "progress":
            self.send_update(f"Signing in with {api_key}", percentage_complete=50)
        if site == "leak":
            return {"site": site, "api_key": api_key}
        return {"site": site, **secret_proof(api_key)}


class FakeSecretPlugin(_FakeSecret, TethysDashPlugin):
    """A table plugin with a secret arg."""

    name = "fake_secret"
    group = "Test"
    label = "Fake Secret"
    type = "table"
    args = FAKE_SECRET_ARGS

    def run(self):
        return {"title": "Fake Secret", "data": [self._answer()]}


class FakeSecretLayerPlugin(_FakeSecret, TethysDashPlugin):
    """A dynamic GeoJSON map layer plugin with a secret arg."""

    name = "fake_secret_layer"
    group = "Test"
    label = "Fake Secret Layer"
    type = "map_layer"
    args = FAKE_SECRET_ARGS
    dynamic_map_layer = True

    def run(self):
        # The scaffold's plugin source keeps the secret's slot, never its value.
        builder = LayerConfigurationBuilder("Fake Secret", "GeoJSON")
        builder.set_plugin_source(
            "fake_secret_layer", {"api_key": "", "site": self.get_arg("site")}
        )
        return builder.build()

    def fetch_features(self):
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": self._answer(),
                    "geometry": {"type": "Point", "coordinates": [-112.0, 40.0]},
                }
            ],
            "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        }


class FakeSecretRasterPlugin(_FakeSecret, TethysDashPlugin):
    """A dynamic GeoTIFF map layer plugin with a secret arg."""

    name = "fake_secret_raster"
    group = "Test"
    label = "Fake Secret Raster"
    type = "map_layer"
    args = FAKE_SECRET_ARGS
    dynamic_map_layer = True
    dynamic_map_layer_source = "GeoTIFF"

    def run(self):
        builder = LayerConfigurationBuilder("Fake Secret Raster", "GeoTIFF")
        builder.set_plugin_source(
            "fake_secret_raster", {"api_key": "", "site": self.get_arg("site")}
        )
        return builder.build()

    def fetch_source(self):
        answer = self._answer()
        if answer["site"] == "leak":
            token = quote(answer["api_key"], safe="")
            return geotiff_source(f"https://data.example.org/latest.tif?token={token}")
        return geotiff_source(f"https://data.example.org/{answer['key_sha256']}.tif")


class FakeSecretEarlyPlugin(FakeSecretPlugin):
    """A table plugin that sends progress quoting its secret while it is constructed,
    before ``TethysDashPlugin.__init__`` has run."""

    name = "fake_secret_early"
    label = "Fake Secret Early"

    def __init__(self, *args, **kwargs):
        self.send_update(f"Connecting with {kwargs.get('api_key')}")
        super().__init__(*args, **kwargs)


class FakeSecretIntake:
    """Stands in for the ``intake`` module with only the fake secret plugins."""

    source = types.SimpleNamespace(
        registry={
            "fake_secret": FakeSecretPlugin,
            "fake_secret_layer": FakeSecretLayerPlugin,
            "fake_secret_raster": FakeSecretRasterPlugin,
            "fake_secret_early": FakeSecretEarlyPlugin,
        }
    )
    open_fake_secret = FakeSecretPlugin
    open_fake_secret_layer = FakeSecretLayerPlugin
    open_fake_secret_raster = FakeSecretRasterPlugin
    open_fake_secret_early = FakeSecretEarlyPlugin


@pytest.mark.django_db
def test_home_not_logged_in(client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:home")
    response = client.get(url)
    assert response.status_code == 200


@pytest.mark.django_db
def test_home_logged_in(client, admin_user, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:home")
    client.force_login(admin_user)
    response = client.get(url)

    assert response.status_code == 200


def _render_app_shell(mock_app):
    """Render the real app shell template rather than the mock's stand-in.

    The app is not registered in the test database, so the context processor
    that supplies ``tethys_app`` finds none; the template is handed the fields
    it reads instead.
    """
    app = mock_app("tethysapp.tethysdash.controllers.App")
    app.render.side_effect = lambda request, template, context: render(
        request,
        f"tethysdash/{template}",
        {**context, "tethys_app": {"package": "tethysdash", "name": "TethysDash"}},
    )
    return app


def _embedded_csrf_token(response):
    return re.search(
        r'<meta name="csrf-token" content="([^"]+)"', response.content.decode()
    ).group(1)


@pytest.mark.django_db
def test_home_gives_a_signed_out_visitor_a_csrf_token(client, mock_app):
    _render_app_shell(mock_app)

    response = client.get(reverse("tethysdash:home"))

    assert response.status_code == 200
    assert response.cookies[settings.CSRF_COOKIE_NAME].value
    assert "no-store" in response["Cache-Control"]
    assert "Cookie" in [value.strip() for value in response["Vary"].split(",")]
    assert _embedded_csrf_token(response)
    assert '<meta name="csrf-cookie-name" content="csrftoken" />' in (
        response.content.decode()
    )


@pytest.mark.django_db
@override_settings(CSRF_COOKIE_NAME="portal_csrf")
def test_home_names_the_portals_csrf_cookie(client, mock_app):
    _render_app_shell(mock_app)

    response = client.get(reverse("tethysdash:home"))

    assert response.cookies["portal_csrf"].value
    assert '<meta name="csrf-cookie-name" content="portal_csrf" />' in (
        response.content.decode()
    )


@pytest.mark.django_db
@override_settings(CSRF_USE_SESSIONS=True)
def test_home_embeds_a_token_when_the_portal_sets_no_csrf_cookie(client, mock_app):
    """A portal keeping the token in the session sets no cookie the browser can
    read, so the embedded token is the one the frontend sends."""
    _render_app_shell(mock_app)

    response = client.get(reverse("tethysdash:home"))

    assert settings.CSRF_COOKIE_NAME not in response.cookies
    assert _embedded_csrf_token(response)


@pytest.mark.django_db
@override_settings(ENABLE_OPEN_PORTAL=True)
def test_signed_out_post_passes_the_csrf_check_only_with_the_shells_token(mock_app):
    """The add endpoint answers a signed-out caller with the app's refusal, so a
    200 carrying it shows the request got past Django's CSRF check."""
    _render_app_shell(mock_app)
    csrf_client = Client(enforce_csrf_checks=True)
    shell = csrf_client.get(reverse("tethysdash:home"))
    url = reverse("tethysdash:add_dashboard")
    body = json.dumps({"name": "signed-out", "gridItems": []})

    without_token = csrf_client.generic("POST", url, body)
    wrong_token = csrf_client.generic("POST", url, body, HTTP_X_CSRFTOKEN="x" * 32)

    assert without_token.status_code == 403
    assert wrong_token.status_code == 403
    for token in (
        shell.cookies[settings.CSRF_COOKIE_NAME].value,
        _embedded_csrf_token(shell),
    ):
        response = csrf_client.generic("POST", url, body, HTTP_X_CSRFTOKEN=token)
        assert response.status_code == 200
        assert response.json() == {
            "success": False,
            "message": "You must be signed in to do that.",
        }


RECORDING_FC = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"id": 1},
            "geometry": {"type": "Point", "coordinates": [-112.0, 40.0]},
        }
    ],
    "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
}

# A tile's saved args, and the same request with an arg that is not wired to a
# variable input changed: the server must never run the second for a viewer.
SAVED = {"location": "CREC1", "base_url": "https://data.example.org"}
CHANGED = {"location": "CREC1", "base_url": "https://elsewhere.example"}


@pytest.fixture
def recording_plugins(mocker):
    """Install plugins that answer with the args they were built with.

    ``recording`` is open to everyone and ``restricted_recording`` takes a
    visualization permission. Each build is recorded as ``(source, args)`` in the
    list returned, so a test can show a plugin was never constructed.
    """
    built = []

    class RecordingPlugin:
        plugin_source = "recording"
        type = "table"
        restricted = False
        dynamic_map_layer = True
        args = {"location": "text", "base_url": "text", "start": "date"}

        def __init__(self, **kwargs):
            self.kwargs = kwargs
            built.append((self.plugin_source, kwargs))

        def read(self):
            return {"ran_with": self.kwargs}

        def read_features(self, request_id=None):
            return RECORDING_FC

    class RestrictedRecordingPlugin(RecordingPlugin):
        plugin_source = "restricted_recording"
        restricted = True

    class MockIntake:
        source = types.SimpleNamespace(
            registry={
                "recording": RecordingPlugin,
                "restricted_recording": RestrictedRecordingPlugin,
            }
        )
        open_recording = RecordingPlugin
        open_restricted_recording = RestrictedRecordingPlugin

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())
    return built


def _add_tile(db_session, dashboard, source="recording", args=None):
    """Save a top-level tile on the dashboard and return its uuid."""
    tile_uuid = str(uuid.uuid4())
    db_session.add(
        GridItem(
            dashboard_id=dashboard.id,
            uuid=tile_uuid,
            i="1",
            x=0,
            y=0,
            w=1,
            h=1,
            source=source,
            args_string=json.dumps(args or {}),
            metadata_string="{}",
        )
    )
    db_session.commit()
    return tile_uuid


def _grant_group(db_session, dashboard, user, permission):
    """Give a user a dashboard permission through a group of their own."""
    group = PermissionGroup(name=str(uuid.uuid4()), description="", owner="someone")
    db_session.add(group)
    db_session.flush()
    db_session.add(
        PermissionGroupUser(
            username=user.username, group_id=group.id, permission="member"
        )
    )
    db_session.add(
        DashboardPermission(
            dashboard_id=dashboard.id, group_id=group.id, permission=permission
        )
    )
    db_session.commit()


def _post_data(client, dashboard_uuid, tile_uuid, args, source="recording", **fields):
    body = {
        "dashboard": dashboard_uuid,
        "tile": tile_uuid,
        "source": source,
        "args": args,
        "requestId": "n:g:layer-1",
        **fields,
    }
    return client.post(
        reverse("tethysdash:visualization"),
        json.dumps(body),
        content_type="application/json",
    )


def _ran_with(response):
    body = response.json()
    assert response.status_code == 200
    assert body["success"] is True, body
    return body["data"]["ran_with"]


def _data_refusal(message):
    return {"success": False, "data": {"error": message}, "viz_type": None}


@pytest.fixture
def editor_post(client, mock_app_get_ps_db, dashboard, test_owner_user):
    """POST a data request as the dashboard's owner, whose args run as sent: it
    carries every arg (``allArgs``), as the browser sends an editor's."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    client.force_login(test_owner_user)

    def post(source, args, **fields):
        fields.setdefault("allArgs", True)
        return _post_data(
            client, dashboard.uuid, str(uuid.uuid4()), args, source, **fields
        )

    return post


@pytest.mark.django_db
def test_data_failed(editor_post, mocker):
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = [Exception("Failed data retrieval")]

    response = editor_post("usace_time_series", {"location": "CREC1", "year": 2025})

    mock_gv.assert_called_once()
    assert response.status_code == 200
    assert response.json() == _data_refusal(DATA_REQUEST_FAILED)


@pytest.mark.django_db
def test_data_failed_custom_error(editor_post, mocker):
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = [VisualizationError("some custom error message")]

    response = editor_post("usace_time_series", {"location": "CREC1", "year": 2025})

    mock_gv.assert_called_once()
    assert response.status_code == 200
    assert response.json() == _data_refusal("some custom error message")


@pytest.mark.django_db
def test_data(editor_post, mocker, test_owner_user):
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    plot_data = {"data": [], "layout": {}}
    mock_gv.return_value = ["plotly", plot_data]
    args = {"location": "CREC1", "year": 2025}

    response = editor_post("usace_time_series", args, requestId="req-1")

    mock_gv.assert_called_once()
    assert mock_gv.call_args.args == (
        "usace_time_series",
        args,
        test_owner_user,
        "req-1",
    )
    assert response.status_code == 200
    assert response.json() == {"success": True, "data": plot_data, "viz_type": "plotly"}


@pytest.mark.django_db
def test_data_features_mode_passes_through_exception_message(editor_post, mocker):
    """Unit 2: mode=features must pass the plugin's exception message through
    so authors can self-diagnose. mode=scaffold (default) keeps the existing
    sanitized 'Failed to retrieve data' message."""
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = RuntimeError("raw plugin traceback details")

    # mode=features -> plugin exception message passes through
    response = editor_post("echo_runtime", {"mode": "raise"}, mode="features")
    assert response.status_code == 200
    assert response.json() == _data_refusal("raw plugin traceback details")

    # mode=scaffold (default) -> sanitized message preserved
    mock_gv.side_effect = RuntimeError("raw plugin traceback details")
    response = editor_post("echo_runtime", {})
    assert response.status_code == 200
    assert response.json() == _data_refusal(DATA_REQUEST_FAILED)


@pytest.mark.django_db
def test_data_features_mode_happy_path(editor_post, mocker):
    """mode=features success returns viz_type=features with the FC payload."""
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.return_value = ["features", RECORDING_FC]

    response = editor_post("echo_runtime", {"mode": "empty"}, mode="features")

    # Confirm the controller forwarded mode=features to get_visualization.
    mock_gv.assert_called_once()
    _, kwargs = mock_gv.call_args
    assert kwargs.get("mode") == "features"
    assert response.json() == {
        "success": True,
        "viz_type": "features",
        "data": RECORDING_FC,
    }


@pytest.fixture
def echo_runtime_raster_intake(mocker):
    """Route the real get_visualization to the GeoTIFF echo fixture."""
    from tethysapp.tethysdash.tests.fixtures.echo_runtime_raster_plugin import (
        EchoRuntimeRasterPlugin,
    )

    class MockIntake:
        source = type(
            "Source", (), {"registry": {"echo_runtime_raster": EchoRuntimeRasterPlugin}}
        )

        @staticmethod
        def open_echo_runtime_raster(**kwargs):
            return EchoRuntimeRasterPlugin(**kwargs)

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())


@pytest.mark.django_db
def test_data_features_mode_geotiff_source(editor_post, echo_runtime_raster_intake):
    """A GeoTIFF runtime fetch responds with viz_type=source and the
    validated source description, through the same mode=features request."""
    from tethysapp.tethysdash.tests.fixtures.echo_runtime_raster_plugin import (
        ECHO_RASTER_URL,
    )

    response = editor_post("echo_runtime_raster", {"mode": "styled"}, mode="features")

    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "viz_type": "source",
        "data": {
            "type": "GeoTIFF",
            "props": {
                "url": ECHO_RASTER_URL,
                "projection": "EPSG:32612",
                "mask_below": -9999,
            },
        },
    }


@pytest.mark.django_db
def test_data_features_mode_geotiff_invalid_source(
    editor_post, echo_runtime_raster_intake
):
    """A malformed GeoTIFF description fails per-layer with the validator's
    actionable message passed through, like any features-mode error."""
    response = editor_post(
        "echo_runtime_raster", {"mode": "wrong_type"}, mode="features"
    )

    body = response.json()
    assert response.status_code == 200
    assert body["success"] is False
    assert body["viz_type"] is None
    assert "type 'XYZ'" in body["data"]["error"]
    assert "dynamic_map_layer_source = 'GeoTIFF'" in body["data"]["error"]


@pytest.mark.django_db
def test_data_scaffold_mode_default(editor_post, mocker):
    """Omitting mode defaults to scaffold (backward compat)."""
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.return_value = ["plotly", {"data": []}]

    response = editor_post("some_plugin", {})

    assert response.status_code == 200
    _, kwargs = mock_gv.call_args
    assert kwargs.get("mode") == "scaffold"


@pytest.mark.django_db
def test_data_runs_a_public_dashboards_saved_tile_for_a_signed_out_caller(
    client, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, public_dashboard, args=SAVED)

    response = _post_data(client, public_dashboard.uuid, tile, CHANGED)

    assert response.json() == {
        "success": True,
        "data": {"ran_with": SAVED},
        "viz_type": "table",
    }
    assert recording_plugins == [("recording", SAVED)]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "open_portal, empty_username_row",
    [(False, False), (True, False), (False, True)],
    ids=["closed portal", "open portal", "empty-username row"],
)
def test_data_answers_an_unviewable_dashboard_like_a_missing_one(
    client,
    mock_app_get_ps_db,
    db_session,
    dashboard,
    admin_user,
    recording_plugins,
    settings,
    open_portal,
    empty_username_row,
):
    """Signed out, or signed in holding no permission, a private dashboard's tile is
    answered as a missing dashboard's is, and its plugin is never constructed. An
    open portal lets signed-out callers past Tethys's own login check, and a
    permission row stored under an empty username matches no signed-out caller."""
    settings.ENABLE_OPEN_PORTAL = open_portal
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, dashboard, args=SAVED)
    if empty_username_row:
        db_session.add(
            DashboardPermission(
                dashboard_id=dashboard.id, username="", permission="admin"
            )
        )
        db_session.commit()
    named = [dashboard.uuid, str(uuid.uuid4()), "not-a-uuid"]

    signed_out = [_post_data(client, d, tile, SAVED).json() for d in named]
    client.force_login(admin_user)
    no_permission = [_post_data(client, d, tile, SAVED).json() for d in named]

    assert signed_out == no_permission == [_data_refusal(DASHBOARD_NOT_FOUND)] * 3
    assert recording_plugins == []


@pytest.mark.django_db
def test_data_gives_a_signed_out_caller_no_edit_rights_from_an_empty_username_row(
    client, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    db_session.add(
        DashboardPermission(
            dashboard_id=public_dashboard.id, username="", permission="admin"
        )
    )
    db_session.commit()
    tile = _add_tile(db_session, public_dashboard, args=SAVED)

    assert _ran_with(_post_data(client, public_dashboard.uuid, tile, CHANGED)) == SAVED


@pytest.mark.django_db
def test_data_runs_a_viewers_request_from_the_saved_settings(
    client,
    mock_app_get_ps_db,
    db_session,
    dashboard,
    test_member_user,
    recording_plugins,
):
    """A viewer runs the saved value of every arg not wired to a variable input,
    whatever the request sends for it, and the request's value of a wired one. A
    tile resolves the viewer's relative date in the browser, so it takes the
    request's date. Keys the request adds are dropped."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(
        db_session,
        dashboard,
        args={**SAVED, "location": "${Station}", "start": "now-1D"},
    )
    client.force_login(test_member_user)  # a viewer, through a group

    ran = _ran_with(
        _post_data(
            client,
            dashboard.uuid,
            tile,
            {
                **CHANGED,
                "location": "XYZ",
                "start": "2026-11-19T00:00:00-07:00",
                "added": "x",
            },
        )
    )

    assert ran == {
        "location": "XYZ",
        "base_url": SAVED["base_url"],
        "start": "2026-11-19T00:00:00-07:00",
    }


@pytest.mark.django_db
def test_data_runs_an_editors_args_as_sent(
    client,
    mock_app_get_ps_db,
    db_session,
    dashboard,
    test_owner_user,
    test_admin_user,
    test_member_user,
    recording_plugins,
):
    """The owner, an editor, and an editor through a group run unsaved work as
    sent, on a saved tile or on one with no row yet, in a request that carries every
    arg, as the browser sends an editor's."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, dashboard, args=SAVED)
    _grant_group(db_session, dashboard, test_member_user, "editor")
    unsaved = {"location": "draft", "base_url": "https://draft.example"}

    for user in [test_owner_user, test_admin_user, test_member_user]:
        client.force_login(user)
        assert (
            _ran_with(_post_data(client, dashboard.uuid, tile, unsaved, allArgs=True))
            == unsaved
        )
        new_tile = str(uuid.uuid4())
        assert (
            _ran_with(
                _post_data(client, dashboard.uuid, new_tile, unsaved, allArgs=True)
            )
            == unsaved
        )


@pytest.mark.django_db
def test_data_runs_an_editors_request_without_all_args_from_the_saved_settings(
    client,
    mock_app_get_ps_db,
    db_session,
    dashboard,
    test_owner_user,
    recording_plugins,
):
    """Only a request that says it carries every arg runs as sent. Without
    ``allArgs`` an editor's request, as from a page loaded before they could edit,
    holds only a viewer's args, so it runs the saved settings as a viewer's does."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, dashboard, args=SAVED)
    client.force_login(test_owner_user)

    assert _ran_with(_post_data(client, dashboard.uuid, tile, CHANGED)) == SAVED
    assert (
        _post_data(client, dashboard.uuid, str(uuid.uuid4()), SAVED).json()
        == _data_refusal(DASHBOARD_CHANGED)
    )


@pytest.mark.django_db
def test_data_never_runs_a_viewers_request_as_sent_for_all_args(
    client, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, public_dashboard, args=SAVED)

    assert (
        _ran_with(
            _post_data(client, public_dashboard.uuid, tile, CHANGED, allArgs=True)
        )
        == SAVED
    )


@pytest.mark.django_db
@pytest.mark.parametrize("all_args", ["yes", 1, None])
def test_data_refuses_an_all_args_that_is_not_a_boolean(
    client,
    mock_app_get_ps_db,
    db_session,
    public_dashboard,
    recording_plugins,
    all_args,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, public_dashboard, args=SAVED)

    response = _post_data(client, public_dashboard.uuid, tile, SAVED, allArgs=all_args)

    assert response.json() == _data_refusal(DATA_REQUEST_FAILED)
    assert recording_plugins == []


@pytest.mark.django_db
def test_data_takes_the_viewer_path_once_an_editors_permission_is_removed(
    client,
    mock_app_get_ps_db,
    db_session,
    dashboard,
    test_admin_user,
    recording_plugins,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, dashboard, args=SAVED)
    client.force_login(test_admin_user)
    post = lambda: _post_data(  # noqa: E731
        client, dashboard.uuid, tile, CHANGED, allArgs=True
    )
    assert _ran_with(post()) == CHANGED

    db_session.query(DashboardPermission).filter_by(
        dashboard_id=dashboard.id, username=test_admin_user.username
    ).delete()
    db_session.commit()

    # Still a viewer through a group, so the next request runs the saved settings,
    # whatever the page loaded while they could edit still sends.
    assert _ran_with(post()) == SAVED


@pytest.mark.django_db
def test_data_tells_a_viewer_the_dashboard_changed(
    client,
    mock_app_get_ps_db,
    db_session,
    public_dashboard,
    recording_plugins,
    capsys,
):
    """A deleted tile, a tile whose saved plugin changed, and args the saved ones
    cannot have produced all answer with the reload message, never the plugin."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    changed_source = _add_tile(db_session, public_dashboard, "other_plugin", SAVED)
    template = _add_tile(
        db_session, public_dashboard, args={**SAVED, "location": "gauge-${Station}"}
    )
    requests = [
        (str(uuid.uuid4()), SAVED),
        (None, SAVED),
        (changed_source, SAVED),
        (template, {**SAVED, "location": "other-XYZ"}),
    ]

    responses = [
        _post_data(client, public_dashboard.uuid, tile, args).json()
        for tile, args in requests
    ]

    assert responses == [_data_refusal(DASHBOARD_CHANGED)] * 4
    assert recording_plugins == []
    assert (
        f"Refused a data request for tile {changed_source!r} layer '' of dashboard "
        f"{public_dashboard.uuid}: The saved plugin source is another one."
    ) in capsys.readouterr().out


@pytest.mark.django_db
def test_data_runs_a_viewers_dynamic_layer_from_its_saved_plugin_source(
    client, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    """A layer is looked up within its Map tile. Layer requests resolve no dates in
    the browser, so the saved relative date runs as saved."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    saved_args = {**SAVED, "location": "${Station}", "start": "now-1D"}
    map_tile = _add_tile(
        db_session,
        public_dashboard,
        "Map",
        {
            "layers": [
                {
                    "configuration": {
                        "props": {
                            "layerId": "layer-1",
                            "pluginSource": {"source": "recording", "args": saved_args},
                        }
                    }
                }
            ]
        },
    )
    sent = {**CHANGED, "location": "XYZ", "start": "2026-11-19T00:00:00-07:00"}

    response = _post_data(
        client, public_dashboard.uuid, map_tile, sent, mode="features", layer="layer-1"
    )

    assert response.json() == {
        "success": True,
        "data": RECORDING_FC,
        "viz_type": "features",
    }
    assert recording_plugins == [
        (
            "recording",
            {"location": "XYZ", "base_url": SAVED["base_url"], "start": "now-1D"},
        )
    ]


@pytest.mark.django_db
def test_data_runs_a_viewers_popup_tile_from_its_saved_settings(
    client, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    popup_tile = str(uuid.uuid4())
    popup = {
        "uuid": popup_tile,
        "source": "recording",
        "args_string": json.dumps(SAVED),
    }
    _add_tile(
        db_session,
        public_dashboard,
        "Map",
        {"layers": [{"popupConfig": {"gridItems": [popup]}}]},
    )

    response = _post_data(client, public_dashboard.uuid, popup_tile, CHANGED)

    assert _ran_with(response) == SAVED


@pytest.mark.django_db
def test_data_reports_a_viewers_uninstalled_plugin(
    client, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    """A saved tile whose plugin is not installed has no declared arg types, and
    fails as it always has once its saved args are built."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, public_dashboard, "uninstalled", SAVED)

    response = _post_data(client, public_dashboard.uuid, tile, SAVED, "uninstalled")

    assert response.json() == _data_refusal(
        "Visualization (uninstalled) is not installed."
    )


@pytest.mark.django_db
def test_data_keeps_the_restricted_plugin_check(
    client,
    mock_app_get_ps_db,
    db_session,
    public_dashboard,
    test_owner_user,
    recording_plugins,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, public_dashboard, "restricted_recording", SAVED)

    def post():
        return _post_data(
            client, public_dashboard.uuid, tile, SAVED, "restricted_recording"
        )

    assert post().json() == _data_refusal(
        "User does not have permission to access this visualization."
    )
    client.force_login(test_owner_user)
    assert post().json()["success"] is False
    assert recording_plugins == []

    db_session.add(
        VisualizationPermission(
            visualization="restricted_recording", username=test_owner_user.username
        )
    )
    db_session.commit()
    assert _ran_with(post()) == SAVED


@pytest.mark.django_db
def test_data_reads_chat_history_only_through_the_chats_own_dashboard(
    client,
    mock_app_get_ps_db,
    db_session,
    live_chat_dashboard,
    public_dashboard,
    test_owner_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    private_chat = live_chat_dashboard.tabs[0].grid_items[0].uuid
    public_chat = _add_tile(db_session, public_dashboard, "Live Chat")
    for chat, text in [(private_chat, "private"), (public_chat, "public")]:
        db_session.add(
            Message(
                timestamp=datetime.utcnow(),
                request_id=chat,
                session_id="some_session_id",
                message_id=f"{text}_message",
                sender="user",
                message=text,
            )
        )
    db_session.commit()

    def history(dashboard_uuid, chat):
        response = _post_data(client, dashboard_uuid, chat, {}, "Live Chat").json()
        if not response["success"]:
            return response
        assert response["viz_type"] == "Live Chat"
        return [m["message"] for m in response["data"]["chatHistory"]]

    # A private dashboard's chat named under a public dashboard has no history.
    assert history(public_dashboard.uuid, private_chat) == []
    assert history(public_dashboard.uuid, public_chat) == ["public"]
    assert history(live_chat_dashboard.uuid, private_chat) == _data_refusal(
        DASHBOARD_NOT_FOUND
    )
    client.force_login(test_owner_user)
    assert history(live_chat_dashboard.uuid, private_chat) == ["private"]


@pytest.mark.django_db
def test_data_reads_chat_history_only_from_a_top_level_live_chat_tile(
    client, mock_app_get_ps_db, db_session, live_chat_dashboard, public_dashboard
):
    """A popup tile's uuid is the editor's to choose: one repeating a private
    dashboard's chat tile, or a top-level tile that is not a chat, has no history."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    private_chat = live_chat_dashboard.tabs[0].grid_items[0].uuid
    popup = {"uuid": private_chat, "source": "Live Chat", "args_string": "{}"}
    _add_tile(
        db_session,
        public_dashboard,
        "Map",
        {"layers": [{"popupConfig": {"gridItems": [popup]}}]},
    )
    not_a_chat = _add_tile(db_session, public_dashboard, "recording", SAVED)
    for chat, text in [(private_chat, "private"), (not_a_chat, "not a chat")]:
        db_session.add(
            Message(
                timestamp=datetime.utcnow(),
                request_id=chat,
                session_id="some_session_id",
                message_id=f"{text}_message",
                sender="user",
                message=text,
            )
        )
    db_session.commit()

    responses = [
        _post_data(client, public_dashboard.uuid, tile, {}, "Live Chat").json()
        for tile in (private_chat, private_chat.upper(), not_a_chat)
    ]

    assert responses == [
        {"success": True, "data": {"chatHistory": []}, "viz_type": "Live Chat"}
    ] * 3


@pytest.mark.django_db
def test_data_takes_only_a_post(client, recording_plugins):
    response = client.get(
        reverse("tethysdash:visualization"),
        {"source": "recording", "args": json.dumps(SAVED), "requestId": "req-1"},
    )

    assert response.status_code == 405
    assert response["Allow"] == "POST"
    assert response.json() == _data_refusal(PAGE_OUT_OF_DATE)
    assert recording_plugins == []


@pytest.mark.django_db
@override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=1024 * 1024)
def test_data_answers_a_body_over_the_portals_limit_with_413(client, recording_plugins):
    response = _post_data(
        client, str(uuid.uuid4()), str(uuid.uuid4()), {"csv": "x" * 1024 * 1024}
    )

    assert response.status_code == 413
    assert response.json() == _data_refusal(
        "The values sent are too large. A request must be smaller than 1.0 MB."
    )
    assert recording_plugins == []


@pytest.mark.django_db
@pytest.mark.parametrize(
    "body",
    [
        "{not json",
        "[]",
        json.dumps({"args": {}}),
        json.dumps({"source": "recording", "args": json.dumps(SAVED)}),
        json.dumps({"source": "recording", "args": {}, "mode": "everything"}),
    ],
    ids=["not json", "not an object", "no source", "args a string", "unknown mode"],
)
def test_data_answers_a_malformed_body_with_the_generic_message(
    client, recording_plugins, body
):
    response = client.post(
        reverse("tethysdash:visualization"), body, content_type="application/json"
    )

    assert response.status_code == 200
    assert response.json() == _data_refusal(DATA_REQUEST_FAILED)
    assert recording_plugins == []


@pytest.mark.django_db
def test_data_answers_an_unexpected_failure_with_the_generic_message(
    client, mocker, capsys
):
    """Only a plugin's own failure passes its message through in features mode;
    anything else that fails answers the generic message."""
    mocker.patch(
        "tethysapp.tethysdash.controllers.prepare_run_args",
        side_effect=RuntimeError("connection to server failed"),
    )

    response = _post_data(
        client, str(uuid.uuid4()), str(uuid.uuid4()), {}, mode="features"
    )

    assert response.status_code == 200
    assert response.json() == _data_refusal(DATA_REQUEST_FAILED)
    assert "Failed to answer a data request: connection to server failed" in (
        capsys.readouterr().out
    )


@pytest.mark.django_db
def test_data_takes_a_signed_out_callers_csrf_token(
    mock_app, mock_app_get_ps_db, db_session, public_dashboard, recording_plugins
):
    _render_app_shell(mock_app)
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = _add_tile(db_session, public_dashboard, args=SAVED)
    csrf_client = Client(enforce_csrf_checks=True)
    shell = csrf_client.get(reverse("tethysdash:home"))
    url = reverse("tethysdash:visualization")
    body = json.dumps(
        {
            "dashboard": public_dashboard.uuid,
            "tile": tile,
            "source": "recording",
            "args": SAVED,
        }
    )

    without_token = csrf_client.post(url, body, content_type="application/json")
    assert without_token.status_code == 403
    assert recording_plugins == []

    response = csrf_client.post(
        url,
        body,
        content_type="application/json",
        HTTP_X_CSRFTOKEN=shell.cookies[settings.CSRF_COOKIE_NAME].value,
    )
    assert _ran_with(response) == SAVED


@pytest.mark.django_db
def test_visualizations(
    client, admin_user, mock_app, mocker, mock_plugin_visualization
):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualizations")
    client.force_login(admin_user)
    mock_gav = mocker.patch(
        "tethysapp.tethysdash.controllers.get_available_visualizations"
    )
    mock_gav_return = {"visualizations": [mock_plugin_visualization]}
    mock_gav.return_value = mock_gav_return

    response = client.get(url)

    mock_gav.assert_called_once()
    assert response.status_code == 200
    assert response.json() == mock_gav_return


@pytest.mark.django_db
def test_dashboards(
    client,
    test_owner_user,
    test_admin_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
    permission_group,
):
    mocked_app = mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mocked_app.get_custom_setting.side_effect = ["", ""]

    url = reverse("tethysdash:dashboards")
    client.force_login(test_owner_user)
    response = client.get(url)

    assert response.status_code == 200
    response_json = response.json()
    assert response_json["dashboards"][0]["description"] == dashboard.description
    assert response_json["dashboards"][0]["id"] == dashboard.id
    assert response_json["dashboards"][0]["name"] == dashboard.name
    assert response_json["dashboards"][0]["uuid"] == dashboard.uuid
    assert (
        response_json["dashboards"][0]["unrestrictedPlacement"]
        == dashboard.unrestricted_placement
    )
    assert response_json["dashboards"][0]["owner"] == dashboard.owner
    assert response_json["dashboards"][0]["publicDashboard"] == dashboard.public
    assert response_json["dashboards"][0]["userPermission"] == "admin"
    assert response_json["dashboards"][0]["permissions"] == [
        {"permission": "admin", "username": test_owner_user.username},
        {"permission": "editor", "username": test_admin_user.username},
        {"permission": "viewer", "group": permission_group["name"]},
    ]
    assert len(response_json["permission_groups"]) == 1
    assert "support_info" not in response_json


@pytest.mark.django_db
def test_dashboards_with_support_email(
    client,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mocked_app = mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mocked_app.get_custom_setting.side_effect = ["support@example.com", ""]

    url = reverse("tethysdash:dashboards")
    client.force_login(test_owner_user)
    response = client.get(url)

    assert response.status_code == 200
    response_json = response.json()
    assert response_json["support_info"] == {"support_email": "support@example.com"}


@pytest.mark.django_db
def test_dashboards_with_support_github(
    client,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mocked_app = mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mocked_app.get_custom_setting.side_effect = ["", "https://github.com/support"]

    url = reverse("tethysdash:dashboards")
    client.force_login(test_owner_user)
    response = client.get(url)

    assert response.status_code == 200
    response_json = response.json()
    assert response_json["support_info"] == {
        "support_github": "https://github.com/support"
    }


@pytest.mark.django_db
def test_dashboards_with_support_email_and_github(
    client,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mocked_app = mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mocked_app.get_custom_setting.side_effect = [
        "support@example.com",
        "https://github.com/support",
    ]

    url = reverse("tethysdash:dashboards")
    client.force_login(test_owner_user)
    response = client.get(url)

    assert response.status_code == 200
    response_json = response.json()
    assert response_json["support_info"] == {
        "support_email": "support@example.com",
        "support_github": "https://github.com/support",
    }


@pytest.mark.django_db
def test_get_dashboard(
    client,
    test_owner_user,
    test_admin_user,
    mock_app_get_ps_db,
    dashboard,
    permission_group,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:get_dashboard")
    client.force_login(test_owner_user)

    itemData = {
        "id": dashboard.id,
    }
    response = client.get(url, itemData)

    assert response.status_code == 200
    assert response.json() == {
        "dashboard": {
            "description": dashboard.description,
            "id": dashboard.id,
            "name": dashboard.name,
            "tabs": [],
            "storedSecrets": [],
            "uuid": dashboard.uuid,
            "notes": "some notes",
            "image": None,
            "unrestrictedPlacement": dashboard.unrestricted_placement,
            "autoThumbnail": True,
            "owner": dashboard.owner,
            "permissions": [
                {"permission": "admin", "username": test_owner_user.username},
                {"permission": "editor", "username": test_admin_user.username},
                {"permission": "viewer", "group": permission_group["name"]},
            ],
            "publicDashboard": dashboard.public,
            "userPermission": "admin",
        },
        "success": True,
    }


@pytest.mark.django_db
def test_get_dashboard_answers_a_private_dashboard_like_a_missing_one(
    client, admin_user, mock_app_get_ps_db, dashboard
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    url = reverse("tethysdash:get_dashboard")

    signed_out = [client.get(url, {"id": i}).json() for i in [dashboard.id, 999999]]
    client.force_login(admin_user)
    no_permission = [client.get(url, {"id": i}).json() for i in [dashboard.id, 999999]]

    expected = {"success": False, "message": DASHBOARD_NOT_FOUND}
    assert signed_out == no_permission == [expected, expected]


@pytest.mark.django_db
def test_update_and_delete_answer_an_unviewable_dashboard_like_a_missing_one(
    client, admin_user, mock_app_get_ps_db, dashboard, db_session
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    client.force_login(admin_user)
    responses = [
        client.generic("POST", reverse(f"tethysdash:{name}"), json.dumps(body)).json()
        for name in ["update_dashboard", "delete_dashboard"]
        for body in [{"id": dashboard.id, "notes": "x"}, {"id": 999999, "notes": "x"}]
    ]

    expected = {"success": False, "message": DASHBOARD_NOT_FOUND}
    assert responses == [expected] * 4
    assert db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).count() == 1


@pytest.mark.django_db
def test_get_dashboard_failed(
    client, admin_user, mock_app_get_ps_db, dashboard, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:get_dashboard")
    client.force_login(admin_user)
    mock_get_dashboards = mocker.patch(
        "tethysapp.tethysdash.controllers.get_dashboards"
    )
    mock_get_dashboards.side_effect = [Exception("failed to add")]

    itemData = {
        "id": dashboard.id,
    }
    response = client.get(url, itemData)

    mock_get_dashboards.assert_called_with(
        admin_user, id=str(itemData["id"]), dashboard_view=True
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to add"


@pytest.mark.django_db
def test_get_dashboard_failed_unknown_exception(
    client, admin_user, mock_app_get_ps_db, dashboard, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:get_dashboard")
    client.force_login(admin_user)
    mock_get_dashboards = mocker.patch(
        "tethysapp.tethysdash.controllers.get_dashboards"
    )
    mock_get_dashboards.side_effect = [Exception()]

    itemData = {
        "id": dashboard.id,
    }
    response = client.get(url, itemData)

    mock_get_dashboards.assert_called_with(
        admin_user, id=str(itemData["id"]), dashboard_view=True
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "Failed to get the dashboard. Check server for logs."
    )


@pytest.mark.django_db
def test_add_dashboard(
    client, mock_app, db_session, mocker, tmp_path, test_admin_user, mock_app_get_ps_db
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174000"
    itemData = {
        "name": "some_new_dashboard_name",
        "description": "description",
    }

    url = reverse("tethysdash:add_dashboard")
    client.force_login(test_admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]
    new_dashboard = response.json()["new_dashboard"]
    expected_result = {
        "description": "description",
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        # A new dashboard has no thumbnail until one is captured or uploaded.
        "image": None,
        "uuid": "123e4567-e89b-12d3-a456-426614174000",
        # itemData omits unrestrictedPlacement, so this pins the creation default.
        "unrestrictedPlacement": True,
        "autoThumbnail": True,
        "owner": test_admin_user.username,
        "permissions": [{"permission": "admin", "username": test_admin_user.username}],
        "publicDashboard": False,
        "userPermission": "admin",
    }
    assert response.json()["new_dashboard"] == expected_result

    added_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard["id"]).first()
    )
    assert added_dashboard is not None


@pytest.mark.django_db
def test_add_dashboard_failed(client, admin_user, mock_app, mocker, tmp_path):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174000"
    itemData = {
        "name": "dashboard_name",
        "description": "description",
    }

    url = reverse("tethysdash:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.add_new_dashboard"
    )
    mock_add_new_dashboard.side_effect = [Exception("failed to add")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        admin_user,
        "123e4567-e89b-12d3-a456-426614174000",
        itemData["name"],
        itemData["description"],
        "",
        False,
        True,
        [],
        [],
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to add"


@pytest.mark.django_db
def test_add_dashboard_failed_unknown_exception(
    client, admin_user, mock_app, mocker, tmp_path
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174000"
    itemData = {
        "name": "dashboard_name",
        "description": "description",
    }

    url = reverse("tethysdash:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.add_new_dashboard"
    )
    mock_add_new_dashboard.side_effect = [Exception()]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        admin_user,
        "123e4567-e89b-12d3-a456-426614174000",
        itemData["name"],
        itemData["description"],
        "",
        False,
        True,
        [],
        [],
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to create the dashboard named {itemData["name"]}. Check server for logs."  # noqa: E501
    )


@pytest.mark.django_db
def test_delete_dashboard(
    client,
    test_owner_user,
    mock_app,
    db_session,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    itemData = {
        "id": dashboard.id,
    }

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(test_owner_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]

    assert (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).first() is None
    )

    assert (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).first() is None
    )


@pytest.mark.django_db
def test_delete_dashboard_with_thumbnail(
    client,
    test_owner_user,
    mock_app,
    db_session,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    app_media_path = tmp_path
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
    itemData = {
        "id": dashboard.id,
    }

    thumbnail = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "files/thumbnail.png",
    )
    with open(thumbnail, "rb") as handle:
        save_thumbnail("5d1a2f3e-8b4c-4d6e-9f70-1a2b3c4d5e6f", handle.read())

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(test_owner_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]

    assert (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).first() is None
    )

    assert not default_storage.exists(
        thumbnail_name("5d1a2f3e-8b4c-4d6e-9f70-1a2b3c4d5e6f")
    )


@pytest.mark.django_db
def test_delete_dashboard_succeeds_when_the_thumbnail_delete_fails(
    client, test_owner_user, db_session, mock_app_get_ps_db, dashboard, mocker
):
    """The dashboard is already gone, so a storage error must not fail the delete."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers.delete_thumbnail",
        side_effect=OSError("storage is unreachable"),
    )

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(test_owner_user)

    response = client.generic("POST", url, json.dumps({"id": dashboard.id}))

    assert response.json() == {"success": True}
    assert (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).first() is None
    )


@pytest.mark.django_db
def test_delete_dashboard_removes_its_layer_files(
    client, test_owner_user, mock_app_get_ps_db, dashboard
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    _store(dashboard.uuid, "layer.json", "{}")

    client.force_login(test_owner_user)
    response = client.generic(
        "POST", reverse("tethysdash:delete_dashboard"), json.dumps({"id": dashboard.id})
    )

    assert response.json() == {"success": True}
    assert _stored_text(dashboard.uuid, "layer.json") is None


@pytest.mark.django_db
def test_delete_dashboard_succeeds_when_the_layer_file_delete_fails(
    client, test_owner_user, db_session, mock_app_get_ps_db, dashboard, mocker
):
    """The dashboard is already gone, so a file error must not fail the delete."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers.delete_dashboard_files",
        side_effect=OSError("storage is unreachable"),
    )

    client.force_login(test_owner_user)
    response = client.generic(
        "POST", reverse("tethysdash:delete_dashboard"), json.dumps({"id": dashboard.id})
    )

    assert response.json() == {"success": True}
    assert (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).first() is None
    )


@pytest.mark.django_db
def test_delete_dashboard_failed(client, admin_user, mock_app, mocker, tmp_path):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    itemData = {
        "id": "1",
    }

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(admin_user)
    mock_delete_named_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_named_dashboard"
    )
    mock_delete_named_dashboard.side_effect = [Exception("failed to delete")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_delete_named_dashboard.assert_called_with(admin_user, itemData["id"])
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to delete"


@pytest.mark.django_db
def test_delete_dashboard_failed_unknown_exception(
    client, admin_user, mock_app, mocker, tmp_path
):
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "id": "1",
    }

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(admin_user)
    mock_delete_named_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_named_dashboard"
    )
    mock_delete_named_dashboard.side_effect = [Exception()]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_delete_named_dashboard.assert_called_with(admin_user, itemData["id"])
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to delete the dashboard {itemData["id"]}. Check server for logs."  # noqa: E501
    )


@pytest.mark.django_db
def test_update_dashboard(
    client,
    test_owner_user,
    test_admin_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    permission_group,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    itemData = {
        "id": dashboard.id,
        "name": "new_dashboard_name",
    }

    url = reverse("tethysdash:update_dashboard")
    client.force_login(test_owner_user)

    response = client.generic("POST", url, json.dumps(itemData))
    expected_dashboard = {
        "description": dashboard.description,
        "tabs": dashboard.tabs,
        "storedSecrets": [],
        "id": dashboard.id,
        "name": "new_dashboard_name",
        "notes": dashboard.notes,
        "image": None,
        "uuid": "5d1a2f3e-8b4c-4d6e-9f70-1a2b3c4d5e6f",
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "autoThumbnail": True,
        "owner": dashboard.owner,
        "permissions": [
            {"permission": "admin", "username": test_owner_user.username},
            {"permission": "editor", "username": test_admin_user.username},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": dashboard.public,
        "userPermission": "admin",
    }

    assert response.status_code == 200
    assert response.json()["success"]
    assert response.json()["updated_dashboard"] == expected_dashboard


@pytest.mark.django_db
def test_update_dashboard_sweeps_unused_layer_files_when_its_tabs_are_saved(
    client, test_owner_user, mock_app, mock_app_get_ps_db, dashboard
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    store_layer_file(test_owner_user, dashboard.uuid, "kept.json", b"{}")
    store_layer_file(test_owner_user, dashboard.uuid, "unused.json", b"{}")
    map_item = {
        "i": "1",
        "x": 0,
        "y": 0,
        "w": 1,
        "h": 1,
        "source": "Map",
        "args_string": json.dumps(
            {
                "layers": [
                    {"configuration": {"type": "VectorLayer", "style": "kept.json"}}
                ]
            }
        ),
        "metadata_string": "{}",
        "uuid": str(uuid.uuid4()),
    }

    client.force_login(test_owner_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps(
            {"id": dashboard.id, "tabs": [{"name": "Tab 1", "gridItems": [map_item]}]}
        ),
    )

    assert response.json()["success"] is True
    assert _stored_text(dashboard.uuid, "kept.json") == "{}"
    assert _stored_text(dashboard.uuid, "unused.json") is None


@pytest.mark.django_db
def test_update_dashboard_sweeps_only_when_its_tabs_are_saved(
    client, test_owner_user, mock_app, mock_app_get_ps_db, dashboard, mocker
):
    """A rename or a thumbnail changes no references, so nothing is swept."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    sweep = mocker.patch("tethysapp.tethysdash.controllers.clean_up_dashboard_files")

    client.force_login(test_owner_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps({"id": dashboard.id, "name": "renamed"}),
    )

    assert response.json()["success"] is True
    sweep.assert_not_called()


@pytest.mark.django_db
def test_update_dashboard_succeeds_when_the_sweep_fails(
    client, test_owner_user, mock_app, mock_app_get_ps_db, dashboard, mocker
):
    """The save is committed before the sweep, so a sweep error must not fail it."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    sweep = mocker.patch(
        "tethysapp.tethysdash.controllers.clean_up_dashboard_files",
        side_effect=OSError("storage is unreachable"),
    )

    client.force_login(test_owner_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps({"id": dashboard.id, "tabs": [{"name": "Tab 1", "gridItems": []}]}),
    )

    assert response.json()["success"] is True
    sweep.assert_called_once_with(dashboard.id)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "refusal, message",
    [
        (DashboardNotFound(), DASHBOARD_NOT_FOUND),
        (
            DashboardUpdateRefused("User does not have admin permission."),
            "User does not have admin permission.",
        ),
        (SecretChangeRefused(SECRET_SETTING_GONE), SECRET_SETTING_GONE),
        (
            LayerStorageQuotaExceeded(2 * 1024 * 1024, 1024 * 1024),
            str(LayerStorageQuotaExceeded(2 * 1024 * 1024, 1024 * 1024)),
        ),
    ],
    ids=["not found", "refused", "secret change refused", "over the quota"],
)
def test_update_dashboard_failed(
    client, admin_user, mock_app, mocker, refusal, message
):
    """A refusal written for the editor is shown as it is."""
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "id": "1",
        "name": "dashboard_name",
    }

    url = reverse("tethysdash:update_dashboard")
    client.force_login(admin_user)
    mock_update_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.update_named_dashboard"
    )
    mock_update_dashboard.side_effect = [refusal]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_update_dashboard.assert_called_with(
        admin_user,
        itemData["id"],
        {"name": "dashboard_name"},
    )
    assert response.status_code == 200
    assert response.json() == {"success": False, "message": message}


@override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=1024)  # 1 KB
def test_update_dashboard_body_too_big(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")

    url = reverse("tethysdash:update_dashboard")
    client.force_login(admin_user)

    # Patch the update method to ensure it's not called
    mock_update_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.update_named_dashboard"
    )

    # Create a body that's too big (e.g., 2 KB JSON string)
    too_big_data = {"data": "x" * 2048}
    body = json.dumps(too_big_data)

    # Use .generic() to simulate raw POST with a large body
    response = client.generic(
        "POST",
        url,
        body,
        content_type="application/json",
    )

    # Assert behavior
    mock_update_dashboard.assert_not_called()
    assert response.status_code == 200  # or the expected status
    assert response.json()["success"] is False
    assert "File size too big" in response.json()["message"]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "error",
    [
        KeyError("source"),
        ValueError("dashboard uuid 'a/b' cannot name a thumbnail"),
        IntegrityError("INSERT INTO griditems", {}, Exception("duplicate key")),
        Exception("failed to update"),
        Exception(),
    ],
    ids=["KeyError", "ValueError", "database error", "Exception", "no message"],
)
def test_update_dashboard_failed_unknown_exception(
    client, admin_user, mock_app, mocker, error, capsys
):
    """Any other error's text is internal: the editor is told only that the save
    failed, and the error is logged."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers.update_named_dashboard", side_effect=[error]
    )
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps({"id": "1", "name": "dashboard_name"}),
    )

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": UPDATE_FAILED}
    assert str(error) in capsys.readouterr().out


@pytest.mark.django_db
def test_update_dashboard_shows_a_permission_refusal_but_not_a_malformed_tile(
    client,
    test_admin_user,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    no_source = {"uuid": str(uuid.uuid4()), "args_string": "{}"}

    client.force_login(test_admin_user)
    renamed = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps({"id": dashboard.id, "name": "A new name"}),
    )
    client.force_login(test_owner_user)
    malformed = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps(
            {"id": dashboard.id, "tabs": [{"name": "Tab", "gridItems": [no_source]}]}
        ),
    )

    assert renamed.json() == {
        "success": False,
        "message": "User does not have admin permission to change the name of the "
        "dashboard.",
    }
    assert malformed.json() == {"success": False, "message": UPDATE_FAILED}


@pytest.mark.django_db
def test_copy_dashboard(
    client,
    test_admin_user,
    dashboard,
    mock_app,
    db_session,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    dashboard_uuid = str(uuid.uuid4())
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = dashboard_uuid

    itemData = {
        "id": dashboard.id,
        "newName": "some_new_dashboard_name",
    }

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(test_admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]
    new_dashboard = response.json()["new_dashboard"]
    expected_result = {
        "description": dashboard.description,
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": None,
        "uuid": dashboard_uuid,
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "autoThumbnail": True,
        "owner": test_admin_user.username,
        "permissions": [{"permission": "admin", "username": test_admin_user.username}],
        "publicDashboard": False,
        "userPermission": "admin",
    }
    assert response.json()["new_dashboard"] == expected_result

    added_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard["id"]).first()
    )
    assert added_dashboard is not None


@pytest.mark.django_db
def test_copy_dashboard_copies_the_layer_files(
    client, test_admin_user, test_owner_user, dashboard, mock_app_get_ps_db, mocker
):
    """A copy's grid items name the original's GeoJSON and style files, and each
    dashboard reads them from its own directory, so the files come along."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    new_uuid = str(uuid.uuid4())
    mocker.patch("tethysapp.tethysdash.controllers.uuid").uuid4.return_value = new_uuid
    store_layer_file(test_owner_user, dashboard.uuid, "layer.json", b'{"ok": true}')

    client.force_login(test_admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:copy_dashboard"),
        json.dumps({"id": dashboard.id, "newName": "copied"}),
    )

    assert response.json()["success"] is True
    assert json.loads(_stored_text(new_uuid, "layer.json")) == {"ok": True}
    assert _stored_text(dashboard.uuid, "layer.json") is not None


@pytest.mark.django_db
def test_copy_dashboard_refused_past_the_layer_storage_limit(
    client, db_session, test_owner_user, dashboard, mock_app_get_ps_db
):
    mock_app_get_ps_db(
        "tethysapp.tethysdash.app.App"
    ).get_custom_setting.return_value = 1
    store_layer_file(test_owner_user, dashboard.uuid, "layer.json", b"x" * 600_000)
    dashboards_before = db_session.query(Dashboard).count()

    client.force_login(test_owner_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:copy_dashboard"),
        json.dumps({"id": dashboard.id, "newName": "copied"}),
    ).json()

    assert response["success"] is False
    assert response["message"].startswith("This would exceed your layer storage limit")
    assert db_session.query(Dashboard).count() == dashboards_before


@pytest.mark.django_db
def test_copy_dashboard_with_thumbnail(
    client,
    test_admin_user,
    dashboard,
    mock_app,
    db_session,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174001"

    itemData = {
        "id": dashboard.id,
        "newName": "some_new_dashboard_name",
    }

    thumbnail = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "files/thumbnail.png",
    )
    with open(thumbnail, "rb") as handle:
        thumbnail_bytes = handle.read()
    save_thumbnail("5d1a2f3e-8b4c-4d6e-9f70-1a2b3c4d5e6f", thumbnail_bytes)

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(test_admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]
    new_dashboard = response.json()["new_dashboard"]
    image_path, image_version = new_dashboard["image"].split("?v=")
    assert image_path == (
        "/media/tethysdash/app/123e4567-e89b-12d3-a456-426614174001.png"
    )
    assert image_version.isdigit()
    expected_result = {
        "description": dashboard.description,
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": new_dashboard["image"],
        "uuid": "123e4567-e89b-12d3-a456-426614174001",
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "autoThumbnail": True,
        "owner": test_admin_user.username,
        "permissions": [{"permission": "admin", "username": test_admin_user.username}],
        "publicDashboard": dashboard.public,
        "userPermission": "admin",
    }
    assert response.json()["new_dashboard"] == expected_result
    with default_storage.open(
        thumbnail_name("123e4567-e89b-12d3-a456-426614174001"), "rb"
    ) as handle:
        assert handle.read() == thumbnail_bytes
    assert default_storage.exists(
        thumbnail_name("5d1a2f3e-8b4c-4d6e-9f70-1a2b3c4d5e6f")
    )

    added_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard["id"]).first()
    )
    assert added_dashboard is not None


@pytest.mark.django_db
@pytest.mark.parametrize("helper", ["copy_thumbnail", "copy_dashboard_files"])
def test_copy_dashboard_succeeds_when_a_storage_copy_fails(
    client, test_admin_user, dashboard, db_session, mock_app_get_ps_db, mocker, helper
):
    """The copy is already committed, so a storage error must not report it failed."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch(
        f"tethysapp.tethysdash.controllers.{helper}",
        side_effect=OSError("storage is unreachable"),
    )

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(test_admin_user)

    response = client.generic(
        "POST", url, json.dumps({"id": dashboard.id, "newName": "the_copy"})
    )

    assert response.json()["success"]
    assert response.json()["new_dashboard"]["image"] is None
    assert db_session.query(Dashboard).filter(Dashboard.name == "the_copy").count() == 1


@pytest.mark.django_db
def test_copy_dashboard_refused_without_permission(
    client, admin_user, dashboard, db_session, mock_app_get_ps_db
):
    """A private dashboard the user holds no permission on cannot be copied."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(admin_user)

    response = client.generic(
        "POST", url, json.dumps({"id": dashboard.id, "newName": "the_copy"})
    )

    assert response.json() == {"success": False, "message": DASHBOARD_NOT_FOUND}
    assert db_session.query(Dashboard).filter(Dashboard.name == "the_copy").count() == 0


@pytest.mark.django_db
def test_copy_dashboard_failed(
    client,
    admin_user,
    dashboard,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174000"

    itemData = {
        "id": dashboard.id,
        "newName": "some_new_dashboard_name",
    }

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(admin_user)
    mock_copy_named_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.copy_named_dashboard"
    )
    mock_copy_named_dashboard.side_effect = [Exception("failed to update")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_copy_named_dashboard.assert_called_with(
        admin_user,
        itemData["id"],
        "some_new_dashboard_name",
        "123e4567-e89b-12d3-a456-426614174000",
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to update"


@pytest.mark.django_db
def test_copy_dashboard_failed_unknown_exception(
    client,
    admin_user,
    dashboard,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174000"

    itemData = {
        "id": dashboard.id,
        "newName": "some_new_dashboard_name",
    }

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(admin_user)
    mock_copy_named_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.copy_named_dashboard"
    )
    mock_copy_named_dashboard.side_effect = [Exception()]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_copy_named_dashboard.assert_called_with(
        admin_user,
        itemData["id"],
        "some_new_dashboard_name",
        "123e4567-e89b-12d3-a456-426614174000",
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to create the dashboard named {itemData['newName']}. Check server for logs."  # noqa: E501
    )


def _store(dashboard_uuid, filename, text):
    """Put a layer file straight into the storage, as the workspace move does."""
    default_storage.save(layer_file_name(dashboard_uuid, filename), ContentFile(text))


def _stored_text(dashboard_uuid, filename):
    """A stored layer file's text, or None when the storage holds none."""
    name = layer_file_name(dashboard_uuid, filename)
    if not default_storage.exists(name):
        return None
    with default_storage.open(name, "rb") as handle:
        return handle.read().decode()


def _stored_names():
    """Every name in the test's storage, so a refusal can be shown to store nothing."""
    root = Path(default_storage.location)
    return sorted(
        str(path.relative_to(root)) for path in root.rglob("*") if path.is_file()
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "sent_name",
    [{}, {"filename": "page.html"}, {"filename": "../../escaped.json"}],
    ids=["no_name", "html_name", "escaping_name"],
)
def test_upload_json_names_the_file_itself(
    client, test_owner_user, mock_app_get_ps_db, dashboard, sent_name
):
    """Web-served media takes a file's content type from its name, so a caller that
    could choose one could store a page on the portal's domain."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    itemData = {
        "data": json.dumps({"some": "data"}),
        "dashboard_uuid": dashboard.uuid,
        **sent_name,
    }

    client.force_login(test_owner_user)
    response = client.generic(
        "POST", reverse("tethysdash:upload_json"), json.dumps(itemData)
    ).json()

    assert response["success"] is True
    filename = response["filename"]
    assert filename == f"{uuid.UUID(filename.removesuffix('.json'))}.json"
    assert _stored_names() == [f"tethysdash/layers/{dashboard.uuid}/{filename}"]
    assert json.loads(_stored_text(dashboard.uuid, filename)) == {"some": "data"}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "error",
    [
        Exception(
            "An error occurred (AccessDenied) when calling the PutObject operation"
        ),
        Exception(),
    ],
    ids=["with_message", "without_message"],
)
def test_upload_json_failed(
    client, test_owner_user, mock_app_get_ps_db, mocker, dashboard, error
):
    """A storage backend's own message names its bucket, keys or credentials, so the
    caller gets the generic one."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers.store_layer_file", side_effect=[error]
    )
    itemData = {
        "data": json.dumps({"some": "data"}),
        "dashboard_uuid": dashboard.uuid,
    }

    client.force_login(test_owner_user)
    response = client.generic(
        "POST", reverse("tethysdash:upload_json"), json.dumps(itemData)
    )

    assert response.status_code == 200
    assert response.json() == {
        "success": False,
        "message": "Failed to upload the json. Check server for logs.",
    }


@pytest.mark.django_db
def test_upload_json_reports_the_layer_storage_limit(
    client, test_owner_user, mock_app_get_ps_db, dashboard
):
    """The limit's message reaches the user, who sees it in the layer editor."""
    mock_app_get_ps_db(
        "tethysapp.tethysdash.app.App"
    ).get_custom_setting.return_value = 1
    client.force_login(test_owner_user)

    def upload():
        return client.generic(
            "POST",
            reverse("tethysdash:upload_json"),
            json.dumps(
                {
                    "data": json.dumps({"x": "y" * 600_000}),
                    "dashboard_uuid": dashboard.uuid,
                }
            ),
        ).json()

    assert upload()["success"] is True
    stored = _stored_names()
    refused = upload()

    assert refused["success"] is False
    assert refused["message"].startswith(
        "This would exceed your layer storage limit: 0.6 MB of 1.0 MB is in use."
    )
    assert _stored_names() == stored


@pytest.mark.django_db
def test_download_json(client, test_member_user, mock_app_get_ps_db, dashboard):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    geojson = Path(__file__).resolve().parent.parent / "files/valid_geojson.geojson"
    _store(dashboard.uuid, "some_filename.json", geojson.read_text())

    client.force_login(test_member_user)
    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "some_filename.json", "dashboard_uuid": dashboard.uuid},
    )

    assert response.status_code == 200
    assert response.json()["success"]
    assert response.json()["data"] == {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:3857"}},
        "features": [
            {"type": "Feature", "geometry": {"type": "Point", "coordinates": [0, 0]}}
        ],
    }


@pytest.mark.django_db
@pytest.mark.parametrize(
    "error", [Exception("failed to load json"), Exception()], ids=["message", "bare"]
)
def test_download_json_failed(
    client, test_member_user, mock_app_get_ps_db, mocker, dashboard, error
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    _store(dashboard.uuid, "some_filename.json", "{}")
    mocker.patch("json.load", side_effect=[error])

    client.force_login(test_member_user)
    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "some_filename.json", "dashboard_uuid": dashboard.uuid},
    )

    assert response.status_code == 200
    # Every download failure reports the same message, whatever its cause.
    assert response.json() == {"success": False, "message": "Invalid file path."}


def _download(client, dashboard_uuid):
    return client.get(
        reverse("tethysdash:download_json"),
        {"filename": "layer.json", "dashboard_uuid": dashboard_uuid},
    ).json()


def _upload(client, dashboard_uuid):
    return client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {"data": json.dumps({"layer": 2}), "dashboard_uuid": dashboard_uuid}
        ),
    ).json()


@pytest.mark.django_db
def test_download_json_serves_a_public_dashboard_when_signed_out(
    client, mock_app_get_ps_db, public_dashboard
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    _store(public_dashboard.uuid, "layer.json", '{"layer": 1}')

    assert _download(client, public_dashboard.uuid) == {
        "success": True,
        "data": {"layer": 1},
    }


@pytest.mark.django_db
def test_download_json_takes_view_permission(
    client,
    mock_app_get_ps_db,
    dashboard,
    admin_user,
    test_member_user,
    capsys,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    _store(dashboard.uuid, "layer.json", '{"layer": 1}')
    refused = {"success": False, "message": INVALID_FILE_PATH}

    assert _download(client, dashboard.uuid) == refused  # signed out
    assert f"Refused a json download from dashboard {dashboard.uuid}" in (
        capsys.readouterr().out
    )
    client.force_login(admin_user)  # signed in, holding no permission
    assert _download(client, dashboard.uuid) == refused
    assert _download(client, str(uuid.uuid4())) == refused  # no such dashboard
    client.force_login(test_member_user)  # a viewer, through a group
    assert _download(client, dashboard.uuid)["success"] is True


@pytest.mark.django_db
def test_upload_json_takes_editor_permission(
    client,
    mock_app_get_ps_db,
    dashboard,
    admin_user,
    test_member_user,
    test_admin_user,
    test_owner_user,
    capsys,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    refused = {"success": False, "message": INVALID_FILE_PATH}

    for user in [admin_user, test_member_user]:  # no permission, viewer
        client.force_login(user)
        assert _upload(client, dashboard.uuid) == refused
        assert _stored_names() == []
        assert (
            f"Refused a json upload to dashboard {dashboard.uuid} for {user.username}"
            in capsys.readouterr().out
        )

    assert _upload(client, str(uuid.uuid4())) == refused
    assert _stored_names() == []

    for user in [test_admin_user, test_owner_user]:  # editor, admin
        client.force_login(user)
        response = _upload(client, dashboard.uuid)
        assert response["success"] is True
        assert json.loads(_stored_text(dashboard.uuid, response["filename"])) == {
            "layer": 2
        }


def _grant_json_access(mocker):
    """Grant the json endpoints' permission checks.

    The tests using this exercise the naming rules alone; permission has tests of its
    own. None of their requests should store anything.
    """
    mocker.patch(
        "tethysapp.tethysdash.controllers.can_view_dashboard", return_value=True
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers.can_edit_dashboard", return_value=True
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "filename",
    ["../../outside.json", "subdir/../../../outside.json", "/tethysdash/outside.json"],
    ids=["relative_traversal", "traversal_through_subdir", "absolute_path"],
)
def test_download_json_rejects_filename_escaping_dashboard_folder(
    client, admin_user, mock_app, mocker, dashboard_data, filename
):
    """A filename naming anything but one entry in the dashboard's directory is refused.

    The storage holds a file at the name each case would reach if it were joined
    unchecked -- the traversals climb out to tethysdash/, while the absolute path
    collapses into a directory nested in the dashboard's -- so the refusal comes from
    the naming rule rather than a missing file.
    """
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    default_storage.save("tethysdash/outside.json", ContentFile('{"outside": true}'))
    default_storage.save(
        f"tethysdash/layers/{dashboard_data['uuid']}/tethysdash/outside.json",
        ContentFile('{"outside": true}'),
    )

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": filename, "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
def test_download_json_rejects_traversal_in_dashboard_uuid(
    client, admin_user, mock_app, mocker
):
    """The dashboard uuid is checked as well as the filename."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    default_storage.save("tethysdash/outside.json", ContentFile('{"outside": true}'))

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "outside.json", "dashboard_uuid": ".."},
    )

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
def test_download_json_refusal_is_the_same_whether_or_not_the_file_exists(
    client, admin_user, mock_app, mocker, dashboard_data
):
    """A refused name answers the same whether or not something is stored there."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    default_storage.save("tethysdash/present.json", ContentFile('{"here": true}'))
    url = reverse("tethysdash:download_json")

    client.force_login(admin_user)
    existing = client.get(
        url,
        {"filename": "../../present.json", "dashboard_uuid": dashboard_data["uuid"]},
    )
    missing = client.get(
        url,
        {"filename": "../../absent.json", "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert existing.json() == missing.json()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "dashboard_uuid",
    ["", ".", "uuid/..", "../../", None],
)
def test_upload_json_rejects_a_dashboard_uuid_that_is_not_one(
    client, admin_user, mock_app, mocker, dashboard_uuid
):
    """Asserted on the storage as well as the message: refusal and a missing file
    report the same string by design, so only the effect distinguishes them."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)

    client.force_login(admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"some": "data"}),
                "dashboard_uuid": dashboard_uuid,
            }
        ),
    )

    assert response.json() == {"success": False, "message": "Invalid file path."}
    assert _stored_names() == []


@pytest.mark.django_db
def test_upload_json_refuses_a_uuid_nested_in_another_dashboards_directory(
    client, admin_user, mock_app, mocker, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)

    client.force_login(admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"a": 1}),
                "dashboard_uuid": f"{dashboard_data['uuid']}/sub",
            }
        ),
    )

    assert response.json() == {"success": False, "message": "Invalid file path."}
    assert _stored_names() == []


@pytest.mark.django_db
def test_download_json_accepts_dotted_filenames(
    client, test_owner_user, mock_app_get_ps_db, dashboard
):
    """The rule constrains escape, not punctuation — dots in a name are fine."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    filename = "chart.v2.data.json"
    _store(dashboard.uuid, filename, json.dumps({"round": "trip"}))

    client.force_login(test_owner_user)
    download = client.get(
        reverse("tethysdash:download_json"),
        {"filename": filename, "dashboard_uuid": dashboard.uuid},
    )
    assert download.json() == {"success": True, "data": {"round": "trip"}}


@pytest.mark.django_db
def test_download_json_refuses_a_stored_file_not_ending_in_json(
    client, test_owner_user, mock_app_get_ps_db, dashboard
):
    """Present in the dashboard's own directory, as an upload that once took the
    caller's name could have left it, and still refused."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    default_storage.save(
        f"tethysdash/layers/{dashboard.uuid}/page.html", ContentFile('{"a": 1}')
    )

    client.force_login(test_owner_user)
    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "page.html", "dashboard_uuid": dashboard.uuid},
    )

    assert response.json() == {"success": False, "message": INVALID_FILE_PATH}


@pytest.mark.django_db
def test_download_json_refuses_an_outside_file_when_signed_out(
    client, mock_app, mocker, dashboard_data
):
    """download_json takes no login, so the naming rule is exercised signed out too."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    default_storage.save("tethysdash/outside.json", ContentFile('{"outside": true}'))

    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "../../outside.json", "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "outside" not in json.dumps(response.json())


@pytest.mark.django_db
@pytest.mark.parametrize("open_portal", [False, True])
def test_download_json_serves_a_signed_out_viewer(
    client, mock_app, mocker, dashboard_data, open_portal
):
    """Public dashboards load their layer files for signed-out viewers, so this
    endpoint stays open to them and does not take require_login."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    _store(dashboard_data["uuid"], "layer.json", json.dumps({"ok": True}))

    with override_settings(ENABLE_OPEN_PORTAL=open_portal):
        response = client.get(
            reverse("tethysdash:download_json"),
            {"filename": "layer.json", "dashboard_uuid": dashboard_data["uuid"]},
        )

    assert response.json() == {"success": True, "data": {"ok": True}}


@pytest.mark.django_db
def test_download_json_refuses_a_dashboard_id_that_is_not_a_uuid(
    client, mock_app, mocker
):
    """Only a canonical uuid names a dashboard's directory, so another name never
    reaches whatever else the storage holds."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    default_storage.save(
        "tethysdash/layers/geoglows_plots_cache/cached.json",
        ContentFile('{"outside": true}'),
    )

    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "cached.json", "dashboard_uuid": "geoglows_plots_cache"},
    )

    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
def test_download_json_missing_file_answers_like_a_refused_path(
    client, admin_user, mock_app, mocker, dashboard_data
):
    """A missing file and a refused name give the same answer."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    client.force_login(admin_user)

    absent = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "not_here.json", "dashboard_uuid": dashboard_data["uuid"]},
    )
    refused = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "../escape.json", "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert absent.json() == refused.json()
    assert isinstance(absent.json()["message"], str)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "supplied_uuid",
    ["7f3d9c12-4b6e-4a91-8c2d-1e5f7a9b3c4d", "../outside", "a/b", "not-a-uuid"],
)
def test_add_dashboard_mints_its_own_uuid(
    client, db_session, test_admin_user, mock_app_get_ps_db, supplied_uuid
):
    """A uuid sent with the request is ignored; the server always picks one."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    client.force_login(test_admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:add_dashboard"),
        json.dumps({"name": "imported", "uuid": supplied_uuid, "gridItems": []}),
    )

    assert response.json()["success"] is True
    stored = db_session.query(Dashboard).filter(Dashboard.name == "imported").one()
    assert stored.uuid != supplied_uuid
    assert stored.uuid == str(uuid.UUID(stored.uuid))
    assert response.json()["new_dashboard"]["uuid"] == stored.uuid


@pytest.mark.django_db
def test_add_dashboard_cannot_claim_files_a_deleted_dashboard_left_behind(
    client, test_admin_user, mock_app, mock_app_get_ps_db
):
    mock_app("tethysapp.tethysdash.controllers.App").get_custom_setting.return_value = (
        ""
    )
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    leftover_uuid = str(uuid.uuid4())
    _store(leftover_uuid, "layer.json", "{}")

    client.force_login(test_admin_user)
    added = client.generic(
        "POST",
        reverse("tethysdash:add_dashboard"),
        json.dumps({"name": "claim", "uuid": leftover_uuid}),
    ).json()["new_dashboard"]
    client.get(reverse("tethysdash:dashboards"))
    client.generic(
        "POST", reverse("tethysdash:delete_dashboard"), json.dumps({"id": added["id"]})
    )

    assert added["uuid"] != leftover_uuid
    assert _stored_text(leftover_uuid, "layer.json") == "{}"


@pytest.mark.django_db
def test_add_dashboard_duplicate_uuid_reports_a_fixed_message(
    client, mocker, db_session, test_admin_user, mock_app_get_ps_db
):
    """Database errors are reported with a fixed message, not the driver's text."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    minted_uuid = "7f3d9c12-4b6e-4a91-8c2d-1e5f7a9b3c4d"
    mocker.patch("tethysapp.tethysdash.controllers.uuid").uuid4.return_value = (
        minted_uuid
    )
    body = json.dumps({"name": "imported", "gridItems": []})

    client.force_login(test_admin_user)
    first = client.generic("POST", reverse("tethysdash:add_dashboard"), body)
    second = client.generic("POST", reverse("tethysdash:add_dashboard"), body)

    assert first.json()["success"] is True
    assert second.json() == {
        "success": False,
        "message": "Failed to create the dashboard named imported. "
        "Check server for logs.",
    }
    assert (
        db_session.query(Dashboard).filter(Dashboard.uuid == minted_uuid).count() == 1
    )


def _login_required_controllers():
    """Map each controller declaring login_required=True to its decorator names.

    Read from the source rather than listed by hand, so an endpoint added later is
    covered without anyone remembering to add it here.
    """
    tree = ast.parse(Path(controllers_module.__file__).read_text())
    found = {}
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        decorators = node.decorator_list
        login_required = any(
            isinstance(d, ast.Call)
            and getattr(d.func, "id", None) == "controller"
            and any(
                k.arg == "login_required" and getattr(k.value, "value", None) is True
                for k in d.keywords
            )
            for d in decorators
        )
        if login_required:
            found[node.name] = [
                getattr(d, "id", None) or getattr(getattr(d, "func", None), "id", None)
                for d in decorators
            ]
    return found


# Tethys drops login_required on an open portal, so each of these also carries
# the app's own require_login gate.
LOGIN_GATED_ENDPOINTS = sorted(_login_required_controllers())


def test_every_login_required_controller_carries_require_login_beneath_it():
    controllers = _login_required_controllers()

    assert controllers
    for name, decorators in controllers.items():
        assert "require_login" in decorators, name
        assert decorators.index("require_login") > decorators.index("controller"), name


SIGNED_OUT_REFUSAL = {"success": False, "message": "You must be signed in to do that."}


def _dashboard_state(db_session):
    return (
        db_session.query(Dashboard).count(),
        db_session.query(DashboardPermission).count(),
        db_session.query(GridItem).count(),
        db_session.query(PermissionGroup).count(),
        db_session.query(PermissionGroupUser).count(),
        db_session.query(VisualizationPermission).count(),
    )


@pytest.mark.django_db
@override_settings(ENABLE_OPEN_PORTAL=True)
@pytest.mark.parametrize("url_name", LOGIN_GATED_ENDPOINTS)
def test_login_gated_endpoint_refuses_a_signed_out_caller_on_an_open_portal(
    client,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    db_session,
    mocker,
    tmp_path,
    url_name,
):
    """A 200 carrying the app's refusal, rather than Tethys's login redirect,
    shows the open-portal flag took effect and the request reached app code --
    so this cannot pass merely because the platform still enforced login."""
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    before = _dashboard_state(db_session)

    response = client.generic(
        "POST",
        reverse(f"tethysdash:{url_name}"),
        json.dumps(
            {
                "id": dashboard.id,
                "name": "signed-out",
                "gridItems": [],
                "data": "{}",
                "filename": "a.json",
                "dashboard_uuid": dashboard.uuid,
            }
        ),
    )

    assert response.status_code == 200
    assert response.json() == SIGNED_OUT_REFUSAL
    assert _dashboard_state(db_session) == before
    assert _stored_names() == []


@pytest.mark.django_db
@pytest.mark.parametrize("url_name", LOGIN_GATED_ENDPOINTS)
def test_login_gated_endpoint_still_redirects_a_signed_out_caller_by_default(
    client, url_name
):
    """On a normally configured portal the login_required=True declarations
    still send a signed-out caller to the login page."""
    response = client.generic("POST", reverse(f"tethysdash:{url_name}"), "{}")

    assert response.status_code == 302
    assert "login" in response["Location"]


@pytest.mark.django_db
@override_settings(ENABLE_OPEN_PORTAL=True)
def test_signed_out_dashboard_create_on_an_open_portal_writes_nothing(
    client, mock_app, mock_app_get_ps_db, db_session, capsys
):
    """A refused create writes no dashboard and no permission row."""
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    response = client.generic(
        "POST",
        reverse("tethysdash:add_dashboard"),
        json.dumps({"name": "signed-out", "gridItems": []}),
    )

    assert response.json() == SIGNED_OUT_REFUSAL
    # Refusals return 200 like every other failure, so they are logged.
    assert "Refused a signed-out POST request to" in capsys.readouterr().out
    assert db_session.query(Dashboard).count() == 0
    assert db_session.query(DashboardPermission).filter_by(username="").count() == 0


@pytest.mark.django_db
@override_settings(ENABLE_OPEN_PORTAL=True)
def test_signed_in_dashboard_create_on_an_open_portal_still_succeeds(
    client, mock_app, mock_app_get_ps_db, db_session, test_admin_user
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    client.force_login(test_admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:add_dashboard"),
        json.dumps({"name": "signed-in", "gridItems": []}),
    )

    assert response.json()["success"] is True
    stored = db_session.query(Dashboard).filter_by(name="signed-in").one()
    assert stored.owner == test_admin_user.username


@pytest.mark.django_db
@pytest.mark.parametrize("missing_key", ["filename", "dashboard_uuid"])
def test_download_json_missing_parameter_returns_the_failure_shape(
    client, admin_user, mock_app, mocker, dashboard_data, missing_key
):
    """A missing parameter gets the standard failure payload, not a 500."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    client.force_login(admin_user)

    params = {"filename": "a.json", "dashboard_uuid": dashboard_data["uuid"]}
    del params[missing_key]

    response = client.get(reverse("tethysdash:download_json"), params)

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."


@pytest.mark.django_db
@pytest.mark.parametrize("missing_key", ["data", "dashboard_uuid"])
def test_upload_json_missing_key_returns_the_failure_shape(
    client, admin_user, mock_app, mocker, dashboard_data, missing_key
):
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    client.force_login(admin_user)

    body = {
        "data": json.dumps({"a": 1}),
        "dashboard_uuid": dashboard_data["uuid"],
    }
    del body[missing_key]

    response = client.generic(
        "POST", reverse("tethysdash:upload_json"), json.dumps(body)
    )

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
def test_upload_json_keeps_html_in_values_valid_json(
    client, test_owner_user, mock_app_get_ps_db, dashboard
):
    """Sanitizing the serialized text left a link's href with bare quotes and an
    unclosed tag's closer after the final brace, so a GeoJSON whose properties held
    a link could not be stored at all. Each value is now cleaned on its own."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    client.force_login(test_owner_user)
    properties = {
        "link": '<a href="https://example.com">site</a>',
        "note": "<p>open",
        "<script>x</script>name": "<script>alert(1)</script>kept",
        "count": 3,
    }

    upload = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"properties": properties}),
                "dashboard_uuid": dashboard.uuid,
            }
        ),
    )
    filename = upload.json()["filename"]
    download = client.get(
        reverse("tethysdash:download_json"),
        {"filename": filename, "dashboard_uuid": dashboard.uuid},
    )

    expected = {
        "properties": {
            "link": '<a href="https://example.com" rel="noopener noreferrer">site</a>',
            "note": "<p>open</p>",
            "name": "kept",
            "count": 3,
        }
    }
    assert upload.json()["success"] is True
    assert json.loads(_stored_text(dashboard.uuid, filename)) == expected
    assert download.json() == {"success": True, "data": expected}


@pytest.mark.django_db
def test_upload_json_refuses_content_that_is_not_json(
    client, admin_user, mock_app, mocker, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": "{not json",
                "dashboard_uuid": dashboard_data["uuid"],
            }
        ),
    )

    assert response.json() == {
        "success": False,
        "message": "The uploaded content is not valid JSON.",
    }
    assert _stored_names() == []


@pytest.mark.django_db
def test_download_json_sanitizes_a_stored_file(
    client, mock_app, mocker, dashboard_data
):
    """A file can reach the storage without passing through upload -- the workspace
    move and dashboard copy store files directly -- so reads clean it too."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    _store(
        dashboard_data["uuid"],
        "layer.json",
        json.dumps({"name": "<img src=x onerror=alert(1)>"}),
    )

    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "layer.json", "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert response.json() == {"success": True, "data": {"name": '<img src="x">'}}


@pytest.mark.django_db
def test_upload_json_rejects_a_null_identifier_rather_than_writing_to_None(
    client, admin_user, mock_app, mocker
):
    """Coercing a non-string identifier would name a literal file 'None' and report
    success, turning a loud failure into a silent one."""
    mock_app("tethysapp.tethysdash.app.App")
    _grant_json_access(mocker)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"a": 1}),
                "dashboard_uuid": None,
            }
        ),
    )

    assert response.json()["success"] is False
    assert _stored_names() == []


@pytest.mark.django_db
def test_get_error_message_falls_back_for_a_non_string_argument():
    """An OSError's args[0] is its integer errno, which is not a message."""
    from tethysapp.tethysdash.controllers import _get_error_message

    assert _get_error_message(OSError(2, "No such file"), "fallback") == "fallback"
    assert _get_error_message(Exception("a real message"), "fallback") == (
        "a real message"
    )
    assert _get_error_message(Exception(), "fallback") == "fallback"
    assert (
        _get_error_message(
            IntegrityError("INSERT ...", {"uuid": "x"}, Exception("dup")), "fallback"
        )
        == "fallback"
    )


@pytest.mark.django_db
def test_ping_no_session_id(client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:ping")

    response = client.get(url)

    assert response.status_code == 200
    assert response.json()["status"] == 2
    assert response.json()["EXPIRE_AFTER"] == 0
    assert response.json()["WARN_AFTER"] == 0


@pytest.mark.django_db
def test_ping_no_session_security(client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:ping")

    client.cookies["sessionid"] = "mocked-session-id"

    response = client.get(url)

    assert response.status_code == 200
    assert response.json()["status"] == -1
    assert response.json()["EXPIRE_AFTER"] == 0
    assert response.json()["WARN_AFTER"] == 0


@pytest.mark.django_db
def test_ping_with_session_security(mocker, client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:ping")

    EXPIRE_AFTER = getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600)  # 10 minutes
    WARN_AFTER = getattr(settings, "SESSION_SECURITY_WARN_AFTER", 540)  # 9 minutes

    # Create fake modules and attributes
    fake_utils = types.SimpleNamespace(
        get_last_activity=mocker.Mock(return_value=datetime.now()),
        set_last_activity=mocker.Mock(),
    )
    fake_settings = types.SimpleNamespace(
        EXPIRE_AFTER=300, PASSIVE_URLS=["/keepalive/"], PASSIVE_URL_NAMES=["keepalive"]
    )

    # Patch sys.modules to pretend the imports work
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": fake_utils,
            "session_security.settings": fake_settings,
        },
    )

    # Create a session manually
    session = client.session
    session["_session_security"] = {
        "EXPIRE_AFTER": EXPIRE_AFTER,
        "WARN_AFTER": WARN_AFTER,
    }
    session.save()

    # Set the sessionid cookie
    client.cookies["sessionid"] = session.session_key

    itemData = {"idleFor": 5}

    response = client.get(url, itemData)

    assert response.status_code == 200
    assert response.json()["status"] == 1
    assert response.json()["EXPIRE_AFTER"] == EXPIRE_AFTER + 1
    assert response.json()["WARN_AFTER"] == WARN_AFTER + 1


@pytest.mark.django_db
def test_ping_with_session_security_and_logged_out(mocker, client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:ping")

    EXPIRE_AFTER = getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600)  # 10 minutes
    WARN_AFTER = getattr(settings, "SESSION_SECURITY_WARN_AFTER", 540)  # 9 minutes

    # Create fake modules and attributes
    fake_utils = types.SimpleNamespace(
        get_last_activity=mocker.Mock(
            return_value=datetime.now() - timedelta(seconds=EXPIRE_AFTER + 1000)
        ),
        set_last_activity=mocker.Mock(),
    )
    fake_settings = types.SimpleNamespace(
        EXPIRE_AFTER=300, PASSIVE_URLS=["/keepalive/"], PASSIVE_URL_NAMES=["keepalive"]
    )

    # Patch sys.modules to pretend the imports work
    mocker.patch.dict(
        "sys.modules",
        {
            "session_security": mocker.Mock(),
            "session_security.utils": fake_utils,
            "session_security.settings": fake_settings,
        },
    )

    # Create a session manually
    session = client.session
    session["_session_security"] = {
        "EXPIRE_AFTER": EXPIRE_AFTER,
        "WARN_AFTER": WARN_AFTER,
    }
    session.save()

    # Set the sessionid cookie
    client.cookies["sessionid"] = session.session_key

    itemData = {"idleFor": 5}

    response = client.get(url, itemData)

    assert response.status_code == 200
    assert response.json()["status"] == -2
    assert response.json()["EXPIRE_AFTER"] == 0
    assert response.json()["WARN_AFTER"] == 0


@pytest.mark.django_db
def test_ping_with_session_security_and_name_error(mocker, client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:ping")

    # Create a session manually
    session = client.session
    session["_session_security"] = {
        "EXPIRE_AFTER": getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600),
        "WARN_AFTER": getattr(settings, "SESSION_SECURITY_WARN_AFTER", 540),
    }
    session.save()

    # Set the sessionid cookie
    client.cookies["sessionid"] = session.session_key

    # 👇 Patch SessionSecurityMiddleware to raise NameError when instantiated
    mocker.patch(
        "tethysapp.tethysdash.sessions.SessionSecurityMiddleware",
        side_effect=NameError("simulated missing function"),
    )

    response = client.get(url)

    assert response.status_code == 200
    assert response.json()["status"] == -1
    assert response.json()["EXPIRE_AFTER"] == 0
    assert response.json()["WARN_AFTER"] == 0


@pytest.mark.django_db
def test_update_permission_group(
    client,
    test_admin_user,
    test_member_user,
    mock_app,
    mock_app_get_ps_db,
    permission_group,
    permission_group_table,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:update_permission_group")
    client.force_login(test_admin_user)

    new_members = [
        {
            "username": test_admin_user.username,
            "permission": "admin",
        },
        {
            "username": test_member_user.username,
            "permission": "admin",
        },
    ]
    permission_group["members"] = new_members
    permission_group["id"] = permission_group_table.id

    response = client.generic("POST", url, json.dumps(permission_group))

    assert response.status_code == 200
    assert response.json()["updated_permission_group"]["members"] == new_members


@pytest.mark.django_db
def test_create_permission_group(
    client,
    test_admin_user,
    mock_app,
    mock_app_get_ps_db,
    permission_group,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:update_permission_group")
    client.force_login(test_admin_user)

    response = client.generic("POST", url, json.dumps(permission_group))

    assert response.status_code == 200

    response_json = response.json()
    permission_group["id"] = response_json["updated_permission_group"]["id"]
    permission_group["owner"] = test_admin_user.username
    print(response_json["updated_permission_group"])
    print(permission_group)
    assert response_json == {
        "updated_permission_group": permission_group,
        "success": True,
    }


@pytest.mark.django_db
def test_create_permission_group_nonexistent_users(
    client,
    test_admin_user,
    mock_app,
    mock_app_get_ps_db,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:update_permission_group")
    client.force_login(test_admin_user)

    response = client.generic(
        "POST",
        url,
        json.dumps(
            {
                "name": "some name",
                "description": "",
                "owner": test_admin_user.username,
                "members": [
                    {
                        "username": "nonexistent_user",
                        "permission": "admin",
                    },
                    {
                        "username": test_admin_user.username,
                        "permission": "admin",
                    },
                ],
                "user_permission": "admin",
            }
        ),
    )

    assert response.status_code == 200

    response_json = response.json()
    assert response_json == {
        "success": False,
        "message": "Users don't exist: nonexistent_user",
    }


@pytest.mark.django_db
def test_create_permission_group_error(
    client, admin_user, mock_app, mock_app_get_ps_db, permission_group, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_update_permission_groups = mocker.patch(
        "tethysapp.tethysdash.controllers.update_permission_groups"
    )
    mock_update_permission_groups.return_value = {
        "status": "error",
        "message": "failed to create",
    }

    url = reverse("tethysdash:update_permission_group")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(permission_group))

    assert response.status_code == 200
    assert response.json() == {
        "message": "failed to create",
        "success": False,
    }


@pytest.mark.django_db
def test_create_permission_group_exception(
    client, admin_user, mock_app, mock_app_get_ps_db, permission_group, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_update_permission_groups = mocker.patch(
        "tethysapp.tethysdash.controllers.update_permission_groups"
    )
    mock_update_permission_groups.side_effect = Exception("failed to create")

    url = reverse("tethysdash:update_permission_group")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(permission_group))

    assert response.status_code == 200
    assert response.json() == {
        "message": "failed to create",
        "success": False,
    }


@pytest.mark.django_db
def test_create_permission_group_exception_without_message(
    client, admin_user, mock_app, mock_app_get_ps_db, permission_group, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_update_permission_groups = mocker.patch(
        "tethysapp.tethysdash.controllers.update_permission_groups"
    )
    mock_update_permission_groups.side_effect = Exception()

    url = reverse("tethysdash:update_permission_group")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(permission_group))

    assert response.status_code == 200
    assert response.json() == {
        "message": f"Failed to update the permission group {permission_group['name']}. Check server for logs.",  # noqa: E501
        "success": False,
    }


@pytest.mark.django_db
def test_delete_permission_group(
    client,
    test_admin_user,
    mock_app,
    mock_app_get_ps_db,
    permission_group_table,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    url = reverse("tethysdash:delete_permission_group")
    client.force_login(test_admin_user)

    response = client.generic(
        "POST", url, json.dumps({"id": permission_group_table.id})
    )

    assert response.status_code == 200
    assert response.json()["success"]


@pytest.mark.django_db
def test_delete_permission_group_error(
    client,
    admin_user,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    permission_group_table,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_delete_permission_groups = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_permission_groups"
    )
    mock_delete_permission_groups.return_value = {
        "status": "error",
        "message": "failed to create",
    }

    url = reverse("tethysdash:delete_permission_group")
    client.force_login(admin_user)

    response = client.generic(
        "POST", url, json.dumps({"id": permission_group_table.id})
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "failed to create",
        "success": False,
    }


@pytest.mark.django_db
def test_delete_permission_group_exception(
    client,
    admin_user,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    permission_group_table,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_delete_permission_groups = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_permission_groups"
    )
    mock_delete_permission_groups.side_effect = Exception("failed to create")

    url = reverse("tethysdash:delete_permission_group")
    client.force_login(admin_user)

    response = client.generic(
        "POST", url, json.dumps({"id": permission_group_table.id})
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": "failed to create",
        "success": False,
    }


@pytest.mark.django_db
def test_delete_permission_group_exception_without_message(
    client,
    admin_user,
    mock_app,
    mock_app_get_ps_db,
    mocker,
    permission_group_table,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_delete_permission_groups = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_permission_groups"
    )
    mock_delete_permission_groups.side_effect = Exception()

    url = reverse("tethysdash:delete_permission_group")
    client.force_login(admin_user)

    response = client.generic(
        "POST", url, json.dumps({"id": permission_group_table.id})
    )

    assert response.status_code == 200
    assert response.json() == {
        "message": f"Failed to delete the permission group {permission_group_table.id}. Check server for logs.",  # noqa: E501
        "success": False,
    }


@pytest.mark.django_db
def test_permissions(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:permissions")

    # Patch get_all_permissions at the class level
    from django.contrib.auth.models import User

    mock_get_perms = mocker.patch.object(User, "get_all_permissions")
    mock_get_perms.return_value = [
        "tethys_apps.tethysdash:manage_visualizations",
    ]

    client.force_login(admin_user)

    response = client.get(url)
    assert response.status_code == 200
    assert set(response.json()["permissions"]) == {"manage_visualizations"}


@pytest.mark.django_db
def test_visualization_permissions_has_permission(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get_visualization_permissions = mocker.patch(
        "tethysapp.tethysdash.controllers.get_visualization_permissions"
    )
    perms = {"some_plugin": {"users": ["user1"], "groups": ["group1"]}}
    mock_get_visualization_permissions.return_value = perms

    mock_has_permission = mocker.patch(
        "tethysapp.tethysdash.controllers.has_permission"
    )
    mock_has_permission.return_value = True

    mock_get_restricted_visualizations = mocker.patch(
        "tethysapp.tethysdash.controllers.get_restricted_visualizations"
    )
    mock_get_restricted_visualizations.return_value = {
        "some_plugin": {
            "users": [],
            "groups": [],
            "info": {"label": "Some Plugin", "description": "A description"},
        },
        "another_plugin": {
            "users": [],
            "groups": [],
            "info": {"label": "Another Plugin", "description": "Another description"},
        },
    }

    url = reverse("tethysdash:visualization_permissions")

    client.force_login(admin_user)

    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["visualization_permissions"] == {
        "some_plugin": {
            "users": ["user1"],
            "groups": ["group1"],
            "info": {"label": "Some Plugin", "description": "A description"},
        },
        "another_plugin": {
            "users": [],
            "groups": [],
            "info": {"label": "Another Plugin", "description": "Another description"},
        },
    }


@pytest.mark.django_db
def test_visualization_permissions_no_permission(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get_visualization_permissions = mocker.patch(
        "tethysapp.tethysdash.controllers.get_visualization_permissions"
    )

    mock_has_permission = mocker.patch(
        "tethysapp.tethysdash.controllers.has_permission"
    )
    mock_has_permission.return_value = False

    url = reverse("tethysdash:visualization_permissions")

    client.force_login(admin_user)

    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "User doesn't have permission to view visualization permissions."
    )
    mock_get_visualization_permissions.assert_not_called()


@pytest.mark.asyncio
async def test_visualization_consumer_connect_authenticated(settings):
    """Test that an authenticated user can connect and is added to the group."""

    # Patch the user to be authenticated
    class DummyUser:
        is_authenticated = True

    application = VisualizationConsumer()
    scope = {"user": DummyUser(), "type": "websocket", "path": "/ws/"}
    application.scope = scope
    application.channel_layer = get_channel_layer()
    application.channel_name = "test_channel"

    # Patch group_add and accept to track calls
    called = {}

    async def fake_group_add(group, channel):
        called["group_add"] = (group, channel)

    async def fake_accept():
        called["accept"] = True

    application.channel_layer.group_add = fake_group_add
    application.accept = fake_accept

    await application.connect()
    assert called["group_add"] == ("dashboard_updates", "test_channel")
    assert called["accept"] is True


@pytest.mark.asyncio
async def test_visualization_consumer_connect_unauthenticated():
    """Test that an unauthenticated user can connect and is added to the group.."""

    class DummyUser:
        is_authenticated = False

    application = VisualizationConsumer()
    scope = {"user": DummyUser(), "type": "websocket", "path": "/ws/"}
    application.scope = scope
    application.channel_layer = get_channel_layer()
    application.channel_name = "test_channel"

    # Patch group_add and accept to track calls
    called = {}

    async def fake_group_add(group, channel):
        called["group_add"] = (group, channel)

    async def fake_accept():
        called["accept"] = True

    application.channel_layer.group_add = fake_group_add
    application.accept = fake_accept

    await application.connect()
    assert called["group_add"] == ("dashboard_updates", "test_channel")
    assert called["accept"] is True


@pytest.mark.asyncio
async def test_visualization_consumer_disconnect():
    """Test that disconnect removes the channel from the group."""
    application = VisualizationConsumer()
    application.scope = {"user": type("User", (), {"is_authenticated": True})()}
    application.channel_layer = get_channel_layer()
    application.channel_name = "test_channel"
    called = {}

    async def fake_group_discard(group, channel):
        called["group_discard"] = (group, channel)

    application.channel_layer.group_discard = fake_group_discard
    await application.disconnect(1000)
    assert called["group_discard"] == ("dashboard_updates", "test_channel")


@pytest.mark.asyncio
async def test_visualization_consumer_send_message():
    """Test that send_message sends the correct JSON message."""
    application = VisualizationConsumer()
    application.scope = {"user": type("User", (), {"is_authenticated": True})()}
    sent = {}

    async def fake_send(text):
        sent["text"] = text

    application.send = fake_send
    message = {"foo": "bar"}
    await application.send_message({"message": message})
    assert json.loads(sent["text"]) == message


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receives_and_edit(
    mocker, mock_app_get_ps_db, db_connection, live_chat_dashboard, db_session
):
    """Test that receive does nothing (pass)."""
    mock_app_get_ps_db("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_broadcast = mocker.patch(
        "tethysapp.tethysdash.controllers.send_websocket_message"
    )
    mock_datetime = mocker.patch("tethysapp.tethysdash.controllers.datetime")
    date = datetime(2024, 1, 1, 0, 0, 0)
    mock_datetime.utcnow.return_value = date
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    application = VisualizationConsumer()

    # Should not raise
    websocket_message = {
        "requestId": grid_item_uuid,
        "message": "test",
        "sessionId": "abc",
        "messageId": "1",
        "sender": "user1",
    }
    await application.receive(text_data=json.dumps(websocket_message))
    mock_broadcast.assert_called_with(
        grid_item_uuid,
        "test",
        sender="user1",
        sessionId="abc",
        timestamp="2024-01-01T00:00:00Z",
        messageId="1",
    )

    first_message = (
        db_session.query(Message)
        .filter_by(request_id=grid_item_uuid, message_id="1")
        .first()
    )
    assert first_message is not None
    assert first_message.message == "test"
    assert first_message.edited is False
    assert first_message.sender == "user1"

    # Should not raise
    websocket_message = {
        "requestId": grid_item_uuid,
        "message": "second test",
        "sessionId": "abc",
        "messageId": "2",
        "sender": "user1",
    }
    await application.receive(text_data=json.dumps(websocket_message))
    mock_broadcast.assert_called_with(
        grid_item_uuid,
        "second test",
        sender="user1",
        sessionId="abc",
        timestamp="2024-01-01T00:00:00Z",
        messageId="2",
    )

    second_message = (
        db_session.query(Message)
        .filter_by(request_id=grid_item_uuid, message_id="2")
        .first()
    )
    assert second_message is not None
    assert second_message.message == "second test"
    assert second_message.edited is False
    assert second_message.sender == "user1"

    # Should not raise
    websocket_message = {
        "requestId": grid_item_uuid,
        "message": "an edited message",
        "sessionId": "abc",
        "messageId": "1",
        "sender": "new user1",
    }
    await application.receive(text_data=json.dumps(websocket_message))
    mock_broadcast.assert_called_with(
        grid_item_uuid,
        "an edited message",
        sender="new user1",
        sessionId="abc",
        timestamp="2024-01-01T00:00:00Z",
        messageId="1",
    )

    db_session.refresh(first_message)
    assert first_message is not None
    assert first_message.message == "an edited message"
    assert first_message.edited is True
    assert first_message.sender == "new user1"

    db_session.refresh(second_message)
    assert second_message is not None
    assert second_message.sender == "new user1"


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receive_missing_requestid(mock_app_get_ps_db):
    """Test that receive does nothing (pass)."""
    mock_app_get_ps_db("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    application = VisualizationConsumer()
    sent = []

    async def fake_send(message):
        sent.append(message)

    application.send = fake_send

    await application.receive(
        text_data=json.dumps(
            {
                "message": "test",
                "sessionId": "abc",
                "messageId": "1",
                "sender": "user1",
            }
        )
    )

    assert (
        sent[0]
        == '{"error": "Invalid message format. requestId, message, sessionId, and sender required."}'  # noqa: E501
    )


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receive_not_live_chat(mock_app_get_ps_db):
    """Test that receive does nothing (pass)."""
    mock_app_get_ps_db("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    application = VisualizationConsumer()
    sent = []

    async def fake_send(message):
        sent.append(message)

    application.send = fake_send

    await application.receive(
        text_data=json.dumps(
            {
                "requestId": "invalid_uuid",
                "message": "test",
                "sessionId": "abc",
                "messageId": "1",
                "sender": "user1",
            }
        )
    )

    assert sent[0] == '{"error": "Invalid liveChat request ID."}'


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receive_rate_limit_error(
    mock_app_get_ps_db, mocker, live_chat_dashboard, db_session
):
    """Test that receive sends rate limit error when rate limit is exceeded."""
    mock_app_get_ps_db("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    application = VisualizationConsumer()
    sent = []

    async def fake_send(message):
        sent.append(message)

    application.send = fake_send

    mock_cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    mock_cache.get.return_value = 5  # At the limit
    # 3 s into a 10 s window.
    mocker.patch("tethysapp.tethysdash.controllers.time.time", return_value=1003.0)

    await application.receive(
        text_data=json.dumps(
            {
                "requestId": grid_item_uuid,
                "message": "test",
                "sessionId": "abc",
                "messageId": "1",
                "sender": "user1",
            }
        )
    )

    expected = json.dumps(
        {
            "error": "Rate limit exceeded. Please wait 7 seconds before sending more messages.",  # noqa: E501
            "requestId": grid_item_uuid,
            "messageId": "1",
        }
    )
    assert sent[0] == expected

    new_message = (
        db_session.query(Message).filter(Message.request_id == grid_item_uuid).first()
    )
    assert new_message is None


@pytest.mark.asyncio
async def test_visualization_consumer_rate_limit_incr(
    mock_app_get_ps_db, mocker, live_chat_dashboard, db_session
):
    """
    Test that VisualizationConsumer.receive calls cache.incr(rate_key)
    when count > 0 and < 5.
    """
    # Patch cache.get and cache.incr
    mock_cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    mock_cache.get.return_value = 2  # Simulate count > 0 and < 5
    mock_cache.incr = MagicMock()

    mock_app_get_ps_db("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    application = VisualizationConsumer()
    sent = []

    async def fake_send(message):
        sent.append(message)

    application.send = fake_send

    # Patch only cache.get and cache.ttl
    mocker.patch("tethysapp.tethysdash.controllers.cache.get", return_value=2)

    await application.receive(
        text_data=json.dumps(
            {
                "requestId": grid_item_uuid,
                "message": "test",
                "sessionId": "abc",
                "messageId": "1",
                "sender": "user1",
            }
        )
    )

    # Assert cache.incr was called
    mock_cache.incr.assert_called_once()
    # Assert no rate limit error was sent
    assert not any("Rate limit exceeded" in c["error"] for c in sent)

    new_message = (
        db_session.query(Message).filter(Message.request_id == grid_item_uuid).first()
    )
    assert new_message is not None
    assert new_message.message == "test"


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receive_failed_broadcast(
    mocker, mock_app_get_ps_db, live_chat_dashboard, db_session
):
    """Test that receive does nothing (pass)."""
    mock_app_get_ps_db("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_broadcast = mocker.patch(
        "tethysapp.tethysdash.controllers.send_websocket_message"
    )
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    mock_broadcast.side_effect = Exception("broadcast failed")

    application = VisualizationConsumer()
    sent = []

    async def fake_send(message):
        sent.append(message)

    application.send = fake_send

    # Should not raise
    await application.receive(
        text_data=json.dumps(
            {
                "requestId": grid_item_uuid,
                "message": "test",
                "sessionId": "abc",
                "messageId": "1",
                "sender": "user1",
            }
        )
    )

    expected = json.dumps(
        {
            "error": "Failed to broadcast message.",
            "requestId": grid_item_uuid,
            "messageId": "1",
        }
    )
    assert sent[0] == expected

    new_message = (
        db_session.query(Message).filter(Message.request_id == grid_item_uuid).first()
    )
    assert new_message is None


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receive_failed_db_save(
    mocker, mock_app_get_ps_db, live_chat_dashboard, db_session
):
    """Test that receive does nothing (pass)."""
    mock_app = mocker.patch("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch("tethysapp.tethysdash.controllers.send_websocket_message")
    mock_app.get_persistent_store_database.side_effect = Exception(
        "database save failed"
    )
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    application = VisualizationConsumer()
    sent = []

    async def fake_send(message):
        sent.append(message)

    application.send = fake_send

    # Should not raise
    await application.receive(
        text_data=json.dumps(
            {
                "requestId": grid_item_uuid,
                "message": "test",
                "sessionId": "abc",
                "messageId": "1",
                "sender": "user1",
            }
        )
    )

    expected = json.dumps(
        {
            "error": "Failed to save message.",
            "requestId": grid_item_uuid,
            "messageId": "1",
        }
    )
    assert sent[0] == expected

    new_message = (
        db_session.query(Message).filter(Message.request_id == grid_item_uuid).first()
    )
    assert new_message is None


@pytest.mark.django_db
def test_visualization_permissions_error(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch("tethysapp.tethysdash.controllers.get_restricted_visualizations")
    mock_get_visualization_permissions = mocker.patch(
        "tethysapp.tethysdash.controllers.get_visualization_permissions"
    )
    mock_get_visualization_permissions.side_effect = [
        Exception("failed to get visualization")
    ]

    mock_has_permission = mocker.patch(
        "tethysapp.tethysdash.controllers.has_permission"
    )
    mock_has_permission.return_value = True

    url = reverse("tethysdash:visualization_permissions")

    client.force_login(admin_user)

    response = client.get(url)
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "Failed to get visualization permissions: failed to get visualization"
    )


@pytest.mark.django_db
def test_update_visualization_permissions(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch("tethysapp.tethysdash.controllers.update_viz_perms")

    mock_has_permission = mocker.patch(
        "tethysapp.tethysdash.controllers.has_permission"
    )
    mock_has_permission.return_value = True

    url = reverse("tethysdash:update_visualization_permissions")

    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps({}))
    assert response.status_code == 200
    assert response.json()["success"] is True


@pytest.mark.django_db
def test_update_visualization_permissions_no_permission(
    client, admin_user, mock_app, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch("tethysapp.tethysdash.controllers.update_viz_perms")

    mock_has_permission = mocker.patch(
        "tethysapp.tethysdash.controllers.has_permission"
    )
    mock_has_permission.return_value = False

    url = reverse("tethysdash:update_visualization_permissions")

    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps({}))
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "User does not have permission to manage visualization permissions."
    )


@pytest.mark.django_db
def test_update_visualization_permissions_error(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_update_viz_perms = mocker.patch(
        "tethysapp.tethysdash.controllers.update_viz_perms"
    )
    mock_update_viz_perms.side_effect = Exception(
        "failed to update visualization permissions"
    )

    mock_has_permission = mocker.patch(
        "tethysapp.tethysdash.controllers.has_permission"
    )
    mock_has_permission.return_value = True

    url = reverse("tethysdash:update_visualization_permissions")

    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps({}))
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "Failed to update visualization permissions: failed to update visualization permissions"  # noqa: E501
    )


def _request_with_headers(headers=None):
    request = MagicMock()
    request.headers = headers or {}
    return request


def test_get_main_bundle_path_dev_server_header():
    request = _request_with_headers({"X-Webpack-Dev-Server": "1"})
    assert _get_main_bundle_path(request) == "frontend/main.js"


def test_get_main_bundle_path_manifest_not_found():
    request = _request_with_headers()
    with patch("builtins.open", side_effect=FileNotFoundError):
        assert _get_main_bundle_path(request) == "frontend/main.js"


def test_get_main_bundle_path_manifest_invalid_json():
    request = _request_with_headers()
    with patch("builtins.open", mock_open(read_data="not json")):
        assert _get_main_bundle_path(request) == "frontend/main.js"


def test_get_main_bundle_path_returns_hashed_from_manifest():
    request = _request_with_headers()
    manifest = json.dumps({"main.js": "main.abc123.js"})
    with patch("builtins.open", mock_open(read_data=manifest)):
        assert _get_main_bundle_path(request) == "frontend/main.abc123.js"


@pytest.mark.django_db
def test_image_proxy_returns_the_image(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    upstream = mock_get.return_value
    upstream.raise_for_status.return_value = None
    upstream.is_redirect = False
    upstream.headers = {"Content-Type": "image/png; charset=binary"}
    upstream.raw.read.return_value = b"\x89PNG-bytes"

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/logo.png"}
    )

    assert response.status_code == 200
    assert response["Content-Type"] == "image/png"
    assert response.content == b"\x89PNG-bytes"

    # The body is written by whoever controls the remote host but served from
    # our origin, so it is pinned down as tightly as an image allows. An SVG can
    # carry script, and "attachment" is what stops a top-level visit rendering
    # it as this origin.
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["Content-Security-Policy"] == "default-src 'none'; sandbox"
    assert response["Content-Disposition"] == "attachment"
    # The capture is same-origin, so no CORS header is needed - and a wildcard
    # is refused alongside credentialed requests anyway.
    assert not response.has_header("Access-Control-Allow-Origin")


@pytest.fixture
def proxy_view_allowed(mocker):
    """The caller may view the dashboard the proxy request names."""
    return mocker.patch(
        "tethysapp.tethysdash.controllers.can_view_dashboard", return_value=True
    )


@pytest.fixture
def clear_cache():
    from django.core.cache import cache

    cache.clear()
    yield cache
    cache.clear()


def _permit_any_image_host(mocker):
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    upstream = mock_get.return_value
    upstream.raise_for_status.return_value = None
    upstream.is_redirect = False
    upstream.headers = {"Content-Type": "image/png"}
    upstream.raw.read.return_value = b"\x89PNG-bytes"
    return mock_get


@pytest.mark.django_db
def test_image_proxy_serves_an_anonymous_viewer_of_a_public_dashboard(
    client, mock_app, mock_app_get_ps_db, public_dashboard, clear_cache, mocker
):
    """Anyone who can view a dashboard can export it, logged in or not."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    _permit_any_image_host(mocker)

    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "https://example.com/logo.png", "dashboard": public_dashboard.uuid},
    )

    assert response.status_code == 200
    assert response.content == b"\x89PNG-bytes"


@pytest.mark.django_db
def test_image_proxy_checks_the_named_dashboard(
    client, admin_user, mock_app, clear_cache, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    _permit_any_image_host(mocker)
    can_view = mocker.patch(
        "tethysapp.tethysdash.controllers.can_view_dashboard", return_value=True
    )
    client.force_login(admin_user)

    dashboard_uuid = str(uuid.uuid4())
    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "https://example.com/logo.png", "dashboard": dashboard_uuid},
    )

    assert response.status_code == 200
    viewer, named = can_view.call_args.args
    assert viewer.username == admin_user.username
    assert named == dashboard_uuid


@pytest.mark.django_db
@pytest.mark.parametrize(
    "params",
    [
        {},
        {"dashboard": ""},
        {"dashboard": "not-a-uuid"},
        {"dashboard": "00000000-0000-0000-0000-000000000000"},
    ],
)
def test_image_proxy_refuses_a_dashboard_the_caller_cannot_view(
    client, mock_app, mock_app_get_ps_db, clear_cache, mocker, params
):
    """Missing, malformed, unknown and private all get the same answer, so the
    proxy cannot be used to learn which dashboards exist."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get = _permit_any_image_host(mocker)

    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "https://example.com/logo.png", **params},
    )

    assert response.status_code == 403
    assert response.content == b"Not permitted"
    mock_get.assert_not_called()


@pytest.mark.django_db
def test_image_proxy_refuses_an_anonymous_caller_on_a_private_dashboard(
    client, mock_app, mock_app_get_ps_db, dashboard, db_session, clear_cache, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get = _permit_any_image_host(mocker)
    dashboard.uuid = str(uuid.uuid4())
    db_session.commit()

    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "https://example.com/logo.png", "dashboard": dashboard.uuid},
    )

    assert response.status_code == 403
    assert response.content == b"Not permitted"
    mock_get.assert_not_called()


@pytest.mark.django_db
def test_image_proxy_throttles_anonymous_callers(
    client, mock_app, proxy_view_allowed, clear_cache, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    _permit_any_image_host(mocker)
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_ANONYMOUS_LIMIT", 2)
    params = {"url": "https://example.com/logo.png", "dashboard": "any"}
    # As the Tethys nginx and Apache templates send it: the proxy appends the
    # address that connected.
    headers = {"HTTP_X_FORWARDED_FOR": "203.0.113.7"}

    for _ in range(2):
        assert (
            client.get(reverse("tethysdash:image_proxy"), params, **headers).status_code
            == 200
        )
    throttled = client.get(reverse("tethysdash:image_proxy"), params, **headers)

    assert throttled.status_code == 429
    assert int(throttled["Retry-After"]) > 0

    # Another address has its own window.
    other = client.get(
        reverse("tethysdash:image_proxy"), params, HTTP_X_FORWARDED_FOR="203.0.113.8"
    )
    assert other.status_code == 200

    # A new window serves the caller again.
    clear_cache.clear()
    assert (
        client.get(reverse("tethysdash:image_proxy"), params, **headers).status_code
        == 200
    )


@pytest.mark.django_db
def test_image_proxy_throttle_ignores_addresses_the_client_chooses(
    client, mock_app, proxy_view_allowed, clear_cache, mocker
):
    """Everything before the proxy's own entry is the client's to choose, and so is
    X-Real-IP where the fronting proxy does not overwrite it. Rotating them must
    not reset the count."""
    mock_app("tethysapp.tethysdash.controllers.App")
    _permit_any_image_host(mocker)
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_ANONYMOUS_LIMIT", 1)
    params = {"url": "https://example.com/logo.png", "dashboard": "any"}

    first = client.get(
        reverse("tethysdash:image_proxy"),
        params,
        HTTP_X_REAL_IP="198.51.100.1",
        HTTP_X_FORWARDED_FOR="198.51.100.1, 203.0.113.7",
    )
    second = client.get(
        reverse("tethysdash:image_proxy"),
        params,
        HTTP_X_REAL_IP="198.51.100.2",
        HTTP_X_FORWARDED_FOR="198.51.100.2,203.0.113.7",
    )

    assert first.status_code == 200
    assert second.status_code == 429


@pytest.mark.django_db
def test_image_proxy_throttles_by_remote_addr_without_a_proxy(
    client, mock_app, proxy_view_allowed, clear_cache, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    _permit_any_image_host(mocker)
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_ANONYMOUS_LIMIT", 1)
    params = {"url": "https://example.com/logo.png", "dashboard": "any"}

    assert client.get(reverse("tethysdash:image_proxy"), params).status_code == 200
    assert client.get(reverse("tethysdash:image_proxy"), params).status_code == 429


@pytest.mark.django_db
def test_image_proxy_throttles_logged_in_callers_per_account_with_more_room(
    client, admin_user, mock_app, proxy_view_allowed, clear_cache, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    _permit_any_image_host(mocker)
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_ANONYMOUS_LIMIT", 1)
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_AUTHENTICATED_LIMIT", 2)
    client.force_login(admin_user)
    params = {"url": "https://example.com/logo.png", "dashboard": "any"}
    # The account is counted, not the address: changing it does not help.
    addresses = ["203.0.113.7", "203.0.113.8", "203.0.113.9"]

    statuses = [
        client.get(
            reverse("tethysdash:image_proxy"), params, HTTP_X_FORWARDED_FOR=address
        ).status_code
        for address in addresses
    ]

    assert statuses == [200, 200, 429]


@pytest.mark.django_db
def test_image_proxy_throttles_ipv6_callers_per_64(
    client, mock_app, proxy_view_allowed, clear_cache, mocker
):
    """One home or server holds a whole /64; rotating within it must not reset
    the count, while a neighbouring /64 is someone else."""
    mock_app("tethysapp.tethysdash.controllers.App")
    _permit_any_image_host(mocker)
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_ANONYMOUS_LIMIT", 1)
    params = {"url": "https://example.com/logo.png", "dashboard": "any"}

    def get(address):
        return client.get(
            reverse("tethysdash:image_proxy"), params, HTTP_X_FORWARDED_FOR=address
        ).status_code

    assert get("2001:db8:1:1::1") == 200
    assert get("2001:db8:1:1:ffff::2") == 429
    assert get("2001:db8:1:2::1") == 200


@pytest.mark.django_db
def test_image_proxy_blocks_internal_hosts_for_anonymous_callers(
    client, mock_app, proxy_view_allowed, clear_cache, mocker
):
    """Opening the proxy to viewers leaves the SSRF guard in front of them."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")

    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "http://169.254.169.254/latest/meta-data/", "dashboard": "any"},
    )

    assert response.status_code == 403
    mock_get.assert_not_called()


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://example.com/logo.png",
        "not-a-url",
        "",
    ],
)
def test_image_proxy_rejects_non_http_urls(
    proxy_view_allowed, client, admin_user, mock_app, url
):
    mock_app("tethysapp.tethysdash.controllers.App")
    client.force_login(admin_user)
    response = client.get(reverse("tethysdash:image_proxy"), {"url": url})
    assert response.status_code == 400


@pytest.mark.django_db
def test_image_proxy_blocks_internal_hosts(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """Without this the endpoint is a server-side request forgery primitive."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    client.force_login(admin_user)

    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "http://169.254.169.254/latest/meta-data/"},
    )

    assert response.status_code == 403
    # Blocked before any request leaves the server.
    mock_get.assert_not_called()


@pytest.mark.django_db
def test_image_proxy_reports_an_unreachable_host(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers.requests.get",
        side_effect=requests.exceptions.ConnectionError("boom"),
    )

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/logo.png"}
    )
    assert response.status_code == 502


@pytest.mark.django_db
def test_image_proxy_refuses_a_non_image(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """An error page answering 200 must not be passed off as an image."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    mock_get.return_value.raise_for_status.return_value = None
    mock_get.return_value.is_redirect = False
    mock_get.return_value.headers = {"Content-Type": "text/html"}

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/oops"}
    )
    assert response.status_code == 415


@pytest.mark.django_db
def test_image_proxy_rejects_an_oversized_image(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """Size is capped by reading, not by trusting Content-Length."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    mocker.patch("tethysapp.tethysdash.controllers.IMAGE_PROXY_MAX_BYTES", 10)
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    upstream = mock_get.return_value
    upstream.raise_for_status.return_value = None
    upstream.is_redirect = False
    upstream.headers = {"Content-Type": "image/png"}
    upstream.raw.read.return_value = b"x" * 11

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/huge.png"}
    )
    assert response.status_code == 413


def test_is_blocked_image_host_allows_a_public_address(mocker):
    mocker.patch(
        "tethysapp.tethysdash.controllers.socket.getaddrinfo",
        return_value=[(None, None, None, None, ("93.184.216.34", 0))],
    )
    assert _is_blocked_image_host("example.com") is False


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.5",
        "192.168.1.10",
        "169.254.169.254",
        "0.0.0.0",
        # Shared address space: Alibaba Cloud's instance metadata.
        "100.100.100.200",
        # A private address written as IPv6.
        "::ffff:10.0.0.1",
    ],
)
def test_is_blocked_image_host_blocks_internal_addresses(mocker, address):
    mocker.patch(
        "tethysapp.tethysdash.controllers.socket.getaddrinfo",
        return_value=[(None, None, None, None, (address, 0))],
    )
    assert _is_blocked_image_host(address) is True


def test_is_blocked_image_host_blocks_a_name_that_will_not_resolve(mocker):
    """Fail closed: an unresolvable name is refused rather than attempted."""
    mocker.patch(
        "tethysapp.tethysdash.controllers.socket.getaddrinfo",
        side_effect=socket.gaierror("nope"),
    )
    assert _is_blocked_image_host("nowhere.invalid") is True


def _redirect_to(location):
    """An upstream response that redirects, as requests would report it."""
    hop = MagicMock()
    hop.is_redirect = True
    hop.headers = {"Location": location}
    return hop


@pytest.mark.django_db
def test_image_proxy_rechecks_the_host_on_every_redirect(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """A permitted public URL must not be able to bounce us onto an internal one.

    Following redirects automatically is a complete bypass of the address
    checks: only the first URL is ever inspected, so a public host answering
    with a Location of 127.0.0.1 gets the server to fetch it anyway.
    """
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host",
        side_effect=lambda host: host != "public.example.com",
    )
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    mock_get.return_value = _redirect_to("http://169.254.169.254/latest/meta-data/")

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"),
        {"url": "https://public.example.com/innocent.png"},
    )

    assert response.status_code == 403
    # The internal address was never requested, only the permitted first hop.
    assert mock_get.call_count == 1


@pytest.mark.django_db
def test_image_proxy_follows_a_redirect_to_a_permitted_host(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """Image CDNs redirect routinely, so permitted hops must still be followed."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    final = MagicMock()
    final.is_redirect = False
    final.raise_for_status.return_value = None
    final.headers = {"Content-Type": "image/png"}
    final.raw.read.return_value = b"\x89PNG"
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    mock_get.side_effect = [_redirect_to("https://cdn.example.com/real.png"), final]

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/start.png"}
    )

    assert response.status_code == 200
    assert response.content == b"\x89PNG"


@pytest.mark.django_db
def test_image_proxy_gives_up_on_a_redirect_loop(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mock_get = mocker.patch("tethysapp.tethysdash.controllers.requests.get")
    mock_get.return_value = _redirect_to("https://example.com/round-again.png")

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/start.png"}
    )

    assert response.status_code == 502
    assert mock_get.call_count == 4  # the first request plus MAX_REDIRECTS hops


@pytest.mark.django_db
def test_image_proxy_blocks_a_peer_that_resolved_somewhere_else(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """Guards against DNS rebinding: the socket, not a second lookup, decides.

    The hostname check resolves the name, and requests resolves it again when
    it connects. A hostile DNS server is free to answer those two differently.
    """
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked", return_value=True
    )
    upstream = MagicMock()
    upstream.is_redirect = False
    mocker.patch("tethysapp.tethysdash.controllers.requests.get", return_value=upstream)

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://rebind.example.com/x.png"}
    )

    assert response.status_code == 403
    # Refused before any of the body was read.
    upstream.raw.read.assert_not_called()


@pytest.mark.parametrize(
    "peer,expected",
    [("93.184.216.34", False), ("127.0.0.1", True), ("169.254.169.254", True)],
)
def test_connected_peer_is_blocked_reads_the_socket(peer, expected):
    response = MagicMock()
    response.raw._connection.sock.getpeername.return_value = (peer, 443)
    assert _connected_peer_is_blocked(response) is expected


def test_connected_peer_is_blocked_fails_closed():
    """An unverifiable connection is refused rather than trusted.

    urllib3 releases the connection once a body is read, so this can genuinely
    happen; losing one image from a thumbnail is the right price.
    """
    response = MagicMock()
    response.raw._connection = None
    assert _connected_peer_is_blocked(response) is True


def test_is_blocked_address_rejects_something_that_is_not_an_address():
    """Fail closed on anything unparseable rather than letting it through."""
    assert _is_blocked_address("not-an-address") is True


@pytest.mark.django_db
def test_image_proxy_handles_a_redirect_with_no_location(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    hop = MagicMock()
    hop.is_redirect = True
    hop.headers = {}
    mocker.patch("tethysapp.tethysdash.controllers.requests.get", return_value=hop)

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/x.png"}
    )
    assert response.status_code == 502


@pytest.mark.django_db
def test_image_proxy_reports_an_upstream_error_status(
    proxy_view_allowed, client, admin_user, mock_app, mocker
):
    """A 404 from the far end is an upstream failure, not a broken thumbnail."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    upstream = MagicMock()
    upstream.is_redirect = False
    upstream.raise_for_status.side_effect = requests.exceptions.HTTPError("404")
    mocker.patch("tethysapp.tethysdash.controllers.requests.get", return_value=upstream)

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:image_proxy"), {"url": "https://example.com/missing.png"}
    )
    assert response.status_code == 502


def test_rate_limit_counts_up_to_the_limit_then_reports_the_wait(mocker):
    cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    cache.get.side_effect = [0, 1, 2]
    # 2.5 s into the window that started at 1000 s.
    mocker.patch("tethysapp.tethysdash.controllers.time.time", return_value=1002.5)

    assert _rate_limit_retry_after("k", limit=2, window=10) is None
    cache.set.assert_called_once_with("k:100", 1, timeout=10)
    assert _rate_limit_retry_after("k", limit=2, window=10) is None
    cache.incr.assert_called_once_with("k:100")
    # Rounded up, so a caller who waits that long is served.
    assert _rate_limit_retry_after("k", limit=2, window=10) == 8


def test_rate_limit_ends_a_window_on_time_whatever_the_cache_does(mocker):
    """The file and database caches restart a key's lifetime on every increment,
    so a window measured by the key's lifetime would never end under steady
    traffic. The next window is a different key."""
    cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    clock = mocker.patch("tethysapp.tethysdash.controllers.time.time")

    clock.return_value = 1009.9
    cache.get.return_value = 5
    assert _rate_limit_retry_after("k", limit=5, window=10) == 1

    clock.return_value = 1010.0
    cache.get.side_effect = lambda key, default: 5 if key == "k:100" else default
    assert _rate_limit_retry_after("k", limit=5, window=10) is None
    cache.set.assert_called_once_with("k:101", 1, timeout=10)


def test_rate_limit_restarts_a_window_evicted_mid_count(mocker):
    """The key can be evicted between the read and the increment."""
    cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    cache.get.return_value = 1
    cache.incr.side_effect = ValueError("Key 'k' not found")
    mocker.patch("tethysapp.tethysdash.controllers.time.time", return_value=1000.0)

    assert _rate_limit_retry_after("k", limit=5, window=10) is None
    cache.set.assert_called_once_with("k:100", 1, timeout=10)


@pytest.mark.parametrize(
    "address, blocked",
    [
        # NAT64 well-known prefix carrying 10.0.0.1, 169.254.169.254, 127.0.0.1.
        ("64:ff9b::a00:1", True),
        ("64:ff9b::a9fe:a9fe", True),
        ("64:ff9b::7f00:1", True),
        # ...and carrying a public address, 93.184.216.34.
        ("64:ff9b::5db8:d822", False),
        # 6to4 and Teredo, refused as not global.
        ("2002:a00:1::", True),
        ("2001:0:4136:e378:8000:63bf:3fff:fdd2", True),
    ],
)
def test_is_blocked_address_judges_ipv4_carried_in_ipv6(address, blocked):
    assert _is_blocked_address(address) is blocked


@pytest.mark.django_db
def test_image_proxy_logs_failures_without_the_query_string(
    proxy_view_allowed, client, admin_user, mock_app, mocker, capsys
):
    """Image URLs carry access tokens; the log line must not."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers._is_blocked_image_host", return_value=False
    )
    mocker.patch(
        "tethysapp.tethysdash.controllers._connected_peer_is_blocked",
        return_value=False,
    )
    url = "https://user:pw@maps.example.com:8443/arcgis/export?token=SECRET"
    client.force_login(admin_user)

    upstream = MagicMock()
    upstream.is_redirect = False
    upstream.status_code = 401
    upstream.raise_for_status.side_effect = requests.exceptions.HTTPError(
        f"401 Client Error for url: {url}"
    )
    mocker.patch("tethysapp.tethysdash.controllers.requests.get", return_value=upstream)
    client.get(reverse("tethysdash:image_proxy"), {"url": url})

    mocker.patch(
        "tethysapp.tethysdash.controllers.requests.get",
        side_effect=requests.exceptions.ConnectionError(f"Max retries: {url}"),
    )
    client.get(reverse("tethysdash:image_proxy"), {"url": url})

    logged = capsys.readouterr().out
    assert "SECRET" not in logged and "pw" not in logged
    assert (
        "Image proxy failed to fetch https://maps.example.com:8443/arcgis/export: "
        "HTTP 401"
    ) in logged
    assert (
        "Image proxy failed to fetch https://maps.example.com:8443/arcgis/export: "
        "ConnectionError"
    ) in logged


@pytest.mark.parametrize(
    "forwarded, remote, expected",
    [
        ("198.51.100.1, 203.0.113.7", "", "203.0.113.7"),
        ("", "203.0.113.7", "203.0.113.7"),
        ("2001:db8:1:1::abcd", "", "2001:db8:1:1::/64"),
        # An IPv4 address written as IPv6 is counted as that IPv4 address.
        ("::ffff:203.0.113.7", "", "203.0.113.7"),
        # Not an address at all: counted as given, never an error.
        ("unknown", "", "unknown"),
    ],
)
def test_image_proxy_client_address(forwarded, remote, expected):
    request = MagicMock()
    request.META = {"HTTP_X_FORWARDED_FOR": forwarded, "REMOTE_ADDR": remote}
    assert _image_proxy_client_address(request) == expected


@pytest.mark.parametrize(
    "url, expected",
    [
        ("https://a.example.com/x.png?token=s", "https://a.example.com/x.png"),
        ("http://u:p@a.example.com:81/x#frag", "http://a.example.com:81/x"),
    ],
)
def test_redacted_url(url, expected):
    assert _redacted_url(url) == expected


@pytest.mark.django_db
def test_a_signed_out_visitor_can_open_a_public_dashboard_end_to_end(
    client,
    mock_app,
    mock_app_get_ps_db,
    live_chat_dashboard,
    dashboard,
    db_session,
    mocker,
    tmp_path,
):
    """List, open, read a layer file, and load a widget's data, all signed out."""
    mock_app("tethysapp.tethysdash.controllers.App").get_custom_setting.return_value = (
        ""
    )
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    live_chat_dashboard.public = True
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid
    db_session.add(
        Message(
            timestamp=datetime.utcnow(),
            request_id=grid_item_uuid,
            session_id="session",
            message_id="message",
            sender="someone",
            message="hello",
        )
    )
    db_session.commit()
    _store(live_chat_dashboard.uuid, "layer.json", '{"layer": 1}')

    listed = client.get(reverse("tethysdash:dashboards")).json()["dashboards"]
    assert [d["uuid"] for d in listed] == [live_chat_dashboard.uuid]  # not private

    opened = client.get(
        reverse("tethysdash:get_dashboard"), {"id": live_chat_dashboard.id}
    ).json()
    assert opened["success"] is True
    assert opened["dashboard"]["tabs"][0]["gridItems"][0]["uuid"] == grid_item_uuid

    assert _download(client, live_chat_dashboard.uuid) == {
        "success": True,
        "data": {"layer": 1},
    }

    widget = _post_data(
        client, live_chat_dashboard.uuid, grid_item_uuid, {}, "Live Chat"
    ).json()
    assert widget["success"] is True
    assert [m["message"] for m in widget["data"]["chatHistory"]] == ["hello"]


@pytest.mark.django_db
def test_an_import_saves_its_tabs_into_the_dashboard_it_created(
    client, mock_app_get_ps_db, db_session, test_admin_user
):
    """The sequence dashboard import uses: create empty, then save tabs into it."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    client.force_login(test_admin_user)
    created = client.generic(
        "POST", reverse("tethysdash:add_dashboard"), json.dumps({"name": "imported"})
    ).json()["new_dashboard"]
    item = {
        "i": "1",
        "x": 0,
        "y": 0,
        "w": 10,
        "h": 10,
        "source": "Text",
        "args_string": json.dumps({"text": "hi"}),
        "metadata_string": json.dumps({}),
    }

    saved = client.generic(
        "POST",
        reverse("tethysdash:update_dashboard"),
        json.dumps(
            {
                "id": created["id"],
                "tabs": [
                    {"name": "First", "gridItems": [{**item, "uuid": "item-1"}]},
                    {"name": "Second", "gridItems": [{**item, "uuid": "item-2"}]},
                ],
            }
        ),
    ).json()

    assert saved["success"] is True
    tabs = saved["updated_dashboard"]["tabs"]
    assert [tab["name"] for tab in tabs] == ["First", "Second"]
    assert [[i["uuid"] for i in tab["gridItems"]] for tab in tabs] == [
        ["item-1"],
        ["item-2"],
    ]
    # The tab and placeholder item the dashboard was created with are gone.
    stored = db_session.query(GridItem).filter_by(dashboard_id=created["id"]).all()
    assert sorted(i.uuid for i in stored) == ["item-1", "item-2"]


# Secrets saved, read and swept with the dashboard

STORED_SECRET = "s3cr3t-api-key"
# A value an older save left in a secret arg, which is never stored or served.
LEFT_IN_ARGS = "l3ft-1n-args-key"


@pytest.fixture
def fake_secrets(mocker, monkeypatch, mock_app, mock_app_get_ps_db):
    """The app, with the fake secret plugins as the only ones installed.

    The key rotation warning counts as given, so no test depends on another's.
    """
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=FakeSecretIntake())
    monkeypatch.setattr(tile_secrets, "_warned_derived_keys_only", True)


def _fake_tile(api_key="", **fields):
    """A tile of the fake secret plugin, whose api_key arg is secret."""
    return {
        "i": "1",
        "x": 0,
        "y": 0,
        "w": 1,
        "h": 1,
        "source": "fake_secret",
        "args_string": json.dumps({"api_key": api_key, "site": "A"}),
        "metadata_string": "{}",
        "uuid": str(uuid.uuid4()),
        **fields,
    }


def _fake_map(api_key=""):
    """A Map tile with a dynamic fake secret layer, whose popup holds an echo tile."""
    layer = {
        "configuration": {
            "type": "VectorLayer",
            "props": {
                "name": "Echo",
                "layerId": "layer-1",
                "pluginSource": {
                    "source": "fake_secret_layer",
                    "args": {"api_key": api_key, "site": "A"},
                },
            },
        },
        "popupConfig": {"gridItems": [_fake_tile(api_key)]},
    }
    return _fake_tile(source="Map", args_string=json.dumps({"layers": [layer]}))


def _set_secret(tile, value=STORED_SECRET, layer="", arg="api_key"):
    return {"tile": tile, "layer": layer, "arg": arg, "value": value}


def _update(client, body):
    return client.generic("POST", reverse("tethysdash:update_dashboard"), body)


def _save_secret(client, dashboard, tile, value=STORED_SECRET):
    """Save a tab holding the tile, setting its secret."""
    return _update(
        client,
        json.dumps(
            {
                "id": dashboard.id,
                "tabs": [{"name": "Tab", "gridItems": [tile]}],
                "secretChanges": [_set_secret(tile["uuid"], value)],
            }
        ),
    )


@pytest.mark.django_db
def test_update_dashboard_saves_a_secret_and_answers_only_its_place(
    client, dashboard, db_session, fake_secrets, test_owner_user, capsys
):
    tile = _fake_tile()
    client.force_login(test_owner_user)

    response = _save_secret(client, dashboard, tile)

    body = response.json()
    assert body["success"] is True
    assert body["updated_dashboard"]["storedSecrets"] == [
        {"tile": tile["uuid"], "layer": "", "arg": "api_key"}
    ]
    assert STORED_SECRET not in response.content.decode()
    out = capsys.readouterr().out
    assert f"Successfully updated the dashboard {dashboard.id}" in out
    assert STORED_SECRET not in out
    (row,) = db_session.query(TileSecret).all()
    identity = SecretIdentity(
        dashboard.uuid, tile["uuid"], "", "api_key", "fake_secret"
    )
    assert decrypt(identity, row.ciphertext).reveal() == STORED_SECRET


@pytest.mark.django_db
def test_update_dashboard_scrubs_an_encryption_error_carrying_the_value(
    client, dashboard, db_session, fake_secrets, test_owner_user, mocker, capsys
):
    def encrypt_quoting_the_value(identity, value):
        raise ValueError(f"Could not encrypt {value!r} for {identity}")

    mocker.patch(
        "tethysapp.tethysdash.model.encrypt", side_effect=encrypt_quoting_the_value
    )
    client.force_login(test_owner_user)

    response = _save_secret(client, dashboard, _fake_tile())

    # The error's text is internal, so only the log has it, scrubbed.
    assert response.json() == {"success": False, "message": UPDATE_FAILED}
    out = capsys.readouterr().out
    assert f"Could not encrypt '{REDACTED}' for dashboard" in out
    assert STORED_SECRET not in out
    # The save failed whole.
    assert db_session.query(TileSecret).count() == 0
    assert db_session.query(GridItem).filter_by(dashboard_id=dashboard.id).count() == 0


@pytest.mark.django_db
def test_update_dashboard_scrubs_a_value_found_in_a_secret_arg(
    client, dashboard, fake_secrets, test_owner_user, mocker, capsys
):
    """A value in a secret arg, however deep, is scrubbed from a refusal quoting it."""
    mocker.patch(
        "tethysapp.tethysdash.controllers.update_named_dashboard",
        side_effect=DashboardUpdateRefused(f"Could not save {LEFT_IN_ARGS}"),
    )
    client.force_login(test_owner_user)
    body = {
        "id": dashboard.id,
        "tabs": [{"name": "Tab", "gridItems": [_fake_map(LEFT_IN_ARGS)]}],
    }

    response = _update(client, json.dumps(body))

    assert response.json() == {
        "success": False,
        "message": f"Could not save {REDACTED}",
    }
    out = capsys.readouterr().out
    assert f"Could not save {REDACTED}" in out
    assert LEFT_IN_ARGS not in out


@pytest.mark.django_db
def test_update_dashboard_scrubs_a_failed_file_sweep(
    client, dashboard, fake_secrets, test_owner_user, mocker, capsys
):
    """The save is committed before the layer file sweep, whose failure is only
    logged, scrubbed like everything else the save logs."""
    mocker.patch(
        "tethysapp.tethysdash.controllers.clean_up_dashboard_files",
        side_effect=OSError(f"storage is unreachable at {STORED_SECRET}"),
    )
    client.force_login(test_owner_user)

    response = _save_secret(client, dashboard, _fake_tile())

    assert response.json()["success"] is True
    out = capsys.readouterr().out
    assert f"storage is unreachable at {REDACTED}" in out
    assert STORED_SECRET not in out


@pytest.mark.django_db
def test_update_dashboard_refuses_a_secret_for_an_arg_that_is_not_secret(
    client, dashboard, db_session, fake_secrets, test_owner_user
):
    tile = _fake_tile()
    client.force_login(test_owner_user)
    body = {
        "id": dashboard.id,
        "tabs": [{"name": "Tab", "gridItems": [tile]}],
        "secretChanges": [
            _set_secret(tile["uuid"]),
            _set_secret(tile["uuid"], arg="site"),
        ],
    }

    response = _update(client, json.dumps(body))

    assert response.json() == {"success": False, "message": SECRET_SETTING_GONE}
    assert db_session.query(TileSecret).count() == 0
    assert db_session.query(GridItem).filter_by(dashboard_id=dashboard.id).count() == 0


@pytest.mark.django_db
@pytest.mark.parametrize(
    "body",
    ["not json", json.dumps([{"id": 1}]), json.dumps({"name": "No id"})],
    ids=["not JSON", "not an object", "no id"],
)
def test_update_dashboard_answers_a_malformed_body_with_the_generic_message(
    body, client, fake_secrets, test_owner_user, capsys
):
    client.force_login(test_owner_user)

    response = _update(client, body)

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": UPDATE_FAILED}
    assert "Failed to update a dashboard: " in capsys.readouterr().out


@pytest.mark.django_db
def test_no_dashboard_answer_holds_a_secret_value(
    client, dashboard, db_session, fake_secrets, test_owner_user
):
    """Every endpoint answering with a dashboard serves its secret args blank, for a
    dashboard holding a stored secret and a value an older save left in its args."""
    client.force_login(test_owner_user)
    tile = _fake_tile()
    saved = _save_secret(client, dashboard, tile).json()["updated_dashboard"]
    legacy = _fake_map(LEFT_IN_ARGS)
    db_session.add(
        GridItem(
            dashboard_id=dashboard.id,
            tab_id=saved["tabs"][0]["id"],
            uuid=legacy["uuid"],
            i="2",
            x=0,
            y=0,
            w=1,
            h=1,
            source="Map",
            args_string=legacy["args_string"],
            metadata_string="{}",
        )
    )
    db_session.commit()

    def get(dashboard_id):
        return client.get(reverse("tethysdash:get_dashboard"), {"id": dashboard_id})

    def post(name, body):
        return client.generic("POST", reverse(f"tethysdash:{name}"), json.dumps(body))

    answers = {
        "get": get(dashboard.id),
        "list": client.get(reverse("tethysdash:dashboards")),
        "update": post("update_dashboard", {"id": dashboard.id, "name": "Renamed"}),
        "copy": post("copy_dashboard", {"id": dashboard.id, "newName": "Copy"}),
        "add": post(
            "add_dashboard",
            {
                "name": "Imported",
                "tabs": [{"name": "Tab", "gridItems": [_fake_map(LEFT_IN_ARGS)]}],
            },
        ),
    }
    for name in ("copy", "add"):
        answers[f"{name}, then get"] = get(answers[name].json()["new_dashboard"]["id"])

    for name, response in answers.items():
        assert response.status_code == 200, name
        assert response.json().get("success", True) is True, name
        text = response.content.decode()
        assert STORED_SECRET not in text, name
        assert LEFT_IN_ARGS not in text, name
    served = answers["get"].json()["dashboard"]
    assert served["storedSecrets"] == [
        {"tile": tile["uuid"], "layer": "", "arg": "api_key"}
    ]
    assert len(served["tabs"][0]["gridItems"]) == 2
    copy = answers["copy, then get"].json()["dashboard"]
    assert copy["storedSecrets"] == []
    assert len(copy["tabs"][0]["gridItems"]) == 2


# Secrets resolved at run time and kept out of outputs

# What an editor types into a secret arg and previews before saving. Quoting it in
# a URL changes it, so a URL carrying it holds another form of it.
TYPED_SECRET = "typed k3y/+value"


@pytest.fixture
def stored_tile(client, dashboard, fake_secrets, test_owner_user):
    """The uuid of an fake secret tile saved on the dashboard, STORED_SECRET stored as
    its secret. The client is left signed out."""
    tile = _fake_tile()
    client.force_login(test_owner_user)
    assert _save_secret(client, dashboard, tile).json()["success"] is True
    client.logout()
    return tile["uuid"]


@pytest.fixture
def stored_map(client, dashboard, fake_secrets, test_owner_user):
    """A Map tile saved on the dashboard with STORED_SECRET stored for its dynamic
    layer and for the tile in that layer's popup. Returns the map's and the popup
    tile's uuids; the client is left signed out."""
    tile = _fake_map()
    popup = json.loads(tile["args_string"])["layers"][0]["popupConfig"]["gridItems"]
    popup_uuid = popup[0]["uuid"]
    client.force_login(test_owner_user)
    body = {
        "id": dashboard.id,
        "tabs": [{"name": "Tab", "gridItems": [tile]}],
        "secretChanges": [
            _set_secret(tile["uuid"], layer="layer-1"),
            _set_secret(popup_uuid),
        ],
    }
    assert _update(client, json.dumps(body)).json()["success"] is True
    client.logout()
    return tile["uuid"], popup_uuid


@pytest.fixture
def broadcast(mocker):
    """The messages sent over the progress WebSocket, as the browser gets them."""
    sent = []

    async def group_send(group, event):
        sent.append(event["message"]["message"])

    mocker.patch(
        "channels.layers.get_channel_layer",
        return_value=types.SimpleNamespace(group_send=group_send),
    )
    return sent


@pytest.fixture
def plugins_built(mocker):
    """Every plugin construction, to show a refused request never built one."""
    return mocker.spy(TethysDashPlugin, "__init__")


def _run_fake(client, dashboard, tile, api_key="", site="A", **fields):
    """POST a data request for an fake secret plugin, fake_secret by default, as the
    browser sends an editor's: every arg (``allArgs``), and the secret only when one
    was typed. A viewer's ``allArgs`` changes nothing, so viewers run it too."""
    source = fields.pop("source", "fake_secret")
    fields.setdefault("allArgs", True)
    args = {"site": site, **({"api_key": api_key} if api_key else {})}
    return _post_data(client, dashboard.uuid, tile, args, source, **fields)


def _fake_answer(response):
    """What the fake secret tile answered: its site and its secret's proof."""
    body = response.json()
    assert body["success"] is True, body
    return body["data"]["data"][0]


def _proof(value, site="A"):
    return {"site": site, **secret_proof(value)}


@pytest.mark.django_db
def test_data_runs_a_secret_tile_for_a_signed_out_viewer_of_a_public_dashboard(
    client, dashboard, db_session, stored_tile
):
    """The plugin gets the stored secret, whatever the request sends for it, and
    the response holds none of it. The tile's uuid may come in any case."""
    dashboard.public = True
    db_session.commit()

    response = _run_fake(client, dashboard, stored_tile.upper(), api_key="guess")

    assert _fake_answer(response) == _proof(STORED_SECRET)
    assert STORED_SECRET not in response.content.decode()


@pytest.mark.django_db
def test_data_runs_an_editors_typed_secret_before_the_stored_one(
    client, dashboard, stored_tile, test_owner_user, test_admin_user, test_member_user
):
    """An editor's request runs the secret they just typed, and the stored one when
    they typed none. Only a request that runs as sent (``allArgs``) runs a typed
    value: an editor's without it, like a viewer's, runs the stored one."""
    for user in [test_owner_user, test_admin_user]:
        client.force_login(user)
        typed = _run_fake(client, dashboard, stored_tile, api_key=TYPED_SECRET)
        stored = _run_fake(client, dashboard, stored_tile, api_key="")
        not_as_sent = _run_fake(
            client, dashboard, stored_tile, api_key=TYPED_SECRET, allArgs=False
        )

        assert _fake_answer(typed) == _proof(TYPED_SECRET)
        assert _fake_answer(stored) == _proof(STORED_SECRET)
        assert _fake_answer(not_as_sent) == _proof(STORED_SECRET)
    client.force_login(test_member_user)
    viewer = _run_fake(client, dashboard, stored_tile, api_key=TYPED_SECRET)
    assert _fake_answer(viewer) == _proof(STORED_SECRET)


@pytest.mark.django_db
def test_data_runs_a_viewers_dynamic_layer_and_popup_tile_with_their_secrets(
    client, dashboard, stored_map, test_member_user
):
    map_tile, popup_tile = stored_map
    client.force_login(test_member_user)

    layer = _run_fake(
        client,
        dashboard,
        map_tile,
        source="fake_secret_layer",
        mode="features",
        layer="layer-1",
    )
    popup = _run_fake(client, dashboard, popup_tile)

    features = layer.json()["data"]["features"]
    assert features[0]["properties"] == _proof(STORED_SECRET)
    assert _fake_answer(popup) == _proof(STORED_SECRET)


@pytest.mark.django_db
def test_data_tells_editors_and_viewers_a_secret_is_missing_without_building_the_plugin(
    client,
    dashboard,
    db_session,
    fake_secrets,
    test_owner_user,
    test_member_user,
    plugins_built,
):
    """With no secret stored, a viewer is told the tile is not set up and an editor
    to enter the secret, on a saved tile or an unsaved one. A value left in the
    saved args does not count."""
    tile = _add_tile(
        db_session, dashboard, "fake_secret", {"api_key": LEFT_IN_ARGS, "site": "A"}
    )

    client.force_login(test_member_user)
    viewer = _run_fake(client, dashboard, tile, api_key=LEFT_IN_ARGS)
    client.force_login(test_owner_user)
    editor = _run_fake(client, dashboard, tile)
    unsaved = _run_fake(client, dashboard, str(uuid.uuid4()))

    assert viewer.json() == _data_refusal(SECRET_NOT_SET_UP)
    assert editor.json() == unsaved.json() == _data_refusal(SECRET_NEEDED)
    assert plugins_built.call_count == 0


@pytest.mark.django_db
def test_data_treats_a_secret_stored_for_another_plugin_as_missing(
    client,
    dashboard,
    db_session,
    stored_tile,
    test_owner_user,
    test_member_user,
    plugins_built,
):
    client.force_login(test_owner_user)
    # An editor previewing another plugin on the tile, before saving the change.
    switched = _run_fake(client, dashboard, stored_tile, source="fake_secret_early")
    assert switched.json() == _data_refusal(SECRET_NEEDED)

    row = db_session.query(TileSecret).one()
    row.plugin_source = "fake_secret_layer"
    db_session.commit()

    editor = _run_fake(client, dashboard, stored_tile)
    client.force_login(test_member_user)
    viewer = _run_fake(client, dashboard, stored_tile)

    assert editor.json() == _data_refusal(SECRET_NEEDED)
    assert viewer.json() == _data_refusal(SECRET_NOT_SET_UP)
    assert plugins_built.call_count == 0


@pytest.mark.django_db
def test_data_asks_an_editor_to_reenter_a_secret_that_cannot_be_read(
    client,
    dashboard,
    db_session,
    stored_tile,
    test_owner_user,
    test_member_user,
    plugins_built,
    capsys,
):
    row = db_session.query(TileSecret).one()
    row.ciphertext = "not a ciphertext"
    db_session.commit()

    client.force_login(test_owner_user)
    editor = _run_fake(client, dashboard, stored_tile)
    client.force_login(test_member_user)
    viewer = _run_fake(client, dashboard, stored_tile)

    assert editor.json() == _data_refusal(SECRET_UNREADABLE)
    assert viewer.json() == _data_refusal(SECRET_NOT_SET_UP)
    assert plugins_built.call_count == 0
    assert f"tile {stored_tile} arg 'api_key' (plugin fake_secret) is unavailable" in (
        capsys.readouterr().out
    )


@pytest.mark.django_db
def test_data_answers_a_bad_secret_key_setting_with_the_generic_message(
    client, dashboard, stored_tile, test_member_user, settings, capsys
):
    settings.TETHYSDASH_SECRET_KEYS = ["not a key"]
    client.force_login(test_member_user)

    response = _run_fake(client, dashboard, stored_tile)

    assert response.json() == _data_refusal(DATA_REQUEST_FAILED)
    assert (
        "Failed to answer a data request: Entry 0 of TETHYSDASH_SECRET_KEYS is not a "
        "Fernet key."
    ) in capsys.readouterr().out


@pytest.mark.django_db
def test_data_scrubs_a_plugin_error_quoting_its_secret(
    client, dashboard, stored_tile, test_owner_user, test_member_user, capsys
):
    """The error reaches the browser, and the log, with the secret masked: the
    stored one, and the one an editor typed."""
    client.force_login(test_member_user)
    viewer = _run_fake(client, dashboard, stored_tile)
    client.force_login(test_owner_user)
    # The saved site is not wired, so only an editor's request can change it.
    stored = _run_fake(client, dashboard, stored_tile, site="raise")
    typed = _run_fake(
        client, dashboard, stored_tile, api_key=TYPED_SECRET, site="raise"
    )

    assert _fake_answer(viewer) == _proof(STORED_SECRET)
    expected = _data_refusal(f"Could not sign in to raise with {REDACTED}")
    assert stored.json() == typed.json() == expected
    out = capsys.readouterr().out
    assert f"VisualizationError: Could not sign in to raise with {REDACTED}" in out
    for secret in (STORED_SECRET, TYPED_SECRET):
        assert secret not in out
        assert secret not in stored.content.decode() + typed.content.decode()


@pytest.mark.django_db
def test_data_scrubs_a_dynamic_layers_failure_quoting_its_secret(
    client, dashboard, stored_map, test_owner_user, capsys
):
    """A features-mode failure passes the plugin's own message through, scrubbed."""
    map_tile, _ = stored_map
    client.force_login(test_owner_user)

    response = _run_fake(
        client,
        dashboard,
        map_tile,
        site="crash",
        source="fake_secret_layer",
        mode="features",
        layer="layer-1",
    )

    assert response.json() == _data_refusal(f"Connection refused for {REDACTED}")
    out = capsys.readouterr().out
    assert f"Connection refused for {REDACTED}" in out
    assert STORED_SECRET not in out


@pytest.mark.django_db
def test_data_scrubs_progress_quoting_a_secret(
    client, dashboard, stored_tile, test_owner_user, broadcast
):
    """Progress is scrubbed of the stored secret and of a typed one, including
    progress a plugin sends while it is still being built."""
    client.force_login(test_owner_user)

    stored = _run_fake(client, dashboard, stored_tile, site="progress")
    early = _run_fake(
        client,
        dashboard,
        str(uuid.uuid4()),
        api_key=TYPED_SECRET,
        source="fake_secret_early",
    )

    assert _fake_answer(stored) == _proof(STORED_SECRET, "progress")
    assert _fake_answer(early) == _proof(TYPED_SECRET)
    assert broadcast == [
        f"Signing in with {REDACTED}",
        f"Connecting with {REDACTED}",
    ]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "source, fields",
    [
        ("fake_secret", {}),
        ("fake_secret_layer", {"mode": "features", "layer": "layer-1"}),
        ("fake_secret_raster", {"mode": "features", "layer": "layer-1"}),
    ],
    ids=["tile", "dynamic GeoJSON layer", "dynamic GeoTIFF layer"],
)
def test_data_refuses_a_result_holding_a_secret(
    client, dashboard, fake_secrets, test_owner_user, source, fields, capsys
):
    """However the result carries it: the GeoTIFF plugin URL-quotes it into the
    query string of the file it names."""
    client.force_login(test_owner_user)

    response = _run_fake(
        client,
        dashboard,
        str(uuid.uuid4()),
        api_key=TYPED_SECRET,
        site="leak",
        source=source,
        **fields,
    )

    assert response.json() == _data_refusal(SECRET_RETURNED)
    assert f"VisualizationError: {SECRET_RETURNED}" in capsys.readouterr().out
