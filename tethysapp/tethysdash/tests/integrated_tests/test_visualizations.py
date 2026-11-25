from tethysapp.tethysdash.visualizations import (
    DataRequest,
    get_available_visualizations,
    get_chat_history,
    get_plugin_secret_args,
    get_visualization,
    prepare_run_args,
    warm_visualization_cache,
)
from tethysapp.tethysdash.model import (
    DashboardPermission,
    GridItem,
    Message,
    TileSecret,
)
from tethysapp.tethysdash import tile_secrets
from tethysapp.tethysdash.plugin_helpers import run_secret_values
from tethysapp.tethysdash.tile_secrets import (
    REDACTED,
    SecretIdentity,
    SecretValue,
    encrypt,
)
from datetime import datetime
from urllib.parse import quote
from uuid import uuid4
from django.contrib.auth.models import AnonymousUser
from django.views.debug import SafeExceptionReporterFilter
import json
import pytest
import re
import types
from django.urls import reverse
from tethysapp.tethysdash.exceptions import (
    SECRET_RETURNED,
    DashboardNotFound,
    VisualizationError,
)
from tethysapp.tethysdash.tests.fixtures.echo_runtime_plugin import (
    EchoRuntimePlugin,
)
from tethysapp.tethysdash.tests.fixtures.echo_runtime_raster_plugin import (
    ECHO_RASTER_URL,
    EchoRuntimeRasterPlugin,
)
import hashlib
from tethysapp.tethysdash.plugin_helpers import LayerConfigurationBuilder
from tethysapp.tethysdash.plugin_helpers import TethysDashPlugin
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


@pytest.fixture
def echo_runtime_intake(mocker):
    """Wire the EchoRuntimePlugin fixture into a mocked intake registry."""

    class MockIntake:
        source = type("Source", (), {"registry": {"echo_runtime": EchoRuntimePlugin}})

        @staticmethod
        def open_echo_runtime(**kwargs):
            return EchoRuntimePlugin(**kwargs)

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())
    return MockIntake


@pytest.fixture
def echo_runtime_raster_intake(mocker):
    """Wire the EchoRuntimeRasterPlugin fixture into a mocked intake registry."""

    class MockIntake:
        source = type(
            "Source", (), {"registry": {"echo_runtime_raster": EchoRuntimeRasterPlugin}}
        )

        @staticmethod
        def open_echo_runtime_raster(**kwargs):
            return EchoRuntimeRasterPlugin(**kwargs)

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())
    return MockIntake


