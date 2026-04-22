import pytest
import json
from uuid import uuid4
from sqlalchemy import text, create_engine
from sqlalchemy.orm import Session
from django.conf import settings
from django.http import HttpResponse
from unittest.mock import MagicMock
from tethysapp.tethysdash.model import (
    Dashboard,
    DashboardTab,
    GridItem,
    DashboardPermission,
    PermissionGroup,
    PermissionGroupUser,
    VisualizationPermission,
    init_primary_db,
)
from django.contrib.auth import get_user_model
import os
from pathlib import Path
import psycopg2
from sqlalchemy.engine.url import make_url


@pytest.fixture(scope="session")
def db_url():
    db_settings = settings.DATABASES["default"]
    if db_settings["ENGINE"] == "django.db.backends.sqlite3":
        parent_dir = Path(__file__).parent
        return f"sqlite:///{parent_dir}/testing_db.sqlite"
    else:
        return f"postgresql+psycopg2://{db_settings['USER']}:{db_settings['PASSWORD']}@{db_settings['HOST']}:{db_settings['PORT']}/tethysdash_test_db"  # noqa: E501


@pytest.fixture(scope="session")
def db_engine_and_migrate(db_url):
    """Create a SQLAlchemy engine and run migrations once."""
    if db_url.startswith("sqlite:///"):
        engine = create_engine(db_url, connect_args={"check_same_thread": False})
    else:
        url = make_url(db_url)
        db_name = url.database

        # Try to create the test db if it doesn't exist
        try:
            conn = psycopg2.connect(
                dbname="postgres",
                user=url.username,
                password=url.password,
                host=url.host,
                port=url.port,
            )
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(f"CREATE DATABASE {db_name}")
            cur.close()
            conn.close()
        except psycopg2.errors.DuplicateDatabase:
            pass  # Database already exists
        engine = create_engine(db_url)

    init_primary_db(engine, first_time=True, clean=False)
    yield engine
    engine.dispose()

    if db_url.startswith("sqlite:///"):
        db_path = db_url.replace("sqlite:///", "")

        if os.path.exists(db_path):
            os.remove(db_path)
    else:
        # Drop the PostgreSQL database after tests
        url = make_url(db_url)
        db_name = url.database
        try:
            conn = psycopg2.connect(
                dbname="postgres",
                user=url.username,
                password=url.password,
                host=url.host,
                port=url.port,
            )
            conn.autocommit = True
            cur = conn.cursor()
            cur.execute(f"DROP DATABASE IF EXISTS {db_name}")
            cur.close()
            conn.close()
        except Exception as e:
            print(f"Error dropping database {db_name}: {e}")


@pytest.fixture(scope="function")
def db_connection(db_engine_and_migrate):
    """Create a fresh connection and transaction for each test."""
    connection = db_engine_and_migrate.connect()
    transaction = connection.begin()
    yield connection
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def session_maker(db_connection):
    """Create a SQLAlchemy session for the primary database."""

    def session_maker_factory():
        db_connection.begin_nested()
        session = Session(db_connection)
        return session

    return session_maker_factory


@pytest.fixture(scope="function")
def db_session(session_maker):
    session = session_maker()
    session.expire_all()
    yield session
    session.rollback()
    session.close()


@pytest.fixture(autouse=True)
def truncate_tables(db_session, db_url):
    meta = Dashboard.metadata

    if db_url.startswith("sqlite:///"):
        db_session.execute(text("PRAGMA foreign_keys=OFF"))
        for table in reversed(meta.sorted_tables):
            db_session.execute(table.delete())
        db_session.commit()
        db_session.execute(text("PRAGMA foreign_keys=ON"))
    else:
        # For PostgreSQL, truncate all tables and restart identity (reset autoincrement)
        table_names = ", ".join([f'"{table.name}"' for table in meta.sorted_tables])
        db_session.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))
        db_session.commit()


