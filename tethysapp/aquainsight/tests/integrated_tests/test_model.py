import pytest
import json
from tethysapp.aquainsight.model import (
    add_new_dashboard,
    delete_named_dashboard,
    add_new_row,
    delete_row,
    add_new_column,
    delete_column,
    update_named_dashboard,
    get_dashboards,
    Dashboard,
    Row,
    Column,
)


@pytest.mark.django_db
def test_add_and_delete_dashboard(db_session, mock_app_get_ps_db, row_data):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
    label = "added_dashboard"
    name = "added_dashboard"
    notes = "added notes"
    owner = "some_user"
    access_groups = ["public"]

    # Create a new dashboard and Verify dashboard, rows, and columns were created
    add_new_dashboard(label, name, notes, row_data, owner, access_groups)

    dashboard = db_session.query(Dashboard).filter(Dashboard.name == name).first()
    assert dashboard.label == label
    assert dashboard.name == name
    assert dashboard.notes == notes
    assert dashboard.owner == owner
    assert dashboard.access_groups == access_groups
    dashboard_id = dashboard.id

    row = db_session.query(Row).filter(Row.dashboard_id == dashboard_id).first()
    assert row.height == 50
    row_id = row.id

    column = db_session.query(Column).filter(Column.row_id == row_id).first()
    assert column.width == 12
    assert column.data_source == "image"
    assert column.data_args == json.dumps({"uri": "some/path"})
    column_id = column.id

    # Add a new row and verify
    new_row_order = 2
    new_row_height = 100
    new_row = add_new_row(db_session, dashboard_id, new_row_order, new_row_height)

    new_row = db_session.query(Row).filter(Row.id == new_row.id).first()
    assert new_row.height == new_row_height
    assert new_row.row_order == new_row_order

    # Delete the new row
    delete_row(db_session, new_row.id)

    new_row = db_session.query(Row).filter(Row.id == new_row.id).all()
    assert len(new_row) == 0

    # Add a new column and verify
    new_col_order = 2
    new_col_width = 6
    new_col_source = "image"
    new_col_args = json.dumps({"uri": "some/new/path"})
    new_column = add_new_column(
        db_session, row_id, new_col_order, new_col_width, new_col_source, new_col_args
    )

    new_column = db_session.query(Column).filter(Column.id == new_column.id).first()
    assert new_column.width == new_col_width
    assert new_column.col_order == new_col_order
    assert new_column.data_source == new_col_source
    assert new_column.data_args == new_col_args

    # Delete the new column
    delete_column(db_session, new_column.id)

    new_column = db_session.query(Column).filter(Column.id == new_column.id).all()
    assert len(new_column) == 0

    # Delete the dashboard and Verify dashboard, rows, and columns were deleted
    delete_named_dashboard(owner, name)

    dashboard = db_session.query(Dashboard).filter(Dashboard.id == dashboard_id).all()
    assert len(dashboard) == 0
    row = db_session.query(Row).filter(Row.id == row_id).all()
    assert len(row) == 0
    column = db_session.query(Column).filter(Column.id == column_id).all()
    assert len(column) == 0


@pytest.mark.django_db
def test_delete_named_dashboard(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
    dashboard_name = dashboard.name
    dashboard_owner = dashboard.owner

    delete_named_dashboard(dashboard_owner, dashboard_name)

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.name == dashboard_name).all()
    )
    assert len(db_dashboard) == 0


