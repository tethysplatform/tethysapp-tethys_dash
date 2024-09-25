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
    __table_args__ = (UniqueConstraint("dashboard_id", "i", name="_dashboard_i"),)


def add_new_dashboard(label, name, notes, owner, access_groups):
    # Get connection/session to database
    Session = app.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
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

        add_new_grid_item(
            session,
            new_dashboard.id,
            "1",
            0,
            0,
            20,
            20,
            "",
            "{}",
        )

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
        db_dashboard = session.query(Dashboard).filter(Dashboard.name == name).first()
        if db_dashboard.owner != user:
            raise Exception("Dashboards can only be deleted by their owner")

        session.delete(db_dashboard)

        # Commit the session and close the connection
        session.commit()
    finally:
        session.close()


def update_named_dashboard(user, name, label, notes, grid_items, access_groups):
    # Get connection/session to database
    Session = app.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        db_dashboard = session.query(Dashboard).filter(Dashboard.name == name).first()
        if db_dashboard.owner != user:
            raise Exception("Dashboards can only be updated by their owner")

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
                "access_groups": (
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
                }
                griditems.append(griditem_data)

            dashboard_dict[dashboard.name]["gridItems"] = griditems

    finally:
        session.close()

    return dashboard_dict


def init_primary_db(engine, first_time):
    """
    Initializer for the primary database.
    """
    # Create all the tables
    Base.metadata.create_all(engine)
