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
    DashboardPermission,
    DashboardPermissionLevel,
    PermissionGroup,
    GroupPermissionLevel,
    parse_db_dashboard,
    clean_up_jsons,
    init_primary_db,
    get_dashboard_user_permission,
    update_dashboard_permissions,
    update_permission_groups,
    get_user_permission_groups,
    delete_permission_groups,
)
from unittest.mock import MagicMock
import base64
import os
from pathlib import Path
from types import SimpleNamespace
from sqlalchemy.exc import ProgrammingError


@pytest.fixture
def mock_alembic(mocker):
    # Patch alembic components
    mock_cfg = mocker.Mock()
    mock_script = mocker.Mock()
    mock_revision = mocker.Mock(revision="1234")

    mocker.patch("tethysapp.tethysdash.model.Config", return_value=mock_cfg)
    mocker.patch("tethysapp.tethysdash.model.command.ensure_version")
    mock_upgrade = mocker.patch("tethysapp.tethysdash.model.command.upgrade")
    mock_stamp = mocker.patch("tethysapp.tethysdash.model.command.stamp")
    mocker.patch(
        "tethysapp.tethysdash.model.script.ScriptDirectory.from_config",
        return_value=mock_script,
    )

    return SimpleNamespace(
        config=mock_cfg,
        script=mock_script,
        revision=mock_revision,
        upgrade=mock_upgrade,
        stamp=mock_stamp,
    )


@pytest.mark.django_db
def test_add_and_delete_dashboard(db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    description = "added_dashboard"
    uuid = "3ddc3d80-2593-468f-825a-425f816c892f"
    name = "added_dashboard"
    owner = "some_user"
    grid_items = []
    notes = ""
    public = False
    unrestricted_placement = False

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        owner,
        uuid,
        name,
        description,
        notes,
        public,
        unrestricted_placement,
        grid_items,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == owner
    assert not dashboard.public
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
    public = False
    unrestricted_placement = True

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        owner,
        uuid,
        name,
        description,
        notes,
        public,
        unrestricted_placement,
        grid_items,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == owner
    assert not dashboard.public
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
def test_delete_named_dashboard_id_doesnt_exist(
    dashboard, db_session, mock_app_get_ps_db
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    with pytest.raises(Exception) as excinfo:
        delete_named_dashboard("admin", 1000000000000000000)
    assert "A dashboard with the id 1000000000000000000 does not exist." in str(
        excinfo.value
    )

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == dashboard.id).all()
    )
    assert len(db_dashboard) == 1
    assert db_dashboard[0].name == dashboard.name


