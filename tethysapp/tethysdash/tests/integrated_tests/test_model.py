import pytest
import json
from tethysapp.tethysdash.model import (
    add_new_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
    copy_named_dashboard,
    get_dashboards,
    add_new_grid_item,
    Dashboard,
    GridItem,
    DashboardPermission,
    VisualizationPermission,
    PermissionGroup,
    Message,
    parse_db_dashboard,
    clean_up_jsons,
    init_primary_db,
    get_dashboard_user_permission,
    update_dashboard_permissions,
    update_permission_groups,
    get_user_permission_groups,
    delete_permission_groups,
    get_visualization_user_permission,
    get_visualization_permissions,
    update_visualization_permissions,
)
from unittest.mock import MagicMock, call
import base64
import os
from pathlib import Path
from types import SimpleNamespace
from sqlalchemy.exc import ProgrammingError
from django.contrib.auth.models import AnonymousUser
from django.test import override_settings
from uuid import uuid4
from datetime import datetime


@pytest.fixture
def mock_alembic(mocker):
    # Patch alembic components
    mock_cfg = mocker.Mock()
    mock_script = mocker.Mock()
    mock_revision = mocker.Mock(revision="1234")

    mocker.patch("tethysapp.tethysdash.model.config", return_value=mock_cfg)
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
def test_add_and_delete_dashboard(db_session, mock_app_get_ps_db, test_owner_user):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    description = "added_dashboard"
    uuid = str(uuid4())
    name = "added_dashboard"
    grid_items = []
    tabs = []
    notes = ""
    public = False
    unrestricted_placement = False

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        test_owner_user,
        uuid,
        name,
        description,
        notes,
        public,
        unrestricted_placement,
        grid_items,
        tabs,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == test_owner_user.username
    assert not dashboard.public
    assert not dashboard.unrestricted_placement
    dashboard_id = dashboard.id

    assert len(dashboard.tabs) == 1
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
    uuid = str(uuid4())
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
        uuid,
        dashboard.tabs[0].id,
    )

    new_grid_item = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item.id).first()
    )
    assert new_grid_item.x == grid_item_x
    assert new_grid_item.w == grid_item_w
    assert new_grid_item.uuid == uuid
    new_grid_item_id = new_grid_item.id

    # Delete the dashboard and Verify dashboard, rows, and columns were deleted
    delete_named_dashboard(test_owner_user, dashboard_id)

    dashboard = db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).all()
    assert len(dashboard) == 0
    grid_items = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item_id).all()
    )
    assert len(grid_items) == 0


@pytest.mark.django_db
def test_add_and_delete_dashboard_with_grid_items(
    db_session, mock_app_get_ps_db, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    description = "added_dashboard"
    uuid = str(uuid4())
    name = "added_dashboard"
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
    tabs = []

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        test_owner_user,
        uuid,
        name,
        description,
        notes,
        public,
        unrestricted_placement,
        grid_items,
        tabs,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.uuid == uuid).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == test_owner_user.username
    assert not dashboard.public
    assert dashboard.unrestricted_placement
    dashboard_id = dashboard.id

    assert len(dashboard.tabs) == 1
    assert dashboard.tabs[0].name == "Main"
    assert len(dashboard.grid_items) == 1
    # Check grid item order
    assert dashboard.grid_items[0].order == 0
    assert dashboard.grid_items[0].x == 1
    assert dashboard.grid_items[0].w == 1
    assert dashboard.grid_items[0].source == "Text"
    assert dashboard.grid_items[0].args_string == json.dumps({"text": "Some text"})
    grid_item_id = dashboard.grid_items[0].id

    # Delete the dashboard and Verify dashboard, rows, and columns were deleted
    delete_named_dashboard(test_owner_user, dashboard_id)

    dashboard = db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).all()
    assert len(dashboard) == 0
    grid_items = db_session.query(GridItem).filter(GridItem.id == grid_item_id).all()
    assert len(grid_items) == 0


@pytest.mark.django_db
def test_add_dashboard_with_tabs(db_session, mock_app_get_ps_db, test_owner_user):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    description = "added_dashboard"
    uuid = str(uuid4())
    name = "added_dashboard"
    tabs = [
        {
            "name": "A tab",
            "gridItems": [
                {
                    "i": "2",
                    "x": 1,
                    "y": 1,
                    "w": 1,
                    "h": 1,
                    "source": "Text",
                    "uuid": "12345678-1234-5678-1234-567812345678",
                    "args_string": json.dumps({"text": "Some text"}),
                    "metadata_string": json.dumps({}),
                }
            ],
        }
    ]
    notes = ""
    public = False
    unrestricted_placement = True
    grid_items = []

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(
        test_owner_user,
        uuid,
        name,
        description,
        notes,
        public,
        unrestricted_placement,
        grid_items,
        tabs,
    )

    dashboard = db_session.query(Dashboard).filter(Dashboard.uuid == uuid).first()
    assert dashboard.description == description
    assert dashboard.name == name
    assert dashboard.notes == ""
    assert dashboard.uuid == uuid
    assert dashboard.owner == test_owner_user.username
    assert not dashboard.public
    assert dashboard.unrestricted_placement

    assert len(dashboard.tabs) == 1
    assert dashboard.tabs[0].name == "A tab"
    assert len(dashboard.grid_items) == 1
    # Check grid item order
    assert dashboard.grid_items[0].order == 0
    assert dashboard.grid_items[0].x == 1
    assert dashboard.grid_items[0].w == 1
    assert dashboard.grid_items[0].source == "Text"
    assert dashboard.grid_items[0].args_string == json.dumps({"text": "Some text"})

    uuid = str(uuid4())
    new_grid_item = add_new_grid_item(
        db_session,
        dashboard.id,
        "2",
        1,
        1,
        1,
        1,
        "Text",
        {"text": "Some more text"},
        {"refreshRate": 0},
        1,
        uuid,
        dashboard.tabs[0].id,
    )

    new_grid_item = (
        db_session.query(GridItem).filter(GridItem.id == new_grid_item.id).first()
    )
    assert new_grid_item.uuid == uuid
    assert new_grid_item.uuid != "12345678-1234-5678-1234-567812345678"


