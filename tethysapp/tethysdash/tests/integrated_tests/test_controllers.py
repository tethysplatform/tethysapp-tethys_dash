import pytest
import json
from django.urls import reverse
from tethysapp.tethysdash.model import Dashboard
from unittest.mock import MagicMock
import os
import shutil


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
    assert response.json()["data"] is None
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
    client, admin_user, mock_app, mock_app_get_ps_db, dashboard, mocker, tmp_path
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
    assert response.json() == {
        "user": [
            {
                "accessGroups": dashboard.access_groups,
                "description": dashboard.description,
                "id": dashboard.id,
                "name": dashboard.name,
                "uuid": dashboard.uuid,
                "image": "/static/tethysdash/images/tethys_dash.png",
                "unrestrictedPlacement": False,
            }
        ],
        "public": [],
    }


@pytest.mark.django_db
def test_get_dashboard(
    client, admin_user, mock_app_get_ps_db, dashboard, mocker, tmp_path
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
            "accessGroups": dashboard.access_groups,
            "description": dashboard.description,
            "id": dashboard.id,
            "name": dashboard.name,
            "gridItems": [],
            "uuid": dashboard.uuid,
            "notes": "some notes",
            "image": "/static/tethysdash/images/tethys_dash.png",
            "unrestrictedPlacement": False,
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
        "accessGroups": [],
        "description": "description",
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": "/media/app_root/app/123e4567-e89b-12d3-a456-426614174000.png",
        "uuid": "123e4567-e89b-12d3-a456-426614174000",
        "unrestrictedPlacement": False,
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
        [],
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
        [],
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
    client, admin_user, mock_app, mock_app_get_ps_db, dashboard, mocker, tmp_path
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
        "accessGroups": dashboard.access_groups,
        "description": dashboard.description,
        "gridItems": dashboard.grid_items,
        "id": dashboard.id,
        "name": "new_dashboard_name",
        "notes": dashboard.notes,
        "image": "/static/tethysdash/images/tethys_dash.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
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
    mock_uuid = mocker.patch("tethysapp.tethysdash.controllers.uuid")
    mock_uuid.uuid4.return_value = "123e4567-e89b-12d3-a456-426614174000"

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
        "accessGroups": [],
        "description": "test_dashboard",
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": "/static/tethysdash/images/tethys_dash.png",
        "uuid": "123e4567-e89b-12d3-a456-426614174000",
        "unrestrictedPlacement": False,
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
        "accessGroups": [],
        "description": "test_dashboard",
        "id": new_dashboard["id"],
        "name": "some_new_dashboard_name",
        "image": "/media/app_root/app/123e4567-e89b-12d3-a456-426614174001.png",
        "uuid": "123e4567-e89b-12d3-a456-426614174001",
        "unrestrictedPlacement": False,
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
