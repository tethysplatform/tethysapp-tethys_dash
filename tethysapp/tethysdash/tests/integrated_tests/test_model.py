import pytest
import json
from tethysapp.tethysdash.model import (
    add_new_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
    copy_named_dashboard,
    get_dashboards,
    add_new_grid_item,
    delete_grid_item,
    Dashboard,
    GridItem,
    check_existing_user_dashboard_names,
    check_existing_public_dashboards,
    parse_db_dashboard,
    clean_up_jsons,
)
from unittest.mock import MagicMock
import base64
import os
from pathlib import Path


@pytest.mark.django_db
def test_add_and_delete_dashboard(db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    description = "added_dashboard"
    uuid = "3ddc3d80-2593-468f-825a-425f816c892f"
    name = "added_dashboard"
    owner = "some_user"
    grid_items = []
    notes = ""
    access_groups = []
    unrestricted_placement = False

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        owner,
        uuid,
        name,
        description,
        notes,
        access_groups,
        unrestricted_placement,
        grid_items,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == owner
    assert dashboard.access_groups == []
    assert not dashboard.unrestricted_placement
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
    grid_item_order = 0
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
        grid_item_order,
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
def test_add_and_delete_dashboard_with_grid_items(db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    description = "added_dashboard"
    uuid = "3ddc3d80-2593-468f-825a-425f816c892f"
    name = "added_dashboard"
    owner = "some_user"
    grid_items = [
        {
            "i": "2",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Text",
            "args_string": json.dumps({"text": "Some text"}),
            "metadata_string": json.dumps({}),
        }
    ]
    notes = ""
    access_groups = []
    unrestricted_placement = True

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        owner,
        uuid,
        name,
        description,
        notes,
        access_groups,
        unrestricted_placement,
        grid_items,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == owner
    assert dashboard.access_groups == []
    assert dashboard.unrestricted_placement
    dashboard_id = dashboard.id

    assert len(dashboard.grid_items) == 1
    assert dashboard.grid_items[0].x == 1
    assert dashboard.grid_items[0].w == 1
    assert dashboard.grid_items[0].source == "Text"
    assert dashboard.grid_items[0].args_string == json.dumps({"text": "Some text"})
    grid_item_i = dashboard.grid_items[0].i
    grid_item_id = dashboard.grid_items[0].id

    # Delete the new row
    delete_grid_item(db_session, dashboard_id, grid_item_i)

    new_grid_item = db_session.query(GridItem).filter(GridItem.id == grid_item_id).all()
    assert len(new_grid_item) == 0

    # Delete the dashboard and Verify dashboard, rows, and columns were deleted
    delete_named_dashboard(owner, dashboard_id)

    dashboard = db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).all()
    assert len(dashboard) == 0
    grid_items = db_session.query(GridItem).filter(GridItem.id == grid_item_id).all()
    assert len(grid_items) == 0


@pytest.mark.django_db
def test_delete_named_dashboard(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    delete_named_dashboard(dashboard.owner, dashboard.id)

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.name == dashboard.name).all()
    )
    assert len(db_dashboard) == 0


@pytest.mark.django_db
def test_delete_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

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
def test_update_named_dashboard(
    dashboard, db_session, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
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
            "unrestrictedPlacement": True,
        },
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert dashboard.notes == updated_notes
    assert len(dashboard.grid_items) == 2
    assert dashboard.grid_items[0].args_string == json.dumps({"uri": "some_path"})
    assert dashboard.grid_items[0].metadata_string == json.dumps({"refreshRate": 0})
    assert dashboard.access_groups == updated_access_groups
    assert dashboard.unrestricted_placement

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


@pytest.mark.django_db
def test_update_named_dashboard_image(dashboard, mock_app_get_ps_db, mocker, tmp_path):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard([dashboard], False)
    assert existing_dashboard[0]["image"] == "/static/tethysdash/images/tethys_dash.png"

    example_image = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "files/thumbnail.png",
    )
    with open(example_image, "rb") as image_file:
        base64_string = base64.b64encode(image_file.read()).decode("utf-8")

    image = f"data:image/png;base64,{base64_string}"
    updated_dashboard = update_named_dashboard(
        dashboard.owner,
        dashboard.id,
        {
            "image": image,
        },
    )

    assert (
        updated_dashboard["image"] == "/media/app_root/app/some_user_dashboard_uuid.png"
    )


