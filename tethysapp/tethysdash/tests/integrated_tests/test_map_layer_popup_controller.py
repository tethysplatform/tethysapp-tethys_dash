"""Integrated tests for the ``/popups/update/`` controller endpoint and the
dashboard-load hydration of ``layer.popupConfig``.
"""

import json
import pytest
from uuid import uuid4
from unittest.mock import MagicMock
from django.urls import reverse
from django.test import override_settings

from tethysapp.tethysdash.model import (
    DashboardTab,
    GridItem,
    MapLayerPopup,
)


def _make_map_grid_item_with_popup(
    db_session, dashboard, layer_name="Layer A", mode="modal"
):
    """Persist a Map ``GridItem`` plus a popup with two child grid items.

    Returns the parent grid item, the popup, and the two child grid items.
    """
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    map_grid_item = GridItem(
        dashboard_id=dashboard.id,
        tab_id=tab.id,
        uuid=str(uuid4()),
        i="1",
        x=0,
        y=0,
        w=10,
        h=10,
        source="Map",
        args_string=json.dumps({"layers": [{"name": layer_name, "configuration": {}}]}),
        metadata_string=json.dumps({}),
        order=0,
    )
    db_session.add(map_grid_item)
    db_session.commit()
    db_session.refresh(map_grid_item)

    popup = MapLayerPopup(
        grid_item_id=map_grid_item.id,
        layer_name=layer_name,
        mode=mode,
        position_json=json.dumps(
            {"leftPct": 20, "topPct": 25, "widthPct": 60, "heightPct": 50}
        ),
        title_template="Site: ${feature.station_name}",
    )
    db_session.add(popup)
    db_session.commit()
    db_session.refresh(popup)

    children = []
    for index in range(2):
        child = GridItem(
            dashboard_id=dashboard.id,
            tab_id=None,
            popup_id=popup.id,
            uuid=str(uuid4()),
            i=str(index + 1),
            x=index * 4,
            y=0,
            w=4,
            h=4,
            source="Text",
            args_string=json.dumps({"text": f"child {index}"}),
            metadata_string=json.dumps({}),
            order=index,
        )
        db_session.add(child)
        children.append(child)
    db_session.commit()
    for child in children:
        db_session.refresh(child)
    return map_grid_item, popup, children


@pytest.mark.django_db
def test_get_dashboard_hydrates_popup_config_into_map_layer(
    client,
    test_owner_user,
    mock_app_get_ps_db,
    dashboard,
    db_session,
    mocker,
    tmp_path,
):
    """Happy path (GET): a dashboard with one Map GridItem owning a popup
    with two child grid items returns those children hydrated under the
    layer's ``popupConfig.gridItems``."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    map_grid_item, popup, children = _make_map_grid_item_with_popup(
        db_session, dashboard
    )

    url = reverse("tethysdash:get_dashboard")
    client.force_login(test_owner_user)
    response = client.get(url, {"id": dashboard.id})

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"]
    tabs = payload["dashboard"]["tabs"]
    assert len(tabs) == 1
    grid_items = tabs[0]["gridItems"]
    assert len(grid_items) == 1
    args = json.loads(grid_items[0]["args_string"])
    layer = args["layers"][0]
    assert "popupConfig" in layer
    pc = layer["popupConfig"]
    assert pc["mode"] == "modal"
    assert pc["position"] == {
        "leftPct": 20,
        "topPct": 25,
        "widthPct": 60,
        "heightPct": 50,
    }
    assert pc["titleTemplate"] == "Site: ${feature.station_name}"
    assert len(pc["gridItems"]) == 2
    child_uuids = {g["uuid"] for g in pc["gridItems"]}
    assert child_uuids == {child.uuid for child in children}


@pytest.mark.django_db
def test_get_dashboard_does_not_inject_popup_config_when_no_popup(
    client,
    test_owner_user,
    mock_app_get_ps_db,
    dashboard,
    db_session,
    mocker,
    tmp_path,
):
    """Edge case: a Map ``GridItem`` without any ``MapLayerPopup`` rows
    leaves the layer config untouched."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = GridItem(
        dashboard_id=dashboard.id,
        tab_id=tab.id,
        uuid=str(uuid4()),
        i="1",
        x=0,
        y=0,
        w=10,
        h=10,
        source="Map",
        args_string=json.dumps({"layers": [{"name": "Layer A"}]}),
        metadata_string=json.dumps({}),
        order=0,
    )
    db_session.add(map_grid_item)
    db_session.commit()

    url = reverse("tethysdash:get_dashboard")
    client.force_login(test_owner_user)
    response = client.get(url, {"id": dashboard.id})

    payload = response.json()
    grid_items = payload["dashboard"]["tabs"][0]["gridItems"]
    args = json.loads(grid_items[0]["args_string"])
    assert "popupConfig" not in args["layers"][0]


