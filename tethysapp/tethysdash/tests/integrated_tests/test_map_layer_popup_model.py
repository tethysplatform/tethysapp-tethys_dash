"""Integrated tests for the ``MapLayerPopup`` model and the ``GridItem``
``popup_id`` foreign key.

Covers:

* Cascading relationships (Map ``GridItem`` -> ``MapLayerPopup`` -> child
  popup ``GridItem`` rows).
* The ``ck_griditems_tab_xor_popup`` check constraint that enforces every
  grid item belongs to exactly one of (a tab) xor (a popup).
* The popup-update model entry point (``update_named_popup``).
"""

import json
import pytest
from uuid import uuid4

from sqlalchemy.exc import IntegrityError

from tethysapp.tethysdash.model import (
    DashboardTab,
    GridItem,
    MapLayerPopup,
    update_named_popup,
)


def _make_map_grid_item(db_session, dashboard, tab):
    """Persist a Map ``GridItem`` belonging to ``tab`` and return it."""
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
        args_string=json.dumps(
            {
                "layers": [
                    {"name": "Layer A", "configuration": {}},
                    {"name": "Layer B", "configuration": {}},
                ]
            }
        ),
        metadata_string=json.dumps({}),
        order=0,
    )
    db_session.add(map_grid_item)
    db_session.commit()
    db_session.refresh(map_grid_item)
    return map_grid_item


def _make_popup(db_session, map_grid_item, layer_name="Layer A"):
    popup = MapLayerPopup(
        grid_item_id=map_grid_item.id,
        layer_name=layer_name,
        mode="modal",
        position_json=json.dumps(
            {"leftPct": 20, "topPct": 25, "widthPct": 60, "heightPct": 50}
        ),
        title_template="Site: ${feature.station_name}",
    )
    db_session.add(popup)
    db_session.commit()
    db_session.refresh(popup)
    return popup


def _add_popup_grid_item(db_session, dashboard, popup, source="Text", args=None):
    if args is None:
        args = {"text": "hello"}
    grid_item = GridItem(
        dashboard_id=dashboard.id,
        tab_id=None,
        popup_id=popup.id,
        uuid=str(uuid4()),
        i=str(uuid4())[:6],
        x=0,
        y=0,
        w=4,
        h=4,
        source=source,
        args_string=json.dumps(args),
        metadata_string=json.dumps({}),
        order=0,
    )
    db_session.add(grid_item)
    db_session.commit()
    db_session.refresh(grid_item)
    return grid_item


@pytest.mark.django_db
def test_popup_relationships_traverse_correctly(db_session, dashboard):
    """Happy path: parent Map -> popup -> child grid items can be navigated
    via SQLAlchemy relationships."""
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)

    child_a = _add_popup_grid_item(db_session, dashboard, popup, source="Text")
    child_b = _add_popup_grid_item(
        db_session, dashboard, popup, source="Custom Image"
    )

    db_session.refresh(map_grid_item)
    db_session.refresh(popup)

    assert popup.grid_item_id == map_grid_item.id
    assert popup.grid_item.id == map_grid_item.id
    assert [g.id for g in map_grid_item.map_layer_popups] == [popup.id]

    child_ids = sorted(g.id for g in popup.grid_items)
    assert child_ids == sorted([child_a.id, child_b.id])

    # Children point back to the popup, not a tab.
    for child in popup.grid_items:
        assert child.popup_id == popup.id
        assert child.tab_id is None
        assert child.popup is not None
        assert child.popup.id == popup.id


@pytest.mark.django_db
def test_deleting_map_grid_item_cascades_to_popup_and_children(
    db_session, dashboard
):
    """Edge case: deleting the parent Map ``GridItem`` cascades to its popup
    rows and to the popup's child grid items."""
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)
    child = _add_popup_grid_item(db_session, dashboard, popup)

    map_id = map_grid_item.id
    popup_id = popup.id
    child_id = child.id

    db_session.delete(map_grid_item)
    db_session.commit()

    assert db_session.get(GridItem, map_id) is None
    assert db_session.get(MapLayerPopup, popup_id) is None
    assert db_session.get(GridItem, child_id) is None


@pytest.mark.django_db
def test_deleting_popup_cascades_to_child_grid_items(db_session, dashboard):
    """Edge case: deleting a ``MapLayerPopup`` directly cascades to its
    child grid items."""
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)
    child = _add_popup_grid_item(db_session, dashboard, popup)

    popup_id = popup.id
    child_id = child.id
    map_id = map_grid_item.id

    db_session.delete(popup)
    db_session.commit()

    assert db_session.get(MapLayerPopup, popup_id) is None
    assert db_session.get(GridItem, child_id) is None
    # The parent Map grid item is unaffected.
    assert db_session.get(GridItem, map_id) is not None


