from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, ARRAY, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import json
import nh3

from .app import App as app

Base = declarative_base()


class Dashboard(Base):
    """
    SQLAlchemy Dashboard DB Model
    """

    __tablename__ = "dashboards"

    # Columns
    id = Column(Integer, primary_key=True)
    label = Column(String)
    name = Column(String)
    notes = Column(String)
    owner = Column(String)
    access_groups = Column(ARRAY(String))
    grid_items = relationship("GridItem", cascade="delete")


class GridItem(Base):
    """
    SQLAlchemy GridItem DB Model
    """

    __tablename__ = "griditems"

    # Columns
    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    i = Column(String, nullable=False)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    w = Column(Integer, nullable=False)
    h = Column(Integer, nullable=False)
    source = Column(String)
    args_string = Column(String)
    metadata_string = Column(String)
    __table_args__ = (UniqueConstraint("dashboard_id", "i", name="_dashboard_i"),)


def add_new_dashboard(label, name, notes, owner, access_groups, grid_items):
    # Get connection/session to database
    Session = app.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        check_existing_user_dashboard_names(session, owner, name)
        check_existing_user_dashboard_labels(session, owner, label)
        if "public" in access_groups:
            check_existing_public_dashboards(session, name, label)

        new_dashboard = Dashboard(
            label=label,
            name=name,
            notes=notes,
            owner=owner,
            access_groups=access_groups,
        )

        session.add(new_dashboard)
        session.commit()
        session.refresh(new_dashboard)

        if grid_items:
            for grid_item in grid_items:
                grid_item_i = grid_item["i"]
                grid_item_x = int(grid_item["x"])
                grid_item_y = int(grid_item["y"])
                grid_item_w = int(grid_item["w"])
                grid_item_h = int(grid_item["h"])
                grid_item_source = grid_item["source"]
                grid_item_args_string = grid_item["args_string"]
                grid_item_metadata_string = grid_item["metadata_string"]
                if grid_item_source == "Text":
                    clean_text = nh3.clean(json.loads(grid_item_args_string)["text"])
                    grid_item_args_string = json.dumps({"text": clean_text})

                add_new_grid_item(
                    session,
                    new_dashboard.id,
                    grid_item_i,
                    grid_item_x,
                    grid_item_y,
                    grid_item_w,
                    grid_item_h,
                    grid_item_source,
                    grid_item_args_string,
                    grid_item_metadata_string,
                )
        else:
            add_new_grid_item(session, new_dashboard.id, "1", 0, 0, 20, 20, "", "{}", 0)

        # Commit the session and close the connection
        session.commit()
    finally:
        session.close()


def add_new_grid_item(
    session,
    dashboard_id,
    grid_item_i,
    grid_item_x,
    grid_item_y,
    grid_item_w,
    grid_item_h,
    grid_item_source,
    grid_item_args_string,
    grid_item_metadata_string,
):
    new_grid_item = GridItem(
        dashboard_id=dashboard_id,
        i=grid_item_i,
        x=grid_item_x,
        y=grid_item_y,
        w=grid_item_w,
        h=grid_item_h,
        source=grid_item_source,
        args_string=grid_item_args_string,
        metadata_string=grid_item_metadata_string,
    )
    session.add(new_grid_item)
    session.commit()
    session.refresh(new_grid_item)

    return new_grid_item


def delete_grid_item(session, dashboard_id, i):
    db_grid_item = (
        session.query(GridItem)
        .filter(GridItem.dashboard_id == dashboard_id)
        .filter(GridItem.i == i)
        .first()
    )
    session.delete(db_grid_item)

    return


def delete_named_dashboard(user, name):
    # Get connection/session to database
    Session = app.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        db_dashboard = (
            session.query(Dashboard)
            .filter(Dashboard.owner == user)
            .filter(Dashboard.name == name)
            .first()
        )
        if not db_dashboard:
            raise Exception(
                f"A dashboard with the name {name} does not exist for this user"
            )

        session.delete(db_dashboard)

        # Commit the session and close the connection
        session.commit()
    finally:
        session.close()