@pytest.mark.django_db
def test_delete_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    with pytest.raises(Exception) as excinfo:
        delete_named_dashboard("test_not_valid_user", dashboard.id)
    assert "User does not have admin permission to delete the dashboard." in str(
        excinfo.value
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
    update_named_dashboard(
        dashboard.owner,
        dashboard.id,
        {
            "name": new_dashboard_name,
            "notes": updated_notes,
            "public": True,
            "gridItems": grid_items,
            "unrestrictedPlacement": True,
            "permissions": [
                {"permission": "admin", "username": dashboard.owner},
            ],
        },
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert dashboard.notes == updated_notes
    assert len(dashboard.grid_items) == 2
    assert dashboard.grid_items[0].args_string == json.dumps({"uri": "some_path"})
    assert dashboard.grid_items[0].metadata_string == json.dumps({"refreshRate": 0})
    assert dashboard.public is True
    assert dashboard.unrestricted_placement
    assert len(dashboard.permissions) == 1
    assert dashboard.permissions[0].permission == DashboardPermissionLevel.admin
    assert dashboard.permissions[0].username == dashboard.owner

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
def test_update_named_dashboard_image(
    db_session, dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], dashboard.owner, False
    )
    assert (
        existing_dashboard[0]["image"]
        == "/static/tethysdash/images/dashboard_thumbnail.png"
    )

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
def test_update_named_dashboard_not_exist(mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    with pytest.raises(Exception) as excinfo:
        updated_notes = "Some new notes"
        updated_access_groups = ["public"]
        update_named_dashboard(
            "test_not_valid_user",
            12345678912345678912346789,
            {"notes": updated_notes, "accessGroups": updated_access_groups},
        )
    assert (
        "A dashboard with the id 12345678912345678912346789 does not exist for this user"  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_update_named_dashboard_no_edit_permissions(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    new_dashboard_name = "new_name"

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            "viewer",
            dashboard.id,
            {
                "name": new_dashboard_name,
            },
        )

    assert (
        "User does not have admin or editor permissions to update the dashboard."
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_update_named_dashboard_no_admin_permissions_for_name(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    new_dashboard_name = "new_name"

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            "editor",
            dashboard.id,
            {
                "name": new_dashboard_name,
            },
        )

    assert (
        "User does not have admin permission to change the name of the dashboard."
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_update_named_dashboard_no_admin_permissions_for_public(
    dashboard, mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            "editor",
            dashboard.id,
            {
                "public": True,
            },
        )

    assert (
        "User does not have admin permission to change the public status of the dashboard."  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_get_dashboards_all(
    dashboard, public_dashboard, mock_app_get_ps_db, mocker, tmp_path, permission_group
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    all_dashboards = get_dashboards(dashboard.owner)
    assert all_dashboards == [
        {
            "id": dashboard.id,
            "uuid": dashboard.uuid,
            "name": dashboard.name,
            "description": dashboard.description,
            "publicDashboard": dashboard.public,
            "userPermission": "admin",
            "permissions": [
                {"permission": "admin", "username": dashboard.owner},
                {"permission": "editor", "username": "editor"},
                {"permission": "viewer", "group": permission_group["name"]},
            ],
            "unrestrictedPlacement": dashboard.unrestricted_placement,
            "image": "/static/tethysdash/images/dashboard_thumbnail.png",
            "owner": dashboard.owner,
        },
        {
            "id": public_dashboard.id,
            "uuid": public_dashboard.uuid,
            "name": public_dashboard.name,
            "description": public_dashboard.description,
            "publicDashboard": public_dashboard.public,
            "userPermission": None,
            "permissions": [
                {"permission": "admin", "username": public_dashboard.owner}
            ],
            "unrestrictedPlacement": public_dashboard.unrestricted_placement,
            "image": "/static/tethysdash/images/dashboard_thumbnail.png",
            "owner": public_dashboard.owner,
        },
    ]


@pytest.mark.django_db
def test_get_dashboards_specific_dashboard_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, permission_group
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
        "gridItems": [],
        "image": "/static/tethysdash/images/dashboard_thumbnail.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
        "owner": dashboard.owner,
        "permissions": [
            {"permission": "admin", "username": dashboard.owner},
            {"permission": "editor", "username": "editor"},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
def test_get_dashboards_specific_landing_page_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, permission_group
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    retrieved_dashboard = get_dashboards(dashboard.owner, id=dashboard.id)
    assert retrieved_dashboard == {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/static/tethysdash/images/dashboard_thumbnail.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
        "owner": dashboard.owner,
        "permissions": [
            {"permission": "admin", "username": dashboard.owner},
            {"permission": "editor", "username": "editor"},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


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
        "some new user", dashboard.id, new_dashboard_name, "123456789"
    )

    assert copied_dashboard_uuid == "some_user_dashboard_uuid"
    copied_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.id == new_dashboard_id).first()
    )

    assert copied_dashboard.uuid == "123456789"
    assert copied_dashboard.description == new_description
    assert copied_dashboard.name == new_dashboard_name
    assert copied_dashboard.notes == dashboard.notes
    assert copied_dashboard.public == dashboard.public
    assert copied_dashboard.owner == "some new user"
    assert copied_dashboard.unrestricted_placement == dashboard.unrestricted_placement

    assert len(copied_dashboard.grid_items) == len(dashboard.grid_items) == 1
    assert dashboard.grid_items[0].dashboard_id == dashboard.id
    assert copied_dashboard.grid_items[0].dashboard_id == copied_dashboard.id


@pytest.mark.django_db
def test_parse_db_dashboard_landing_page_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, db_session, permission_group
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], dashboard.owner, dashboard_view=False
    )
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/static/tethysdash/images/dashboard_thumbnail.png",
        "unrestrictedPlacement": False,
        "owner": dashboard.owner,
        "permissions": [
            {"permission": "admin", "username": dashboard.owner},
            {"permission": "editor", "username": "editor"},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
def test_parse_db_dashboard_dashboard_view(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, db_session, permission_group
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], dashboard.owner, dashboard_view=True
    )
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/static/tethysdash/images/dashboard_thumbnail.png",
        "notes": dashboard.notes,
        "gridItems": [],
        "unrestrictedPlacement": False,
        "owner": dashboard.owner,
        "permissions": [
            {"permission": "admin", "username": dashboard.owner},
            {"permission": "editor", "username": "editor"},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
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


def test_init_primary_db_with_current_revision(mocker, mock_alembic):
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout="abcd1234 some message"),
    )

    mock_alembic.script.walk_revisions.return_value = []

    init_primary_db(engine=mocker.Mock(), first_time=True)

    mock_alembic.upgrade.assert_called_once_with(mock_alembic.config, "head")
    mock_alembic.stamp.assert_not_called()


def test_init_primary_db_no_current_revision_upgrade_all(mocker, mock_alembic):
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout=""),
    )

    rev1 = mocker.Mock(revision="rev1")
    rev2 = mocker.Mock(revision="rev2")
    mock_alembic.script.walk_revisions.return_value = [rev2, rev1]

    init_primary_db(engine=mocker.Mock(), first_time=True)

    assert mock_alembic.upgrade.call_count == 2
    mock_alembic.upgrade.assert_any_call(mock_alembic.config, "rev1")
    mock_alembic.upgrade.assert_any_call(mock_alembic.config, "rev2")
    mock_alembic.stamp.assert_not_called()


def test_init_primary_db_skips_existing_table(mocker, mock_alembic):
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout=""),
    )

    rev = mock_alembic.revision
    mock_alembic.script.walk_revisions.return_value = [rev]

    error = ProgrammingError("select 1", {}, Exception("relation already exists"))
    error.args = ("table already exists",)
    mock_alembic.upgrade.side_effect = error

    init_primary_db(engine=mocker.Mock(), first_time=True)

    mock_alembic.stamp.assert_called_once_with(mock_alembic.config, rev.revision)


