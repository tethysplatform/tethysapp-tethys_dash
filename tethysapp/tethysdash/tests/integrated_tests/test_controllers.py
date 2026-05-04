import pytest
import json
from django.urls import reverse
from tethysapp.tethysdash.model import Dashboard, Message
from unittest.mock import MagicMock
import os
import shutil
from django.conf import settings
from django.test import override_settings
from datetime import datetime, timedelta
import types
from tethysapp.tethysdash.exceptions import VisualizationError
import uuid
from tethysapp.tethysdash.controllers import VisualizationConsumer
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    mocker,
    tmp_path,
    permission_group,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)

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
            "image": "/static/tethysdash/images/default_dashboard.png",
            "unrestrictedPlacement": dashboard.unrestricted_placement,
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
def test_get_dashboard_failed(
    client, admin_user, mock_app_get_ps_db, dashboard, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    app_media_path = tmp_path
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)

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
    app_media_path = tmp_path
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)

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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
        "image": "/media/tethysdash/app/123e4567-e89b-12d3-a456-426614174000.png",
        "uuid": "123e4567-e89b-12d3-a456-426614174000",
        "unrestrictedPlacement": False,
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
        False,
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
        False,
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

    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/thumbnail.png",
        ),
        os.path.join(app_media_path, "some_user_dashboard_uuid.png"),
    )

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(test_owner_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]

    assert (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).first() is None
    )

    assert not os.path.exists(
        os.path.join(app_media_path, "some_user_dashboard_uuid.png")
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
    mocker,
    tmp_path,
    permission_group,
):
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
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
        "image": "/static/tethysdash/images/default_dashboard.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": dashboard.unrestricted_placement,
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
    admin_user,
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]
    new_dashboard = response.json()["new_dashboard"]
    expected_result = {
        "description": dashboard.description,
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": "/static/tethysdash/images/default_dashboard.png",
        "uuid": dashboard_uuid,
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "owner": admin_user.username,
        "permissions": [{"permission": "admin", "username": admin_user.username}],
        "publicDashboard": dashboard.public,
        "userPermission": "admin",
    }
    assert response.json()["new_dashboard"] == expected_result

    added_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard["id"]).first()
    )
    assert added_dashboard is not None


@pytest.mark.django_db
def test_copy_dashboard_with_thumbnail(
    client,
    admin_user,
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
    mock_get_app_media2 = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media2.return_value = MagicMock(path=app_media_path)
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174001"

    itemData = {
        "id": dashboard.id,
        "newName": "some_new_dashboard_name",
    }

    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/thumbnail.png",
        ),
        os.path.join(app_media_path, "some_user_dashboard_uuid.png"),
    )

    url = reverse("tethysdash:copy_dashboard")
    client.force_login(admin_user)

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
        "owner": admin_user.username,
        "permissions": [{"permission": "admin", "username": admin_user.username}],
        "publicDashboard": dashboard.public,
        "userPermission": "admin",
    }
    assert response.json()["new_dashboard"] == expected_result

    added_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard["id"]).first()
    )
    assert added_dashboard is not None


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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)
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
    assert response.json()["message"] == "failed to load json"


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
    assert (
        response.json()["message"]
        == "Failed to download the json. Check server for logs."
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

    # Patch only cache.get and cache.ttl
    mock_cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    mock_cache.get.return_value = 5  # Simulate count > 0 and < 5
    mock_cache.ttl.return_value = 7  # Simulate ttl returning 7

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


@pytest.mark.django_db
@pytest.mark.asyncio
async def test_visualization_consumer_receive_rate_limit_ttl_None(
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

    # Patch only cache.get and cache.ttl
    mock_cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    mock_cache.get.return_value = 5  # Simulate count > 0 and < 5
    mock_cache.ttl.return_value = None  # Simulate ttl returning None

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
            "error": "Rate limit exceeded. Please wait 10 seconds before sending more messages.",  # noqa: E501
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
async def test_visualization_consumer_receive_rate_limit_ttl_exception(
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

    # Patch only cache.get and cache.ttl
    mock_cache = mocker.patch("tethysapp.tethysdash.controllers.cache")
    mock_cache.get.return_value = 5  # Simulate count > 0 and < 5
    mock_cache.ttl.side_effect = Exception("TTL error")

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
            "error": "Rate limit exceeded. Please wait 10 seconds before sending more messages.",  # noqa: E501
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
