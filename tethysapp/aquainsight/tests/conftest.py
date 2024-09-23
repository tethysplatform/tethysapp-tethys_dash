import pytest
import json
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from tethysapp.aquainsight.tests.integrated_tests import TEST_DB_URL
from django.http import HttpResponse
from unittest.mock import MagicMock
from tethysapp.aquainsight.model import init_primary_db, Dashboard


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
    init_primary_db(connection, first_time=True)

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

    yield session

    session.close()


@pytest.fixture(scope="function")
def mock_app_get_ps_db(session_maker, mocker):
    """Create a SQLAlchemy session for the primary database."""

    def mock_app_factory(mock_path):
        mock_app = mocker.patch(mock_path)
        mock_app.get_persistent_store_database.return_value = session_maker
        return mock_app

    return mock_app_factory


@pytest.fixture(scope="function")
def dashboard_data():
    return {
        "name": "test_dashboard",
        "label": "test_dashboard",
        "notes": "some notes",
        "owner": "test_user",
        "access_groups": [],
    }


@pytest.fixture(scope="function")
def row_data():
    return json.dumps(
        [
            {
                "height": 50,
                "order": 1,
                "columns": [
                    {
                        "width": 12,
                        "order": 1,
                        "source": "image",
                        "args": {"uri": "some/path"},
                    }
                ],
            }
        ]
    )


@pytest.fixture(scope="function")
def dashboard(db_session, dashboard_data):
    dashboard = Dashboard(
        name=dashboard_data["name"],
        label=dashboard_data["label"],
        notes=dashboard_data["notes"],
        owner=dashboard_data["owner"],
        access_groups=dashboard_data["access_groups"],
    )
    db_session.add(dashboard)
    db_session.commit()
    yield dashboard
    if (
        db_session.query(Dashboard)
        .filter(Dashboard.name == dashboard_data["name"])
        .all()
    ):
        db_session.refresh(dashboard)
        db_session.delete(dashboard)
    db_session.commit()


@pytest.fixture(scope="function")
def mock_app(mocker):
    def mocked_path(mock_path):
        mock_app = mocker.patch(mock_path)
        mock_app.render.return_value = HttpResponse("Success")
        return mock_app

    return mocked_path


@pytest.fixture(scope="function")
def mock_plugin(mocker):
    plugin = MagicMock(
        visualization_group="package_group",
        visualization_label="Some Package",
        visualization_args={"package_arg": "text"},
        visualization_type="image",
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
            },
            {
                "source": mock_plugin2.name,
                "value": mock_plugin2.visualization_label,
                "label": mock_plugin2.visualization_label,
                "args": mock_plugin2.visualization_args,
            },
        ],
    }

    return plugin_visualization
