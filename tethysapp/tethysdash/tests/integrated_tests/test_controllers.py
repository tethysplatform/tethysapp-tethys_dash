import ast
import pytest
import json
from pathlib import Path
from sqlalchemy.exc import IntegrityError
import tethysapp.tethysdash.controllers as controllers_module
from django.urls import reverse
from tethysapp.tethysdash.model import (
    Dashboard,
    DashboardPermission,
    Message,
    PermissionGroup,
)
from unittest.mock import MagicMock, mock_open, patch
import os
import shutil
from django.core.files.storage import default_storage
from tethysapp.tethysdash.model import save_thumbnail, thumbnail_name
from django.conf import settings
from django.test import override_settings
from datetime import datetime, timedelta
import types
from tethysapp.tethysdash.exceptions import DASHBOARD_NOT_FOUND, VisualizationError
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
)
import requests
import socket
from channels.layers import get_channel_layer


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


@pytest.mark.django_db
def test_data_failed(client, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualization")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = [Exception("Failed data retrieval")]
    requestId = str(uuid.uuid4())

    itemData = {
        "source": "usace_time_series",
        "args": json.dumps({"location": "CREC1", "year": 2025}),
        "requestId": requestId,
    }

    response = client.get(url, itemData)

    mock_gv.assert_called_once()
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["data"] == {"error": "Failed to retrieve data"}
    assert response.json()["viz_type"] is None


@pytest.mark.django_db
def test_data_failed_custom_error(client, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualization")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = [VisualizationError("some custom error message")]
    requestId = str(uuid.uuid4())

    itemData = {
        "source": "usace_time_series",
        "args": json.dumps({"location": "CREC1", "year": 2025}),
        "requestId": requestId,
    }

    response = client.get(url, itemData)

    mock_gv.assert_called_once()
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["data"] == {"error": "some custom error message"}
    assert response.json()["viz_type"] is None


@pytest.mark.django_db
def test_data(client, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualization")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    plot_data = {"data": [], "layout": {}}
    mock_gv.return_value = ["plotly", plot_data]
    requestId = str(uuid.uuid4())

    itemData = {
        "source": "usace_time_series",
        "args": json.dumps({"location": "CREC1", "year": 2025}),
        "requestId": requestId,
    }

    response = client.get(url, itemData)

    mock_gv.assert_called_once()
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == plot_data
    assert response.json()["viz_type"] == "plotly"


@pytest.mark.django_db
def test_data_features_mode_passes_through_exception_message(client, mock_app, mocker):
    """Unit 2: mode=features must pass the plugin's exception message through
    so authors can self-diagnose. mode=scaffold (default) keeps the existing
    sanitized 'Failed to retrieve data' message."""
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualization")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = RuntimeError("raw plugin traceback details")

    # mode=features -> plugin exception message passes through
    response = client.get(
        url,
        {
            "source": "echo_runtime",
            "args": json.dumps({"mode": "raise"}),
            "requestId": "n:g:layer-1",
            "mode": "features",
        },
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["data"] == {"error": "raw plugin traceback details"}

    # mode=scaffold (default) -> sanitized message preserved
    mock_gv.side_effect = RuntimeError("raw plugin traceback details")
    response = client.get(
        url,
        {
            "source": "echo_runtime",
            "args": json.dumps({}),
            "requestId": "req-1",
        },
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["data"] == {"error": "Failed to retrieve data"}


@pytest.mark.django_db
def test_data_features_mode_happy_path(client, mock_app, mocker):
    """mode=features success returns viz_type=features with the FC payload."""
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualization")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    fc = {
        "type": "FeatureCollection",
        "features": [],
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
    }
    mock_gv.return_value = ["features", fc]

    response = client.get(
        url,
        {
            "source": "echo_runtime",
            "args": json.dumps({"mode": "empty"}),
            "requestId": "n:g:layer-1",
            "mode": "features",
        },
    )
    # Confirm the controller forwarded mode=features to get_visualization.
    mock_gv.assert_called_once()
    _, kwargs = mock_gv.call_args
    assert kwargs.get("mode") == "features"
    assert response.json()["success"] is True
    assert response.json()["viz_type"] == "features"
    assert response.json()["data"] == fc


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
def test_data_features_mode_geotiff_source(
    client, mock_app, echo_runtime_raster_intake
):
    """A GeoTIFF runtime fetch responds with viz_type=source and the
    validated source description, through the same mode=features request."""
    from tethysapp.tethysdash.tests.fixtures.echo_runtime_raster_plugin import (
        ECHO_RASTER_URL,
    )

    mock_app("tethysapp.tethysdash.controllers.App")
    response = client.get(
        reverse("tethysdash:visualization"),
        {
            "source": "echo_runtime_raster",
            "args": json.dumps({"mode": "styled"}),
            "requestId": "n:g:layer-1",
            "mode": "features",
        },
    )

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
    client, mock_app, echo_runtime_raster_intake
):
    """A malformed GeoTIFF description fails per-layer with the validator's
    actionable message passed through, like any features-mode error."""
    mock_app("tethysapp.tethysdash.controllers.App")
    response = client.get(
        reverse("tethysdash:visualization"),
        {
            "source": "echo_runtime_raster",
            "args": json.dumps({"mode": "wrong_type"}),
            "requestId": "n:g:layer-1",
            "mode": "features",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["success"] is False
    assert body["viz_type"] is None
    assert "type 'XYZ'" in body["data"]["error"]
    assert "dynamic_map_layer_source = 'GeoTIFF'" in body["data"]["error"]


@pytest.mark.django_db
def test_data_scaffold_mode_default(client, mock_app, mocker):
    """Omitting mode defaults to scaffold (backward compat)."""
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:visualization")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.return_value = ["plotly", {"data": []}]

    response = client.get(
        url,
        {
            "source": "some_plugin",
            "args": json.dumps({}),
            "requestId": "req-1",
        },
    )
    assert response.status_code == 200
    _, kwargs = mock_gv.call_args
    assert kwargs.get("mode") == "scaffold"


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
    workspace_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
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
    workspace_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
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
    workspace_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
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
    workspace_path = tmp_path
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
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
def test_add_dashboard_rejects_a_uuid_that_is_not_one(
    client, db_session, mock_app_get_ps_db, test_admin_user
):
    """A dashboard uuid becomes a storage name, so a path in its place is refused."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    itemData = {"name": "traversal", "uuid": "../../otherapp/app/logo"}

    url = reverse("tethysdash:add_dashboard")
    client.force_login(test_admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.json() == {
        "success": False,
        "message": "The dashboard uuid must be a UUID.",
    }
    assert (
        db_session.query(Dashboard).filter(Dashboard.name == "traversal").count() == 0
    )


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
def test_update_dashboard_failed(client, admin_user, mock_app, mocker):
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
    mock_update_dashboard.side_effect = [Exception("failed to update")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_update_dashboard.assert_called_with(
        admin_user,
        itemData["id"],
        {"name": "dashboard_name"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to update"


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
def test_update_dashboard_failed_unknown_exception(
    client, admin_user, mock_app, mocker
):
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
    mock_update_dashboard.side_effect = [Exception()]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_update_dashboard.assert_called_with(
        admin_user,
        itemData["id"],
        {"name": "dashboard_name"},
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to update the dashboard {itemData["id"]}. Check server for logs."  # noqa: E501
    )


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
    client, test_admin_user, dashboard, mock_app, mock_app_get_ps_db, mocker, tmp_path
):
    """A copy's grid items name the original's GeoJSON and style files, and each
    dashboard reads them from its own folder, so the files come along."""
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch("tethysapp.tethysdash.model.get_app_workspace").return_value = (
        MagicMock(path=tmp_path)
    )
    new_uuid = str(uuid.uuid4())
    mocker.patch("tethysapp.tethysdash.controllers.uuid").uuid4.return_value = new_uuid
    (tmp_path / dashboard.uuid).mkdir()
    (tmp_path / dashboard.uuid / "layer.json").write_text(json.dumps({"ok": True}))

    client.force_login(test_admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:copy_dashboard"),
        json.dumps({"id": dashboard.id, "newName": "copied"}),
    )

    assert response.json()["success"] is True
    assert json.loads((tmp_path / new_uuid / "layer.json").read_text()) == {"ok": True}
    assert (tmp_path / dashboard.uuid / "layer.json").exists()


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
    expected_result = {
        "description": dashboard.description,
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": "/media/tethysdash/app/123e4567-e89b-12d3-a456-426614174001.png",
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
def test_copy_dashboard_succeeds_when_the_thumbnail_copy_fails(
    client, test_admin_user, dashboard, db_session, mock_app_get_ps_db, mocker
):
    """The copy is already committed, so a storage error must not report it failed."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mocker.patch(
        "tethysapp.tethysdash.controllers.copy_thumbnail",
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


@pytest.mark.django_db
def test_upload_json(client, admin_user, mock_app, mocker, tmp_path, dashboard_data):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "data": json.dumps({"some": "data"}),
        "filename": "some_filename.json",
        "dashboard_uuid": dashboard_data["uuid"],
    }

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert os.path.exists(
        os.path.join(workspace_path, dashboard_data["uuid"], itemData["filename"])
    )

    assert response.status_code == 200
    assert response.json()["success"]


@pytest.mark.django_db
def test_upload_json_failed(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
    mockMKDir = mocker.patch("os.mkdir")
    mockMKDir.side_effect = [Exception("failed to make directory")]

    itemData = {
        "data": json.dumps({"some": "data"}),
        "filename": "some_filename.json",
        "dashboard_uuid": dashboard_data["uuid"],
    }

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to make directory"


@pytest.mark.django_db
def test_upload_json_failed_unknown_exception(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
    mockMKDir = mocker.patch("os.mkdir")
    mockMKDir.side_effect = [Exception()]

    itemData = {
        "data": json.dumps({"some": "data"}),
        "filename": "some_filename.json",
        "dashboard_uuid": dashboard_data["uuid"],
    }

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "Failed to upload the json. Check server for logs."
    )


@pytest.mark.django_db
def test_download_json(client, admin_user, mock_app, mocker, tmp_path, dashboard_data):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "filename": "some_filename.json",
        "dashboard_uuid": dashboard_data["uuid"],
    }

    os.makedirs(os.path.join(workspace_path, dashboard_data["uuid"]), exist_ok=True)
    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/valid_geojson.geojson",
        ),
        os.path.join(workspace_path, dashboard_data["uuid"], itemData["filename"]),
    )

    url = reverse("tethysdash:download_json")
    client.force_login(admin_user)

    response = client.get(url, itemData)

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
def test_download_json_failed(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "filename": "some_filename.json",
        "dashboard_uuid": dashboard_data["uuid"],
    }

    os.makedirs(os.path.join(workspace_path, dashboard_data["uuid"]), exist_ok=True)
    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/valid_geojson.geojson",
        ),
        os.path.join(workspace_path, dashboard_data["uuid"], itemData["filename"]),
    )

    url = reverse("tethysdash:download_json")
    client.force_login(admin_user)
    mockJsonLoad = mocker.patch("json.load")
    mockJsonLoad.side_effect = [Exception("failed to load json")]

    response = client.get(url, itemData)

    assert response.status_code == 200
    assert response.json()["success"] is False
    # Every download failure reports the same message, whatever its cause.
    assert response.json()["message"] == "Invalid file path."