def test_get_available_visualizations(
    mock_app_get_ps_db, mock_plugin, mock_plugin_visualization, mocker, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = True
    mock_intake.source.registry = [mock_plugin.name]
    mock_intake.open_package_name = mock_plugin

    available_visualizations = get_available_visualizations(test_owner_user)

    assert available_visualizations == {"visualizations": [mock_plugin_visualization]}


def test_get_available_visualizations2(
    mock_app_get_ps_db,
    mock_plugin,
    mock_plugin2,
    mock_plugin_visualization2,
    mocker,
    test_owner_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = True
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.source.registry = [mock_plugin.name, mock_plugin2.name]
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2.visualization_restricted = False

    available_visualizations = get_available_visualizations(test_owner_user)
    assert available_visualizations == {"visualizations": [mock_plugin_visualization2]}


def test_get_visualization_uninstalled_plugin(
    mock_app_get_ps_db, mocker, test_owner_user
):
    class MockIntake:
        source = type("Source", (), {"registry": {}})

    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())

    test_args = {"some_arg": "test"}
    viz_source = "some_viz_source"

    with pytest.raises(VisualizationError) as excinfo:
        get_visualization(viz_source, test_args, test_owner_user, 12345)

    assert f"Visualization ({viz_source}) is not installed." in str(excinfo.value)


def test_get_visualization_restricted_and_access(
    mock_app_get_ps_db, mock_plugin, mocker, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = True
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name().read.return_value = "some_data"
    mock_intake.open_package_name.visualization_restricted = True

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(
        mock_plugin.name, test_args, test_owner_user, 12345
    )

    mock_intake.open_package_name.assert_called_with(some_arg="test")
    assert viz_type == mock_plugin.visualization_type
    assert viz_data == "some_data"


def test_get_visualization_restricted_and_no_access(
    mock_app_get_ps_db, mock_plugin, mocker, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_get_visualization_user_permission = mocker.patch(
        "tethysapp.tethysdash.visualizations.get_visualization_user_permission"
    )
    mock_get_visualization_user_permission.return_value = False
    mock_intake.open_package_name = mock_plugin
    mock_intake.open_package_name().read.return_value = "some_data"
    mock_intake.open_package_name.visualization_restricted = True

    test_args = {"some_arg": "test"}
    with pytest.raises(Exception) as excinfo:
        get_visualization(mock_plugin.name, test_args, test_owner_user, 12345)
    assert "User does not have permission to access this visualization." in str(
        excinfo.value
    )


def test_get_visualization_not_restricted(mock_plugin2, mocker, test_owner_user):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2().read.return_value = "some_data"
    mock_intake.open_package_name2.visualization_restricted = False

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(
        mock_plugin2.name, test_args, test_owner_user, 12345
    )

    mock_intake.open_package_name2.assert_called_with(some_arg="test")
    assert viz_type == mock_plugin2.visualization_type
    assert viz_data == "some_data"


def _chat_request(dashboard, tile_uuid):
    return DataRequest.from_body(
        {"dashboard": dashboard.uuid, "tile": tile_uuid, "source": "Live Chat"}
    )


def test_get_chat_history(
    test_owner_user,
    db_session,
    live_chat_dashboard,
    mock_app_get_ps_db,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid
    request = _chat_request(live_chat_dashboard, grid_item_uuid)

    assert get_chat_history(test_owner_user, request) == {"chatHistory": []}

    message = Message(
        timestamp=datetime.utcnow(),
        request_id=grid_item_uuid,
        session_id="some_session_id",
        message_id="some_message_id",
        sender="user",
        message="Hello, this is a test message.",
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)

    # The tile is matched in any case, and its history read under its saved uuid.
    request = _chat_request(live_chat_dashboard, grid_item_uuid.upper())
    assert get_chat_history(test_owner_user, request) == {
        "chatHistory": [
            {
                "edited": False,
                "message": "Hello, this is a test message.",
                "messageId": "some_message_id",
                "sender": "user",
                "timestamp": message.timestamp.isoformat() + "Z",
                "sessionId": "some_session_id",
            }
        ]
    }


def _chat_message(db_session, grid_item_uuid):
    db_session.add(
        Message(
            timestamp=datetime.utcnow(),
            request_id=grid_item_uuid,
            session_id="some_session_id",
            message_id="some_message_id",
            sender="user",
            message="Hello",
        )
    )
    db_session.commit()


def _history(user, dashboard, grid_item_uuid):
    request = _chat_request(dashboard, grid_item_uuid)
    return get_chat_history(user, request)["chatHistory"]


@pytest.mark.django_db
def test_get_chat_history_takes_view_permission(
    db_session,
    live_chat_dashboard,
    mock_app_get_ps_db,
    test_owner_user,
    test_member_user,
    admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid
    _chat_message(db_session, grid_item_uuid)

    # Signed out, and signed in holding no permission: the dashboard is not found.
    for user in [AnonymousUser(), admin_user]:
        with pytest.raises(DashboardNotFound):
            _history(user, live_chat_dashboard, grid_item_uuid)
    # A tile the dashboard has not saved has no history.
    assert _history(test_owner_user, live_chat_dashboard, str(uuid4())) == []
    assert [
        m["message"]
        for m in _history(test_owner_user, live_chat_dashboard, grid_item_uuid)
    ] == ["Hello"]

    # A viewer, and anyone once the dashboard is public.
    db_session.add(
        DashboardPermission(
            dashboard_id=live_chat_dashboard.id,
            username=test_member_user.username,
            permission="viewer",
        )
    )
    db_session.commit()
    assert len(_history(test_member_user, live_chat_dashboard, grid_item_uuid)) == 1
    live_chat_dashboard.public = True
    db_session.commit()
    assert len(_history(AnonymousUser(), live_chat_dashboard, grid_item_uuid)) == 1


def test_get_visualization_has_no_live_chat_plugin(mocker, test_owner_user):
    """Live Chat history is read only through its dashboard, never as a plugin."""

    class MockIntake:
        source = type("Source", (), {"registry": {}})

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())

    with pytest.raises(VisualizationError, match=r"\(Live Chat\) is not installed"):
        get_visualization("Live Chat", {}, test_owner_user, str(uuid4()))


def test_get_visualization_without_request_id_kwarg(
    mock_plugin2, mocker, test_owner_user
):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2().read.return_value = "some_data"
    mock_intake.open_package_name2.visualization_restricted = False

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(
        mock_plugin2.name, test_args, test_owner_user, 12345
    )

    mock_intake.open_package_name2.assert_called_with(some_arg="test")
    assert viz_type == mock_plugin2.visualization_type
    assert viz_data == "some_data"


def test_get_visualization_with_request_id_kwarg(mock_plugin2, mocker, test_owner_user):
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2.visualization_restricted = False

    def read_with_request_id(request_id=None):
        return "data_with_request_id"

    mock_intake.open_package_name2().read = read_with_request_id

    test_args = {"some_arg": "test"}
    viz_type, viz_data = get_visualization(
        mock_plugin2.name, test_args, test_owner_user, "req-42"
    )

    assert viz_type == mock_plugin2.visualization_type
    assert viz_data == "data_with_request_id"


def test_get_restricted_visualizations_none(mocker):
    from tethysapp.tethysdash.visualizations import get_restricted_visualizations

    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    # No restricted plugins
    mock_intake.source.registry = ["plugin1", "plugin2"]
    mock_plugin1 = mocker.Mock()
    mock_plugin1.visualization_restricted = False
    mock_plugin2 = mocker.Mock()
    mock_plugin2.visualization_restricted = False
    setattr(mock_intake, "open_plugin1", mock_plugin1)  # noqa: B010
    setattr(mock_intake, "open_plugin2", mock_plugin2)  # noqa: B010
    result = get_restricted_visualizations()
    assert result == {}


def test_get_restricted_visualizations_some(mocker):
    from tethysapp.tethysdash.visualizations import get_restricted_visualizations

    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    # One restricted, one not
    mock_intake.source.registry = ["plugin1", "plugin2"]
    mock_plugin1 = mocker.Mock()
    mock_plugin1.visualization_restricted = True
    mock_plugin1.visualization_label = "Restricted Viz"
    mock_plugin1.visualization_description = "Desc"
    mock_plugin2 = mocker.Mock()
    mock_plugin2.visualization_restricted = False
    setattr(mock_intake, "open_plugin1", mock_plugin1)  # noqa: B010
    setattr(mock_intake, "open_plugin2", mock_plugin2)  # noqa: B010
    result = get_restricted_visualizations()
    assert "plugin1" in result
    assert result["plugin1"]["info"]["label"] == "Restricted Viz"
    assert result["plugin1"]["info"]["description"] == "Desc"
    assert result["plugin1"]["users"] == []
    assert result["plugin1"]["groups"] == []


# --- Runtime features mode tests (Unit 2) -----------------------------------


def test_get_visualization_features_mode_happy(echo_runtime_intake, test_owner_user):
    viz_type, data = get_visualization(
        "echo_runtime",
        {"mode": "happy"},
        test_owner_user,
        "n:g:layer-1",
        mode="features",
    )
    assert viz_type == "features"
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 1


def test_get_visualization_features_mode_empty(echo_runtime_intake, test_owner_user):
    viz_type, data = get_visualization(
        "echo_runtime",
        {"mode": "empty"},
        test_owner_user,
        "n:g:layer-1",
        mode="features",
    )
    assert viz_type == "features"
    assert data["features"] == []


def test_get_visualization_features_mode_none_raises(
    echo_runtime_intake, test_owner_user
):
    with pytest.raises(ValueError, match="returned None"):
        get_visualization(
            "echo_runtime",
            {"mode": "none"},
            test_owner_user,
            "n:g:layer-1",
            mode="features",
        )


def test_get_visualization_features_mode_scaffold_raises(
    echo_runtime_intake, test_owner_user
):
    with pytest.raises(ValueError, match="configure-time scaffold"):
        get_visualization(
            "echo_runtime",
            {"mode": "scaffold"},
            test_owner_user,
            "n:g:layer-1",
            mode="features",
        )


def test_get_visualization_features_mode_raise_propagates(
    echo_runtime_intake, test_owner_user
):
    with pytest.raises(RuntimeError, match="intentional failure"):
        get_visualization(
            "echo_runtime",
            {"mode": "raise"},
            test_owner_user,
            "n:g:layer-1",
            mode="features",
        )


def test_get_visualization_features_mode_bad_crs_raises(
    echo_runtime_intake, test_owner_user
):
    with pytest.raises(ValueError):
        get_visualization(
            "echo_runtime",
            {"mode": "bad_crs"},
            test_owner_user,
            "n:g:layer-1",
            mode="features",
        )


def test_get_visualization_features_mode_slow_progress(
    echo_runtime_intake, test_owner_user, mocker
):
    """The slow_progress mode calls send_update during fetch_features; the
    framework should attach the composite requestId's layer suffix as layer_id
    without any explicit kwarg from the plugin author."""
    mock_send = mocker.patch(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message"
    )
    viz_type, data = get_visualization(
        "echo_runtime",
        {"mode": "slow_progress"},
        test_owner_user,
        "sess:grid:layer-xyz",
        mode="features",
    )
    assert viz_type == "features"
    assert data["type"] == "FeatureCollection"
    # send_update call forwarded through to send_websocket_message with layer_id
    assert mock_send.called
    _, kwargs = mock_send.call_args
    assert kwargs.get("layer_id") == "layer-xyz"


def test_get_visualization_features_mode_non_runtime_plugin(
    mock_plugin2, mocker, test_owner_user
):
    """A plugin without dynamic_map_layer should surface a distinct error."""
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.source.registry = {"package_name2": mock_plugin2}
    # Set dynamic_map_layer=False on both the factory and the instance so
    # get_plugin_prop's legacy-name lookup resolves to False.
    mock_plugin2.visualization_dynamic_map_layer = False
    mock_plugin2.return_value.visualization_dynamic_map_layer = False

    with pytest.raises(VisualizationError, match="does not support dynamic features"):
        get_visualization(
            mock_plugin2.name,
            {"some_arg": "test"},
            test_owner_user,
            "sess:grid:layer-1",
            mode="features",
        )


def test_get_visualization_scaffold_mode_preserves_existing_behavior(
    mock_plugin2, mocker, test_owner_user
):
    """mode=scaffold (and mode omitted) must behave exactly as today."""
    mock_intake = mocker.patch("tethysapp.tethysdash.visualizations.intake")
    mock_intake.open_package_name2 = mock_plugin2
    mock_intake.open_package_name2().read.return_value = "some_data"
    mock_intake.open_package_name2.visualization_restricted = False

    # Explicit scaffold
    viz_type, viz_data = get_visualization(
        mock_plugin2.name,
        {"some_arg": "test"},
        test_owner_user,
        "req-1",
        mode="scaffold",
    )
    assert viz_data == "some_data"

    # Omitted mode — defaults to scaffold
    viz_type, viz_data = get_visualization(
        mock_plugin2.name,
        {"some_arg": "test"},
        test_owner_user,
        "req-2",
    )
    assert viz_data == "some_data"


def test_get_visualization_features_mode_none_request_id_safe(
    echo_runtime_intake, test_owner_user
):
    """No requestId (None) must not crash the composite-id parsing path."""
    viz_type, data = get_visualization(
        "echo_runtime",
        {"mode": "happy"},
        test_owner_user,
        None,
        mode="features",
    )
    assert viz_type == "features"
    assert data["type"] == "FeatureCollection"


def test_get_visualization_features_mode_no_colon_request_id(
    echo_runtime_intake, test_owner_user, mocker
):
    """requestId without `:` is allowed; no layer_id is attached to progress."""
    mock_send = mocker.patch(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message"
    )
    viz_type, data = get_visualization(
        "echo_runtime",
        {"mode": "slow_progress"},
        test_owner_user,
        "flat-request-id",
        mode="features",
    )
    assert viz_type == "features"
    # send_update still fires, but layer_id is None (no suffix to parse)
    _, kwargs = mock_send.call_args
    assert kwargs.get("layer_id") is None


def test_get_visualization_features_mode_empty_suffix_request_id(
    echo_runtime_intake, test_owner_user, mocker
):
    """Malformed requestId like 'a:b:' must not attach an empty-string layerId.

    Empty layer_id would pollute the WebSocket routing on the frontend
    (collision with legitimate empty-keyed state, misrouted progress messages).
    The backend guards against this by only setting _pending_layer_id when
    the parsed suffix is truthy.
    """
    mock_send = mocker.patch(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message"
    )
    viz_type, data = get_visualization(
        "echo_runtime",
        {"mode": "slow_progress"},
        test_owner_user,
        "sess:grid:",  # trailing colon yields empty suffix
        mode="features",
    )
    assert viz_type == "features"
    _, kwargs = mock_send.call_args
    # Empty suffix is rejected: layer_id falls back to None, not "".
    assert kwargs.get("layer_id") is None


# --- Runtime GeoTIFF source mode tests ---------------------------------------


def _fetch_raster(mode, request_id="n:g:layer-1"):
    return get_visualization(
        "echo_runtime_raster",
        {"mode": mode},
        None,
        request_id,
        mode="features",
    )


def test_build_plugin_metadata_reports_dynamic_map_layer_source():
    from tethysapp.tethysdash.visualizations import build_plugin_metadata

    raster = build_plugin_metadata(EchoRuntimeRasterPlugin, "echo_runtime_raster")
    vector = build_plugin_metadata(EchoRuntimePlugin, "echo_runtime")

    assert raster["dynamic_map_layer"] is True
    assert raster["dynamic_map_layer_source"] == "GeoTIFF"
    assert vector["dynamic_map_layer_source"] == "GeoJSON"


class OptionalEchoPlugin(TethysDashPlugin):
    """A table plugin whose ``area`` arg may be left empty."""

    name = "optional_echo"
    group = "Test"
    label = "Optional Echo"
    type = "table"
    args = {"site": "text", "area": "text"}
    optional_args = ("area",)

    def run(self):
        return {
            "title": "Optional Echo",
            "data": [{"site": self.site, "area_is_none": self.area is None}],
        }


@pytest.fixture
def optional_echo_intake(mocker):
    """Install OptionalEchoPlugin as the only plugin."""

    class MockIntake:
        source = types.SimpleNamespace(registry={"optional_echo": OptionalEchoPlugin})
        open_optional_echo = OptionalEchoPlugin

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())


def test_build_plugin_metadata_lists_optional_args():
    from tethysapp.tethysdash.visualizations import build_plugin_metadata

    declared = build_plugin_metadata(OptionalEchoPlugin, "optional_echo")
    undeclared = build_plugin_metadata(EchoRuntimePlugin, "echo_runtime")

    assert declared["optional_args"] == ["area"]
    assert undeclared["optional_args"] == []


@pytest.mark.parametrize(
    ("declared", "listed"),
    [(None, []), ("area", []), (5, []), (["area", 3], ["area"])],
    ids=["none", "bare-string", "not-a-sequence", "non-string-name"],
)
def test_build_plugin_metadata_lists_a_malformed_declaration_safely(declared, listed):
    """One plugin's malformed optional_args must not break the plugin list."""
    from tethysapp.tethysdash.visualizations import build_plugin_metadata

    class Malformed(TethysDashPlugin):
        name = "malformed"
        group = "Test"
        label = "Malformed"
        type = "table"
        args = {"area": "text"}
        optional_args = declared

    assert build_plugin_metadata(Malformed, "malformed")["optional_args"] == listed


@pytest.mark.django_db
def test_viewer_request_with_an_empty_optional_token_runs_with_none(
    db_session, dashboard, optional_echo_intake, mock_app_get_ps_db, test_member_user
):
    """A viewer's request carries an empty exact ``${Area}`` as "", and the plugin
    reads it as None."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tile = str(uuid4())
    db_session.add(
        GridItem(
            dashboard_id=dashboard.id,
            uuid=tile,
            i="1",
            x=0,
            y=0,
            w=1,
            h=1,
            source="optional_echo",
            args_string=json.dumps({"site": "A", "area": "${Area}"}),
            metadata_string="{}",
        )
    )
    db_session.commit()
    request = DataRequest(
        dashboard=dashboard.uuid,
        tile=tile,
        layer="",
        source="optional_echo",
        args={"area": ""},
        mode="scaffold",
        request_id="req-1",
        all_args=False,
    )

    run_args = prepare_run_args(test_member_user, request)
    viz_type, data = get_visualization("optional_echo", run_args, None, "req-1")

    assert run_args == {"site": "A", "area": ""}
    assert viz_type == "table"
    assert data["data"] == [{"site": "A", "area_is_none": True}]


def test_get_visualization_features_mode_geotiff_happy(echo_runtime_raster_intake):
    viz_type, data = _fetch_raster("happy")

    assert viz_type == "source"
    assert data == {"type": "GeoTIFF", "props": {"url": ECHO_RASTER_URL}}


def test_get_visualization_features_mode_geotiff_full(echo_runtime_raster_intake):
    """A fetch carries the file and what describes the data in it, never style."""
    viz_type, data = _fetch_raster("styled")

    assert viz_type == "source"
    assert data == {
        "type": "GeoTIFF",
        "props": {
            "url": ECHO_RASTER_URL,
            "projection": "EPSG:32612",
            "mask_below": -9999,
        },
    }


@pytest.mark.parametrize(
    "mode,message",
    [
        ("none", "fetch_source\\(\\) returned None"),
        ("scaffold", "configure-time scaffold"),
        ("wrong_type", "type 'XYZ'.*dynamic_map_layer_source = 'GeoTIFF'"),
        ("empty_url", "props.url must be a non-empty string"),
        ("file_url", "'file:///etc/passwd' is not allowed"),
        ("bad_mask", "props.mask_below must be a finite number"),
        ("with_style", "unknown keys: style"),
    ],
)
def test_get_visualization_features_mode_geotiff_invalid_returns(
    echo_runtime_raster_intake, mode, message
):
    with pytest.raises(ValueError, match=message):
        _fetch_raster(mode)


def test_get_visualization_features_mode_geotiff_raise_propagates(
    echo_runtime_raster_intake,
):
    with pytest.raises(RuntimeError, match="intentional failure"):
        _fetch_raster("raise")


def test_get_visualization_features_mode_geotiff_progress_carries_layer_id(
    echo_runtime_raster_intake, mocker
):
    mock_send = mocker.patch(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message"
    )

    viz_type, _ = _fetch_raster("slow_progress", request_id="sess:grid:layer-xyz")

    assert viz_type == "source"
    args, kwargs = mock_send.call_args
    assert args[0] == "sess:grid:layer-xyz"
    assert kwargs.get("layer_id") == "layer-xyz"


def test_get_visualization_scaffold_mode_geotiff_runtime(echo_runtime_raster_intake):
    # The configure-time scaffold the editor opens: a sourceless GeoTIFF.
    _, data = get_visualization("echo_runtime_raster", {"mode": "happy"}, None, "req-1")

    props = data["configuration"]["props"]
    assert data["configuration"]["type"] == "WebGLTile"
    assert props["source"]["type"] == "GeoTIFF"
    assert "url" not in props["source"]["props"]
    assert props["pluginSource"]["source"] == "echo_runtime_raster"
    assert data["configuration"]["style"] == {"rampName": "viridis"}
    assert "rampName" not in props["source"]


def test_warm_visualization_cache_touches_each_and_skips_failures(mocker):
    """Warm-up imports every registered source; a failing one is logged and skipped."""

    class Good:
        label = "Good"

    class MockIntake:
        source = type("Source", (), {"registry": ["good", "bad"]})
        open_good = Good
        # No open_bad: getattr(intake, "open_bad") raises -> logged and skipped.

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())
    log_spy = mocker.patch("tethysapp.tethysdash.visualizations.logger")

    warmed = warm_visualization_cache()

    assert warmed == 1
    log_spy.warning.assert_called_once()
    assert "bad" in str(log_spy.warning.call_args)


STORED_SECRET = "s3cr3t-api-key"


@pytest.fixture
def fake_secret_intake(mocker):
    """Install the fake secret plugins as the only ones."""
    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=FakeSecretIntake())


def test_get_plugin_secret_args_of_tile_and_dynamic_layer_plugins(
    fake_secret_intake,
):
    assert get_plugin_secret_args("fake_secret") == {"api_key"}
    assert get_plugin_secret_args("fake_secret_layer") == {"api_key"}


def test_get_plugin_secret_args_of_plugin_declaring_none(mocker):
    class MockIntake:
        source = type("Source", (), {"registry": {"plain": EchoRuntimePlugin}})
        open_plain = EchoRuntimePlugin

    mocker.patch("tethysapp.tethysdash.visualizations.intake", new=MockIntake())

    assert get_plugin_secret_args("plain") == frozenset()


def test_get_plugin_secret_args_of_uninstalled_source_is_unknown(fake_secret_intake):
    assert get_plugin_secret_args("not_installed") is None


@pytest.mark.django_db
def test_visualizations_list_shows_a_secret_arg(client, fake_secret_intake):
    response = client.get(reverse("tethysdash:visualizations"))

    assert response.status_code == 200
    (group,) = response.json()["visualizations"]
    args = {option["source"]: option["args"] for option in group["options"]}
    assert args == {
        "fake_secret": {"api_key": "secret", "site": "text"},
        "fake_secret_layer": {"api_key": "secret", "site": "text"},
        "fake_secret_raster": {"api_key": "secret", "site": "text"},
        "fake_secret_early": {"api_key": "secret", "site": "text"},
    }


def test_fake_secret_plugin_runs_with_its_secret(fake_secret_intake):
    viz_type, data = get_visualization(
        "fake_secret", {"api_key": STORED_SECRET, "site": "A"}, None, "req-1"
    )

    assert viz_type == "table"
    assert data == {
        "title": "Fake Secret",
        "data": [{"site": "A", **secret_proof(STORED_SECRET)}],
    }
    assert STORED_SECRET not in str(data)


def test_fake_secret_layer_fetches_with_its_secret(fake_secret_intake):
    viz_type, data = get_visualization(
        "fake_secret_layer",
        {"api_key": STORED_SECRET, "site": "A"},
        None,
        "n:g:layer-1",
        mode="features",
    )

    assert viz_type == "features"
    assert data["features"][0]["properties"] == {
        "site": "A",
        **secret_proof(STORED_SECRET),
    }
    assert STORED_SECRET not in str(data)


def test_fake_secret_layer_scaffold_keeps_the_secret_slot_empty(fake_secret_intake):
    _, data = get_visualization(
        "fake_secret_layer", {"api_key": STORED_SECRET, "site": "A"}, None, "req-1"
    )

    plugin_source = data["configuration"]["props"]["pluginSource"]
    assert plugin_source == {
        "source": "fake_secret_layer",
        "args": {"api_key": "", "site": "A"},
    }
    assert STORED_SECRET not in str(data)


def test_fake_secret_plugin_switches_leak_the_secret(mocker):
    """The switches tests use to show a secret is scrubbed or refused."""
    with pytest.raises(VisualizationError, match=STORED_SECRET):
        FakeSecretPlugin(api_key=STORED_SECRET, site="raise").read("req-1")

    mock_send = mocker.patch(
        "tethysapp.tethysdash.plugin_helpers.send_websocket_message"
    )
    proof = FakeSecretPlugin(api_key=STORED_SECRET, site="progress").read("req-1")
    assert STORED_SECRET in mock_send.call_args.args[1]
    assert proof["data"] == [{"site": "progress", **secret_proof(STORED_SECRET)}]

    leaked = FakeSecretPlugin(api_key=STORED_SECRET, site="leak").read("req-1")
    assert leaked["data"] == [{"site": "leak", "api_key": STORED_SECRET}]


# Secrets resolved at run time and kept out of outputs

# Quoting it in a URL changes it, so a URL carrying it holds another form of it.
QUOTED_SECRET = "s3cr3t k3y/+="


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
def stored_fake_tile(
    db_session, dashboard, fake_secret_intake, mock_app_get_ps_db, monkeypatch
):
    """The uuid of an fake secret tile saved on the dashboard, STORED_SECRET stored as
    its secret."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    monkeypatch.setattr(tile_secrets, "_warned_derived_keys_only", True)
    tile = str(uuid4())
    db_session.add(
        GridItem(
            dashboard_id=dashboard.id,
            uuid=tile,
            i="1",
            x=0,
            y=0,
            w=1,
            h=1,
            source="fake_secret",
            args_string=json.dumps({"api_key": "", "site": "A"}),
            metadata_string="{}",
        )
    )
    identity = SecretIdentity(dashboard.uuid, tile, "", "api_key", "fake_secret")
    db_session.add(
        TileSecret(
            dashboard_id=dashboard.id,
            tile_uuid=tile,
            layer_id="",
            arg_name="api_key",
            plugin_source="fake_secret",
            ciphertext=encrypt(identity, STORED_SECRET),
            updated_by="owner_user",
        )
    )
    db_session.commit()
    return tile


def _fake_request(dashboard, tile, api_key):
    return DataRequest(
        dashboard=dashboard.uuid,
        tile=tile,
        layer="",
        source="fake_secret",
        args={"api_key": api_key, "site": "A"},
        mode="scaffold",
        request_id="req-1",
        all_args=True,
    )


@pytest.mark.django_db
def test_prepare_run_args_hands_on_every_secret_wrapped(
    dashboard, stored_fake_tile, test_owner_user, test_member_user
):
    """The stored secret and an editor's typed one alike leave as SecretValues,
    which never show the value."""
    viewer = prepare_run_args(
        test_member_user, _fake_request(dashboard, stored_fake_tile, "guess")
    )
    editor = prepare_run_args(
        test_owner_user, _fake_request(dashboard, stored_fake_tile, "typed-key")
    )

    for run_args, value in [(viewer, STORED_SECRET), (editor, "typed-key")]:
        assert isinstance(run_args["api_key"], SecretValue)
        assert run_args["api_key"].reveal() == value
        assert value not in repr(run_args)
        assert run_args["site"] == "A"


def test_get_visualization_unwraps_a_secret_only_to_build_the_plugin(
    fake_secret_intake,
):
    viz_type, data = get_visualization(
        "fake_secret", {"api_key": SecretValue(STORED_SECRET), "site": "A"}, None, "r"
    )

    assert viz_type == "table"
    assert data["data"] == [{"site": "A", **secret_proof(STORED_SECRET)}]


def test_get_visualization_scrubs_progress_from_before_the_plugin_is_built(
    fake_secret_intake, broadcast
):
    """The run's secrets are known from before the plugin is built until the run
    ends, and only then."""
    args = {"api_key": SecretValue(STORED_SECRET), "site": "progress"}

    get_visualization("fake_secret_early", args, None, "req-1")

    assert broadcast == [
        f"Connecting with {REDACTED}",
        f"Signing in with {REDACTED}",
    ]
    assert run_secret_values() == ()


@pytest.mark.parametrize(
    "source, mode",
    [
        ("fake_secret", "scaffold"),
        ("fake_secret_layer", "features"),
        ("fake_secret_raster", "features"),
    ],
)
def test_get_visualization_refuses_a_result_holding_a_secret(
    fake_secret_intake, source, mode
):
    """In any form: the GeoTIFF plugin URL-quotes it into the file's query string."""
    args = {"api_key": SecretValue(QUOTED_SECRET), "site": "leak"}

    with pytest.raises(VisualizationError, match=re.escape(SECRET_RETURNED)):
        get_visualization(source, args, None, "n:g:layer-1", mode=mode)

    assert run_secret_values() == ()


def test_fake_secret_raster_leak_carries_only_the_quoted_secret():
    """The raster leak shows the result check finds a form other than the value."""

    plugin = FakeSecretRasterPlugin(api_key=QUOTED_SECRET, site="leak")
    url = plugin.read_source("n:g:layer-1")["props"]["url"]

    assert QUOTED_SECRET not in url
    assert quote(QUOTED_SECRET, safe="") in url


def test_get_visualization_passes_a_result_holding_only_the_secrets_empty_slot(
    fake_secret_intake,
):
    _, data = get_visualization(
        "fake_secret_layer",
        {"api_key": SecretValue(STORED_SECRET), "site": "A"},
        None,
        "req-1",
    )

    assert data["configuration"]["props"]["pluginSource"]["args"]["api_key"] == ""


def test_get_visualization_hides_every_frame_below_it_from_error_reports(
    fake_secret_intake,
):
    """Django's error reports list each frame's variables; under get_visualization,
    the plugin's own included, every one is masked."""
    with pytest.raises(VisualizationError) as raised:
        get_visualization(
            "fake_secret",
            {"api_key": SecretValue(STORED_SECRET), "site": "raise"},
            None,
            "req-1",
        )

    reporter_filter = SafeExceptionReporterFilter()
    frames = {}
    # The first frame is this test's own, whose ``raised`` quotes the error.
    tb = raised.tb.tb_next
    while tb is not None:
        frames[tb.tb_frame.f_code.co_name] = dict(
            reporter_filter.get_traceback_frame_variables(None, tb.tb_frame)
        )
        tb = tb.tb_next

    # The plugin's frame holds the plain value in a variable of its own.
    assert "api_key" in frames["_answer"]
    for name in ("get_visualization", "_read_plugin", "run", "_answer"):
        assert set(frames[name].values()) == {reporter_filter.cleansed_substitute}
    assert STORED_SECRET not in repr(frames)