@pytest.mark.django_db
def test_check_constraint_rejects_both_tab_and_popup(db_session, dashboard):
    """Error path: a grid item with both ``tab_id`` and ``popup_id`` set
    violates the check constraint."""
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)

    # Use a nested savepoint so the integrity error doesn't unwind the
    # surrounding test transaction (which would prematurely delete the
    # dashboard fixture and break teardown).
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            bad_item = GridItem(
                dashboard_id=dashboard.id,
                tab_id=tab.id,
                popup_id=popup.id,
                uuid=str(uuid4()),
                i="bad",
                x=0,
                y=0,
                w=1,
                h=1,
                source="Text",
                args_string=json.dumps({"text": "x"}),
                metadata_string=json.dumps({}),
                order=0,
            )
            db_session.add(bad_item)
            db_session.flush()


@pytest.mark.django_db
def test_check_constraint_rejects_neither_tab_nor_popup(db_session, dashboard):
    """Error path: a grid item with neither ``tab_id`` nor ``popup_id``
    violates the check constraint."""
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            bad_item = GridItem(
                dashboard_id=dashboard.id,
                tab_id=None,
                popup_id=None,
                uuid=str(uuid4()),
                i="bad",
                x=0,
                y=0,
                w=1,
                h=1,
                source="Text",
                args_string=json.dumps({"text": "x"}),
                metadata_string=json.dumps({}),
                order=0,
            )
            db_session.add(bad_item)
            db_session.flush()


@pytest.mark.django_db
def test_unique_constraint_grid_item_layer_name(db_session, dashboard):
    """Two popup rows for the same (grid_item_id, layer_name) violate the
    unique constraint."""
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup_a = MapLayerPopup(
        grid_item_id=map_grid_item.id, layer_name="Layer A", mode="modal"
    )
    db_session.add(popup_a)
    db_session.commit()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            popup_dup = MapLayerPopup(
                grid_item_id=map_grid_item.id, layer_name="Layer A", mode="table"
            )
            db_session.add(popup_dup)
            db_session.flush()


@pytest.mark.django_db
def test_update_named_popup_creates_when_missing(
    db_session, mock_app_get_ps_db, dashboard, test_owner_user
):
    """Happy path: ``update_named_popup`` creates a popup row lazily when
    one does not yet exist for the (grid_item_id, layer_name) pair."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)

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
        "title_template": "Site: ${feature.station_name}",
        "gridItems": [
            {
                "i": "1",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 4,
                "source": "Text",
                "args_string": json.dumps({"text": "hi"}),
                "metadata_string": json.dumps({}),
                "uuid": str(uuid4()),
            }
        ],
    }
    result = update_named_popup(test_owner_user, payload)

    assert result["mode"] == "modal"
    assert result["position"] == {
        "leftPct": 20,
        "topPct": 25,
        "widthPct": 60,
        "heightPct": 50,
    }
    assert result["titleTemplate"] == "Site: ${feature.station_name}"
    assert len(result["gridItems"]) == 1
    assert result["gridItems"][0]["source"] == "Text"


@pytest.mark.django_db
def test_update_named_popup_falls_back_to_lazy_create_when_popup_id_is_stale(
    db_session, mock_app_get_ps_db, dashboard, test_owner_user
):
    """Resilience: when ``popup_id`` is supplied but the row no longer
    exists (e.g., DB reset, prior delete, or stale id baked into the
    client-side layer config), fall through to the lazy-create path using
    ``grid_item_id`` + ``layer_name`` instead of raising. Without this the
    user hits "A map layer popup with the id N does not exist." every time
    they save a layer that has a stale popup id in its frontend state.
    """
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)

    payload = {
        "popup_id": 99999,  # does not exist in DB
        "grid_item_id": map_grid_item.id,
        "layer_name": "Layer A",
        "mode": "modal",
        "position": {
            "leftPct": 10,
            "topPct": 10,
            "widthPct": 50,
            "heightPct": 50,
        },
        "gridItems": [],
    }

    result = update_named_popup(test_owner_user, payload)

    # A real row is created (id assigned by the DB; not 99999).
    assert isinstance(result["id"], int)
    assert result["id"] != 99999
    assert result["mode"] == "modal"
    assert result["position"]["widthPct"] == 50


@pytest.mark.django_db
def test_update_named_popup_raises_when_stale_popup_id_lacks_fallback(
    db_session, mock_app_get_ps_db, dashboard, test_owner_user
):
    """A stale popup_id with no grid_item_id/layer_name fallback still
    raises — we don't silently swallow malformed payloads."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)

    payload = {"popup_id": 99999, "mode": "modal"}

    with pytest.raises(Exception, match="popup_id"):
        update_named_popup(test_owner_user, payload)