@pytest.mark.django_db
def test_download_json_failed_unknown_exception(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "filename": "some_filename.json",
        "dashboard_uuid": dashboard_data["uuid"],
    }

    os.makedirs(os.path.join(workspace_path, dashboard_data["uuid"]), exist_ok=True)
    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/valid_geojson.geojson",
        ),
        os.path.join(workspace_path, dashboard_data["uuid"], itemData["filename"]),
    )

    url = reverse("tethysdash:download_json")
    client.force_login(admin_user)
    mockJsonLoad = mocker.patch("json.load")
    mockJsonLoad.side_effect = [Exception()]

    response = client.get(url, itemData)

    assert response.status_code == 200
    assert response.json()["success"] is False
    # Every download failure reports the same message, whatever its cause.
    assert response.json()["message"] == "Invalid file path."


def _json_workspace(mocker, tmp_path):
    """Point the json endpoints at a throwaway workspace and return its path.

    The workspace is a subdirectory of tmp_path so that escape targets can live
    outside it while staying inside this test's own directory.
    """
    workspace_path = tmp_path / "workspace"
    workspace_path.mkdir()
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)
    return workspace_path


@pytest.mark.django_db
@pytest.mark.parametrize(
    "filename",
    ["../../outside.json", "subdir/../../../outside.json", None],
    ids=["relative_traversal", "traversal_through_subdir", "absolute_path"],
)
def test_download_json_rejects_filename_escaping_dashboard_folder(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data, filename
):
    """A filename resolving outside its dashboard folder is refused.

    Each case names a real, parseable file, so the refusal comes from the path
    check rather than from a missing file.
    """
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)
    outside_file = tmp_path / "outside.json"
    outside_file.write_text(json.dumps({"outside": True}))

    url = reverse("tethysdash:download_json")
    client.force_login(admin_user)

    response = client.get(
        url,
        {
            "filename": filename or str(outside_file),
            "dashboard_uuid": dashboard_data["uuid"],
        },
    )

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
def test_download_json_rejects_traversal_in_dashboard_uuid(
    client, admin_user, mock_app, mocker, tmp_path
):
    """The dashboard uuid is checked as well as the filename."""
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)
    (tmp_path / "outside.json").write_text(json.dumps({"outside": True}))

    url = reverse("tethysdash:download_json")
    client.force_login(admin_user)

    response = client.get(url, {"filename": "outside.json", "dashboard_uuid": ".."})

    assert response.status_code == 200
    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
