import pytest
import json
from django.urls import reverse


@pytest.mark.django_db
def test_home_not_logged_in(client):
    url = reverse("aquainsight:home")
    response = client.get(url)
    assert response.status_code == 302


@pytest.mark.django_db
def test_home_logged_in(client, admin_user, mock_app):
    mock_app("tethysapp.aquainsight.controllers.App")
    url = reverse("aquainsight:home")
    client.force_login(admin_user)
    response = client.get(url)

    assert response.status_code == 200


@pytest.mark.django_db
def test_data_not_logged_in(client, mock_app):
    mock_app("tethysapp.aquainsight.controllers.App")
    url = reverse("aquainsight:data")
    response = client.get(url)

    assert response.status_code == 302


@pytest.mark.django_db
def test_data_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    url = reverse("aquainsight:data")
    client.force_login(admin_user)
    mock_gv = mocker.patch("tethysapp.aquainsight.controllers.get_visualization")
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
    mock_app("tethysapp.aquainsight.controllers.App")
    url = reverse("aquainsight:data")
    client.force_login(admin_user)
    mock_gv = mocker.patch("tethysapp.aquainsight.controllers.get_visualization")
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
    mock_app("tethysapp.aquainsight.controllers.App")
    url = reverse("aquainsight:visualizations")
    client.force_login(admin_user)
    mock_gav = mocker.patch(
        "tethysapp.aquainsight.controllers.get_available_visualizations"
    )
    mock_gav_return = {"visualizations": [mock_plugin_visualization]}
    mock_gav.return_value = mock_gav_return

    response = client.get(url)

    mock_gav.assert_called_once()
    assert response.status_code == 200
    assert response.json() == mock_gav_return


@pytest.mark.django_db
def test_dashboards(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    url = reverse("aquainsight:dashboards")
    client.force_login(admin_user)
    mock_get_dashboards = mocker.patch(
        "tethysapp.aquainsight.controllers.get_dashboards"
    )
    mock_get_dashboards_return = {"dashboard_name": {"id": 1}}
    mock_get_dashboards.return_value = mock_get_dashboards_return

    response = client.get(url)

    mock_get_dashboards.assert_called_with("admin")
    assert response.status_code == 200
    assert response.json() == mock_get_dashboards_return


@pytest.mark.django_db
def test_add_dashboard(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
        "rowData": [],
    }

    url = reverse("aquainsight:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.aquainsight.controllers.add_new_dashboard"
    )
    mock_get_dashboards = mocker.patch(
        "tethysapp.aquainsight.controllers.get_dashboards"
    )
    mock_get_dashboards_return = {itemData["name"]: {"id": 1}}
    mock_get_dashboards.return_value = mock_get_dashboards_return

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        itemData["label"],
        itemData["name"],
        itemData["notes"],
        itemData["rowData"],
        "admin",
        [],
    )
    mock_get_dashboards.assert_called_with("admin", name=itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"]
    assert (
        response.json()["new_dashboard"] == mock_get_dashboards_return[itemData["name"]]
    )


@pytest.mark.django_db
def test_add_dashboard_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
        "rowData": [],
    }

    url = reverse("aquainsight:add_dashboard")
    client.force_login(admin_user)
    mock_add_new_dashboard = mocker.patch(
        "tethysapp.aquainsight.controllers.add_new_dashboard"
    )
    mock_add_new_dashboard.side_effect = [Exception("failed to add")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_add_new_dashboard.assert_called_with(
        itemData["label"],
        itemData["name"],
        itemData["notes"],
        itemData["rowData"],
        "admin",
        [],
    )
    assert response.status_code == 200
    assert response.json()["success"] is False


@pytest.mark.django_db
def test_delete_dashboard(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    itemData = {
        "name": "dashboard_name",
    }

    url = reverse("aquainsight:delete_dashboard")
    client.force_login(admin_user)
    mock_delete_named_dashboard = mocker.patch(
        "tethysapp.aquainsight.controllers.delete_named_dashboard"
    )

    response = client.generic("POST", url, json.dumps(itemData))

    mock_delete_named_dashboard.assert_called_with("admin", itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"]


@pytest.mark.django_db
def test_delete_dashboard_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    itemData = {
        "name": "dashboard_name",
    }

    url = reverse("aquainsight:delete_dashboard")
    client.force_login(admin_user)
    mock_delete_named_dashboard = mocker.patch(
        "tethysapp.aquainsight.controllers.delete_named_dashboard"
    )
    mock_delete_named_dashboard.side_effect = [Exception("failed to delete")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_delete_named_dashboard.assert_called_with("admin", itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"] is False


@pytest.mark.django_db
def test_update_dashboard(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
        "rowData": [],
        "access_groups": [],
    }

    url = reverse("aquainsight:update_dashboard")
    client.force_login(admin_user)
    mock_update_dashboard = mocker.patch(
        "tethysapp.aquainsight.controllers.update_named_dashboard"
    )
    mock_get_dashboards = mocker.patch(
        "tethysapp.aquainsight.controllers.get_dashboards"
    )
    mock_get_dashboards_return = {itemData["name"]: {"id": 1}}
    mock_get_dashboards.return_value = mock_get_dashboards_return

    response = client.generic("POST", url, json.dumps(itemData))

    mock_update_dashboard.assert_called_with(
        "admin",
        itemData["name"],
        itemData["label"],
        itemData["notes"],
        itemData["rowData"],
        itemData["access_groups"],
    )
    mock_get_dashboards.assert_called_with("admin", name=itemData["name"])
    assert response.status_code == 200
    assert response.json()["success"]
    assert (
        response.json()["updated_dashboard"]
        == mock_get_dashboards_return[itemData["name"]]
    )


@pytest.mark.django_db
def test_update_dashboard_failed(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.aquainsight.controllers.App")
    itemData = {
        "name": "dashboard_name",
        "label": "label",
        "notes": "notes",
        "rowData": [],
        "access_groups": [],
    }

    url = reverse("aquainsight:update_dashboard")
    client.force_login(admin_user)
    mock_update_dashboard = mocker.patch(
        "tethysapp.aquainsight.controllers.update_named_dashboard"
    )
    mock_get_dashboards = mocker.patch(
        "tethysapp.aquainsight.controllers.get_dashboards"
    )
    mock_get_dashboards.side_effect = [Exception("failed to update")]

    response = client.generic("POST", url, json.dumps(itemData))

    mock_update_dashboard.assert_called_with(
        "admin",
        itemData["name"],
        itemData["label"],
        itemData["notes"],
        itemData["rowData"],
        itemData["access_groups"],
    )
    assert response.status_code == 200
    assert response.json()["success"] is False
