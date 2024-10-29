import pytest
import json
import nh3
from tethysapp.tethysdash.model import (
    add_new_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
    get_dashboards,
    add_new_grid_item,
    delete_grid_item,
    Dashboard,
    GridItem,
)


@pytest.mark.django_db
def test_add_and_delete_dashboard(db_session, mock_app_get_ps_db, grid_item):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    label = "added_dashboard"
    name = "added_dashboard"
    notes = "added notes"
    owner = "some_user"
    access_groups = ["public"]

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(label, name, notes, owner, access_groups)

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.label == label
    assert dashboard.name == name
    assert dashboard.notes == notes
    assert dashboard.owner == owner
    assert dashboard.access_groups == access_groups
    dashboard_id = dashboard.id

    assert len(dashboard.grid_items) == 1

    # Add a grid item and verify
    grid_item_i = "2"
    grid_item_x = 1
    grid_item_y = 1
    grid_item_w = 1
    grid_item_h = 1
    grid_item_source = "Custom Image"
    grid_item_args_string = json.dumps({"uri": "some_path"})
    grid_item_refresh_rate = 0
    new_grid_item = add_new_grid_item(
        db_session,
        dashboard_id,
        grid_item_i,
        grid_item_x,
        grid_item_y,
        grid_item_w,
        grid_item_h,
        grid_item_source,
        grid_item_args_string,
        grid_item_refresh_rate,
    )

    new_grid_item = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item.id).first()
    )
    assert new_grid_item.x == grid_item_x
    assert new_grid_item.w == grid_item_w
    new_grid_item_id = new_grid_item.id

    # Delete the new row
    delete_grid_item(db_session, dashboard_id, grid_item_i)

    new_grid_item = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item.id).all()
    )
    assert len(new_grid_item) == 0

    # Delete the dashboard and Verify dashboard, rows, and columns were deleted
    delete_named_dashboard(owner, name)

    dashboard = db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).all()
    assert len(dashboard) == 0
    grid_items = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item_id).all()
    )
    assert len(grid_items) == 0


@pytest.mark.django_db
def test_delete_named_dashboard(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    dashboard_name = dashboard.name
    dashboard_owner = dashboard.owner

    delete_named_dashboard(dashboard_owner, dashboard_name)

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.name == dashboard_name).all()
    )
    assert len(db_dashboard) == 0


@pytest.mark.django_db
def test_delete_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    dashboard_name = dashboard.name

    with pytest.raises(Exception) as excinfo:
        delete_named_dashboard("test_not_valid_user", dashboard_name)
    assert (
        f"A dashboard with the name {dashboard_name} does not exist for this user"
        in str(excinfo.value)
    )

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.name == dashboard_name).all()
    )
    assert len(db_dashboard) == 1
    assert db_dashboard[0].name == dashboard_name