@pytest.fixture(scope="function")
def mock_app_get_ps_db(session_maker, mocker):
    """Create a SQLAlchemy session for the primary database."""

    def mock_app_factory(mock_path):
        mock_app = mocker.patch(mock_path)
        mock_app.render.return_value = HttpResponse("Success")
        mock_app.get_persistent_store_database.return_value = session_maker
        mock_app.root_url = "tethysdash"
        return mock_app

    return mock_app_factory


@pytest.fixture
def test_admin_user(db):
    User = get_user_model()
    user = User.objects.create_user(username="admin_user", password="password123")
    return user


@pytest.fixture
def test_member_user(db):
    User = get_user_model()
    user = User.objects.create_user(username="member_user", password="password123")
    return user


@pytest.fixture
def test_owner_user(db):
    User = get_user_model()
    user = User.objects.create_user(username="owner_user", password="password123")
    user.get_all_permissions = lambda: {"tethys_apps.tethysdash:manage_visualizations"}
    return user


@pytest.fixture(scope="function")
def permission_group(test_admin_user, test_member_user, test_owner_user):
    unique_name = f"{uuid4()}"
    return {
        "name": unique_name,
        "description": "",
        "owner": test_owner_user.username,
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
        "user_permission": "admin",
    }


@pytest.fixture(scope="function")
def permission_group_table(db_session, permission_group):
    group = PermissionGroup(
        name=permission_group["name"],
        description=permission_group["description"],
        owner=permission_group["owner"],
    )
    db_session.add(group)
    db_session.flush()  # get group.id
    group_id = group.id

    # Add members
    for member in permission_group["members"]:
        db_session.add(
            PermissionGroupUser(
                username=member["username"],
                group_id=group_id,
                permission=member["permission"],
            )
        )
    db_session.commit()

    yield group

    # Clean up: delete group if it still exists
    refreshed_group = db_session.get(PermissionGroup, group_id)
    if refreshed_group:
        db_session.delete(refreshed_group)
        db_session.commit()


@pytest.fixture(scope="function")
def dashboard_data(test_owner_user):
    return {
        "name": "test_dashboard",
        "description": "test_dashboard",
        "uuid": "some_user_dashboard_uuid",
        "notes": "some notes",
        "owner": test_owner_user.username,
        "public": False,
        "unrestricted_placement": False,
    }


@pytest.fixture(scope="function")
def public_dashboard_data():
    return {
        "name": "public_dashboard",
        "description": "public_dashboard",
        "uuid": str(uuid4()),
        "notes": "some notes",
        "owner": "public_user",
        "public": True,
        "unrestricted_placement": False,
    }


@pytest.fixture(scope="function")
def grid_item():
    return [
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Custom Image",
            "args_string": json.dumps({"uri": "some_path"}),
            "metadata_string": json.dumps({"refreshRate": 0}),
        }
    ]


@pytest.fixture(scope="function")
def live_chat_grid_item():
    return [
        {
            "i": "1",
            "x": 1,
            "y": 1,
            "w": 1,
            "h": 1,
            "source": "Live Chat",
            "args_string": json.dumps({}),
            "metadata_string": json.dumps({"refreshRate": 0}),
        }
    ]


@pytest.fixture(scope="function")
def live_chat_dashboard_data(test_owner_user):
    return {
        "name": "live_chat_dashboard",
        "description": "live_chat_dashboard",
        "uuid": str(uuid4()),
        "notes": "some notes",
        "owner": test_owner_user.username,
        "public": False,
        "unrestricted_placement": False,
    }