def test_download_json_refusal_is_the_same_whether_or_not_the_file_exists(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    """A refused path answers the same whether or not the file exists."""
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)

    present = tmp_path / "present.json"
    present.write_text(json.dumps({"here": True}))

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
    "escape_style",
    ["relative", "absolute"],
)
def test_upload_json_rejects_filename_escaping_dashboard_folder(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data, escape_style
):
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    escaped = tmp_path / "escaped.json"
    filename = "../../escaped.json" if escape_style == "relative" else str(escaped)

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        url,
        json.dumps(
            {
                "data": json.dumps({"some": "data"}),
                "filename": filename,
                "dashboard_uuid": dashboard_data["uuid"],
            }
        ),
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."
    assert not escaped.exists()
    assert not os.path.exists(os.path.join(workspace_path, "escaped.json"))


@pytest.mark.django_db
def test_upload_json_refusal_creates_no_dashboard_directory(
    client, admin_user, mock_app, mocker, tmp_path
):
    """The containment check runs before the folder is created, so a refused
    upload leaves nothing behind."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    unseen_uuid = "11111111-2222-3333-4444-555555555555"

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        url,
        json.dumps(
            {
                "data": json.dumps({"some": "data"}),
                "filename": "../../escaped.json",
                "dashboard_uuid": unseen_uuid,
            }
        ),
    )

    assert response.json()["success"] is False
    assert not os.path.exists(os.path.join(workspace_path, unseen_uuid))


@pytest.mark.django_db
def test_json_round_trip_accepts_dotted_filenames(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    """The check constrains escape, not punctuation — dots in a name are fine."""
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)
    filename = "chart.v2.data.json"

    client.force_login(admin_user)

    upload = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"round": "trip"}),
                "filename": filename,
                "dashboard_uuid": dashboard_data["uuid"],
            }
        ),
    )
    assert upload.json()["success"] is True

    download = client.get(
        reverse("tethysdash:download_json"),
        {"filename": filename, "dashboard_uuid": dashboard_data["uuid"]},
    )
    assert download.json()["success"] is True
    assert download.json()["data"] == {"round": "trip"}


@pytest.mark.django_db
def test_download_json_refuses_an_outside_file_when_signed_out(
    client, mock_app, mocker, tmp_path, dashboard_data
):
    """download_json takes no login, so the path check is exercised signed out too."""
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)
    outside_file = tmp_path / "outside.json"
    outside_file.write_text(json.dumps({"outside": True}))

    response = client.get(
        reverse("tethysdash:download_json"),
        {
            "filename": "../../outside.json",
            "dashboard_uuid": dashboard_data["uuid"],
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert "outside" not in json.dumps(response.json())


@pytest.mark.django_db
@pytest.mark.parametrize("open_portal", [False, True])
def test_download_json_serves_a_signed_out_viewer(
    client, mock_app, mocker, tmp_path, dashboard_data, open_portal
):
    """Public dashboards load their layer files for signed-out viewers, so this
    endpoint stays open to them and does not take require_login."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    (workspace_path / dashboard_data["uuid"]).mkdir()
    (workspace_path / dashboard_data["uuid"] / "layer.json").write_text(
        json.dumps({"ok": True})
    )

    with override_settings(ENABLE_OPEN_PORTAL=open_portal):
        response = client.get(
            reverse("tethysdash:download_json"),
            {"filename": "layer.json", "dashboard_uuid": dashboard_data["uuid"]},
        )

    assert response.json() == {"success": True, "data": {"ok": True}}