@pytest.mark.django_db
def test_update_popup_replaces_grid_items_atomically(
    client,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    db_session,
):
    """Happy path (POST): updating a popup's grid items replaces the
    children atomically."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    map_grid_item, popup, children = _make_map_grid_item_with_popup(
        db_session, dashboard
    )
    initial_child_id = children[0].id

    payload = {
        "popup_id": popup.id,
        "mode": "modal",
        "title_template": "Refreshed: ${feature.x}",
        "gridItems": [
            {
                "i": "fresh",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 4,
                "source": "Custom Image",
                "args_string": json.dumps({"uri": "img"}),
                "metadata_string": json.dumps({}),
                "uuid": str(uuid4()),
            }
        ],
    }
    url = reverse("tethysdash:update_popup")
    client.force_login(test_owner_user)
    response = client.generic("POST", url, json.dumps(payload))

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["popup"]["titleTemplate"] == "Refreshed: ${feature.x}"
    assert len(body["popup"]["gridItems"]) == 1
    assert body["popup"]["gridItems"][0]["source"] == "Custom Image"

    # Old child was removed; new child is on the popup.
    db_session.expire_all()
    assert db_session.get(GridItem, initial_child_id) is None


@pytest.mark.django_db
def test_update_popup_creates_lazily_when_popup_id_omitted(
    client,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    db_session,
):
    """Happy path: omitting ``popup_id`` and supplying ``grid_item_id`` +
    ``layer_name`` creates the popup row on first save."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = GridItem(
        dashboard_id=dashboard.id,
        tab_id=tab.id,
        uuid=str(uuid4()),
        i="1",
        x=0,
        y=0,
        w=10,
        h=10,
        source="Map",
        args_string=json.dumps({"layers": [{"name": "Layer A"}]}),
        metadata_string=json.dumps({}),
        order=0,
    )
    db_session.add(map_grid_item)
    db_session.commit()
    db_session.refresh(map_grid_item)

    payload = {
        "grid_item_id": map_grid_item.id,
        "layer_name": "Layer A",
        "mode": "modal",
        "position": {
            "leftPct": 20,
            "topPct": 25,
            "widthPct": 60,
            "heightPct": 50,
        },
        "title_template": "Hi ${feature.station}",
        "gridItems": [],
    }
    url = reverse("tethysdash:update_popup")
    client.force_login(test_owner_user)
    response = client.generic("POST", url, json.dumps(payload))

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    popup_id = body["popup"]["id"]
    assert popup_id is not None
    assert body["popup"]["mode"] == "modal"
    # Subsequent call with the popup_id updates instead of creating again.
    payload2 = {"popup_id": popup_id, "title_template": "Hi 2"}
    response2 = client.generic("POST", url, json.dumps(payload2))
    body2 = response2.json()
    assert body2["popup"]["id"] == popup_id
    assert body2["popup"]["titleTemplate"] == "Hi 2"


@pytest.mark.django_db
def test_update_popup_rejects_non_editor_with_403(
    client,
    test_member_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    db_session,
):
    """Error path: a non-editor user attempting ``/popups/update/`` is
    rejected with 403."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    map_grid_item, popup, _children = _make_map_grid_item_with_popup(
        db_session, dashboard
    )

    payload = {
        "popup_id": popup.id,
        "title_template": "Should Fail",
    }
    url = reverse("tethysdash:update_popup")
    client.force_login(test_member_user)
    response = client.generic("POST", url, json.dumps(payload))

    assert response.status_code == 403
    body = response.json()
    assert body["success"] is False
    assert "permission" in body["message"].lower()


@pytest.mark.django_db
def test_update_popup_sanitizes_text_widget_args(
    client,
    test_owner_user,
    mock_app,
    mock_app_get_ps_db,
    dashboard,
    db_session,
):
    """Integration: a Text-widget child with a ``<script>`` payload is
    stripped via the existing ``_sanitize_text_args_string`` path."""
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    map_grid_item, popup, _children = _make_map_grid_item_with_popup(
        db_session, dashboard
    )

    payload = {
        "popup_id": popup.id,
        "gridItems": [
            {
                "i": "1",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 4,
                "source": "Text",
                "args_string": json.dumps(
                    {"text": "<p>Hello</p><script>alert(1)</script>"}
                ),
                "metadata_string": json.dumps({}),
                "uuid": str(uuid4()),
            }
        ],
    }
    url = reverse("tethysdash:update_popup")
    client.force_login(test_owner_user)
    response = client.generic("POST", url, json.dumps(payload))

    assert response.status_code == 200
    body = response.json()
    saved_args = json.loads(body["popup"]["gridItems"][0]["args_string"])
    assert "<script>" not in saved_args["text"]


@pytest.mark.django_db
def test_update_popup_unknown_id_without_fallback_returns_error(
    client, test_owner_user, mock_app, mock_app_get_ps_db
):
    """Error path: an unknown ``popup_id`` with no grid_item_id/layer_name
    fallback returns ``success: false``. (When the fallback fields are
    present, ``update_named_popup`` lazy-creates instead — verified in
    the model-level test suite.)
    """
    mock_app("tethysapp.tethysdash.controllers.App")
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    url = reverse("tethysdash:update_popup")
    client.force_login(test_owner_user)
    response = client.generic(
        "POST", url, json.dumps({"popup_id": 999999, "title_template": "x"})
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert "popup_id" in body["message"] or "required" in body["message"]


@override_settings(DATA_UPLOAD_MAX_MEMORY_SIZE=1024)  # 1 KB
def test_update_popup_body_too_big(client, admin_user, mock_app, mocker):
    mock_app("tethysapp.tethysdash.controllers.App")

    url = reverse("tethysdash:update_popup")
    client.force_login(admin_user)

    # Patch the update method to ensure it's not called
    mock_update_named_popup = mocker.patch(
        "tethysapp.tethysdash.controllers.update_named_popup"
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
    mock_update_named_popup.assert_not_called()
    assert response.status_code == 200  # or the expected status
    assert response.json()["success"] is False
    assert "File size too big" in response.json()["message"]
