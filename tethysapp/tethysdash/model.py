from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ARRAY,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
import json
import os
from tethysapp.tethysdash.app import App
from datetime import datetime, timezone
from django.conf import settings
from tethys_sdk.paths import get_app_media, get_app_workspace
import base64
from alembic.config import Config
from alembic import command, script
from sqlalchemy.exc import ProgrammingError, OperationalError
from pathlib import Path
import subprocess
from tethysapp.tethysdash.utilities import sanitize_html

Base = declarative_base()


class Dashboard(Base):
    """
    SQLAlchemy Dashboard DB Model
    """

    __tablename__ = "dashboards"

    # Columns
    id = Column(Integer, primary_key=True)
    uuid = Column(String)
    description = Column(String)
    name = Column(String)
    notes = Column(String)
    owner = Column(String)
    access_groups = Column(ARRAY(String))
    unrestricted_placement = Column(Boolean)
    grid_items = relationship("GridItem", cascade="delete", order_by="GridItem.order")
    last_updated = Column(DateTime, default=datetime.now(timezone.utc))


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
    order = Column(Integer)
    __table_args__ = (UniqueConstraint("dashboard_id", "i", name="_dashboard_i"),)


def add_new_dashboard(
    owner,
    uuid,
    name,
    description,
    notes,
    access_groups,
    unrestricted_placement,
    grid_items,
):
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        check_existing_user_dashboard_names(session, owner, name)

        new_dashboard = Dashboard(
            uuid=uuid,
            description=description,
            name=name,
            notes=notes,
            owner=owner,
            access_groups=access_groups,
            unrestricted_placement=unrestricted_placement,
        )

        session.add(new_dashboard)
        session.commit()
        session.refresh(new_dashboard)
        new_dashboard_id = new_dashboard.id

        if grid_items:
            for index, grid_item in enumerate(grid_items):
                grid_item_i = grid_item["i"]
                grid_item_x = int(grid_item["x"])
                grid_item_y = int(grid_item["y"])
                grid_item_w = int(grid_item["w"])
                grid_item_h = int(grid_item["h"])
                grid_item_source = grid_item["source"]
                grid_item_args_string = grid_item["args_string"]
                grid_item_metadata_string = grid_item["metadata_string"]
                if grid_item_source == "Text":
                    clean_text = sanitize_html(
                        json.loads(grid_item_args_string)["text"]
                    )
                    grid_item_args_string = json.dumps({"text": clean_text})

                add_new_grid_item(
                    session,
                    new_dashboard_id,
                    grid_item_i,
                    grid_item_x,
                    grid_item_y,
                    grid_item_w,
                    grid_item_h,
                    grid_item_source,
                    grid_item_args_string,
                    grid_item_metadata_string,
                    index,
                )
        else:
            add_new_grid_item(
                session, new_dashboard_id, "1", 0, 0, 20, 20, "", "{}", "{}", 0
            )

        # Commit the session and close the connection
        session.commit()
    finally:
        session.close()

    return new_dashboard_id


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
    grid_item_order,
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
        order=grid_item_order,
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
    session.commit()

    return


def copy_named_dashboard(user, id, new_name, dashboard_uuid):
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        original_dashboard = session.query(Dashboard).filter(Dashboard.id == id).first()
        copied_dashboard_uuid = original_dashboard.uuid

        new_dashboard = Dashboard(
            uuid=dashboard_uuid,
            description=original_dashboard.description,
            name=new_name,
            notes=original_dashboard.notes,
            owner=user,
            access_groups=[],
            unrestricted_placement=original_dashboard.unrestricted_placement,
        )

        # Add and flush to generate new ID
        session.add(new_dashboard)
        session.flush()  # Ensure new_dashboard gets an ID before copying grid_items
        new_dashboard_id = new_dashboard.id

        # Copy GridItems and explicitly add them to the session
        new_grid_items = []
        for index, grid_item in enumerate(original_dashboard.grid_items):
            new_item = GridItem(
                i=grid_item.i,
                x=grid_item.x,
                y=grid_item.y,
                w=grid_item.w,
                h=grid_item.h,
                source=grid_item.source,
                args_string=grid_item.args_string,
                metadata_string=grid_item.metadata_string,
                dashboard_id=new_dashboard.id,  # Explicitly link to new dashboard
                order=index,
            )
            session.add(new_item)  # Explicitly add to session
            new_grid_items.append(new_item)

        new_dashboard.grid_items = new_grid_items  # Assign the new items

        session.commit()  # Save everything
    finally:
        session.close()

    return [new_dashboard_id, copied_dashboard_uuid]