@pytest.mark.django_db
def test_upload_json_refuses_a_uuid_nested_in_another_dashboard_folder(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    """A dashboard_uuid naming a folder inside another dashboard's folder is
    refused, and nothing is created there."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    existing_folder = workspace_path / dashboard_data["uuid"]
    existing_folder.mkdir()
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"a": 1}),
                "filename": "a.json",
                "dashboard_uuid": f"{dashboard_data['uuid']}/sub",
            }
        ),
    )

    assert response.json() == {"success": False, "message": "Invalid file path."}
    assert not any(existing_folder.iterdir())


@pytest.mark.django_db
def test_download_json_refuses_a_plugin_folder_in_the_shared_workspace(
    client, mock_app, mocker, tmp_path
):
    """Plugins keep their own folders in the app workspace; a dashboard_uuid that
    is not a uuid must not reach them."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    (workspace_path / "geoglows_plots_cache").mkdir()
    (workspace_path / "geoglows_plots_cache" / "cached.json").write_text(
        json.dumps({"outside": True})
    )

    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "cached.json", "dashboard_uuid": "geoglows_plots_cache"},
    )

    assert response.json() == {"success": False, "message": "Invalid file path."}


@pytest.mark.django_db
@pytest.mark.parametrize("dashboard_uuid", ["", ".", "uuid/.."])
def test_upload_json_rejects_uuid_resolving_to_the_workspace_root(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_uuid
):
    """Guards the equality clause, which is_relative_to cannot cover.

    A path is relative to itself, so without the clause an empty or dot-only
    uuid writes straight into the shared workspace root. Asserted on the
    filesystem rather than the message: refusal and a missing file report the
    same string by design, so only the effect distinguishes them.
    """
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"some": "data"}),
                "filename": "escaped.json",
                "dashboard_uuid": dashboard_uuid,
            }
        ),
    )

    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."
    assert not (workspace_path / "escaped.json").exists()