@pytest.mark.django_db
def test_delete_named_dashboard(
    dashboard, db_session, mock_app_get_ps_db, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    delete_named_dashboard(test_owner_user, dashboard.id)

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.uuid == dashboard.uuid).all()
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
        db_session.query(Dashboard).filter(Dashboard.uuid == dashboard.uuid).all()
    )
    assert len(db_dashboard) == 1
    assert db_dashboard[0].name == dashboard.name


@pytest.mark.django_db
def test_delete_named_dashboard_not_allowed(
    dashboard, db_session, mock_app_get_ps_db, test_admin_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    with pytest.raises(Exception) as excinfo:
        delete_named_dashboard(test_admin_user, dashboard.id)
    assert "User does not have admin permission to delete the dashboard." in str(
        excinfo.value
    )

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.uuid == dashboard.uuid).all()
    )
    assert len(db_dashboard) == 1
    assert db_dashboard[0].name == dashboard.name


@pytest.mark.django_db
def test_update_named_dashboard_grid_items(
    dashboard, db_session, mock_app_get_ps_db, mocker, tmp_path, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    new_dashboard_name = "new_name"

    grid_items1 = [
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Custom Image",
            "args_string": json.dumps({"uri": "some_path"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
            "uuid": str(uuid4()),
        },
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 3,
            "h": 3,
            "source": "Text",
            "args_string": json.dumps({"text": "some text"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
            "uuid": str(uuid4()),
        },
    ]

    grid_items2 = [
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Custom Image",
            "args_string": json.dumps({"uri": "some_path"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
            "uuid": str(uuid4()),
        },
    ]
    tabs = [
        {"name": "Grid1", "gridItems": grid_items1},
        {"name": "Grid2", "gridItems": grid_items2},
    ]

    # Add 2 new tabs with grid items
    updated_notes = "Some new notes"
    update_named_dashboard(
        test_owner_user,
        dashboard.id,
        {
            "name": new_dashboard_name,
            "notes": updated_notes,
            "public": True,
            "tabs": tabs,
            "unrestrictedPlacement": True,
            "permissions": [
                {"permission": "admin", "username": test_owner_user.username},
            ],
        },
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert dashboard.notes == updated_notes
    assert len(dashboard.tabs) == 2
    # Check tab order
    assert dashboard.tabs[0].tab_order == 0
    assert dashboard.tabs[1].tab_order == 1
    assert dashboard.tabs[0].name == "Grid1"
    assert dashboard.tabs[1].name == "Grid2"
    assert len(dashboard.tabs[0].grid_items) == 2
    assert dashboard.tabs[0].grid_items[0].order == 0
    assert dashboard.tabs[0].grid_items[1].order == 1
    assert dashboard.tabs[0].grid_items[0].args_string == json.dumps(
        {"uri": "some_path"}
    )
    assert dashboard.tabs[0].grid_items[0].metadata_string == json.dumps(
        {"refreshRate": 0}
    )
    assert dashboard.public is True
    assert dashboard.unrestricted_placement
    assert len(dashboard.permissions) == 1
    assert dashboard.permissions[0].permission == "admin"
    assert dashboard.permissions[0].username == dashboard.owner

    grid_item1 = dashboard.tabs[0].grid_items[0]
    grid_item2 = dashboard.tabs[0].grid_items[1]
    grid_item2_id = grid_item2.id

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
            "uuid": grid_item1.uuid,
        },
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 4,
            "h": 4,
            "source": "Text",
            "args_string": json.dumps({"text": "some text"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
            "uuid": str(uuid4()),
        },
    ]

    # delete a tab, delete a grid item, update grid item, add grid item to existing tab
    update_named_dashboard(
        test_owner_user,
        dashboard.id,
        {
            "tabs": [
                {
                    "id": dashboard.tabs[0].id,
                    "name": "Grid",
                    "gridItems": updated_grid_item,
                }
            ],
        },
    )

    db_session.refresh(dashboard)
    assert dashboard.name == new_dashboard_name
    assert len(dashboard.tabs) == 1
    # Check tab order after update
    assert dashboard.tabs[0].tab_order == 0
    assert dashboard.tabs[0].name == "Grid"
    assert len(dashboard.tabs[0].grid_items) == 2
    # Check grid item order after update
    assert dashboard.tabs[0].grid_items[0].order == 0
    assert dashboard.tabs[0].grid_items[1].order == 1

    db_session.refresh(dashboard.tabs[0].grid_items[0])
    assert dashboard.tabs[0].grid_items[0].w == 2
    assert dashboard.tabs[0].grid_items[0].h == 2
    assert dashboard.tabs[0].grid_items[0].metadata_string == json.dumps(
        {"refreshRate": 30}
    )

    # newly added grid item should have a different id than the deleted one
    assert dashboard.tabs[0].grid_items[1].id != grid_item2_id


@pytest.mark.django_db
def test_update_named_dashboard_image(
    db_session, dashboard, mock_app_get_ps_db, mocker, tmp_path, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], test_owner_user, False
    )
    assert (
        existing_dashboard[0]["image"]
        == "/static/tethysdash/images/default_dashboard.png"
    )

    example_image = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "files/thumbnail.png",
    )
    with open(example_image, "rb") as image_file:
        base64_string = base64.b64encode(image_file.read()).decode("utf-8")

    image = f"data:image/png;base64,{base64_string}"
    updated_dashboard = update_named_dashboard(
        test_owner_user,
        dashboard.id,
        {
            "image": image,
        },
    )

    assert (
        updated_dashboard["image"]
        == "/media/tethysdash/app/some_user_dashboard_uuid.png"
    )


@pytest.mark.django_db
def test_update_named_dashboard_live_chat(
    db_session,
    live_chat_dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    test_owner_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    tab_id = live_chat_dashboard.tabs[0].id
    grid_item_id = live_chat_dashboard.tabs[0].grid_items[0].id
    grid_item_uuid = live_chat_dashboard.tabs[0].grid_items[0].uuid

    message = Message(
        timestamp=datetime.utcnow(),
        request_id=grid_item_uuid,
        session_id="some_session_id",
        message_id="some_message_id",
        sender="user",
        message="Hello, this is a test message.",
    )
    db_session.add(message)
    db_session.commit()
    db_session.refresh(message)

    message = db_session.query(Message).filter(Message.id == message.id).first()
    message_id = message.id
    assert message is not None

    update_named_dashboard(
        test_owner_user,
        live_chat_dashboard.id,
        {
            "tabs": [
                {
                    "name": "Tab 1",
                    "id": tab_id,
                    "gridItems": [
                        {
                            "id": grid_item_id,
                            "i": "1",
                            "x": 1,
                            "y": 1,
                            "w": 1,
                            "h": 1,
                            "source": "text",
                            "args_string": json.dumps({}),
                            "metadata_string": json.dumps({"refreshRate": 0}),
                            "uuid": grid_item_uuid,
                        }
                    ],
                }
            ]
        },
    )

    old_messages = db_session.query(Message).filter(Message.id == message_id).first()
    assert old_messages is None


@pytest.mark.django_db
def test_update_named_dashboard_not_exist(mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    with pytest.raises(Exception) as excinfo:
        updated_notes = "Some new notes"
        updated_access_groups = ["public"]
        update_named_dashboard(
            "test_not_valid_user",
            1234,
            {"notes": updated_notes, "accessGroups": updated_access_groups},
        )
    assert (
        "A dashboard with the id 1234 does not exist for this user"  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_update_named_dashboard_no_edit_permissions(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, test_member_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    new_dashboard_name = "new_name"

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            test_member_user,
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
    dashboard, mock_app_get_ps_db, mocker, tmp_path, test_admin_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    new_dashboard_name = "new_name"

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            test_admin_user,
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
    dashboard, mock_app_get_ps_db, mocker, tmp_path, test_admin_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    with pytest.raises(Exception) as excinfo:
        update_named_dashboard(
            test_admin_user,
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
    dashboard,
    public_dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    permission_group,
    test_owner_user,
    test_admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    all_dashboards = get_dashboards(test_owner_user)
    assert all_dashboards == [
        {
            "id": dashboard.id,
            "uuid": dashboard.uuid,
            "name": dashboard.name,
            "description": dashboard.description,
            "publicDashboard": dashboard.public,
            "userPermission": "admin",
            "permissions": [
                {"permission": "admin", "username": test_owner_user.username},
                {"permission": "editor", "username": test_admin_user.username},
                {"permission": "viewer", "group": permission_group["name"]},
            ],
            "unrestrictedPlacement": dashboard.unrestricted_placement,
            "image": "/static/tethysdash/images/default_dashboard.png",
            "owner": test_owner_user.username,
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
            "image": "/static/tethysdash/images/default_dashboard.png",
            "owner": public_dashboard.owner,
        },
    ]


@pytest.mark.django_db
def test_get_dashboards_specific_dashboard_view(
    dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    permission_group,
    test_owner_user,
    test_admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    retrieved_dashboard = get_dashboards(
        test_owner_user, dashboard_view=True, id=dashboard.id
    )
    assert retrieved_dashboard == {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "notes": dashboard.notes,
        "tabs": [],
        "image": "/static/tethysdash/images/default_dashboard.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
        "owner": test_owner_user.username,
        "permissions": [
            {"permission": "admin", "username": test_owner_user.username},
            {"permission": "editor", "username": test_admin_user.username},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
def test_get_dashboards_specific_landing_page_view(
    dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    permission_group,
    test_owner_user,
    test_admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    retrieved_dashboard = get_dashboards(test_owner_user, id=dashboard.id)
    assert retrieved_dashboard == {
        "id": dashboard.id,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/static/tethysdash/images/default_dashboard.png",
        "uuid": "some_user_dashboard_uuid",
        "unrestrictedPlacement": False,
        "owner": test_owner_user.username,
        "permissions": [
            {"permission": "admin", "username": test_owner_user.username},
            {"permission": "editor", "username": test_admin_user.username},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
def test_copy_named_dashboard(
    dashboard,
    db_session,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    test_owner_user,
    test_member_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    new_dashboard_name = "new_name"
    new_description = "some updated descripion"
    tabs = [
        {
            "id": 1,
            "name": "Tab 1",
            "gridItems": [
                {
                    "i": "1",
                    "x": 1,
                    "y": 1,
                    "w": 1,
                    "h": 1,
                    "source": "Custom Image",
                    "args_string": json.dumps({"uri": "some_path"}),
                    "metadata_string": json.dumps({"refreshRate": 0}),
                    "uuid": str(uuid4()),
                },
            ],
        }
    ]

    # Add rows/cells and update dashboards
    update_named_dashboard(
        test_owner_user,
        dashboard.id,
        {
            "tabs": tabs,
            "description": new_description,
        },
    )

    # Add rows/cells and update dashboards
    new_dashboard_id, copied_dashboard_uuid = copy_named_dashboard(
        test_member_user, dashboard.id, new_dashboard_name, "123456789"
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
    assert copied_dashboard.owner == test_member_user.username
    assert copied_dashboard.unrestricted_placement == dashboard.unrestricted_placement

    assert len(copied_dashboard.tabs) == len(dashboard.tabs) == 1
    # Check tab order in copied dashboard
    assert copied_dashboard.tabs[0].tab_order == dashboard.tabs[0].tab_order == 0
    assert copied_dashboard.tabs[0].name == dashboard.tabs[0].name
    assert (
        len(copied_dashboard.tabs[0].grid_items)
        == len(dashboard.tabs[0].grid_items)
        == 1
    )
    # Check grid item order in copied dashboard
    assert (
        copied_dashboard.tabs[0].grid_items[0].order
        == dashboard.tabs[0].grid_items[0].order
        == 0
    )
    assert dashboard.tabs[0].grid_items[0].dashboard_id == dashboard.id
    assert copied_dashboard.tabs[0].grid_items[0].dashboard_id == copied_dashboard.id
    assert len(copied_dashboard.permissions) == 1
    assert copied_dashboard.permissions[0].permission == "admin"
    assert copied_dashboard.permissions[0].username == test_member_user.username


@pytest.mark.django_db
def test_parse_db_dashboard_landing_page_view(
    dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    db_session,
    permission_group,
    test_owner_user,
    test_admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], test_owner_user, dashboard_view=False
    )
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/static/tethysdash/images/default_dashboard.png",
        "unrestrictedPlacement": False,
        "owner": test_owner_user.username,
        "permissions": [
            {"permission": "admin", "username": test_owner_user.username},
            {"permission": "editor", "username": test_admin_user.username},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
@override_settings(PREFIX_URL="test")
def test_parse_db_dashboard_landing_page_view_with_prefix(
    dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    db_session,
    permission_group,
    test_owner_user,
    test_admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)
    mocker.patch("os.path.exists", return_value=True)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], test_owner_user, dashboard_view=False
    )
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/test/media/tethysdash/app/some_user_dashboard_uuid.png",
        "unrestrictedPlacement": False,
        "owner": test_owner_user.username,
        "permissions": [
            {"permission": "admin", "username": test_owner_user.username},
            {"permission": "editor", "username": test_admin_user.username},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
def test_parse_db_dashboard_dashboard_view(
    dashboard,
    mock_app_get_ps_db,
    mocker,
    tmp_path,
    db_session,
    permission_group,
    test_owner_user,
    test_admin_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mock_get_app_media = mocker.patch("tethysapp.tethysdash.model.get_app_media")
    mock_get_app_media.return_value = MagicMock(path=tmp_path)

    existing_dashboard = parse_db_dashboard(
        db_session, [dashboard], test_owner_user, dashboard_view=True
    )
    assert existing_dashboard[0] == {
        "id": dashboard.id,
        "uuid": dashboard.uuid,
        "name": dashboard.name,
        "description": dashboard.description,
        "image": "/static/tethysdash/images/default_dashboard.png",
        "notes": dashboard.notes,
        "tabs": [],
        "unrestrictedPlacement": False,
        "owner": test_owner_user.username,
        "permissions": [
            {"permission": "admin", "username": test_owner_user.username},
            {"permission": "editor", "username": test_admin_user.username},
            {"permission": "viewer", "group": permission_group["name"]},
        ],
        "publicDashboard": False,
        "userPermission": "admin",
    }


@pytest.mark.django_db
def test_clean_up_jsons(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, test_owner_user
):
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
            "uuid": str(uuid4()),
        },
    ]

    dashboard_folder = os.path.join(workspace_path, dashboard.uuid)
    os.makedirs(dashboard_folder, exist_ok=True)

    used_geojson_file = os.path.join(dashboard_folder, "used_geojson.geojson")
    Path(used_geojson_file).touch()

    unused_geojson_file = os.path.join(dashboard_folder, "unused_geojson.geojson")
    Path(unused_geojson_file).touch()

    nonuser_geojson_file = os.path.join(dashboard_folder, "nonuser_geojson.geojson")
    Path(nonuser_geojson_file).touch()

    used_style_file = os.path.join(dashboard_folder, "used_style.json")
    Path(used_style_file).touch()

    unused_style_file = os.path.join(dashboard_folder, "unused_style.json")
    Path(unused_style_file).touch()

    nonuser_style_file = os.path.join(dashboard_folder, "nonuser_style.json")
    Path(nonuser_style_file).touch()

    # Add rows/cells and update dashboards
    update_named_dashboard(
        test_owner_user,
        dashboard.id,
        {"tabs": [{"name": "Tab 1", "gridItems": grid_items}]},
    )

    clean_up_jsons(test_owner_user)

    assert os.path.exists(used_geojson_file)
    assert not os.path.exists(unused_geojson_file)
    assert not os.path.exists(nonuser_geojson_file)

    assert os.path.exists(used_style_file)
    assert not os.path.exists(unused_style_file)
    assert not os.path.exists(nonuser_style_file)


@pytest.mark.django_db
def test_clean_up_jsons_no_existing_dashboard_folder(
    dashboard, mock_app_get_ps_db, mocker, tmp_path, test_owner_user
):
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
            "uuid": str(uuid4()),
        },
    ]

    # Add rows/cells and update dashboards
    update_named_dashboard(
        test_owner_user,
        dashboard.id,
        {"tabs": [{"name": "Tab 1", "gridItems": grid_items}]},
    )

    mock_remove = mocker.patch("os.remove")
    clean_up_jsons(test_owner_user)
    mock_remove.assert_not_called()


@pytest.mark.django_db
def test_init_primary_db_with_current_revision(mock_app_get_ps_db, mocker, tmp_path):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout="abcd1234 some message"),
    )
    mock_cfg = mocker.patch("tethysapp.tethysdash.model.config")
    mock_command = mocker.patch("tethysapp.tethysdash.model.command")
    mock_script = mocker.patch(
        "tethysapp.tethysdash.model.script",
    )

    workspace_path = tmp_path
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    mock_script.walk_revisions.return_value = []

    init_primary_db(engine=mocker.Mock(), first_time=True)

    mock_command.upgrade.assert_called_once_with(mock_cfg.Config(), "head")
    mock_command.stamp.assert_not_called()


@pytest.mark.django_db
def test_init_primary_db_no_current_revision_upgrade_all(
    mock_app_get_ps_db, mocker, tmp_path
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout=""),
    )
    mock_cfg = mocker.patch("tethysapp.tethysdash.model.config")
    mock_command = mocker.patch("tethysapp.tethysdash.model.command")
    mock_script = mocker.patch(
        "tethysapp.tethysdash.model.script",
    )

    workspace_path = tmp_path
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    rev1 = mocker.Mock(revision="rev1")
    rev2 = mocker.Mock(revision="rev2")
    mock_script.ScriptDirectory.from_config().walk_revisions.return_value = [rev2, rev1]

    init_primary_db(engine=mocker.Mock(), first_time=True)

    assert mock_command.upgrade.call_count == 2
    mock_command.upgrade.assert_any_call(mock_cfg.Config(), "rev1")
    mock_command.upgrade.assert_any_call(mock_cfg.Config(), "rev2")
    mock_command.stamp.assert_not_called()


@pytest.mark.django_db
def test_init_primary_db_skips_existing_table(mock_app_get_ps_db, mocker, tmp_path):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout=""),
    )
    mock_cfg = mocker.patch("tethysapp.tethysdash.model.config")
    mock_command = mocker.patch("tethysapp.tethysdash.model.command")
    mock_script = mocker.patch(
        "tethysapp.tethysdash.model.script",
    )

    workspace_path = tmp_path
    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=workspace_path)

    rev = mock_script.revision
    mock_script.ScriptDirectory.from_config().walk_revisions.return_value = [rev]

    error = ProgrammingError("select 1", {}, Exception("relation already exists"))
    error.args = ("table already exists",)
    mock_command.upgrade.side_effect = error

    init_primary_db(engine=mocker.Mock(), first_time=True)

    mock_command.stamp.assert_called_once_with(mock_cfg.Config(), rev.revision)


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


def test_get_dashboard_user_permission(
    dashboard, db_session, test_owner_user, test_member_user, test_admin_user
):
    user_permission = get_dashboard_user_permission(
        db_session, dashboard, test_owner_user
    )
    assert user_permission == "admin"

    user_permission = get_dashboard_user_permission(
        db_session, dashboard, test_admin_user
    )
    assert user_permission == "editor"

    user_permission = get_dashboard_user_permission(
        db_session, dashboard, test_member_user
    )
    assert user_permission == "viewer"

    user_permission = get_dashboard_user_permission(
        db_session, dashboard, AnonymousUser()
    )
    assert user_permission is None


def test_update_dashboard_permissions(
    dashboard,
    db_session,
    permission_group,
    test_owner_user,
    test_admin_user,
    test_member_user,
):
    assert len(dashboard.permissions) == 3
    assert dashboard.permissions[0].username == test_owner_user.username
    assert dashboard.permissions[0].permission == "admin"

    assert dashboard.permissions[1].username == test_admin_user.username
    assert dashboard.permissions[1].permission == "editor"

    assert dashboard.permissions[2].group.name == permission_group["name"]
    assert dashboard.permissions[2].permission == "viewer"

    updated_permissions = [
        {
            "username": test_owner_user.username,
            "permission": "admin",
        },
        {
            "username": test_admin_user.username,
            "permission": "viewer",
        },
        {
            "username": test_member_user.username,
            "permission": "viewer",
        },
        {
            "group": permission_group["name"],
            "permission": "editor",
        },
    ]

    update_dashboard_permissions(
        db_session,
        dashboard,
        test_owner_user,
        updated_permissions,
    )

    permissions = (
        db_session.query(DashboardPermission).filter_by(dashboard_id=dashboard.id).all()
    )

    assert len(permissions) == 4
    assert permissions[0].username == test_owner_user.username
    assert permissions[0].permission == "admin"

    assert permissions[1].username == test_admin_user.username
    assert permissions[1].permission == "viewer"

    assert permissions[2].group.name == permission_group["name"]
    assert permissions[2].permission == "editor"

    assert permissions[3].username == test_member_user.username
    assert permissions[3].permission == "viewer"

    updated_permissions = []

    update_dashboard_permissions(
        db_session,
        dashboard,
        test_owner_user,
        updated_permissions,
    )

    permissions = (
        db_session.query(DashboardPermission).filter_by(dashboard_id=dashboard.id).all()
    )

    assert len(permissions) == 1
    assert permissions[0].username == test_owner_user.username
    assert permissions[0].permission == "admin"

    updated_permissions = [
        {
            "username": test_owner_user.username,
            "permission": "admin",
        },
        {
            "username": test_admin_user.username,
            "permission": "viewer",
        },
        {
            "username": test_member_user.username,
            "permission": "viewer",
        },
        {
            "group": permission_group["name"],
            "permission": "editor",
        },
    ]

    update_dashboard_permissions(
        db_session,
        dashboard,
        test_owner_user,
        updated_permissions,
    )

    permissions = (
        db_session.query(DashboardPermission).filter_by(dashboard_id=dashboard.id).all()
    )

    assert len(permissions) == 4
    assert permissions[0].username == test_owner_user.username
    assert permissions[0].permission == "admin"

    assert permissions[1].username == test_admin_user.username
    assert permissions[1].permission == "viewer"

    assert permissions[2].username == test_member_user.username
    assert permissions[2].permission == "viewer"

    assert permissions[3].group.name == permission_group["name"]
    assert permissions[3].permission == "editor"


def test_update_dashboard_permissions_nonexisting_user(
    dashboard,
    db_session,
    test_owner_user,
):
    updated_permissions = [
        {
            "username": test_owner_user.username,
            "permission": "admin",
        },
        {
            "username": "nonexisting_user",
            "permission": "viewer",
        },
    ]

    with pytest.raises(Exception) as excinfo:
        update_dashboard_permissions(
            db_session,
            dashboard,
            test_owner_user,
            updated_permissions,
        )
    assert "The following users do not exist: nonexisting_user" in str(excinfo.value)


def test_update_dashboard_permissions_nonexisting_group(
    dashboard,
    db_session,
    test_owner_user,
):
    updated_permissions = [
        {
            "group": "nonexisting_group",
            "permission": "editor",
        },
    ]

    with pytest.raises(Exception) as excinfo:
        update_dashboard_permissions(
            db_session,
            dashboard,
            test_owner_user,
            updated_permissions,
        )
    assert "The following groups do not exist: nonexisting_group" in str(excinfo.value)


def test_update_dashboard_permissions_nonexisting_users_and_groups(
    dashboard,
    db_session,
    test_owner_user,
):
    updated_permissions = [
        {
            "username": test_owner_user.username,
            "permission": "admin",
        },
        {
            "username": "nonexisting_user",
            "permission": "viewer",
        },
        {
            "group": "nonexisting_group",
            "permission": "editor",
        },
    ]

    with pytest.raises(Exception) as excinfo:
        update_dashboard_permissions(
            db_session,
            dashboard,
            test_owner_user,
            updated_permissions,
        )
    assert (
        "The following users do not exist: nonexisting_user; The following groups do not exist: nonexisting_group"  # noqa: E501
        in str(excinfo.value)
    )


def test_update_dashboard_permissions_not_admin(
    dashboard, db_session, test_member_user
):

    with pytest.raises(Exception) as excinfo:
        update_dashboard_permissions(db_session, dashboard, test_member_user, [])
    assert (
        "User does not have admin permission to change the permissions of the dashboard."  # noqa: E501
        in str(excinfo.value)
    )


@pytest.mark.django_db
def test_get_user_permission_groups(
    mock_app_get_ps_db,
    permission_group,
    admin_user,
    permission_group_table,
    test_member_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_groups = get_user_permission_groups(
        test_member_user,
    )

    assert len(permission_groups) == 1
    assert permission_groups[0]["name"] == permission_group["name"]
    assert permission_groups[0]["description"] == permission_group["description"]
    assert permission_groups[0]["owner"] == permission_group["owner"]
    assert permission_groups[0]["user_permission"] == "member"
    assert permission_groups[0]["members"][0]["username"] == "owner_user"
    assert permission_groups[0]["members"][0]["permission"] == "admin"

    assert permission_groups[0]["members"][1]["username"] == "admin_user"
    assert permission_groups[0]["members"][1]["permission"] == "admin"

    assert permission_groups[0]["members"][2]["username"] == "member_user"
    assert permission_groups[0]["members"][2]["permission"] == "member"

    permission_groups = get_user_permission_groups(
        AnonymousUser,
    )

    assert len(permission_groups) == 0


@pytest.mark.django_db
def test_update_permission_group(
    mock_app_get_ps_db,
    permission_group,
    permission_group_table,
    test_owner_user,
    test_admin_user,
    test_member_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    updated_members = [
        {
            "username": test_owner_user.username,
            "permission": "admin",
        },
    ]
    updated_permission_group = permission_group
    updated_permission_group["members"] = updated_members
    updated_permission_group["description"] = "some new description"
    updated_permission_group["id"] = permission_group_table.id

    assert len(permission_group_table.members) == 3
    assert permission_group_table.members[0].username == test_owner_user.username
    assert permission_group_table.members[0].permission == "admin"

    assert permission_group_table.members[1].username == test_admin_user.username
    assert permission_group_table.members[1].permission == "admin"

    assert permission_group_table.members[2].username == test_member_user.username
    assert permission_group_table.members[2].permission == "member"

    permission_group_dict = update_permission_groups(
        test_owner_user,
        updated_permission_group,
    )

    assert len(permission_group_dict["members"]) == 1
    assert permission_group_dict["description"] == "some new description"
    assert permission_group_dict["members"][0]["username"] == test_owner_user.username
    assert permission_group_dict["members"][0]["permission"] == "admin"


@pytest.mark.django_db
def test_update_permission_group_nonexistent_user(
    mock_app_get_ps_db,
    permission_group,
    permission_group_table,
    test_owner_user,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    updated_members = [
        {
            "username": "nonexistent_user",
            "permission": "admin",
        },
    ]
    updated_permission_group = permission_group
    updated_permission_group["members"] = updated_members
    updated_permission_group["description"] = "some new description"
    updated_permission_group["id"] = permission_group_table.id

    permission_group_dict = update_permission_groups(
        test_owner_user,
        updated_permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert permission_group_dict["message"] == "Users don't exist: nonexistent_user"


@pytest.mark.django_db
def test_update_permission_group_but_group_doesnt_exist(
    mock_app_get_ps_db, permission_group
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_group = {
        "name": "new group",
        "id": 100,
    }

    permission_group_dict = update_permission_groups(
        "admin",
        permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert permission_group_dict["message"] == "Group not found"


@pytest.mark.django_db
def test_update_permission_group_but_not_admin(
    mock_app_get_ps_db, permission_group, permission_group_table, test_member_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    updated_permission_group = permission_group
    updated_permission_group["id"] = permission_group_table.id

    permission_group_dict = update_permission_groups(
        test_member_user,
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
def test_create_permission_group_then_update(
    mock_app_get_ps_db, test_owner_user, test_admin_user, test_member_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_group = {
        "name": "new group",
        "description": "a new group description",
        "members": [
            {
                "username": test_owner_user.username,
                "permission": "admin",
            },
            {
                "username": test_admin_user.username,
                "permission": "admin",
            },
        ],
    }

    permission_group_dict = update_permission_groups(
        test_owner_user,
        permission_group,
    )

    assert permission_group_dict["name"] == permission_group["name"]
    assert permission_group_dict["description"] == permission_group["description"]
    assert permission_group_dict["owner"] == test_owner_user.username
    assert permission_group_dict["user_permission"] == "admin"
    assert (
        permission_group_dict["members"][0]["username"]
        == permission_group["members"][0]["username"]
    )
    assert permission_group_dict["members"][0]["permission"] == "admin"

    assert (
        permission_group_dict["members"][1]["username"]
        == permission_group["members"][1]["username"]
    )
    assert permission_group_dict["members"][1]["permission"] == "admin"

    updated_permission_group = {
        "name": "some new group",
        "description": "some new group description",
        "members": [
            {
                "username": test_owner_user.username,
                "permission": "admin",
            },
            {
                "username": test_admin_user.username,
                "permission": "admin",
            },
            {
                "username": test_member_user.username,
                "permission": "member",
            },
        ],
    }
    updated_permission_group["id"] = permission_group_dict["id"]

    permission_group_dict = update_permission_groups(
        test_admin_user,
        updated_permission_group,
    )

    assert permission_group_dict["name"] == updated_permission_group["name"]
    assert (
        permission_group_dict["description"] == updated_permission_group["description"]
    )
    assert permission_group_dict["owner"] == test_owner_user.username
    assert permission_group_dict["user_permission"] == "admin"
    assert (
        permission_group_dict["members"][0]["username"]
        == updated_permission_group["members"][0]["username"]
    )
    assert permission_group_dict["members"][0]["permission"] == "admin"

    assert (
        permission_group_dict["members"][1]["username"]
        == updated_permission_group["members"][1]["username"]
    )
    assert permission_group_dict["members"][1]["permission"] == "admin"


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
def test_create_permission_group_but_nonexistent_user(
    mock_app_get_ps_db, permission_group, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permission_group["members"] = [
        {
            "username": "nonexistent_user",
            "permission": "admin",
        },
    ]
    permission_group_dict = update_permission_groups(
        test_owner_user,
        permission_group,
    )

    assert permission_group_dict["status"] == "error"
    assert permission_group_dict["message"] == "Users don't exist: nonexistent_user"


@pytest.mark.django_db
def test_delete_permission_groups(
    mock_app_get_ps_db, db_session, permission_group_table, test_owner_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    group_id = permission_group_table.id
    delete_status = delete_permission_groups(test_owner_user, group_id)

    db_session.expire_all()
    assert delete_status["status"] == "deleted"
    db_perm_group = db_session.query(PermissionGroup).get(group_id)
    assert db_perm_group is None


@pytest.mark.django_db
def test_delete_permission_groups_by_admin_access(
    mock_app_get_ps_db, db_session, permission_group_table, test_admin_user
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    group_id = permission_group_table.id
    delete_status = delete_permission_groups(test_admin_user, group_id)

    db_session.expire_all()
    assert delete_status["status"] == "deleted"
    db_perm_group = db_session.query(PermissionGroup).get(group_id)
    assert db_perm_group is None


@pytest.mark.django_db
def test_delete_permission_groups_failed_by_member_access(
    mock_app_get_ps_db, test_member_user, permission_group_table
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    group_id = permission_group_table.id
    delete_status = delete_permission_groups(test_member_user, group_id)

    assert delete_status["status"] == "error"
    assert delete_status["message"] == "User is not owner or admin in group"


@pytest.mark.django_db
def test_delete_permission_groups_id_not_found(mock_app_get_ps_db, db_session):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    delete_status = delete_permission_groups("owner_user", 100)

    db_session.expire_all()
    assert delete_status["status"] == "error"
    assert delete_status["message"] == "Group not found"


@pytest.mark.django_db
def test_get_visualization_user_permission(
    mock_plugin,
    db_session,
    admin_user,
    test_owner_user,
    test_member_user,
    visualization_permission,
    permission_group_table,
):
    # direct permission
    user_permission = get_visualization_user_permission(
        db_session, mock_plugin.name, test_owner_user
    )
    assert user_permission is True

    # group permission
    user_permission = get_visualization_user_permission(
        db_session, mock_plugin.name, test_member_user
    )
    assert user_permission is True

    user_permission = get_visualization_user_permission(
        db_session, mock_plugin.name, admin_user
    )
    assert user_permission is False


@pytest.mark.django_db
def test_get_visualization_permissions(
    mock_app_get_ps_db,
    mock_plugin,
    db_session,
    admin_user,
    test_owner_user,
    test_member_user,
    visualization_permission,
    permission_group_table,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    permissions = get_visualization_permissions()

    assert mock_plugin.name in permissions
    permissions = permissions[mock_plugin.name]
    assert permissions["users"] == [test_owner_user.username]
    assert permissions["groups"] == [permission_group_table.name]


@pytest.mark.django_db
def test_update_visualization_permissions(
    mock_app_get_ps_db,
    mock_plugin,
    db_session,
    test_owner_user,
    test_admin_user,
    test_member_user,
    permission_group,
    permission_group_table,
    visualization_permission,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    updated_permissions = {
        mock_plugin.name: {
            "users": [],
            "groups": [],
        }
    }

    permissions = (
        db_session.query(VisualizationPermission)
        .filter_by(visualization=mock_plugin.name)
        .all()
    )
    assert len(permissions) == 2
    assert permissions[0].username == test_owner_user.username
    assert permissions[1].group.name == permission_group["name"]

    update_visualization_permissions(
        updated_permissions,
    )

    permissions = (
        db_session.query(VisualizationPermission)
        .filter_by(visualization=mock_plugin.name)
        .all()
    )

    assert len(permissions) == 0

    updated_permissions = {
        mock_plugin.name: {
            "users": [test_owner_user.username],
            "groups": [permission_group["name"]],
        }
    }

    update_visualization_permissions(
        updated_permissions,
    )

    permissions = (
        db_session.query(VisualizationPermission)
        .filter_by(visualization=mock_plugin.name)
        .all()
    )

    assert len(permissions) == 2
    assert permissions[0].username == test_owner_user.username
    assert permissions[1].group.name == permission_group["name"]


@pytest.mark.django_db
def test_update_visualization_permissions_nonexistent_user_and_groups(
    mock_app_get_ps_db,
    mock_plugin,
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")

    updated_permissions = {
        mock_plugin.name: {
            "users": ["bad_user"],
            "groups": [],
        }
    }

    with pytest.raises(Exception) as excinfo:
        update_visualization_permissions(updated_permissions)
    assert "The following users do not exist: bad_user" in str(excinfo.value)

    updated_permissions = {
        mock_plugin.name: {
            "users": [],
            "groups": ["bad_group"],
        }
    }

    with pytest.raises(Exception) as excinfo:
        update_visualization_permissions(updated_permissions)
    assert "The following groups do not exist: bad_group" in str(excinfo.value)

    updated_permissions = {
        mock_plugin.name: {
            "users": ["bad_user"],
            "groups": ["bad_group"],
        }
    }

    with pytest.raises(Exception) as excinfo:
        update_visualization_permissions(updated_permissions)
    assert (
        "The following users do not exist: bad_user; The following groups do not exist: bad_group"  # noqa: E501
        in str(excinfo.value)
    )


def test_flatten():
    # Test with typical list of lists
    input_data = [[1, 2], [3, 4], [5]]
    expected = [1, 2, 3, 4, 5]
    from tethysapp.tethysdash.model import flatten

    assert flatten(input_data) == expected

    # Test with empty list
    input_data = []
    expected = []
    assert flatten(input_data) == expected

    # Test with nested empty lists
    input_data = [[], [], []]
    expected = []
    assert flatten(input_data) == expected

    # Test with mixed empty and non-empty lists
    input_data = [[1], [], [2, 3], []]
    expected = [1, 2, 3]
    assert flatten(input_data) == expected


def test_get_user_app_permissions_basic():
    class MockUser:
        def get_all_permissions(self):
            return [
                "tethys_apps.tethysdash:view_dashboard",
                "tethys_apps.tethysdash:edit_dashboard",
                "other_app:admin",
                "tethys_apps.tethysdash:delete_dashboard",
            ]

    from tethysapp.tethysdash.model import get_user_app_permissions, App

    App.package = "tethysdash"
    user = MockUser()
    perms = get_user_app_permissions(user)
    assert set(perms) == {"view_dashboard", "edit_dashboard", "delete_dashboard"}


def test_get_user_app_permissions_no_permissions():
    class MockUser:
        def get_all_permissions(self):
            return []

    from tethysapp.tethysdash.model import get_user_app_permissions, App

    App.package = "tethysdash"
    user = MockUser()
    perms = get_user_app_permissions(user)
    assert perms == []


def test_get_user_app_permissions_unrelated_permissions():
    class MockUser:
        def get_all_permissions(self):
            return ["other_app:view", "another_app:edit"]

    from tethysapp.tethysdash.model import get_user_app_permissions, App

    App.package = "tethysdash"
    user = MockUser()
    perms = get_user_app_permissions(user)
    assert perms == []


def test_get_user_app_permissions_mixed_permissions():
    class MockUser:
        def get_all_permissions(self):
            return [
                "tethys_apps.tethysdash:view_dashboard",
                "tethys_apps.tethysdash:edit_dashboard",
                "tethys_apps.other:view",
                "tethys_apps.tethysdash:custom",
            ]

    from tethysapp.tethysdash.model import get_user_app_permissions, App

    App.package = "tethysdash"
    user = MockUser()
    perms = get_user_app_permissions(user)
    assert set(perms) == {"view_dashboard", "edit_dashboard", "custom"}


def create_dummy_json_files(root, files):
    os.makedirs(root, exist_ok=True)
    for fname in files:
        with open(os.path.join(root, fname), "w") as f:
            json.dump({"dummy": True}, f)


class MockDashboard:
    def __init__(self, id, grid_items):
        self.id = id
        self.uuid = str(uuid4())
        self.grid_items = grid_items


class MockGridItem:
    def __init__(self, id, source, args_string):
        self.id = id
        self.source = source
        if args_string:
            self.args_string = args_string


def test_init_primary_db_moves_json_and_geojson_files(
    mock_app_get_ps_db, tmp_path, mocker
):
    mock_app_get_ps_db("tethysapp.tethysdash.model.App")
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout=""),
    )
    mocker.patch(
        "tethysapp.tethysdash.model.subprocess.run",
        return_value=SimpleNamespace(stdout="r1 "),
    )

    mock_cfg = mocker.patch("tethysapp.tethysdash.model.config")
    mock_command = mocker.patch("tethysapp.tethysdash.model.command")
    mock_script = mocker.patch(
        "tethysapp.tethysdash.model.script",
    )
    mock_script.ScriptDirectory.from_config.return_value = mocker.Mock(revision="1234")
    mock_engine = mocker.Mock()

    temp_workspace = tmp_path
    json_dir = os.path.join(temp_workspace, "json")
    admin_user_dir = os.path.join(json_dir, "admin")
    geojson_dir = os.path.join(temp_workspace, "geojson")
    os.makedirs(json_dir)
    os.makedirs(geojson_dir)
    os.makedirs(admin_user_dir)
    # Create dummy files
    create_dummy_json_files(json_dir, ["a.json"])
    create_dummy_json_files(geojson_dir, ["c.json"])
    create_dummy_json_files(admin_user_dir, ["b.json"])

    mock_get_app_workspace = mocker.patch(
        "tethysapp.tethysdash.model.get_app_workspace"
    )
    mock_get_app_workspace.return_value = MagicMock(path=temp_workspace)

    mock_query = mocker.patch("sqlalchemy.orm.Session.query")

    dashboard_1 = MockDashboard(
        id=1,
        grid_items=[
            MockGridItem(
                id=1,
                source="Map",
                args_string=json.dumps(
                    {
                        "layers": [
                            {
                                "configuration": {
                                    "props": {"source": {"geojson": "c.json"}},
                                    "style": "b.json",
                                }
                            },
                            {
                                "configuration": {
                                    "props": {"source": {"geojson": "some/url/d.json"}},
                                    "style": "some/url/a.json",
                                }
                            },
                        ]
                    }
                ),
            ),
            MockGridItem(id=2, source="Map", args_string=None),
            MockGridItem(
                id=3,
                source="Map",
                args_string=json.dumps(
                    {
                        "layers": [
                            {},
                        ]
                    }
                ),
            ),
        ],
    )
    mock_query.return_value.all.return_value = [dashboard_1]

    init_primary_db(engine=mock_engine, first_time=True)

    # Check that files have been deleted from original locations
    assert not os.path.exists(os.path.join(json_dir, "a.json"))
    assert not os.path.exists(os.path.join(admin_user_dir, "b.json"))
    assert not os.path.exists(os.path.join(geojson_dir, "c.json"))

    assert os.path.exists(os.path.join(temp_workspace, dashboard_1.uuid, "c.json"))
    assert os.path.exists(os.path.join(temp_workspace, dashboard_1.uuid, "b.json"))

    # Get the directory of the current test file
    test_file_dir = Path(__file__).resolve().parent

    # If you want the app directory (one level up from the test file)
    app_dir = test_file_dir.parent.parent

    # Alembic directory relative to app_dir
    alembic_dir = app_dir / "alembic"

    mock_cfg.Config.assert_called_once()
    set_main_option_calls = [
        call("script_location", str(alembic_dir)),
        call("sqlalchemy.url", str(mock_engine.url)),
    ]

    mock_cfg.Config().set_main_option.assert_has_calls(
        set_main_option_calls, any_order=True
    )
    mock_command.ensure_version.assert_called_once()
