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
    check_existing_user_dashboard_names,
    check_existing_public_dashboards,
)


@pytest.mark.django_db
def test_add_and_delete_dashboard(db_session, mock_app_get_ps_db, grid_item):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    description = "added_dashboard"
    name = "added_dashboard"
    owner = "some_user"
    grid_items = []

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(owner, name, description)

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.owner == owner
    assert dashboard.access_groups == []
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
    grid_item_refreshRate = 0
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
        grid_item_refreshRate,
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
    delete_named_dashboard(owner, dashboard_id)

    dashboard = db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).all()
    assert len(dashboard) == 0
    grid_items = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item_id).all()
    )
    assert len(grid_items) == 0


@pytest.mark.django_db
def test_delete_named_dashboard(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    delete_named_dashboard(dashboard.owner, dashboard.id)

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.name == dashboard.name).all()
    )
    assert len(db_dashboard) == 0


@pytest.mark.django_db
def test_delete_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    with pytest.raises(Exception) as excinfo:
        delete_named_dashboard("test_not_valid_user", dashboard.id)
    assert (
        f"A dashboard with the id {dashboard.id} does not exist for this user"
        in str(excinfo.value)
    )

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).all()
    )
    assert len(db_dashboard) == 1
    assert db_dashboard[0].name == dashboard.name


@pytest.mark.django_db
def test_update_named_dashboard(dashboard, db_session, mock_app_get_ps_db, mocker):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    mock_nh3_clean = mocker.patch(
        "tethysapp.tethysdash.model.nh3.clean", wraps=nh3.clean
    )
    new_dashboard_name = "new_name"

    grid_items = [
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Custom Image",
            "args_string": json.dumps({"uri": "some_path"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
        },
        {
            "i": "2",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Custom Image",
            "args_string": json.dumps({"uri": "some_other_path"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
        },
    ]

    # Add rows/cells and update dashboards
    updated_notes = "Some new notes"
    updated_access_groups = ["public"]
    update_named_dashboard(
        dashboard.owner,
        dashboard.id,
        {
            "name": new_dashboard_name,
            "notes": updated_notes,
            "accessGroups": updated_access_groups,
            "gridItems": grid_items,
        },
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert dashboard.notes == updated_notes
    assert len(dashboard.grid_items) == 2
    assert dashboard.grid_items[0].args_string == json.dumps({"uri": "some_path"})
    assert dashboard.grid_items[0].metadata_string == json.dumps({"refreshRate": 0})
    assert dashboard.access_groups == updated_access_groups

    grid_item1 = dashboard.grid_items[0]

    # Add and update rows/cells
    updated_grid_item = [
        {
            "id": grid_item1.id,
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 2,
            "h": 2,
            "source": "Text",
            "args_string": json.dumps({"text": "some text"}),
            "metadata_string": json.dumps({"refreshRate": 30}),
        }
    ]

    update_named_dashboard(
        dashboard.owner,
        dashboard.id,
        {"gridItems": updated_grid_item},
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert len(dashboard.grid_items) == 1

    db_session.refresh(dashboard.grid_items[0])
    assert dashboard.grid_items[0].w == 2
    assert dashboard.grid_items[0].h == 2
    assert dashboard.grid_items[0].metadata_string == json.dumps({"refreshRate": 30})
    mock_nh3_clean.assert_called()


@pytest.mark.django_db
def test_update_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    with pytest.raises(Exception) as excinfo:
        updated_notes = "Some new notes"
        updated_access_groups = ["public"]
        update_named_dashboard(
            "test_not_valid_user",
            dashboard.id,
            {"notes": updated_notes, "accessGroups": updated_access_groups},
        )
    assert (
        f"A dashboard with the id {dashboard.id} does not exist for this user"
        in str(excinfo.value)
    )

    db_session.refresh(dashboard)
    assert dashboard.notes == dashboard.notes
    assert dashboard.grid_items == []
    assert dashboard.access_groups == dashboard.access_groups


@pytest.mark.django_db
def test_update_named_dashboard_already_public_name(
    dashboard, public_dashboard, db_session, mock_app_get_ps_db
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            dashboard.owner,
            dashboard.id,
            {"name": public_dashboard.name, "accessGroups": ["public"]},
        )

    assert (
        f"A dashboard with the name {public_dashboard.name} is already public. Change the name before attempting again."  # noqa: E501
        in str(excinfo.value)
    )

    db_session.refresh(dashboard)
    assert dashboard.notes == dashboard.notes
    assert dashboard.grid_items == []
    assert dashboard.access_groups == dashboard.access_groups


@pytest.mark.django_db
def test_get_dashboards_all(dashboard, public_dashboard, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    all_dashboards = get_dashboards(dashboard.owner)
    assert all_dashboards == {
        "user": {
            dashboard.name: {
                "id": dashboard.id,
                "name": dashboard.name,
                "description": dashboard.description,
                "accessGroups": [],
                "notes": dashboard.notes,
                "gridItems": [],
            }
        },
        "public": {
            public_dashboard.name: {
                "id": public_dashboard.id,
                "name": public_dashboard.name,
                "description": public_dashboard.description,
                "accessGroups": ["public"],
                "notes": public_dashboard.notes,
                "gridItems": [],
            }
        },
    }


@pytest.mark.django_db
def test_get_dashboards_specific(dashboard, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    retrieved_dashboard = get_dashboards(dashboard.owner, id=dashboard.id)
    assert retrieved_dashboard == {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "notes": dashboard.notes,
        "accessGroups": [],
        "gridItems": [],
    }


@pytest.mark.django_db
def test_check_existing_user_dashboard_names(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    check_existing_user_dashboard_names(
        db_session, dashboard.owner, "some_new_dashboard_name"
    )


@pytest.mark.django_db
def test_check_existing_user_dashboard_names_fail(
    dashboard, db_session, mock_app_get_ps_db
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    with pytest.raises(Exception) as excinfo:
        check_existing_user_dashboard_names(db_session, dashboard.owner, dashboard.name)

    assert (
        f"A dashboard with the name {dashboard.name} already exists. Change the name before attempting again."  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_check_existing_public_dashboards(db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")

    result = check_existing_public_dashboards(db_session, "some_new_public_name")
    assert result is None


@pytest.mark.django_db
def test_check_existing_public_dashboards_failed_name(
    public_dashboard, db_session, mock_app_get_ps_db
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.app")
    with pytest.raises(Exception) as excinfo:
        check_existing_public_dashboards(db_session, public_dashboard.name)

    assert (
        f"A dashboard with the name {public_dashboard.name} is already public. Change the name before attempting again."  # noqa: E501
        in str(excinfo.value)
    )