@pytest.mark.django_db
@pytest.mark.parametrize("filename", ["", ".", ".."])
def test_upload_json_rejects_filename_resolving_to_the_folder_itself(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data, filename
):
    """The other equality clause.

    Asserted by the absence of the dashboard folder: the guard runs before
    mkdir, so a weakened check would leave the directory behind even though
    the write itself still fails.
    """
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"some": "data"}),
                "filename": filename,
                "dashboard_uuid": dashboard_data["uuid"],
            }
        ),
    )

    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."
    assert not (workspace_path / dashboard_data["uuid"]).exists()


@pytest.mark.django_db
@pytest.mark.parametrize("link_style", ["file", "directory"])
def test_download_json_rejects_symlink_pointing_out_of_the_folder(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data, link_style
):
    """A symlink inside the folder that points outside it is refused.

    Pins the resolve() in the containment helper: a check on the unresolved
    path would pass here.
    """
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    dashboard_folder = workspace_path / dashboard_data["uuid"]
    dashboard_folder.mkdir()

    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "outside.json").write_text(json.dumps({"outside": True}))

    if link_style == "file":
        os.symlink(outside / "outside.json", dashboard_folder / "link.json")
        filename = "link.json"
    else:
        os.symlink(outside, dashboard_folder / "linkdir")
        filename = "linkdir/outside.json"

    client.force_login(admin_user)
    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": filename, "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."
    assert "outside" not in json.dumps(response.json())


