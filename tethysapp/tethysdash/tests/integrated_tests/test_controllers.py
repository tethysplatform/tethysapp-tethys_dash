import pytest
import json
from django.urls import reverse


@pytest.mark.django_db
def test_home_not_logged_in(client):
    url = reverse("tethysdash:home")
    response = client.get(url)
    assert response.status_code == 302


@pytest.mark.django_db
def test_home_logged_in(client, admin_user, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:home")
    client.force_login(admin_user)
    response = client.get(url)

    assert response.status_code == 200


@pytest.mark.django_db
def test_data_not_logged_in(client, mock_app):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:data")
    response = client.get(url)

    assert response.status_code == 302


@pytest.mark.django_db
def test_data_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:data")
    client.force_login(admin_user)
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
def test_data(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:data")
    client.force_login(admin_user)
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
def test_dashboards(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    url = reverse("tethysdash:dashboards")
    client.force_login(admin_user)
    mock_get_dashboards = mocker.patch(
        "tethysapp.tethysdash.controllers.get_dashboards"
    )
    mock_get_dashboards_return = {"dashboard_name": {"id": 1}}
    mock_get_dashboards.return_value = mock_get_dashboards_return

    response = client.get(url)

    mock_get_dashboards.assert_called_with("admin")
    assert response.status_code == 200
    assert response.json() == mock_get_dashboards_return


@pytest.mark.django_db
def test_add_dashboard(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
    }

    url = reverse("tethysdash:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.add_new_dashboard"
    )
    mock_get_dashboards = mocker.patch(
        "tethysapp.tethysdash.controllers.get_dashboards"
    )
    mock_get_dashboards_return = {itemData["name"]: {"id": 1}}
    mock_get_dashboards.return_value = mock_get_dashboards_return

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        itemData["label"], itemData["name"], itemData["notes"], "admin", [], []
    )
    mock_get_dashboards.assert_called_with("admin", name=itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"]
    assert (
        response.json()["new_dashboard"] == mock_get_dashboards_return[itemData["name"]]
    )


@pytest.mark.django_db
def test_add_dashboard_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
    }

    url = reverse("tethysdash:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.add_new_dashboard"
    )
    mock_add_new_dashboard.side_effect = [Exception("failed to add")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        itemData["label"], itemData["name"], itemData["notes"], "admin", [], []
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to add"


@pytest.mark.django_db
def test_add_dashboard_failed_unknown_exception(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
    }

    url = reverse("tethysdash:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.add_new_dashboard"
    )
    mock_add_new_dashboard.side_effect = [Exception()]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        itemData["label"], itemData["name"], itemData["notes"], "admin", [], []
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to create the dashboard named {itemData["name"]}. Check server for logs."  # noqa: E501
    )


@pytest.mark.django_db
def test_delete_dashboard(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "name": "dashboard_name",
    }

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(admin_user)
    mock_delete_named_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_named_dashboard"
    )

    response = client.generic("POST", url, json.dumps(itemData))

    mock_delete_named_dashboard.assert_called_with("admin", itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"]


@pytest.mark.django_db
def test_delete_dashboard_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")
    itemData = {
        "name": "dashboard_name",
    }

    url = reverse("tethysdash:delete_dashboard")
    client.force_login(admin_user)
    mock_delete_named_dashboard = mocker.patch(
        "tethysapp.tethysdash.controllers.delete_named_dashboard"
    )
    mock_delete_named_dashboard.side_effect = [Exception("failed to delete")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_delete_named_dashboard.assert_called_with("admin", itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert response.json()["message"] == "failed to delete"


@pytest.mark.django_db
def test_delete_dashboard_failed_unknown_exception(
    client, admin_user, mock_app, mocker
):
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

    mock_delete_named_dashboard.assert_called_with("admin", itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"] is False
    assert (
        response.json()["message"]
        == f"Failed to delete the dashboard named {itemData["name"]}. Check server for logs."  # noqa: E501
    )


@pytest.mark.django_db
def test_update_dashboard(client, admin_user, mock_app, mock_app_get_ps_db, dashboard):
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    itemData = {
        "id": dashboard.id,
        "name": "new_dashboard_name",
    }

    url = reverse("tethysdash:update_dashboard")
    client.force_login(admin_user)

    response = client.generic("POST", url, json.dumps(itemData))
    expected_dashboard = {
        'accessGroups': dashboard.access_groups,
        'description': dashboard.description,
        'gridItems': dashboard.grid_items,
        'id': dashboard.id,
        'name': 'new_dashboard_name',
        "notes": dashboard.notes,
    }
    
    assert response.status_code == 200
    assert response.json()["success"]
    assert (
        response.json()["updated_dashboard"]
        == expected_dashboard
    )


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