def update_named_dashboard(
    original_name,
    original_label,
    original_access_groups,
    user,
    name,
    label,
    notes,
    grid_items,
    access_groups,
):
    # Get connection/session to database
    Session = app.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        db_dashboard = (
            session.query(Dashboard)
            .filter(Dashboard.owner == user)
            .filter(Dashboard.name == original_name)
            .first()
        )
        if not db_dashboard:
            raise Exception(
                f"A dashboard with the name {original_name} does not exist for this user"  # noqa: E501
            )

        if original_name != name:
            check_existing_user_dashboard_names(session, user, name)

        if original_label != label:
            check_existing_user_dashboard_labels(session, user, label)

        if "public" in access_groups and original_access_groups != access_groups:
            check_existing_public_dashboards(session, name, label)

        db_dashboard.name = name
        db_dashboard.label = label
        db_dashboard.notes = notes
        grid_items = (
            json.loads(grid_items) if isinstance(grid_items, str) else grid_items
        )
        db_dashboard.access_groups = access_groups

        existing_db_grid_items_ids = [
            grid_item.i for grid_item in db_dashboard.grid_items
        ]
        grid_items_ids = [grid_item["i"] for grid_item in grid_items]
        grid_items_to_delete = [
            i for i in existing_db_grid_items_ids if i not in grid_items_ids
        ]
        grid_items_to_add = [
            grid_item
            for grid_item in grid_items
            if grid_item["i"] not in existing_db_grid_items_ids
        ]

        for grid_item_id in grid_items_to_delete:
            delete_grid_item(session, db_dashboard.id, grid_item_id)

        for grid_item in grid_items:
            grid_item_i = grid_item["i"]
            grid_item_x = int(grid_item["x"])
            grid_item_y = int(grid_item["y"])
            grid_item_w = int(grid_item["w"])
            grid_item_h = int(grid_item["h"])
            grid_item_source = grid_item["source"]
            grid_item_args_string = grid_item["args_string"]
            grid_item_metadata_string = grid_item["metadata_string"]
            if grid_item_source == "Text":
                clean_text = nh3.clean(json.loads(grid_item_args_string)["text"])
                grid_item_args_string = json.dumps({"text": clean_text})

            if grid_item in grid_items_to_add:
                db_grid_item = add_new_grid_item(
                    session,
                    db_dashboard.id,
                    grid_item_i,
                    grid_item_x,
                    grid_item_y,
                    grid_item_w,
                    grid_item_h,
                    grid_item_source,
                    grid_item_args_string,
                    grid_item_metadata_string,
                )
            else:
                db_grid_item = (
                    session.query(GridItem)
                    .filter(GridItem.dashboard_id == db_dashboard.id)
                    .filter(GridItem.i == grid_item_i)
                    .first()
                )
                db_grid_item.i = grid_item_i
                db_grid_item.x = grid_item_x
                db_grid_item.y = grid_item_y
                db_grid_item.w = grid_item_w
                db_grid_item.h = grid_item_h
                db_grid_item.source = grid_item_source
                db_grid_item.args_string = grid_item_args_string
                db_grid_item.metadata_string = grid_item_metadata_string

        # Commit the session and close the connection
        session.commit()
    finally:
        session.close()


def get_dashboards(user, name=None):
    """
    Get all persisted dashboards.
    """
    dashboard_dict = {}
    # Get connection/session to database
    Session = app.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        # Query for all records
        available_dashboards = session.query(Dashboard).filter(
            (Dashboard.owner == user) | (Dashboard.access_groups.any("public"))
        )
        if name:
            dashboards = available_dashboards.filter(Dashboard.name == name).all()
        else:
            dashboards = available_dashboards.order_by(Dashboard.name).all()

        for dashboard in dashboards:
            dashboard_dict[dashboard.name] = {
                "id": dashboard.id,
                "name": dashboard.name,
                "label": dashboard.label,
                "notes": dashboard.notes,
                "editable": True if dashboard.owner == user else False,
                "accessGroups": (
                    ["public"] if "public" in dashboard.access_groups else []
                ),
            }

            griditems = []
            for griditem in dashboard.grid_items:
                griditem_data = {
                    "id": griditem.id,
                    "i": griditem.i,
                    "x": griditem.x,
                    "y": griditem.y,
                    "w": griditem.w,
                    "h": griditem.h,
                    "source": griditem.source,
                    "args_string": griditem.args_string,
                    "metadata_string": griditem.metadata_string,
                }
                griditems.append(griditem_data)

            dashboard_dict[dashboard.name]["gridItems"] = griditems

    finally:
        session.close()

    return dashboard_dict


def check_existing_user_dashboard_names(session, user, dashboard_name):
    user_dashboards = session.query(Dashboard).filter(Dashboard.owner == user).all()
    user_dashboard_names = [dashboard.name for dashboard in user_dashboards]
    if dashboard_name in user_dashboard_names:
        raise Exception(
            f"A dashboard with the name {dashboard_name} already exists. Change the name before attempting again."  # noqa: E501
        )


def check_existing_user_dashboard_labels(session, user, dashboard_label):
    user_dashboards = session.query(Dashboard).filter(Dashboard.owner == user).all()
    user_dashboard_labels = [dashboard.label for dashboard in user_dashboards]
    if dashboard_label in user_dashboard_labels:
        raise Exception(
            f"A dashboard with the label {dashboard_label} already exists. Change the label before attempting again."  # noqa: E501
        )


def check_existing_public_dashboards(session, dashboard_name, dashboard_label):
    public_dashboards = (
        session.query(Dashboard).filter(Dashboard.access_groups.any("public")).all()
    )
    public_dashboard_names = [dashboard.name for dashboard in public_dashboards]
    if dashboard_name in public_dashboard_names:
        raise Exception(
            f"A dashboard with the name {dashboard_name} is already public. Change the name before attempting again."  # noqa: E501
        )
    public_dashboard_labels = [dashboard.name for dashboard in public_dashboards]
    if dashboard_label in public_dashboard_labels:
        raise Exception(
            f"A dashboard with the label {dashboard_label} is already public. Change the label before attempting again."  # noqa: E501
        )


def init_primary_db(engine, first_time):
    """
    Initializer for the primary database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)