def delete_named_dashboard(user, id):
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        db_dashboard = (
            session.query(Dashboard)
            .filter(Dashboard.owner == user)
            .filter(Dashboard.id == id)
            .first()
        )
        if not db_dashboard:
            raise Exception(
                f"A dashboard with the id {id} does not exist for this user"
            )

        db_dashboard_uuid = db_dashboard.uuid
        session.delete(db_dashboard)

        # Commit the session and close the connection
        session.commit()
    finally:
        session.close()

    return db_dashboard_uuid


def update_named_dashboard(user, id, dashboard_updates):
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        db_dashboard = (
            session.query(Dashboard)
            .filter(Dashboard.owner == user)
            .filter(Dashboard.id == id)
            .first()
        )
        if not db_dashboard:
            raise Exception(
                f"A dashboard with the id {id} does not exist for this user"  # noqa: E501
            )

        db_name = dashboard_updates.get("name", db_dashboard.name)
        db_access = dashboard_updates.get("accessGroups", db_dashboard.access_groups)

        if db_name != db_dashboard.name:
            check_existing_user_dashboard_names(
                session, user, dashboard_updates["name"]
            )
            if "public" in db_access:
                check_existing_public_dashboards(session, dashboard_updates["name"])
            db_dashboard.name = dashboard_updates["name"]

        if "description" in dashboard_updates:
            db_dashboard.description = dashboard_updates["description"]

        if "notes" in dashboard_updates:
            db_dashboard.notes = sanitize_html(dashboard_updates["notes"])

        if db_access != db_dashboard.access_groups:
            if "public" in dashboard_updates["accessGroups"]:
                check_existing_public_dashboards(session, db_name)
            db_dashboard.access_groups = dashboard_updates["accessGroups"]

        if "unrestrictedPlacement" in dashboard_updates:
            db_dashboard.unrestricted_placement = dashboard_updates[
                "unrestrictedPlacement"
            ]

        if "gridItems" in dashboard_updates:
            updated_grid_items = dashboard_updates["gridItems"]
            existing_db_grid_items_ids = [
                grid_item.i for grid_item in db_dashboard.grid_items
            ]
            grid_items_ids = [grid_item["i"] for grid_item in updated_grid_items]
            grid_items_to_delete = [
                i for i in existing_db_grid_items_ids if i not in grid_items_ids
            ]
            grid_items_to_add = [
                grid_item
                for grid_item in updated_grid_items
                if grid_item["i"] not in existing_db_grid_items_ids
            ]

            for grid_item_id in grid_items_to_delete:
                delete_grid_item(session, db_dashboard.id, grid_item_id)

            for index, grid_item in enumerate(updated_grid_items):
                grid_item_i = grid_item["i"]
                grid_item_x = int(grid_item["x"])
                grid_item_y = int(grid_item["y"])
                grid_item_w = int(grid_item["w"])
                grid_item_h = int(grid_item["h"])
                grid_item_source = grid_item["source"]
                grid_item_args_string = grid_item["args_string"]
                grid_item_metadata_string = grid_item["metadata_string"]
                if grid_item_source == "Text":
                    clean_text = sanitize_html(
                        json.loads(grid_item_args_string)["text"]
                    )
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
                        index,
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
                    db_grid_item.order = index

        db_dashboard.last_updated = datetime.now(timezone.utc)

        if "image" in dashboard_updates:
            # Extract the file format (e.g., 'data:image/png;base64,')
            imgstr = dashboard_updates["image"].split(";base64,")[1]
            app_media = get_app_media(App)
            file_path = os.path.join(app_media.path, f"{db_dashboard.uuid}.png")

            # Decode and write the image file
            with open(file_path, "wb") as file:
                file.write(base64.b64decode(imgstr))

        # Commit the session and close the connection
        session.commit()

        parsed_dashboard = parse_db_dashboard([db_dashboard], dashboard_view=True)[0]
    finally:
        session.close()

    return parsed_dashboard


def parse_db_dashboard(dashboards, dashboard_view):
    dashboard_list = []

    for dashboard in dashboards:
        dashboard_image = os.path.join(
            settings.MEDIA_URL, App.root_url, f"app/{dashboard.uuid}.png"
        )
        app_media = get_app_media(App)
        if not os.path.exists(os.path.join(app_media.path, f"{dashboard.uuid}.png")):
            dashboard_image = "/static/tethysdash/images/tethys_dash.png"

        dashboard_dict = {
            "id": dashboard.id,
            "uuid": dashboard.uuid,
            "name": dashboard.name,
            "description": dashboard.description,
            "accessGroups": (["public"] if "public" in dashboard.access_groups else []),
            "unrestrictedPlacement": dashboard.unrestricted_placement,
            "image": dashboard_image,
        }

        if dashboard_view:
            dashboard_dict.update({"notes": dashboard.notes})

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

            dashboard_dict["gridItems"] = griditems

        dashboard_list.append(dashboard_dict)

    return dashboard_list