def test_init_primary_db_raises_unexpected_error(mocker, mock_alembic):
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout=""),
    )

    rev = mock_alembic.revision
    mock_alembic.script.walk_revisions.return_value = [rev]

    error = ProgrammingError("select 1", {}, Exception("other error"))
    error.args = ("some other failure",)
    mock_alembic.upgrade.side_effect = error

    with pytest.raises(ProgrammingError):
        init_primary_db(engine=mocker.Mock(), first_time=True)

    mock_alembic.stamp.assert_not_called()


def test_get_dashboard_user_permission(dashboard, db_session):
    user_permission = get_dashboard_user_permission(
        db_session, dashboard, dashboard.owner
    )
    assert user_permission == DashboardPermissionLevel.admin

    user_permission = get_dashboard_user_permission(db_session, dashboard, "editor")
    assert user_permission == DashboardPermissionLevel.editor

    user_permission = get_dashboard_user_permission(
        db_session, dashboard, "member_user"
    )
    assert user_permission == DashboardPermissionLevel.viewer

    user_permission = get_dashboard_user_permission(db_session, dashboard, "bad_user")
    assert user_permission is None


def test_update_dashboard_permissions(dashboard, db_session, permission_group):
    updated_permissions = [
        {"username": "admin", "permission": DashboardPermissionLevel.admin.value},
        {"username": "editor", "permission": DashboardPermissionLevel.viewer.value},
        {"username": "newuser", "permission": DashboardPermissionLevel.viewer.value},
        {
            "group": permission_group["name"],
            "permission": DashboardPermissionLevel.editor.value,
        },
        {"group": "newgroup", "permission": DashboardPermissionLevel.editor.value},
    ]

    assert len(dashboard.permissions) == 3
    assert dashboard.permissions[0].username == "admin"
    assert dashboard.permissions[0].permission == DashboardPermissionLevel.admin

    assert dashboard.permissions[1].username == "editor"
    assert dashboard.permissions[1].permission == DashboardPermissionLevel.editor

    assert dashboard.permissions[2].group == permission_group["name"]
    assert dashboard.permissions[2].permission == DashboardPermissionLevel.viewer

    update_dashboard_permissions(
        db_session,
        dashboard,
        "admin",
        updated_permissions,
    )

    permissions = (
        db_session.query(DashboardPermission).filter_by(dashboard_id=dashboard.id).all()
    )

    assert permissions[0].username == "admin"
    assert permissions[0].permission == DashboardPermissionLevel.admin

    assert permissions[1].username == "editor"
    assert permissions[1].permission == DashboardPermissionLevel.viewer

    assert permissions[2].group == permission_group["name"]
    assert permissions[2].permission == DashboardPermissionLevel.editor

    assert permissions[3].username == "newuser"
    assert permissions[3].permission == DashboardPermissionLevel.viewer

    assert permissions[4].group == "newgroup"
    assert permissions[4].permission == DashboardPermissionLevel.editor