@pytest.mark.django_db
def test_update_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

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
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

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
def test_get_dashboards_all(
    dashboard, public_dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    all_dashboards = get_dashboards(dashboard.owner)
    assert all_dashboards == {
        "user": [
            {
                "id": dashboard.id,
                "name": dashboard.name,
                "description": dashboard.description,
                "accessGroups": [],
                "image": "/static/tethysdash/images/tethys_dash.png",
                "uuid": "some_user_dashboard_uuid",
                "unrestrictedPlacement": False,
            }
        ],
        "public": [
            {
                "id": public_dashboard.id,
                "name": public_dashboard.name,
                "description": public_dashboard.description,
                "accessGroups": ["public"],
                "image": "/static/tethysdash/images/tethys_dash.png",
                "uuid": "some_public_dashboard_uuid",
                "unrestrictedPlacement": False,
            }
        ],
    }


@pytest.mark.django_db
def test_get_dashboards_specific_dashboard_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    retrieved_dashboard = get_dashboards(
        dashboard.owner, dashboard_view=True, id=dashboard.id
    )
    assert retrieved_dashboard == {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "notes": dashboard.notes,
        "accessGroups": [],
        "gridItems": [],
        "image": "/static/tethysdash/images/tethys_dash.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
    }


@pytest.mark.django_db
def test_get_dashboards_specific_landing_page_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    retrieved_dashboard = get_dashboards(dashboard.owner, id=dashboard.id)
    assert retrieved_dashboard == {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "accessGroups": [],
        "image": "/static/tethysdash/images/tethys_dash.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
    }


@pytest.mark.django_db
def test_check_existing_user_dashboard_names(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    check_existing_user_dashboard_names(
        db_session, dashboard.owner, "some_new_dashboard_name"
    )


@pytest.mark.django_db
def test_check_existing_user_dashboard_names_fail(
    dashboard, db_session, mock_app_get_ps_db
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    with pytest.raises(Exception) as excinfo:
        check_existing_user_dashboard_names(db_session, dashboard.owner, dashboard.name)

    assert (
        f"A dashboard with the name {dashboard.name} already exists. Change the name before attempting again."  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_check_existing_public_dashboards(db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    result = check_existing_public_dashboards(db_session, "some_new_public_name")
    assert result is None


@pytest.mark.django_db
def test_check_existing_public_dashboards_failed_name(
    public_dashboard, db_session, mock_app_get_ps_db
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    with pytest.raises(Exception) as excinfo:
        check_existing_public_dashboards(db_session, public_dashboard.name)

    assert (
        f"A dashboard with the name {public_dashboard.name} is already public. Change the name before attempting again."  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_copy_named_dashboard(
    dashboard, db_session, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    new_dashboard_name = "new_name"
    new_description = "some updated descripion"
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
    ]

    # Add rows/cells and update dashboards
    update_named_dashboard(
        dashboard.owner,
        dashboard.id,
        {"gridItems": grid_items, "description": new_description},
    )

    # Add rows/cells and update dashboards
    new_dashboard_id, copied_dashboard_uuid = copy_named_dashboard(
        dashboard.owner, dashboard.id, new_dashboard_name, "123456789"
    )

    assert copied_dashboard_uuid == "some_user_dashboard_uuid"
    copied_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard_id).first()
    )
    assert copied_dashboard.name == new_dashboard_name
    assert copied_dashboard.notes == dashboard.notes
    assert copied_dashboard.description == new_description
    assert copied_dashboard.access_groups == dashboard.access_groups
    assert copied_dashboard.uuid == "123456789"
    assert len(copied_dashboard.grid_items) == len(dashboard.grid_items) == 1
    assert dashboard.grid_items[0].dashboard_id == dashboard.id
    assert copied_dashboard.grid_items[0].dashboard_id == copied_dashboard.id


@pytest.mark.django_db
def test_parse_db_dashboard_landing_page_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard([dashboard], dashboard_view=False)
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "accessGroups": [],
        "image": "/static/tethysdash/images/tethys_dash.png",
        "unrestrictedPlacement": False,
    }


@pytest.mark.django_db
def test_parse_db_dashboard_dashboard_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard([dashboard], dashboard_view=True)
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "accessGroups": [],
        "image": "/static/tethysdash/images/tethys_dash.png",
        "notes": dashboard.notes,
        "gridItems": [],
        "unrestrictedPlacement": False,
    }


@pytest.mark.django_db
def test_clean_up_jsons(dashboard, mock_app_get_ps_db, mocker, tmp_path):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    workspace_path = tmp_path
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    grid_items = [
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Map",
            "args_string": json.dumps(
                {
                    "layers": [
                        {
                            "configuration": {
                                "props": {
                                    "source": {
                                        "type": "GeoJSON",
                                        "geojson": "used_geojson.geojson",
                                    }
                                },
                                "style": "used_style.json",
                            },
                        }
                    ]
                }
            ),
            "metadata_string": json.dumps({"refreshRate": 0}),
        },
    ]

    json_folder = os.path.join(workspace_path, "json")
    user_json_folder = os.path.join(json_folder, dashboard.owner)
    os.makedirs(user_json_folder, exist_ok=True)

    user_used_geojson_file = os.path.join(user_json_folder, "used_geojson.geojson")
    used_geojson_file = os.path.join(json_folder, "used_geojson.geojson")
    Path(user_used_geojson_file).touch()
    Path(used_geojson_file).touch()

    user_unused_geojson_file = os.path.join(user_json_folder, "unused_geojson.geojson")
    unused_geojson_file = os.path.join(json_folder, "unused_geojson.geojson")
    Path(user_unused_geojson_file).touch()
    Path(unused_geojson_file).touch()

    nonuser_geojson_file = os.path.join(json_folder, "nonuser_geojson.geojson")
    Path(nonuser_geojson_file).touch()

    user_used_style_file = os.path.join(user_json_folder, "used_style.json")
    used_style_file = os.path.join(json_folder, "used_style.json")
    Path(user_used_style_file).touch()
    Path(used_style_file).touch()

    user_unused_style_file = os.path.join(user_json_folder, "unused_style.json")
    unused_style_file = os.path.join(json_folder, "unused_style.json")
    Path(user_unused_style_file).touch()
    Path(unused_style_file).touch()

    nonuser_style_file = os.path.join(json_folder, "nonuser_style.json")
    Path(nonuser_style_file).touch()

    # Add rows/cells and update dashboards
    update_named_dashboard(
        dashboard.owner,
        dashboard.id,
        {"gridItems": grid_items},
    )

    clean_up_jsons(dashboard.owner)

    assert os.path.exists(user_used_geojson_file)
    assert os.path.exists(used_geojson_file)
    assert not os.path.exists(user_unused_geojson_file)
    assert not os.path.exists(unused_geojson_file)
    assert os.path.exists(nonuser_geojson_file)

    assert os.path.exists(user_used_style_file)
    assert os.path.exists(used_style_file)
    assert not os.path.exists(user_unused_style_file)
    assert not os.path.exists(unused_style_file)
    assert os.path.exists(nonuser_style_file)