def get_dashboards(user, dashboard_view=False, id=None):
    """
    Get all persisted dashboards.
    """
    dashboard_dict = {"user": {}, "public": {}}
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        # Query for all records
        user_dashboards = session.query(Dashboard).filter(Dashboard.owner == user)
        if id:
            dashboard = session.query(Dashboard).filter(Dashboard.id == id).first()
            return parse_db_dashboard([dashboard], dashboard_view)[0]

        dashboard_dict["user"] = parse_db_dashboard(user_dashboards, dashboard_view)

        public_dashboards = (
            session.query(Dashboard)
            .filter(Dashboard.owner != user)
            .filter(Dashboard.access_groups.any("public"))
        )

        dashboard_dict["public"] = parse_db_dashboard(public_dashboards, dashboard_view)

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


def check_existing_public_dashboards(session, dashboard_name):
    public_dashboards = (
        session.query(Dashboard).filter(Dashboard.access_groups.any("public")).all()
    )
    public_dashboard_names = [dashboard.name for dashboard in public_dashboards]
    if dashboard_name in public_dashboard_names:
        raise Exception(
            f"A dashboard with the name {dashboard_name} is already public. Change the name before attempting again."  # noqa: E501
        )


def clean_up_jsons(user):
    print("Checking to see if there are any unused json files to remove")
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    user_dashboards = session.query(Dashboard).filter(Dashboard.owner == user).all()
    in_use_jsons = []
    for user_dashboard in user_dashboards:
        maps_grid_items_layers = flatten(
            [
                json.loads(grid_item.args_string)["layers"]
                for grid_item in user_dashboard.grid_items
                if grid_item.source == "Map"
            ]
        )
        if maps_grid_items_layers:
            json_files = [
                maps_grid_items_layer["configuration"]["props"]["source"]["geojson"]
                for maps_grid_items_layer in maps_grid_items_layers
                if maps_grid_items_layer["configuration"]["props"]["source"]["type"]
                == "GeoJSON"
            ]
            in_use_jsons.append(json_files)

            stylejson_files = [
                maps_grid_items_layer["configuration"]["style"]
                for maps_grid_items_layer in maps_grid_items_layers
                if "style" in maps_grid_items_layer["configuration"]
            ]
            in_use_jsons.append(stylejson_files)

    in_use_jsons = flatten(in_use_jsons)

    app_workspace = get_app_workspace(App)
    json_folder = os.path.join(app_workspace.path, "json")
    json_user_folder = os.path.join(json_folder, user)
    if not os.path.exists(json_user_folder):
        os.makedirs(json_user_folder)
    existing_json_user_files = os.listdir(json_user_folder)

    unused_files = [
        file for file in existing_json_user_files if file not in in_use_jsons
    ]

    for unused_file in unused_files:
        print(f"Removing the {unused_file} file")
        os.remove(os.path.join(json_folder, user, unused_file))
        os.remove(os.path.join(json_folder, unused_file))

    return


def flatten(xss):
    return [x for xs in xss for x in xs]


def init_primary_db(engine, first_time):
    """
    Initializer for the primary database.
    """
    # Load Alembic configuration
    tethysdash_directory = Path(__file__).resolve().parent
    alembic_directory = str(tethysdash_directory / "alembic")
    alembic_cfg = Config(tethysdash_directory / "alembic.ini")
    alembic_cfg.set_main_option("script_location", alembic_directory)
    script_directory = script.ScriptDirectory.from_config(alembic_cfg)

    command.ensure_version(alembic_cfg)

    result = subprocess.run(
        ["alembic", "current"], capture_output=True, text=True, cwd=tethysdash_directory
    )
    current_revision = result.stdout.split(" ")[0]

    if current_revision:
        print("Upgrading to head")
        command.upgrade(alembic_cfg, "head")
    else:
        # Iterate over revisions in order
        revisions = list(script_directory.walk_revisions(base="base", head="head"))
        revisions.reverse()  # walk_revisions returns in reverse order (head -> base)

        for rev in revisions:
            try:
                print(f"Attempting to upgrade to revision {rev.revision}")
                command.upgrade(alembic_cfg, rev.revision)
                print(f"Successfully upgraded to revision {rev.revision}")
            except (ProgrammingError, OperationalError) as e:
                if "already exists" in str(e):
                    command.stamp(alembic_cfg, rev.revision)
                    print(
                        f"Stamped and Skipped revision {rev.revision} (column/table already exists)"  # noqa: E501
                    )
                else:
                    raise  # Unknown error — don't skip