def test_update_dashboard_permissions_not_admin(dashboard, db_session):

    with pytest.raises(Exception) as excinfo:
        update_dashboard_permissions(db_session, dashboard, "editor", [])
    assert (
        "User does not have admin permission to change the permissions of the dashboard."  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_get_user_permission_groups(
    mock_app_get_ps_db, permission_group, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_groups = get_user_permission_groups(
        "member_user",
    )

    assert len(permission_groups) == 1
    assert permission_groups[0]["name"] == permission_group["name"]
    assert permission_groups[0]["description"] == permission_group["description"]
    assert permission_groups[0]["owner"] == permission_group["owner"]
    assert permission_groups[0]["user_permission"] == GroupPermissionLevel.member.value
    assert permission_groups[0]["members"][0]["username"] == "owner_user"
    assert (
        permission_groups[0]["members"][0]["permission"]
        == GroupPermissionLevel.admin.value
    )

    assert permission_groups[0]["members"][1]["username"] == "admin_user"
    assert (
        permission_groups[0]["members"][1]["permission"]
        == GroupPermissionLevel.admin.value
    )

    assert permission_groups[0]["members"][2]["username"] == "member_user"
    assert (
        permission_groups[0]["members"][2]["permission"]
        == GroupPermissionLevel.member.value
    )

    permission_groups = get_user_permission_groups(
        "bad_user",
    )

    assert len(permission_groups) == 0


@pytest.mark.django_db
def test_update_permission_group(
    mock_app_get_ps_db, permission_group, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    updated_members = [
        {"username": "owner_user", "permission": GroupPermissionLevel.admin.value},
        {"username": "editor", "permission": GroupPermissionLevel.member.value},
        {"username": "viewer", "permission": GroupPermissionLevel.admin.value},
    ]
    updated_permission_group = permission_group
    updated_permission_group["members"] = updated_members
    updated_permission_group["description"] = "some new description"
    updated_permission_group["id"] = permission_group_table.id

    assert len(permission_group_table.members) == 3
    assert permission_group_table.members[0].username == "owner_user"
    assert permission_group_table.members[0].permission == GroupPermissionLevel.admin

    assert permission_group_table.members[1].username == "admin_user"
    assert permission_group_table.members[1].permission == GroupPermissionLevel.admin

    assert permission_group_table.members[2].username == "member_user"
    assert permission_group_table.members[2].permission == GroupPermissionLevel.member

    permission_group_dict = update_permission_groups(
        "owner_user",
        updated_permission_group,
    )

    assert permission_group_dict["description"] == "some new description"
    assert permission_group_dict["members"][0]["username"] == "owner_user"
    assert (
        permission_group_dict["members"][0]["permission"]
        == GroupPermissionLevel.admin.value
    )

    assert permission_group_dict["members"][1]["username"] == "editor"
    assert (
        permission_group_dict["members"][1]["permission"]
        == GroupPermissionLevel.member.value
    )

    assert permission_group_dict["members"][2]["username"] == "viewer"
    assert (
        permission_group_dict["members"][2]["permission"]
        == GroupPermissionLevel.admin.value
    )


@pytest.mark.django_db
def test_update_permission_group_but_group_doesnt_exist(
    mock_app_get_ps_db, permission_group
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_group = {
        "name": "new group",
        "id": 100000000000000000000,
    }

    permission_group_dict = update_permission_groups(
        "admin",
        permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert permission_group_dict["message"] == "Group not found"


@pytest.mark.django_db
def test_update_permission_group_but_not_admin(
    mock_app_get_ps_db, permission_group, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    updated_permission_group = permission_group
    updated_permission_group["id"] = permission_group_table.id

    permission_group_dict = update_permission_groups(
        "viewer",
        updated_permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert permission_group_dict["message"] == "User is not owner or admin in group"


@pytest.mark.django_db
def test_update_permission_group_but_new_name_already_exists(
    mock_app_get_ps_db, db_session, permission_group, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    group = PermissionGroup(
        name="new_group",
        description="",
        owner="admin",
    )
    db_session.add(group)
    db_session.flush()

    updated_permission_group = {
        "name": permission_group["name"],
        "id": group.id,
    }

    permission_group_dict = update_permission_groups(
        "admin",
        updated_permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert (
        permission_group_dict["message"]
        == f"The group name {permission_group['name']} already exists"
    )


@pytest.mark.django_db
def test_create_permission_group_then_update(mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_group = {
        "name": "new group",
        "description": "a new group description",
        "members": [
            {
                "username": "admin",
                "permission": "admin",
            },
            {
                "username": "viewer",
                "permission": "admin",
            },
        ],
    }

    permission_group_dict = update_permission_groups(
        "admin",
        permission_group,
    )

    assert permission_group_dict["name"] == permission_group["name"]
    assert permission_group_dict["description"] == permission_group["description"]
    assert permission_group_dict["owner"] == "admin"
    assert permission_group_dict["user_permission"] == GroupPermissionLevel.admin.value
    assert (
        permission_group_dict["members"][0]["username"]
        == permission_group["members"][0]["username"]
    )
    assert (
        permission_group_dict["members"][0]["permission"]
        == GroupPermissionLevel.admin.value
    )

    assert (
        permission_group_dict["members"][1]["username"]
        == permission_group["members"][1]["username"]
    )
    assert (
        permission_group_dict["members"][1]["permission"]
        == GroupPermissionLevel.admin.value
    )

    updated_permission_group = {
        "name": "some new group",
        "description": "some new group description",
        "members": [
            {
                "username": "admin",
                "permission": "admin",
            },
            {
                "username": "viewer",
                "permission": "admin",
            },
            {
                "username": "new_user",
                "permission": "member",
            },
        ],
    }
    updated_permission_group["id"] = permission_group_dict["id"]

    permission_group_dict = update_permission_groups(
        "viewer",
        updated_permission_group,
    )

    assert permission_group_dict["name"] == updated_permission_group["name"]
    assert (
        permission_group_dict["description"] == updated_permission_group["description"]
    )
    assert permission_group_dict["owner"] == "admin"
    assert permission_group_dict["user_permission"] == GroupPermissionLevel.admin.value
    assert (
        permission_group_dict["members"][0]["username"]
        == updated_permission_group["members"][0]["username"]
    )
    assert (
        permission_group_dict["members"][0]["permission"]
        == GroupPermissionLevel.admin.value
    )

    assert permission_group_dict["members"][1]["username"] == "viewer"
    assert (
        permission_group_dict["members"][1]["permission"]
        == GroupPermissionLevel.admin.value
    )


@pytest.mark.django_db
def test_create_permission_group_but_names_already_exists(
    mock_app_get_ps_db, permission_group, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_group_dict = update_permission_groups(
        "admin_user",
        permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert permission_group["name"] == permission_group_table.name
    assert (
        permission_group_dict["message"]
        == f"The group name {permission_group['name']} already exists"
    )


@pytest.mark.django_db
def test_delete_permission_groups(
    mock_app_get_ps_db, db_session, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    group_id = permission_group_table.id
    delete_status = delete_permission_groups("owner_user", group_id)

    db_session.expire_all()
    assert delete_status["status"] == "deleted"
    db_perm_group = db_session.query(PermissionGroup).get(group_id)
    assert db_perm_group is None


@pytest.mark.django_db
def test_delete_permission_groups_by_admin_access(
    mock_app_get_ps_db, db_session, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    group_id = permission_group_table.id
    delete_status = delete_permission_groups("admin_user", group_id)

    db_session.expire_all()
    assert delete_status["status"] == "deleted"
    db_perm_group = db_session.query(PermissionGroup).get(group_id)
    assert db_perm_group is None


@pytest.mark.django_db
def test_delete_permission_groups_failed_by_member_access(
    mock_app_get_ps_db, db_session, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    group_id = permission_group_table.id
    delete_status = delete_permission_groups("member_user", group_id)

    assert delete_status["status"] == "error"
    assert delete_status["message"] == "User is not owner or admin in group"


@pytest.mark.django_db
def test_delete_permission_groups_id_not_found(mock_app_get_ps_db, db_session):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    delete_status = delete_permission_groups("owner_user", 100000000000000000000)

    db_session.expire_all()
    assert delete_status["status"] == "error"
    assert delete_status["message"] == "Group not found"