@pytest.fixture(scope="function")
def dashboard(db_session, dashboard_data, permission_group_table, test_admin_user):
    dashboard = Dashboard(**dashboard_data)
    db_session.add(dashboard)
    db_session.commit()
    db_session.refresh(dashboard)
    dashboard_id = dashboard.id

    owner_permission = DashboardPermission(
        dashboard_id=dashboard_id,
        username=dashboard.owner,
        permission="admin",
    )
    db_session.add(owner_permission)
    db_session.commit()

    editor_permission = DashboardPermission(
        dashboard_id=dashboard_id,
        username=test_admin_user.username,
        permission="editor",
    )
    db_session.add(editor_permission)
    db_session.commit()

    viewer_permission = DashboardPermission(
        dashboard_id=dashboard_id,
        group_id=permission_group_table.id,
        permission="viewer",
    )
    db_session.add(viewer_permission)
    db_session.commit()

    yield dashboard

    # Only delete if dashboard still exists
    refreshed_dashboard = db_session.get(Dashboard, dashboard.id)
    if refreshed_dashboard:
        db_session.delete(refreshed_dashboard)

    refreshed_owner_permission = (
        db_session.query(DashboardPermission)
        .filter_by(dashboard_id=dashboard.id, username=dashboard.owner)
        .first()
    )
    if refreshed_owner_permission:
        db_session.delete(refreshed_owner_permission)

    db_session.commit()


@pytest.fixture(scope="function")
def public_dashboard(db_session, public_dashboard_data):
    dashboard = Dashboard(**public_dashboard_data)
    db_session.add(dashboard)
    db_session.commit()
    db_session.refresh(dashboard)
    dashboard_id = dashboard.id

    owner_permission = DashboardPermission(
        dashboard_id=dashboard_id,
        username=dashboard.owner,
        permission="admin",
    )
    db_session.add(owner_permission)
    db_session.commit()

    yield dashboard

    # Only delete if dashboard still exists
    refreshed_dashboard = db_session.get(Dashboard, dashboard.id)
    if refreshed_dashboard:
        db_session.delete(refreshed_dashboard)

    refreshed_owner_permission = (
        db_session.query(DashboardPermission)
        .filter_by(dashboard_id=dashboard.id, username=dashboard.owner)
        .first()
    )
    if refreshed_owner_permission:
        db_session.delete(refreshed_owner_permission)
    db_session.commit()


@pytest.fixture(scope="function")
def live_chat_dashboard(db_session, live_chat_dashboard_data, live_chat_grid_item):
    dashboard = Dashboard(**live_chat_dashboard_data)
    db_session.add(dashboard)
    db_session.commit()
    db_session.refresh(dashboard)
    dashboard_id = dashboard.id

    owner_permission = DashboardPermission(
        dashboard_id=dashboard_id,
        username=dashboard.owner,
        permission="admin",
    )
    db_session.add(owner_permission)
    db_session.commit()

    dashboard_tab = DashboardTab(
        dashboard_id=dashboard.id,
        name="Tab 1",
    )
    db_session.add(dashboard_tab)
    db_session.commit()
    db_session.refresh(dashboard_tab)

    grid_item = GridItem(
        dashboard_id=dashboard.id,
        tab_id=dashboard_tab.id,
        uuid=str(uuid4()),
        i=live_chat_grid_item[0]["i"],
        x=live_chat_grid_item[0]["x"],
        y=live_chat_grid_item[0]["y"],
        w=live_chat_grid_item[0]["w"],
        h=live_chat_grid_item[0]["h"],
        source=live_chat_grid_item[0]["source"],
        args_string=live_chat_grid_item[0]["args_string"],
        metadata_string=live_chat_grid_item[0]["metadata_string"],
    )
    db_session.add(grid_item)
    db_session.commit()
    db_session.refresh(grid_item)

    yield dashboard

    # Only delete if dashboard still exists
    refreshed_dashboard = db_session.get(Dashboard, dashboard.id)
    if refreshed_dashboard:
        db_session.delete(refreshed_dashboard)

    refreshed_owner_permission = (
        db_session.query(DashboardPermission)
        .filter_by(dashboard_id=dashboard.id, username=dashboard.owner)
        .first()
    )
    if refreshed_owner_permission:
        db_session.delete(refreshed_owner_permission)

    db_session.commit()


@pytest.fixture(scope="function")
def mock_app(mocker):
    def mocked_path(mock_path):
        mock_app = mocker.patch(mock_path)
        mock_app.render.return_value = HttpResponse("Success")
        mock_app.root_url = "app_root"
        mock_app.package = "tethysdash"
        return mock_app

    return mocked_path


