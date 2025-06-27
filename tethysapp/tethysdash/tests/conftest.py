import pytest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from tethysapp.tethysdash.tests.integrated_tests import TEST_DB_URL
from django.http import HttpResponse
from unittest.mock import MagicMock
from tethysapp.tethysdash.model import init_primary_db, Dashboard


@pytest.fixture(scope="module")
def db_url():
    return TEST_DB_URL


@pytest.fixture(scope="module")
def db_connection(db_url):
    """Create a SQLAlchemy engine for the primary database."""
    engine = create_engine(db_url)
    connection = engine.connect()
    transaction = connection.begin()

    # Create ATCore-related tables (e.g.: Resources)
    init_primary_db(engine, first_time=True)

    yield connection

    transaction.rollback()
    connection.close()
    engine.dispose()


@pytest.fixture(scope="module")
def session_maker(db_connection):
    """Create a SQLAlchemy session for the primary database."""

    def session_maker_factory():
        db_connection.begin_nested()
        session = Session(db_connection)
        return session

    return session_maker_factory


@pytest.fixture(scope="function")
def db_session(session_maker):
    """Create a SQLAlchemy session for the primary database."""
    session = session_maker()
    session.expire_all()

    yield session

    session.rollback()
    session.close()


@pytest.fixture(scope="function")
def mock_app_get_ps_db(session_maker, mocker):
    """Create a SQLAlchemy session for the primary database."""

    def mock_app_factory(mock_path):
        mock_app = mocker.patch(mock_path)
        mock_app.render.return_value = HttpResponse("Success")
        mock_app.get_persistent_store_database.return_value = session_maker
        mock_app.root_url = "app_root"
        return mock_app

    return mock_app_factory


@pytest.fixture(scope="function")
def dashboard_data():
    return {
        "name": "test_dashboard",
        "description": "test_dashboard",
        "uuid": "some_user_dashboard_uuid",
        "notes": "some notes",
        "owner": "admin",
        "access_groups": [],
        "unrestricted_placement": False,
    }


@pytest.fixture(scope="function")
def public_dashboard_data():
    return {
        "name": "public_dashboard",
        "description": "public_dashboard",
        "uuid": "some_public_dashboard_uuid",
        "notes": "some notes",
        "owner": "public_user",
        "access_groups": ["public"],
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
def dashboard(db_session, dashboard_data):
    dashboard = Dashboard(**dashboard_data)
    db_session.add(dashboard)
    db_session.commit()

    yield dashboard

    db_session.delete(dashboard)
    db_session.commit()


@pytest.fixture(scope="function")
def public_dashboard(db_session, public_dashboard_data):
    dashboard = Dashboard(**public_dashboard_data)
    db_session.add(dashboard)
    db_session.commit()

    yield dashboard

    db_session.delete(dashboard)
    db_session.commit()


@pytest.fixture(scope="function")
def mock_app(mocker):
    def mocked_path(mock_path):
        mock_app = mocker.patch(mock_path)
        mock_app.render.return_value = HttpResponse("Success")
        mock_app.root_url = "app_root"
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
    )
    plugin.name = "package_name"

    return plugin


@pytest.fixture(scope="function")
def mock_plugin2(mocker):
    plugin = MagicMock(
        visualization_group="package_group",
        visualization_label="Some Package2",
        visualization_args={"package_arg": "text"},
        visualization_type="image",
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
                "source": mock_plugin.name,
                "value": mock_plugin.visualization_label,
                "label": mock_plugin.visualization_label,
                "args": mock_plugin.visualization_args,
                "type": mock_plugin.visualization_type,
                "tags": mock_plugin.visualization_tags,
                "description": mock_plugin.visualization_description,
            },
            {
                "source": mock_plugin2.name,
                "value": mock_plugin2.visualization_label,
                "label": mock_plugin2.visualization_label,
                "args": mock_plugin2.visualization_args,
                "type": mock_plugin2.visualization_type,
                "tags": [],
                "description": "",
            },
        ],
    }

    return plugin_visualization
