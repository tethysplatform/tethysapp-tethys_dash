import enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    Enum,
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
    unrestricted_placement = Column(Boolean)
    public = Column(Boolean)
    permissions = relationship(
        "DashboardPermission", cascade="delete", back_populates="dashboard"
    )
    grid_items = relationship(
        "GridItem",
        back_populates="dashboard",
        cascade="all, delete-orphan",
        order_by="GridItem.order",
    )
    last_updated = Column(DateTime, default=datetime.now(timezone.utc))


class GridItem(Base):
    """
    SQLAlchemy GridItem DB Model
    """

    __tablename__ = "griditems"

    # Columns
    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    dashboard = relationship("Dashboard", back_populates="grid_items")
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


class DashboardPermissionLevel(enum.Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class DashboardPermission(Base):
    __tablename__ = "dashboard_permissions"
    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    username = Column(String, nullable=True)  # username or user id
    group = Column(String, nullable=True)  # group name or id
    permission = Column(Enum(DashboardPermissionLevel), nullable=False)

    __table_args__ = (
        UniqueConstraint("dashboard_id", "username", name="_dashboard_user_perm"),
        UniqueConstraint("dashboard_id", "group", name="_dashboard_group_perm"),
    )

    dashboard = relationship("Dashboard", back_populates="permissions")


class GroupPermissionLevel(enum.Enum):
    admin = "admin"
    member = "member"


class PermissionGroup(Base):
    __tablename__ = "permission_groups"
    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    owner = Column(String, nullable=False)

    members = relationship(
        "PermissionGroupUser",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,  # Let DB handle ON DELETE CASCADE
    )


class PermissionGroupUser(Base):
    __tablename__ = "permission_group_user"
    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False)
    group_id = Column(
        Integer,
        ForeignKey("permission_groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    permission = Column(Enum(GroupPermissionLevel), nullable=False)

    group = relationship("PermissionGroup", back_populates="members")


def add_new_dashboard(
    owner,
    uuid,
    name,
    description,
    notes,
    public,
    unrestricted_placement,
    grid_items,
):
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        new_dashboard = Dashboard(
            uuid=uuid,
            description=description,
            name=name,
            notes=notes,
            public=public,
            owner=owner,
            unrestricted_placement=unrestricted_placement,
        )

        session.add(new_dashboard)
        session.commit()
        session.refresh(new_dashboard)
        new_dashboard_id = new_dashboard.id

        # Add default admin permission for owner
        owner_permission = DashboardPermission(
            dashboard_id=new_dashboard_id,
            username=owner,
            permission=DashboardPermissionLevel.admin,
        )
        session.add(owner_permission)
        session.commit()

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
            public=original_dashboard.public,
            owner=user,
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

        # Only add admin permission for the user
        admin_permission = DashboardPermission(
            dashboard_id=new_dashboard.id,
            username=user,
            permission=DashboardPermissionLevel.admin,
        )
        session.add(admin_permission)
        new_dashboard.permissions = [admin_permission]

        session.commit()  # Save everything
    finally:
        session.close()

    return [new_dashboard_id, copied_dashboard_uuid]


def delete_named_dashboard(user, id):
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        db_dashboard = session.query(Dashboard).filter(Dashboard.id == id).first()
        if not db_dashboard:
            raise Exception(f"A dashboard with the id {id} does not exist.")

        user_permission = get_dashboard_user_permission(session, db_dashboard, user)

        # Check if user has admin permission
        if user_permission != DashboardPermissionLevel.admin:
            raise Exception(
                "User does not have admin permission to delete the dashboard."
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
        db_dashboard = session.query(Dashboard).filter(Dashboard.id == id).first()
        if not db_dashboard:
            raise Exception(
                f"A dashboard with the id {id} does not exist for this user"  # noqa: E501
            )
        user_permission = get_dashboard_user_permission(session, db_dashboard, user)

        # Check if user has editor or admin permission
        if (
            user_permission != DashboardPermissionLevel.editor
            and user_permission != DashboardPermissionLevel.admin
        ):
            raise Exception(
                "User does not have admin or editor permissions to update the dashboard."  # noqa: E501
            )

        db_name = dashboard_updates.get("name", db_dashboard.name)
        db_public = dashboard_updates.get("public", db_dashboard.public)

        if db_name != db_dashboard.name:
            # Check if user has admin permission
            if user_permission != DashboardPermissionLevel.admin:
                raise Exception(
                    "User does not have admin permission to change the name of the dashboard."  # noqa: E501
                )
            db_dashboard.name = dashboard_updates["name"]

        if "description" in dashboard_updates:
            db_dashboard.description = dashboard_updates["description"]

        if "notes" in dashboard_updates:
            db_dashboard.notes = sanitize_html(dashboard_updates["notes"])

        if db_public != db_dashboard.public:
            # Check if user has admin permission
            if user_permission != DashboardPermissionLevel.admin:
                raise Exception(
                    "User does not have admin permission to change the public status of the dashboard."  # noqa: E501
                )
            db_dashboard.public = dashboard_updates["public"]

        if "unrestrictedPlacement" in dashboard_updates:
            db_dashboard.unrestricted_placement = dashboard_updates[
                "unrestrictedPlacement"
            ]

        if "permissions" in dashboard_updates:
            update_dashboard_permissions(
                session, db_dashboard, user, dashboard_updates["permissions"]
            )

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
        parsed_dashboard = parse_db_dashboard(
            session, [db_dashboard], user, dashboard_view=True
        )[0]
    finally:
        session.close()

    return parsed_dashboard


def get_dashboard_user_permission(session, dashboard, user):
    """
    Returns the highest permission level (admin > editor > viewer) the user has
    for the given dashboard, either directly or via group membership.

    Returns None if no permission.
    """

    # Get all group names the user belongs to
    user_groups = (
        session.query(PermissionGroup.name)
        .join(PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id)
        .filter(PermissionGroupUser.username == user)
        .all()
    )
    user_group_names = [g[0] for g in user_groups]

    # Collect all permissions for user and their groups
    perms = []
    for p in dashboard.permissions:
        if p.username == user:
            perms.append(p.permission)
        elif p.group and p.group in user_group_names:
            perms.append(p.permission)

    # Determine highest permission
    if DashboardPermissionLevel.admin in perms:
        return DashboardPermissionLevel.admin
    elif DashboardPermissionLevel.editor in perms:
        return DashboardPermissionLevel.editor
    elif DashboardPermissionLevel.viewer in perms:
        return DashboardPermissionLevel.viewer
    else:
        return None


def update_dashboard_permissions(session, db_dashboard, user, updated_permissions):
    """
    Update dashboard permissions for a given dashboard.
    Only allow if the user has admin permission for the dashboard.
    updated_permissions: list of dicts [{username: str, permission: str}]
    """

    # Check if user has admin permission
    user_permission = get_dashboard_user_permission(session, db_dashboard, user)
    if user_permission != DashboardPermissionLevel.admin:
        raise Exception(
            "User does not have admin permission to change the permissions of the dashboard."  # noqa: E501
        )

    # Build lookup for updated permissions
    updated_user_lookup = {
        p["username"]: p["permission"] for p in updated_permissions if "username" in p
    }
    updated_group_lookup = {
        p["group"]: p["permission"] for p in updated_permissions if "group" in p
    }

    # Existing permissions
    existing_user_perms = {
        p.username: p for p in db_dashboard.permissions if p.username
    }
    existing_group_perms = {p.group: p for p in db_dashboard.permissions if p.group}

    # Add or update user permissions
    for username, perm_level in updated_user_lookup.items():
        if username == user or username == db_dashboard.owner:
            continue
        if username in existing_user_perms:
            perm_obj = existing_user_perms[username]
            if perm_obj.permission.value != perm_level:
                perm_obj.permission = DashboardPermissionLevel(perm_level)
        else:
            new_perm = DashboardPermission(
                dashboard_id=db_dashboard.id,
                username=username,
                permission=DashboardPermissionLevel(perm_level),
            )
            session.add(new_perm)

    # Add or update group permissions
    for groupname, perm_level in updated_group_lookup.items():
        if groupname in existing_group_perms:
            perm_obj = existing_group_perms[groupname]
            if perm_obj.permission.value != perm_level:
                perm_obj.permission = DashboardPermissionLevel(perm_level)
        else:
            new_perm = DashboardPermission(
                dashboard_id=db_dashboard.id,
                group=groupname,
                permission=DashboardPermissionLevel(perm_level),
            )
            session.add(new_perm)

    # Delete user permissions not in updated list
    to_delete_users = [
        p
        for uname, p in existing_user_perms.items()
        if uname not in updated_user_lookup
        and uname != user
        and uname != db_dashboard.owner
    ]
    for perm_obj in to_delete_users:
        session.delete(perm_obj)

    # Delete group permissions not in updated list
    to_delete_groups = [
        p
        for gname, p in existing_group_perms.items()
        if gname not in updated_group_lookup
    ]
    for perm_obj in to_delete_groups:
        session.delete(perm_obj)

    session.commit()


def get_user_permission_groups(user):
    """
    Returns a list of all permission groups the user belongs to,
    with all users, their permissions, and the owner.
    """
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        # Get all groups the user belongs to
        groups = (
            session.query(PermissionGroup)
            .join(
                PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id
            )
            .filter(PermissionGroupUser.username == user)
            .all()
        )
        result = []
        for group in groups:
            result.append(parse_group_permissions(user, group))

        return result
    finally:
        session.close()


def update_permission_groups(user, group_data):
    """
    Create or update a permission group.
    group_data: dict like {
        'id': None,
        'name': 'a',
        'description': 'a',
        'members': [{'username': 'admin', 'permission': 'admin'}]}

    If id is None, create a new group.
    If not None, update if user is owner or admin in the group.
    """
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        group_id = group_data.get("id")
        name = group_data.get("name")
        description = group_data.get("description")
        members = group_data.get("members", [])

        if group_id is None:
            # Check if group name already exists
            existing_group = (
                session.query(PermissionGroup)
                .filter(PermissionGroup.name == name)
                .first()
            )
            if existing_group:
                return {
                    "status": "error",
                    "message": f"The group name {name} already exists",
                }
            # Create new group
            group = PermissionGroup(name=name, description=description, owner=user)
            session.add(group)
            session.flush()  # get group.id

            # Add members
            for member in members:
                session.add(
                    PermissionGroupUser(
                        username=member["username"],
                        group_id=group.id,
                        permission=member["permission"],
                    )
                )
            session.commit()
        else:
            # Update existing group
            group = (
                session.query(PermissionGroup)
                .filter(PermissionGroup.id == group_id)
                .first()
            )
            if not group:
                return {"status": "error", "message": "Group not found"}
            # Check if new name is taken by another group
            existing_group = (
                session.query(PermissionGroup)
                .filter(PermissionGroup.name == name, PermissionGroup.id != group_id)
                .first()
            )
            if existing_group:
                return {
                    "status": "error",
                    "message": f"The group name {name} already exists",
                }

            # Only owner or admin can update
            if group.owner != user:
                admin_member = (
                    session.query(PermissionGroupUser)
                    .filter(
                        PermissionGroupUser.group_id == group.id,
                        PermissionGroupUser.username == user,
                        PermissionGroupUser.permission == GroupPermissionLevel.admin,
                    )
                    .first()
                )
                if not admin_member:
                    return {
                        "status": "error",
                        "message": "User is not owner or admin in group",
                    }

            # Update group info
            group.name = name
            group.description = description

            # Update members
            session.query(PermissionGroupUser).filter(
                PermissionGroupUser.group_id == group.id
            ).delete()
            for member in members:
                session.add(
                    PermissionGroupUser(
                        username=member["username"],
                        group_id=group.id,
                        permission=member["permission"],
                    )
                )
            session.commit()
        permission_group_dict = parse_group_permissions(user, group)

    finally:
        session.close()

    return permission_group_dict


def delete_permission_groups(user, permission_group_id):
    """
    Delete a permission group if the user is the owner or an admin in the group.
    Returns a dict with status and message.
    """
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        group = (
            session.query(PermissionGroup)
            .filter(PermissionGroup.id == permission_group_id)
            .first()
        )
        if not group:
            return {"status": "error", "message": "Group not found"}
        # Only owner or admin can delete
        if group.owner != user:
            # Check if user is admin in group
            admin_member = (
                session.query(PermissionGroupUser)
                .filter(
                    PermissionGroupUser.group_id == group.id,
                    PermissionGroupUser.username == user,
                    PermissionGroupUser.permission == GroupPermissionLevel.admin,
                )
                .first()
            )
            if not admin_member:
                return {
                    "status": "error",
                    "message": "User is not owner or admin in group",
                }
        # Delete all members first
        session.query(PermissionGroupUser).filter(
            PermissionGroupUser.group_id == group.id
        ).delete()
        session.delete(group)
        session.commit()
        return {"status": "deleted"}
    finally:
        session.close()


def parse_group_permissions(user, group):
    members = [
        {"username": member.username, "permission": member.permission.value}
        for member in group.members
    ]
    user_permission = next(
        (m["permission"] for m in members if m["username"] == user), None
    )

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "owner": group.owner,
        "members": [
            {"username": member.username, "permission": member.permission.value}
            for member in group.members
        ],
        "user_permission": user_permission,
    }


def parse_db_dashboard(session, dashboards, user, dashboard_view):
    dashboard_list = []

    for dashboard in dashboards:
        dashboard_image = os.path.join(
            settings.MEDIA_URL, App.root_url, f"app/{dashboard.uuid}.png"
        )
        app_media = get_app_media(App)
        if not os.path.exists(os.path.join(app_media.path, f"{dashboard.uuid}.png")):
            dashboard_image = "/static/tethysdash/images/dashboard_thumbnail.png"

        # Find the user's permission level for this dashboard
        user_permission = get_dashboard_user_permission(session, dashboard, user)
        if user_permission:
            user_permission = user_permission.value

        permissions_list = []
        for perm in dashboard.permissions:
            if perm.username:
                permissions_list.append(
                    {
                        "username": perm.username,
                        "permission": perm.permission.value,
                    }
                )
            elif perm.group:
                permissions_list.append(
                    {
                        "group": perm.group,
                        "permission": perm.permission.value,
                    }
                )

        dashboard_dict = {
            "id": dashboard.id,
            "uuid": dashboard.uuid,
            "name": dashboard.name,
            "description": dashboard.description,
            "publicDashboard": dashboard.public,
            "userPermission": user_permission,
            "permissions": permissions_list,
            "unrestrictedPlacement": dashboard.unrestricted_placement,
            "image": dashboard_image,
            "owner": dashboard.owner,
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
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        if id:
            dashboard = session.query(Dashboard).filter(Dashboard.id == id).first()
            return parse_db_dashboard(session, [dashboard], user, dashboard_view)[0]

        # Get all group names the user belongs to
        user_groups = (
            session.query(PermissionGroup.name)
            .join(
                PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id
            )
            .filter(PermissionGroupUser.username == user)
            .all()
        )
        user_group_names = [g[0] for g in user_groups]

        # Dashboards user has direct or group permissions for
        user_dashboards = (
            session.query(Dashboard)
            .join(DashboardPermission)
            .filter(
                (DashboardPermission.username == user)
                | (DashboardPermission.group.in_(user_group_names))
            )
        ).all()

        # Public dashboards (not already included)
        public_dashboards = (
            session.query(Dashboard)
            .filter(Dashboard.public == True)  # noqa: E712
            .filter(~Dashboard.permissions.any(DashboardPermission.username == user))
            .filter(
                ~Dashboard.permissions.any(
                    DashboardPermission.group.in_(user_group_names)
                )
            )
        ).all()

        dashboards = user_dashboards + public_dashboards
        return parse_db_dashboard(session, dashboards, user, dashboard_view)
    finally:
        session.close()


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