@pytest.fixture(scope="function")
def mock_plugin(mocker):
    plugin = MagicMock(
        visualization_group="package_group",
        visualization_label="Some Package",
        visualization_args={"package_arg": "text"},
        visualization_type="image",
        visualization_tags=["some tag"],
        visualization_description="some description",
        visualization_attribution="some attribution",
        visualization_loading_icon=False,
        visualization_restricted=True,
        visualization_dynamic_map_layer=False,
    )
    plugin.name = "package_name"

    return plugin


@pytest.fixture(scope="function")
def visualization_permission(
    db_session, mock_plugin, test_owner_user, permission_group_table
):
    user_permission = VisualizationPermission(
        visualization=mock_plugin.name, username=test_owner_user.username
    )
    db_session.add(user_permission)
    db_session.commit()
    db_session.refresh(user_permission)
    user_permission_id = user_permission.id

    group_permission = VisualizationPermission(
        visualization=mock_plugin.name, group_id=permission_group_table.id
    )
    db_session.add(group_permission)
    db_session.commit()
    db_session.refresh(group_permission)
    group_permission_id = group_permission.id

    yield [user_permission, group_permission]

    # Only delete if user_permission still exists
    refreshed_user_permission = db_session.get(
        VisualizationPermission, user_permission_id
    )
    if refreshed_user_permission:
        db_session.delete(refreshed_user_permission)

    # Only delete if user_permission still exists
    refreshed_group_permission = db_session.get(
        VisualizationPermission, group_permission_id
    )
    if refreshed_group_permission:
        db_session.delete(refreshed_group_permission)

    db_session.commit()


@pytest.fixture(scope="function")
def mock_plugin2(mocker):
    plugin = MagicMock(
        spec=[],
        autospec=True,
        visualization_group="package_group",
        visualization_label="Some Package2",
        visualization_args={"package_arg": "text"},
        visualization_type="image",
        visualization_dynamic_map_layer=False,
    )
    plugin.name = "package_name2"

    return plugin


@pytest.fixture(scope="function")
def mock_plugin_visualization(mock_plugin):
    plugin_visualization = {
        "label": mock_plugin.visualization_group,
        "options": [
            {
                "source": mock_plugin.name,
                "value": mock_plugin.visualization_label,
                "label": mock_plugin.visualization_label,
                "args": mock_plugin.visualization_args,
                "type": mock_plugin.visualization_type,
                "tags": mock_plugin.visualization_tags,
                "description": mock_plugin.visualization_description,
                "attribution": mock_plugin.visualization_attribution,
                "loading_icon": mock_plugin.visualization_loading_icon,
                "restricted": mock_plugin.visualization_restricted,
                "dynamic_map_layer": False,
            }
        ],
    }

    return plugin_visualization


@pytest.fixture(scope="function")
def mock_plugin_visualization2(mock_plugin, mock_plugin2):
    plugin_visualization = {
        "label": mock_plugin.visualization_group,
        "options": [
            {
                "source": mock_plugin2.name,
                "value": mock_plugin2.visualization_label,
                "label": mock_plugin2.visualization_label,
                "args": mock_plugin2.visualization_args,
                "type": mock_plugin2.visualization_type,
                "tags": [],
                "description": "",
                "attribution": "",
                "loading_icon": True,
                "restricted": False,
                "dynamic_map_layer": False,
            },
            {
                "source": mock_plugin.name,
                "value": mock_plugin.visualization_label,
                "label": mock_plugin.visualization_label,
                "args": mock_plugin.visualization_args,
                "type": mock_plugin.visualization_type,
                "tags": mock_plugin.visualization_tags,
                "description": mock_plugin.visualization_description,
                "attribution": mock_plugin.visualization_attribution,
                "loading_icon": mock_plugin.visualization_loading_icon,
                "restricted": mock_plugin.visualization_restricted,
                "dynamic_map_layer": False,
            },
        ],
    }

    return plugin_visualization
