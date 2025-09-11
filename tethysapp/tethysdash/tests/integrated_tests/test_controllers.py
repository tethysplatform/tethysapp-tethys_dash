import pytest
import json
from django.urls import reverse
from tethysapp.tethysdash.model import Dashboard
from unittest.mock import MagicMock
import os
import shutil
from django.conf import settings
from django.test import override_settings
from datetime import datetime, timedelta
import types
from tethysapp.tethysdash.exceptions import VisualizationError
import uuid


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
    url = reverse("tethysdash:data")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = [Exception("Failed data retrieval")]

    itemData = {
        "source": "usace_time_series",
        "args": json.dumps({"location": "CREC1", "year": 2025}),
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
    url = reverse("tethysdash:data")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    mock_gv.side_effect = [VisualizationError("some custom error message")]

    itemData = {
        "source": "usace_time_series",
        "args": json.dumps({"location": "CREC1", "year": 2025}),
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
    url = reverse("tethysdash:data")
    mock_gv = mocker.patch("tethysapp.tethysdash.controllers.get_visualization")
    plot_data = {"data": [], "layout": {}}
    mock_gv.return_value = ["plotly", plot_data]

    itemData = {
        "source": "usace_time_series",
        "args": json.dumps({"location": "CREC1", "year": 2025}),
    }

    response = client.get(url, itemData)

    mock_gv.assert_called_once()
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["data"] == plot_data
    assert response.json()["viz_type"] == "plotly"


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
    admin_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
    permission_group,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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

    url = reverse("tethysdash:dashboards")
    client.force_login(admin_user)
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
        {"permission": "admin", "username": dashboard.owner},
        {"permission": "editor", "username": "editor"},
        {"permission": "viewer", "group": permission_group["name"]},
    ]
    assert len(response_json["permission_groups"]) == 0


@pytest.mark.django_db
def test_get_dashboard(
    client,
    admin_user,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
    permission_group,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    app_media_path = tmp_path
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=app_media_path)

    url = reverse("tethysdash:get_dashboard")
    client.force_login(admin_user)

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
            "gridItems": [],
            "uuid": dashboard.uuid,
            "notes": "some notes",
            "image": "/static/tethysdash/images/dashboard_thumbnail.png",
            "unrestrictedPlacement": dashboard.unrestricted_placement,
            "owner": dashboard.owner,
            "permissions": [
                {"permission": "admin", "username": dashboard.owner},
                {"permission": "editor", "username": "editor"},
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
        "admin", id=str(itemData["id"]), dashboard_view=True
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to add"


@pytest.mark.django_db
def test_get_dashboard_failed_unknown_exception(
    client, admin_user, mock_app_get_ps_db, dashboard, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
        "admin", id=str(itemData["id"]), dashboard_view=True
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == "Failed to get the dashboard. Check server for logs."
    )


@pytest.mark.django_db
def test_add_dashboard(
    client, admin_user, mock_app, db_session, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]
    new_dashboard = response.json()["new_dashboard"]
    expected_result = {
        "description": "description",
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": "/media/app_root/app/123e4567-e89b-12d3-a456-426614174000.png",
        "uuid": "123e4567-e89b-12d3-a456-426614174000",
        "unrestrictedPlacement": False,
        "owner": "admin",
        "permissions": [{"permission": "admin", "username": "admin"}],
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
        "admin",
        "123e4567-e89b-12d3-a456-426614174000",
        itemData["name"],
        itemData["description"],
        "",
        False,
        False,
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
        "admin",
        "123e4567-e89b-12d3-a456-426614174000",
        itemData["name"],
        itemData["description"],
        "",
        False,
        False,
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
    admin_user,
    mock_app,
    db_session,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethys_apps.base.paths.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    itemData = {
        "id": dashboard.id,
    }

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(admin_user)

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
    admin_user,
    mock_app,
    db_session,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    client.force_login(admin_user)

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

    mock_delete_named_dashboard.assert_called_with("admin", itemData["id"])
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

    mock_delete_named_dashboard.assert_called_with("admin", itemData["id"])
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to delete the dashboard {itemData["id"]}. Check server for logs."  # noqa: E501
    )


@pytest.mark.django_db
def test_update_dashboard(
    client,
    admin_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    mocker,
    tmp_path,
    permission_group,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    itemData = {
        "id": dashboard.id,
        "name": "new_dashboard_name",
    }

    url = reverse("tethysdash:update_dashboard")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))
    expected_dashboard = {
        "description": dashboard.description,
        "gridItems": dashboard.grid_items,
        "id": dashboard.id,
        "name": "new_dashboard_name",
        "notes": dashboard.notes,
        "image": "/static/tethysdash/images/dashboard_thumbnail.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "owner": dashboard.owner,
        "permissions": [
            {"permission": "admin", "username": dashboard.owner},
            {"permission": "editor", "username": "editor"},
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
        "admin",
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
        "admin",
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
        "image": "/static/tethysdash/images/dashboard_thumbnail.png",
        "uuid": dashboard_uuid,
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "owner": dashboard.owner,
        "permissions": [{"permission": "admin", "username": dashboard.owner}],
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
        "image": "/media/app_root/app/123e4567-e89b-12d3-a456-426614174001.png",
        "uuid": "123e4567-e89b-12d3-a456-426614174001",
        "unrestrictedPlacement": dashboard.unrestricted_placement,
        "owner": dashboard.owner,
        "permissions": [{"permission": "admin", "username": dashboard.owner}],
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
        "admin",
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
        "admin",
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
def test_upload_json(
    client,
    admin_user,
    mock_app,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "data": json.dumps({"some": "data"}),
        "filename": "some_filename.json",
    }

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"]

    assert os.path.exists(
        os.path.join(workspace_path, "json", "admin", itemData["filename"])
    )
    assert os.path.exists(os.path.join(workspace_path, "json", itemData["filename"]))


@pytest.mark.django_db
def test_upload_json_failed(
    client,
    admin_user,
    mock_app,
    mocker,
    tmp_path,
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
    }

    url = reverse("tethysdash:upload_json")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))

    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to make directory"


@pytest.mark.django_db
def test_upload_json_failed_unknown_exception(
    client,
    admin_user,
    mock_app,
    mocker,
    tmp_path,
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
def test_download_json(
    client,
    admin_user,
    mock_app,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "filename": "some_filename.json",
    }

    os.makedirs(os.path.join(workspace_path, "json"), exist_ok=True)
    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/valid_geojson.geojson",
        ),
        os.path.join(workspace_path, "json", itemData["filename"]),
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
    client,
    admin_user,
    mock_app,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "filename": "some_filename.json",
    }

    os.makedirs(os.path.join(workspace_path, "json"), exist_ok=True)
    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/valid_geojson.geojson",
        ),
        os.path.join(workspace_path, "json", itemData["filename"]),
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
    client,
    admin_user,
    mock_app,
    mocker,
    tmp_path,
):
    mock_app("tethysapp.tethysdash.app.App")
    mock_get_app_workspace = mocker.patch("tethys_apps.base.paths.get_app_workspace")
    workspace_path = tmp_path
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    itemData = {
        "filename": "some_filename.json",
    }

    os.makedirs(os.path.join(workspace_path, "json"), exist_ok=True)
    shutil.copyfile(
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "files/valid_geojson.geojson",
        ),
        os.path.join(workspace_path, "json", itemData["filename"]),
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
        == "Failed to upload the json. Check server for logs."
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
    mock_app,
    mock_app_get_ps_db,
    permission_group,
    permission_group_table,
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    url = reverse("tethysdash:update_permission_group")
    client.force_login(test_admin_user)

    new_members = [
        {
            "username": test_admin_user.username,
            "permission": "admin",
        },
        {
            "username": "jsmith",
            "permission": "member",
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    url = reverse("tethysdash:update_permission_group")
    client.force_login(test_admin_user)

    response = client.generic("POST", url, json.dumps(permission_group))

    assert response.status_code == 200

    response_json = response.json()
    permission_group["id"] = response_json["updated_permission_group"]["id"]
    permission_group["owner"] = test_admin_user.username
    assert response_json == {
        "updated_permission_group": permission_group,
        "success": True,
    }


@pytest.mark.django_db
def test_create_permission_group_error(
    client, admin_user, mock_app, mock_app_get_ps_db, permission_group, mocker
):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
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
