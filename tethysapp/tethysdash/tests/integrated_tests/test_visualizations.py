from tethysapp.tethysdash.visualizations import (
    get_available_visualizations,
    get_visualization,
)
from tethysapp.tethysdash.model import Message
from datetime import datetime
import pytest
from tethysapp.tethysdash.exceptions import VisualizationError
from tethysapp.tethysdash.tests.fixtures.echo_runtime_plugin import (
    EchoRuntimePlugin,
)


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


def test_get_visualization_live_chat(
    test_owner_user,
    db_session,
    live_chat_dashboard,
    mock_app_get_ps_db,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    viz_type, viz_data = get_visualization(
        "Live Chat", {}, test_owner_user, grid_item_uuid
    )

    assert viz_type == "Live Chat"
    assert viz_data == {"chatHistory": []}

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

    viz_type, viz_data = get_visualization(
        "Live Chat", {}, test_owner_user, grid_item_uuid
    )

    assert viz_type == "Live Chat"
    assert viz_data == {
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