@pytest.mark.django_db
def test_download_json_missing_file_answers_like_a_refused_path(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    """A missing file and a refused path give the same answer."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    (workspace_path / dashboard_data["uuid"]).mkdir()
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
def test_upload_json_rejects_traversal_in_dashboard_uuid(
    client, admin_user, mock_app, mocker, tmp_path
):
    """Upload checks the dashboard uuid as well as the filename."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"some": "data"}),
                "filename": "escaped.json",
                "dashboard_uuid": "../../",
            }
        ),
    )

    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."
    assert not (tmp_path.parent / "escaped.json").exists()
    assert not (workspace_path / "escaped.json").exists()


@pytest.mark.django_db
@pytest.mark.parametrize("bad_uuid", ["../outside", "..", "a/b", "not-a-uuid"])
def test_add_dashboard_rejects_a_uuid_that_is_not_a_uuid(
    client, mock_app, db_session, test_admin_user, mock_app_get_ps_db, bad_uuid
):
    """A dashboard uuid names a folder in the workspace, so anything but a UUID
    is refused."""
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")

    client.force_login(test_admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:add_dashboard"),
        json.dumps({"name": "traversal", "uuid": bad_uuid, "gridItems": []}),
    )

    assert response.json()["success"] is False
    assert response.json()["message"] == "The dashboard uuid must be a UUID."
    assert (
        db_session.query(Dashboard).filter(Dashboard.name == "traversal").first()
        is None
    )


@pytest.mark.django_db
def test_add_dashboard_accepts_and_stores_a_caller_supplied_uuid(
    client, mock_app, db_session, test_admin_user, mock_app_get_ps_db
):
    """The import flow mints its own uuid, uploads that dashboard's files under
    it, and only then creates the dashboard -- so rejecting a well-formed
    caller-supplied uuid would orphan those files and break import."""
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    supplied_uuid = "7f3d9c12-4b6e-4a91-8c2d-1e5f7a9b3c4d"

    client.force_login(test_admin_user)
    response = client.generic(
        "POST",
        reverse("tethysdash:add_dashboard"),
        json.dumps({"name": "imported", "uuid": supplied_uuid, "gridItems": []}),
    )

    assert response.json()["success"] is True
    stored = db_session.query(Dashboard).filter(Dashboard.name == "imported").first()
    assert stored is not None
    assert stored.uuid == supplied_uuid