@pytest.mark.django_db
def test_delete_named_dashboard_not_allowed(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
    dashboard_name = dashboard.name

    with pytest.raises(Exception) as excinfo:
        delete_named_dashboard("test_not_valid_user", dashboard_name)

    assert "Dashboards can only be deleted by their owner" in str(excinfo.value)

    db_dashboard = (
        db_session.query(Dashboard).filter(Dashboard.name == dashboard_name).all()
    )
    assert len(db_dashboard) == 1
    assert db_dashboard[0].name == dashboard_name


@pytest.mark.django_db
def test_update_named_dashboard(dashboard, db_session, mock_app_get_ps_db):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
    dashboard_name = dashboard.name
    dashboard_label = dashboard.label
    dashboard_owner = dashboard.owner

    row_data = json.dumps(
        [
            {
                "height": 1,
                "order": 1,
                "columns": [
                    {
                        "width": 12,
                        "order": 1,
                        "source": "image",
                        "args": {"uri": "some/path"},
                    },
                    {
                        "width": 12,
                        "order": 2,
                        "source": "image",
                        "args": {"uri": "some/other/other/path"},
                    },
                ],
            },
            {
                "height": 2,
                "order": 2,
                "columns": [
                    {
                        "width": 12,
                        "order": 1,
                        "source": "image",
                        "args": {"uri": "some/other/path"},
                    }
                ],
            },
        ]
    )

    # Add rows/cells and update dashboards
    updated_notes = "Some new notes"
    updated_access_groups = ["public"]
    update_named_dashboard(
        dashboard_owner,
        dashboard_name,
        dashboard_label,
        updated_notes,
        row_data,
        updated_access_groups,
    )

    db_session.refresh(dashboard)
    assert dashboard.notes == updated_notes
    assert len(dashboard.rows) == 2
    assert dashboard.rows[0].height == 1
    assert len(dashboard.rows[0].columns) == 2
    assert dashboard.rows[0].columns[0].width == 12
    assert dashboard.rows[0].columns[0].data_source == "image"
    assert dashboard.access_groups == updated_access_groups

    row1 = dashboard.rows[0]
    row1col1 = row1.columns[0]

    # Add and update rows/cells
    updated_row_data = json.dumps(
        [
            {
                "id": row1.id,
                "height": 50,
                "order": row1.row_order,
                "columns": [
                    {
                        "id": row1col1.id,
                        "width": 6,
                        "order": row1col1.col_order,
                        "source": "Text",
                        "args": {"text": "some text"},
                    }
                ],
            }
        ]
    )
    update_named_dashboard(
        dashboard_owner,
        dashboard_name,
        dashboard_label,
        updated_notes,
        updated_row_data,
        updated_access_groups,
    )

    db_session.refresh(dashboard)
    assert len(dashboard.rows) == 1

    db_session.refresh(dashboard.rows[0])
    assert dashboard.rows[0].height == 50
    assert len(dashboard.rows[0].columns) == 1

    db_session.refresh(dashboard.rows[0].columns[0])
    assert dashboard.rows[0].columns[0].width == 6
    assert dashboard.rows[0].columns[0].data_source == "Text"


@pytest.mark.django_db
def test_update_named_dashboard_not_allowed(
    dashboard, db_session, mock_app_get_ps_db, row_data
):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
    dashboard_name = dashboard.name
    dashboard_label = dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_access_groups = dashboard.access_groups

    with pytest.raises(Exception) as excinfo:
        updated_notes = "Some new notes"
        updated_access_groups = ["public"]
        update_named_dashboard(
            "test_not_valid_user",
            dashboard_name,
            dashboard_label,
            updated_notes,
            row_data,
            updated_access_groups,
        )

    assert "Dashboards can only be updated by their owner" in str(excinfo.value)

    db_session.refresh(dashboard)
    assert dashboard.notes == dashboard_notes
    assert dashboard.rows == []
    assert dashboard.access_groups == dashboard_access_groups


@pytest.mark.django_db
def test_get_dashboards_all(dashboard, db_session, mock_app_get_ps_db, row_data):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
    dashboard_name = dashboard.name
    dashboard_label = dashboard.label
    dashboard_notes = dashboard.notes
    dashboard_owner = dashboard.owner
    dashboard_access_groups = dashboard.access_groups

    update_named_dashboard(
        dashboard_owner,
        dashboard_name,
        dashboard_label,
        dashboard_notes,
        row_data,
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
            "rowData": [
                {
                    "id": 5,
                    "order": 1,
                    "height": 50,
                    "columns": [
                        {
                            "id": 6,
                            "order": 1,
                            "width": 12,
                            "source": "image",
                            "args": {"uri": "some/path"},
                        }
                    ],
                }
            ],
        }
    }


@pytest.mark.django_db
def test_get_dashboards_specific(dashboard, db_session, mock_app_get_ps_db, row_data):
    mock_app_get_ps_db("tethysapp.aquainsight.model.app")
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
            "rowData": [],
        }
    }