@pytest.mark.django_db
def test_update_named_popup_replaces_grid_items(
    db_session, mock_app_get_ps_db, dashboard, test_owner_user
):
    """Happy path: replacing the grid items removes prior children and adds
    the new ones in a single transaction."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)
    initial_child = _add_popup_grid_item(
        db_session, dashboard, popup, source="Text"
    )
    initial_child_id = initial_child.id

    payload = {
        "popup_id": popup.id,
        "gridItems": [
            {
                "i": "fresh",
                "x": 0,
                "y": 0,
                "w": 4,
                "h": 4,
                "source": "Custom Image",
                "args_string": json.dumps({"uri": "x"}),
                "metadata_string": json.dumps({}),
                "uuid": str(uuid4()),
            }
        ],
    }
    result = update_named_popup(test_owner_user, payload)

    assert len(result["gridItems"]) == 1
    assert result["gridItems"][0]["source"] == "Custom Image"
    # The original child was removed.
    db_session.expire_all()
    assert db_session.get(GridItem, initial_child_id) is None


@pytest.mark.django_db
def test_update_named_popup_idempotent_metadata_only(
    db_session, mock_app_get_ps_db, dashboard, test_owner_user
):
    """Updating only metadata fields (no ``gridItems`` key) preserves the
    popup's existing children."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)
    child = _add_popup_grid_item(db_session, dashboard, popup)
    child_id = child.id

    payload = {
        "popup_id": popup.id,
        "title_template": "New Title: ${feature.x}",
    }
    result = update_named_popup(test_owner_user, payload)

    assert result["titleTemplate"] == "New Title: ${feature.x}"
    # Children unchanged.
    assert db_session.get(GridItem, child_id) is not None
    assert len(result["gridItems"]) == 1


@pytest.mark.django_db
def test_update_named_popup_sanitizes_text_grid_items(
    db_session, mock_app_get_ps_db, dashboard, test_owner_user
):
    """Integration: a popup grid item with a Text widget containing a script
    tag is sanitized via the existing ``_sanitize_text_args_string`` path."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)

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
                    {"text": "<p>Hi</p><script>alert(1)</script>"}
                ),
                "metadata_string": json.dumps({}),
                "uuid": str(uuid4()),
            }
        ],
    }
    result = update_named_popup(test_owner_user, payload)

    saved_args = json.loads(result["gridItems"][0]["args_string"])
    assert "<script>" not in saved_args["text"]
    assert "alert(1)" not in saved_args["text"]


@pytest.mark.django_db
def test_update_named_popup_rejects_non_editor(
    db_session, mock_app_get_ps_db, dashboard, test_member_user
):
    """Error path: a user without editor/admin permission cannot update a
    popup; ``PermissionError`` is raised."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    tab = DashboardTab(dashboard_id=dashboard.id, name="Tab 1", tab_order=0)
    db_session.add(tab)
    db_session.commit()
    db_session.refresh(tab)
    map_grid_item = _make_map_grid_item(db_session, dashboard, tab)
    popup = _make_popup(db_session, map_grid_item)

    with pytest.raises(PermissionError):
        update_named_popup(
            test_member_user,
            {"popup_id": popup.id, "title_template": "x"},
        )


@pytest.mark.django_db
def test_update_named_popup_missing_popup_raises_when_no_fallback(
    db_session, mock_app_get_ps_db, test_owner_user
):
    """Error path: an unknown ``popup_id`` with no grid_item_id/layer_name
    fallback raises. (Resilience for stale popup_ids only kicks in when
    the create-fallback fields are also present — see
    ``test_update_named_popup_falls_back_to_lazy_create_when_popup_id_is_stale``.)
    """
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    with pytest.raises(Exception) as excinfo:
        update_named_popup(test_owner_user, {"popup_id": 99999})
    assert "popup_id" in str(excinfo.value) or "required" in str(excinfo.value)


@pytest.mark.django_db
def test_update_named_popup_requires_create_args(
    db_session, mock_app_get_ps_db, test_owner_user
):
    """Error path: omitting ``popup_id`` without supplying both
    ``grid_item_id`` and ``layer_name`` raises an exception."""
    mock_app_get_ps_db("tethysapp.tethysdash.app.App")
    with pytest.raises(Exception) as excinfo:
        update_named_popup(test_owner_user, {"layer_name": "Layer A"})
    assert "popup_id" in str(excinfo.value) or "required" in str(excinfo.value)