@pytest.mark.django_db
def test_add_dashboard_duplicate_uuid_reports_a_fixed_message(
    client, mock_app, db_session, test_admin_user, mock_app_get_ps_db
):
    """Database errors are reported with a fixed message, not the driver's text."""
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    supplied_uuid = "7f3d9c12-4b6e-4a91-8c2d-1e5f7a9b3c4d"
    body = json.dumps({"name": "imported", "uuid": supplied_uuid, "gridItems": []})

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
        db_session.query(Dashboard).filter(Dashboard.uuid == supplied_uuid).count() == 1
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
        db_session.query(PermissionGroup).count(),
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
    workspace_path = _json_workspace(mocker, tmp_path)
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
    assert not any(workspace_path.iterdir())


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
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data, missing_key
):
    """A missing parameter gets the standard failure payload, not a 500."""
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    params = {"filename": "a.json", "dashboard_uuid": dashboard_data["uuid"]}
    del params[missing_key]

    response = client.get(reverse("tethysdash:download_json"), params)

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "Invalid file path."


@pytest.mark.django_db
@pytest.mark.parametrize("missing_key", ["data", "filename", "dashboard_uuid"])
def test_upload_json_missing_key_returns_the_failure_shape(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data, missing_key
):
    mock_app("tethysapp.tethysdash.app.App")
    _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    body = {
        "data": json.dumps({"a": 1}),
        "filename": "a.json",
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
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    """Sanitizing the serialized text left a link's href with bare quotes and an
    unclosed tag's closer after the final brace, so a GeoJSON whose properties held
    a link could not be stored at all. Each value is now cleaned on its own."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)
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
                "filename": "layer.json",
                "dashboard_uuid": dashboard_data["uuid"],
            }
        ),
    )
    download = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "layer.json", "dashboard_uuid": dashboard_data["uuid"]},
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
    stored = workspace_path / dashboard_data["uuid"] / "layer.json"
    assert json.loads(stored.read_text()) == expected
    assert download.json() == {"success": True, "data": expected}


@pytest.mark.django_db
def test_upload_json_refuses_content_that_is_not_json(
    client, admin_user, mock_app, mocker, tmp_path, dashboard_data
):
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": "{not json",
                "filename": "layer.json",
                "dashboard_uuid": dashboard_data["uuid"],
            }
        ),
    )

    assert response.json() == {
        "success": False,
        "message": "The uploaded content is not valid JSON.",
    }
    assert not (workspace_path / dashboard_data["uuid"]).exists()


@pytest.mark.django_db
def test_download_json_sanitizes_a_stored_file(
    client, mock_app, mocker, tmp_path, dashboard_data
):
    """A file can reach the folder without passing through upload -- the legacy
    migration and dashboard copy write files directly -- so reads clean it too."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    (workspace_path / dashboard_data["uuid"]).mkdir()
    (workspace_path / dashboard_data["uuid"] / "layer.json").write_text(
        json.dumps({"name": "<img src=x onerror=alert(1)>"})
    )

    response = client.get(
        reverse("tethysdash:download_json"),
        {"filename": "layer.json", "dashboard_uuid": dashboard_data["uuid"]},
    )

    assert response.json() == {"success": True, "data": {"name": '<img src="x">'}}


@pytest.mark.django_db
def test_upload_json_rejects_a_null_identifier_rather_than_writing_to_None(
    client, admin_user, mock_app, mocker, tmp_path
):
    """Coercing a non-string identifier would resolve to a literal folder named
    'None' and report success, turning a loud failure into a silent one."""
    mock_app("tethysapp.tethysdash.app.App")
    workspace_path = _json_workspace(mocker, tmp_path)
    client.force_login(admin_user)

    response = client.generic(
        "POST",
        reverse("tethysdash:upload_json"),
        json.dumps(
            {
                "data": json.dumps({"a": 1}),
                "filename": None,
                "dashboard_uuid": None,
            }
        ),
    )

    assert response.json()["success"] is False
    assert not (workspace_path / "None").exists()


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