@pytest.mark.django_db
def test_update_named_dashboard(dashboard, db_session, mock_app_get_ps_db, mocker):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    mock_nh3_clean = mocker.patch(
        "tethysapp.tethysdash.model.nh3.clean", wraps=nh3.clean
    )
    dashboard_name = dashboard.name
    new_dashboard_name = "new_name"
    dashboard_label = dashboard.label
    dashboard_owner = dashboard.owner

    grid_items = json.dumps(
        [
            {
                "i": "1",
                "x": 1,
                "y": 1,
                "w": 1,
                "h": 1,
                "source": "Custom Image",
                "args_string": json.dumps({"uri": "some_path"}),
                "refresh_rate": 0,
            },
            {
                "i": "2",
                "x": 1,
                "y": 1,
                "w": 1,
                "h": 1,
                "source": "Custom Image",
                "args_string": json.dumps({"uri": "some_other_path"}),
                "refresh_rate": 0,
            },
        ]
    )

    # Add rows/cells and update dashboards
    updated_notes = "Some new notes"
    updated_access_groups = ["public"]
    update_named_dashboard(
        dashboard_name,
        dashboard_owner,
        new_dashboard_name,
        dashboard_label,
        updated_notes,
        grid_items,
        updated_access_groups,
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert dashboard.notes == updated_notes
    assert len(dashboard.grid_items) == 2
    assert dashboard.grid_items[0].args_string == json.dumps({"uri": "some_path"})
    assert dashboard.grid_items[0].refresh_rate == 0
    assert dashboard.access_groups == updated_access_groups

    grid_item1 = dashboard.grid_items[0]

    # Add and update rows/cells
    updated_grid_item = json.dumps(
        [
            {
                "id": grid_item1.id,
                "i": "1",
                "x": 1,
                "y": 1,
                "w": 2,
                "h": 2,
                "source": "Text",
                "args_string": json.dumps({"text": "some text"}),
                "refresh_rate": 30,
            }
        ]
    )
    update_named_dashboard(
        new_dashboard_name,
        dashboard_owner,
        dashboard_name,
        dashboard_label,
        updated_notes,
        updated_grid_item,
        updated_access_groups,
    )

    db_session.refresh(dashboard)
    assert dashboard.name == dashboard_name
    assert len(dashboard.grid_items) == 1

    db_session.refresh(dashboard.grid_items[0])
    assert dashboard.grid_items[0].w == 2
    assert dashboard.grid_items[0].h == 2
    assert dashboard.grid_items[0].refresh_rate == 30
    mock_nh3_clean.assert_called()


@pytest.mark.django_db
def test_update_named_dashboard_not_allowed(
    dashboard, db_session, mock_app_get_ps_db, grid_item
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    dashboard_name = dashboard.name
    dashboard_label = dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_access_groups = dashboard.access_groups

    with pytest.raises(Exception) as excinfo:
        updated_notes = "Some new notes"
        updated_access_groups = ["public"]
        update_named_dashboard(
            dashboard_name,
            "test_not_valid_user",
            dashboard_name,
            dashboard_label,
            updated_notes,
            grid_item,
            updated_access_groups,
        )
    assert (
        f"A dashboard with the name {dashboard_name} does not exist for this user"
        in str(excinfo.value)
    )

    db_session.refresh(dashboard)
    assert dashboard.notes == dashboard_notes
    assert dashboard.grid_items == []
    assert dashboard.access_groups == dashboard_access_groups


@pytest.mark.django_db
def test_update_named_dashboard_already_public_name(
    dashboard, public_dashboard, db_session, mock_app_get_ps_db, grid_item
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    original_dashboard_name = dashboard.name
    new_dashboard_name = public_dashboard.name
    dashboard_owner = dashboard.owner
    dashboard_label = dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_access_groups = dashboard.access_groups
    updated_access_groups = ["public"]

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            original_dashboard_name,
            dashboard_owner,
            new_dashboard_name,
            dashboard_label,
            dashboard_notes,
            grid_item,
            updated_access_groups,
        )

    assert (
        f"A dashboard with the name {new_dashboard_name} is already public. Change the name before attempting again."  # noqa: E501
        in str(excinfo.value)
    )

    db_session.refresh(dashboard)
    assert dashboard.notes == dashboard_notes
    assert dashboard.grid_items == []
    assert dashboard.access_groups == dashboard_access_groups


@pytest.mark.django_db
def test_update_named_dashboard_already_public_label(
    dashboard, public_dashboard, db_session, mock_app_get_ps_db, grid_item
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    dashboard_name = dashboard.name
    dashboard_owner = dashboard.owner
    new_dashboard_label = public_dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_access_groups = dashboard.access_groups
    updated_access_groups = ["public"]

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            dashboard_name,
            dashboard_owner,
            dashboard_name,
            new_dashboard_label,
            dashboard_notes,
            grid_item,
            updated_access_groups,
        )

    assert (
        f"A dashboard with the label {new_dashboard_label} is already public. Change the label before attempting again."  # noqa: E501
        in str(excinfo.value)
    )

    db_session.refresh(dashboard)
    assert dashboard.notes == dashboard_notes
    assert dashboard.grid_items == []
    assert dashboard.access_groups == dashboard_access_groups


@pytest.mark.django_db
def test_get_dashboards_all(dashboard, db_session, mock_app_get_ps_db, grid_item):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    dashboard_name = dashboard.name
    dashboard_label = dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_owner = dashboard.owner
    dashboard_access_groups = dashboard.access_groups

    update_named_dashboard(
        dashboard_name,
        dashboard_owner,
        dashboard_name,
        dashboard_label,
        dashboard_notes,
        grid_item,
        dashboard_access_groups,
    )

    all_dashboards = get_dashboards(dashboard_owner)
    assert all_dashboards == {
        dashboard_name: {
            "id": dashboard.id,
            "name": dashboard_name,
            "label": dashboard_label,
            "notes": dashboard_notes,
            "editable": True,
            "access_groups": [],
            "gridItems": [
                {
                    "id": 5,
                    "i": "1",
                    "x": 1,
                    "y": 1,
                    "w": 1,
                    "h": 1,
                    "source": "Custom Image",
                    "args_string": '{"uri": "some_path"}',
                    "refresh_rate": 0,
                }
            ],
        }
    }


@pytest.mark.django_db
def test_get_dashboards_specific(dashboard, db_session, mock_app_get_ps_db, grid_item):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    dashboard_name = dashboard.name
    dashboard_label = dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_owner = dashboard.owner

    all_dashboards = get_dashboards(dashboard_owner, dashboard.name)
    assert all_dashboards == {
        dashboard_name: {
            "id": dashboard.id,
            "name": dashboard_name,
            "label": dashboard_label,
            "notes": dashboard_notes,
            "editable": True,
            "access_groups": [],
            "gridItems": [],
        }
    }
