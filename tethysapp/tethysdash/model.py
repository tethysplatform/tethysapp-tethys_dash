"""SQLAlchemy models for TethysDash application.

This module defines the database models for the TethysDash application,
including dashboards, grid items, permissions, and permission groups.
It also provides functions for creating, updating, and managing these entities.
"""

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
from django.contrib.auth import get_user_model

Base = declarative_base()


class Dashboard(Base):
    """
    SQLAlchemy model for dashboard entities.

    Represents a dashboard with its metadata, permissions, and associated grid items.
    Each dashboard has an owner, can be public or private, and contains multiple
    visualization components arranged in a grid layout.

    Attributes:
        id (int): Primary key identifier
        uuid (str): Unique identifier for the dashboard
        description (str): Optional description of the dashboard
        name (str): Display name of the dashboard
        notes (str): Optional notes about the dashboard
        owner (str): Username of the dashboard owner
        unrestricted_placement (bool): Whether grid items can be placed anywhere
        public (bool): Whether the dashboard is publicly accessible
        last_updated (datetime): Timestamp of last modification
        permissions (relationship): Related dashboard permissions
        grid_items (relationship): Related grid items in the dashboard
    """

    __tablename__ = "dashboards"

    # Columns
    id = Column(Integer, primary_key=True)
    uuid = Column(String, nullable=False)
    description = Column(String)
    name = Column(String, nullable=False)
    notes = Column(String)
    owner = Column(String, nullable=False)
    unrestricted_placement = Column(Boolean)
    public = Column(Boolean, nullable=False, default=False)
    last_updated = Column(DateTime, default=datetime.now(timezone.utc))

    # Relationships
    permissions = relationship(
        "DashboardPermission",
        cascade="all, delete-orphan",
        back_populates="dashboard",
    )
    grid_items = relationship(
        "GridItem",
        back_populates="dashboard",
        cascade="all, delete-orphan",
        order_by="GridItem.order",
    )
    tabs = relationship(
        "DashboardTab",
        back_populates="dashboard",
        cascade="all, delete-orphan",
        order_by="DashboardTab.tab_order",
    )


class DashboardTab(Base):
    __tablename__ = "dashboard_tabs"

    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    name = Column(String, nullable=False)  # Tab display name
    tab_order = Column(Integer, default=0)  # Order of tabs

    # Relationships
    dashboard = relationship("Dashboard", back_populates="tabs")
    grid_items = relationship(
        "GridItem", back_populates="tab", cascade="all, delete-orphan"
    )


class GridItem(Base):
    """
    SQLAlchemy model for grid items within dashboards.

    Represents individual visualization components positioned within a dashboard's
    grid layout. Each grid item has position, size, and visualization configuration.

    Attributes:
        id (int): Primary key identifier
        dashboard_id (int): Foreign key to parent dashboard
        dashboard (relationship): Reference to parent dashboard
        i (str): Unique identifier within the dashboard grid
        x (int): Horizontal position in grid units
        y (int): Vertical position in grid units
        w (int): Width in grid units
        h (int): Height in grid units
        source (str): Type of visualization/component
        args_string (str): JSON string containing visualization arguments
        metadata_string (str): JSON string containing component metadata
        order (int): Display order within the dashboard
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

    # relationships
    tab_id = Column(
        Integer, ForeignKey("dashboard_tabs.id"), nullable=True
    )  # Nullable for backward compatibility
    tab = relationship("DashboardTab", back_populates="grid_items")


class DashboardPermissionLevel(enum.Enum):
    """Enumeration of dashboard permission levels.

    Defines the three levels of access that can be granted for dashboards:
    - admin: Full control including editing, deleting, and managing permissions
    - editor: Can edit dashboard content but cannot manage permissions or delete
    - viewer: Read-only access to view the dashboard
    """

    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class DashboardPermission(Base):
    """
    SQLAlchemy model for dashboard access permissions.

    Manages user and group permissions for dashboards, supporting three permission
    levels: admin, editor, and viewer. Permissions can be granted to individual
    users or to permission groups.

    Attributes:
        id (int): Primary key identifier
        dashboard_id (int): Foreign key to the dashboard
        username (str): Username for user-specific permissions (nullable)
        group_id (int): Foreign key to permission group (nullable)
        permission (DashboardPermissionLevel): Permission level enum
        dashboard (relationship): Reference to the dashboard
        group (relationship): Reference to the permission group
    """

    __tablename__ = "dashboard_permissions"

    id = Column(Integer, primary_key=True)
    dashboard_id = Column(Integer, ForeignKey("dashboards.id"), nullable=False)
    username = Column(String, nullable=True)
    group_id = Column(
        Integer, ForeignKey("permission_groups.id", ondelete="CASCADE"), nullable=True
    )
    permission = Column(Enum(DashboardPermissionLevel), nullable=False)

    __table_args__ = (
        UniqueConstraint("dashboard_id", "username", name="_dashboard_user_perm"),
        UniqueConstraint("dashboard_id", "group_id", name="_dashboard_group_perm"),
    )

    dashboard = relationship("Dashboard", back_populates="permissions")
    group = relationship("PermissionGroup")


class VisualizationPermission(Base):
    """
    SQLAlchemy model for visualization access permissions.

    Controls access to specific visualization types within the application.
    Permissions can be granted to individual users or to permission groups.

    Attributes:
        id (int): Primary key identifier
        visualization (str): Name/identifier of the visualization type
        username (str): Username for user-specific permissions (nullable)
        group_id (int): Foreign key to permission group (nullable)
        group (relationship): Reference to the permission group
    """

    __tablename__ = "visualization_permissions"

    id = Column(Integer, primary_key=True)
    visualization = Column(String, nullable=False)
    username = Column(String, nullable=True)
    group_id = Column(
        Integer, ForeignKey("permission_groups.id", ondelete="CASCADE"), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("visualization", "username", name="_visualization_user_perm"),
        UniqueConstraint("visualization", "group_id", name="_visualization_group_perm"),
    )

    group = relationship("PermissionGroup")


class GroupPermissionLevel(enum.Enum):
    """Enumeration of permission group membership levels.

    Defines the levels of access within a permission group:
    - admin: Can manage group membership and permissions
    - member: Basic membership in the group
    """

    admin = "admin"
    member = "member"


class PermissionGroup(Base):
    """
    SQLAlchemy model for permission groups.

    Represents groups of users that can be granted permissions collectively.
    Each group has an owner and can contain multiple members with different
    permission levels within the group.

    Attributes:
        id (int): Primary key identifier
        name (str): Unique name of the permission group
        description (str): Optional description of the group's purpose
        owner (str): Username of the group owner
        members (relationship): Related group members with their permissions
    """

    __tablename__ = "permission_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String)
    owner = Column(String, nullable=False)

    members = relationship(
        "PermissionGroupUser",
        back_populates="group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class PermissionGroupUser(Base):
    """
    SQLAlchemy model for permission group membership.

    Represents the many-to-many relationship between users and permission groups,
    including each user's permission level within the group (admin or member).

    Attributes:
        id (int): Primary key identifier
        username (str): Username of the group member
        group_id (int): Foreign key to the permission group
        permission (GroupPermissionLevel): User's permission level in the group
        group (relationship): Reference to the permission group
    """

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
    """
    Create a new dashboard in the database.

    Creates a new dashboard with the provided metadata and grid items.
    Automatically grants admin permission to the owner and sanitizes
    any text content in grid items.

    Args:
        owner: User object representing the dashboard owner
        uuid (str): Unique identifier for the dashboard
        name (str): Display name of the dashboard
        description (str): Optional description
        notes (str): Optional notes
        public (bool): Whether the dashboard should be publicly accessible
        unrestricted_placement (bool): Whether grid items can be placed anywhere
        grid_items (list): List of grid item dictionaries to add

    Returns:
        int: ID of the newly created dashboard

    Raises:
        Exception: If dashboard creation fails
    """
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
            owner=owner.username,
            unrestricted_placement=unrestricted_placement,
        )

        session.add(new_dashboard)
        session.commit()
        session.refresh(new_dashboard)
        new_dashboard_id = new_dashboard.id

        # Add default admin permission for owner
        owner_permission = DashboardPermission(
            dashboard_id=new_dashboard_id,
            username=owner.username,
            permission=DashboardPermissionLevel.admin,
        )
        session.add(owner_permission)
        session.commit()

        # Create default "Main" tab
        default_tab = add_new_dashboard_tab(session, new_dashboard_id, "Main", 0)

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
                    tab_id=default_tab.id,
                )
        else:
            add_new_grid_item(
                session,
                new_dashboard_id,
                "1",
                0,
                0,
                20,
                20,
                "",
                "{}",
                "{}",
                0,
                tab_id=default_tab.id,
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
    tab_id=None,
):
    """
    Add a new grid item to a dashboard.

    Creates and persists a new grid item with the specified position,
    size, and configuration within the given dashboard.

    Args:
        session: SQLAlchemy database session
        dashboard_id (int): ID of the parent dashboard
        grid_item_i (str): Unique identifier within the dashboard
        grid_item_x (int): Horizontal position in grid units
        grid_item_y (int): Vertical position in grid units
        grid_item_w (int): Width in grid units
        grid_item_h (int): Height in grid units
        grid_item_source (str): Type of visualization/component
        grid_item_args_string (str): JSON string with visualization arguments
        grid_item_metadata_string (str): JSON string with component metadata
        grid_item_order (int): Display order within dashboard
        tab_id (int, optional): ID of the parent tab

    Returns:
        GridItem: The newly created grid item object
    """
    new_grid_item = GridItem(
        dashboard_id=dashboard_id,
        tab_id=tab_id,
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
    """
    Delete a grid item from a dashboard.

    Removes the specified grid item from the database.

    Args:
        session: SQLAlchemy database session
        dashboard_id (int): ID of the parent dashboard
        i (str): Unique identifier of the grid item to delete
    """
    db_grid_item = (
        session.query(GridItem)
        .filter(GridItem.dashboard_id == dashboard_id)
        .filter(GridItem.i == i)
        .first()
    )
    session.delete(db_grid_item)
    session.commit()

    return


def add_new_dashboard_tab(session, dashboard_id, name, tab_order=0):
    """
    Add a new tab to a dashboard.

    Creates and persists a new dashboard tab with the specified name and order.

    Args:
        session: SQLAlchemy database session
        dashboard_id (int): ID of the parent dashboard
        name (str): Display name of the tab
        tab_order (int): Order position of the tab (default: 0)

    Returns:
        DashboardTab: The newly created dashboard tab object
    """
    new_tab = DashboardTab(
        dashboard_id=dashboard_id,
        name=name,
        tab_order=tab_order,
    )
    session.add(new_tab)
    session.commit()
    session.refresh(new_tab)

    return new_tab


def copy_named_dashboard(user, id, new_name, dashboard_uuid):
    """
    Create a copy of an existing dashboard.

    Duplicates a dashboard with all its grid items, creating a new dashboard
    owned by the specified user. Only grants admin permission to the new owner.

    Args:
        user: User object who will own the copied dashboard
        id (int): ID of the dashboard to copy
        new_name (str): Name for the new dashboard
        dashboard_uuid (str): UUID for the new dashboard

    Returns:
        list: [new_dashboard_id, original_dashboard_uuid]

    Raises:
        Exception: If the original dashboard doesn't exist or copy fails
    """
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
            owner=user.username,
            unrestricted_placement=original_dashboard.unrestricted_placement,
        )

        # Add and flush to generate new ID
        session.add(new_dashboard)
        session.flush()  # Ensure new_dashboard gets an ID before copying grid_items
        new_dashboard_id = new_dashboard.id

        # Copy Tabs and their GridItems
        tab_id_mapping = {}  # Map original tab IDs to new tab IDs

        for tab in original_dashboard.tabs:
            new_tab = DashboardTab(
                dashboard_id=new_dashboard.id,
                name=tab.name,
                tab_order=tab.tab_order,
            )
            session.add(new_tab)
            session.flush()  # Get new tab ID
            tab_id_mapping[tab.id] = new_tab.id

        # Copy GridItems and link them to appropriate tabs
        new_grid_items = []
        for index, grid_item in enumerate(original_dashboard.grid_items):
            # Determine which tab this grid item should belong to
            new_tab_id = tab_id_mapping.get(grid_item.tab_id, tab_id_mapping.get(None))

            new_item = GridItem(
                i=grid_item.i,
                x=grid_item.x,
                y=grid_item.y,
                w=grid_item.w,
                h=grid_item.h,
                source=grid_item.source,
                args_string=grid_item.args_string,
                metadata_string=grid_item.metadata_string,
                dashboard_id=new_dashboard.id,
                tab_id=new_tab_id,
                order=index,
            )
            session.add(new_item)
            new_grid_items.append(new_item)

        new_dashboard.grid_items = new_grid_items

        # Only add admin permission for the user
        admin_permission = DashboardPermission(
            dashboard_id=new_dashboard.id,
            username=user.username,
            permission=DashboardPermissionLevel.admin,
        )
        session.add(admin_permission)
        new_dashboard.permissions = [admin_permission]

        session.commit()  # Save everything
    finally:
        session.close()

    return [new_dashboard_id, copied_dashboard_uuid]


def delete_named_dashboard(user, id):
    """
    Delete a dashboard if the user has admin permission.

    Removes the specified dashboard and all associated data from the database.
    Only users with admin permission can delete dashboards.

    Args:
        user: User object attempting to delete the dashboard
        id (int): ID of the dashboard to delete

    Returns:
        str: UUID of the deleted dashboard

    Raises:
        Exception: If dashboard doesn't exist or user lacks admin permission
    """
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
    """
    Update an existing dashboard with new data.

    Updates dashboard properties based on user permissions. Editor permission
    allows most updates, but admin permission is required for name changes,
    public status changes, and permission modifications.

    Args:
        user: User object attempting to update the dashboard
        id (int): ID of the dashboard to update
        dashboard_updates (dict): Dictionary containing fields to update

    Returns:
        dict: Updated dashboard data in dictionary format

    Raises:
        Exception: If dashboard doesn't exist, user lacks permission,
                  or update fails
    """
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

        if "tabs" in dashboard_updates:
            updated_tabs = dashboard_updates["tabs"]
            # Build a mapping of existing tabs by id
            existing_tabs_by_id = {tab.id: tab for tab in db_dashboard.tabs}
            updated_tab_ids = [tab.get("id") for tab in updated_tabs if tab.get("id")]
            existing_tab_ids = set(existing_tabs_by_id.keys())

            # Delete tabs not present in update
            for tab_id in existing_tab_ids - set(updated_tab_ids):
                db_tab = session.get(DashboardTab, tab_id)
                if db_tab:
                    session.delete(db_tab)

            # Process tabs in order
            for tab_order, updated_tab in enumerate(updated_tabs):
                tab_id = updated_tab.get("id")
                tab_name = updated_tab.get("name")
                tab_grid_items = updated_tab.get("gridItems", [])

                if tab_id and tab_id in existing_tabs_by_id:
                    db_tab = existing_tabs_by_id[tab_id]
                    db_tab.name = tab_name
                    db_tab.tab_order = tab_order
                else:
                    db_tab = DashboardTab(
                        dashboard_id=db_dashboard.id,
                        name=tab_name,
                        tab_order=tab_order,
                    )
                    session.add(db_tab)
                    session.flush()  # Get new tab id
                    tab_id = db_tab.id

                # Build mapping of existing grid items by id for this tab
                existing_grid_items_by_id = {
                    item.id: item for item in db_tab.grid_items
                }
                updated_grid_item_ids = [
                    item.get("id") for item in tab_grid_items if item.get("id")
                ]
                existing_grid_item_ids = set(existing_grid_items_by_id.keys())

                # Delete grid items not present in update
                for grid_item_id in existing_grid_item_ids - set(updated_grid_item_ids):
                    db_grid_item = session.get(GridItem, grid_item_id)
                    if db_grid_item:
                        session.delete(db_grid_item)

                # Process grid items in order
                for grid_item_order, grid_item in enumerate(tab_grid_items):
                    grid_item_id = grid_item.get("id")
                    grid_item_source = grid_item["source"]
                    grid_item_args_string = grid_item["args_string"]

                    # Sanitize text content
                    if grid_item_source == "Text":
                        clean_text = sanitize_html(
                            json.loads(grid_item_args_string)["text"]
                        )
                        grid_item_args_string = json.dumps({"text": clean_text})

                    if grid_item_id and grid_item_id in existing_grid_items_by_id:
                        db_grid_item = existing_grid_items_by_id[grid_item_id]
                        db_grid_item.x = grid_item["x"]
                        db_grid_item.y = grid_item["y"]
                        db_grid_item.w = grid_item["w"]
                        db_grid_item.h = grid_item["h"]
                        db_grid_item.source = grid_item_source
                        db_grid_item.args_string = grid_item_args_string
                        db_grid_item.metadata_string = grid_item["metadata_string"]
                        db_grid_item.order = grid_item_order
                        db_grid_item.tab_id = tab_id
                    else:
                        new_grid_item = GridItem(
                            dashboard_id=db_dashboard.id,
                            tab_id=tab_id,
                            i=grid_item["i"],
                            x=int(grid_item["x"]),
                            y=int(grid_item["y"]),
                            w=int(grid_item["w"]),
                            h=int(grid_item["h"]),
                            source=grid_item_source,
                            args_string=grid_item_args_string,
                            metadata_string=grid_item["metadata_string"],
                            order=grid_item_order,
                        )
                        session.add(new_grid_item)

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
    Get the highest permission level a user has for a dashboard.

    Checks both direct user permissions and permissions inherited through
    group membership. Returns the highest level found, with admin > editor > viewer.

    Args:
        session: SQLAlchemy database session
        dashboard: Dashboard object to check permissions for
        user: User object to check permissions for

    Returns:
        DashboardPermissionLevel or None: Highest permission level found,
                                         or None if no permission exists
    """

    # Get all group ids the user belongs to
    user_groups = (
        session.query(PermissionGroup.id)
        .join(PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id)
        .filter(PermissionGroupUser.username == user.username)
        .all()
    )
    user_group_ids = [g[0] for g in user_groups]

    # Collect all permissions for user and their groups
    perms = []
    for p in dashboard.permissions:
        if p.username == user.username:
            perms.append(p.permission)
        elif p.group_id and p.group_id in user_group_ids:
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


def get_visualization_user_permission(session, visualization, user):
    """
    Check if a user has permission to use a specific visualization.

    Checks both direct user permissions and permissions inherited through
    group membership for the specified visualization type.

    Args:
        session: SQLAlchemy database session
        visualization (str): Name/identifier of the visualization type
        user: User object to check permissions for

    Returns:
        bool: True if user has permission, False otherwise
    """

    permission = False

    # Get all group ids the user belongs to
    user_groups = (
        session.query(PermissionGroup.id)
        .join(PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id)
        .filter(PermissionGroupUser.username == user.username)
        .all()
    )
    user_group_ids = [g[0] for g in user_groups]

    visualization_permissions = (
        session.query(VisualizationPermission)
        .filter(VisualizationPermission.visualization == visualization)
        .all()
    )

    # Collect all permissions for user and their groups
    for p in visualization_permissions:
        if p.username == user.username:
            permission = True
        elif p.group_id and p.group_id in user_group_ids:
            permission = True

    return permission


def get_visualization_permissions():
    """
    Retrieve all visualization permissions in the system.

    Gets a comprehensive mapping of all visualization types and their
    associated user and group permissions.

    Returns:
        dict: Dictionary mapping visualization names to permission data:
              {
                  'visualization_name': {
                      'users': [list of usernames],
                      'groups': [list of group names]
                  }
              }
    """

    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    visualization_permissions = {}

    try:
        visualizations = session.query(VisualizationPermission).all()
        for vp in visualizations:
            vis = vp.visualization
            if vis not in visualization_permissions:
                visualization_permissions[vis] = {"users": set(), "groups": set()}
            if vp.username:
                visualization_permissions[vis]["users"].add(vp.username)
            if vp.group_id and vp.group:
                visualization_permissions[vis]["groups"].add(vp.group.name)

        # Convert sets to lists for serialization
        for vis in visualization_permissions:
            visualization_permissions[vis]["users"] = list(
                visualization_permissions[vis]["users"]
            )
            visualization_permissions[vis]["groups"] = list(
                visualization_permissions[vis]["groups"]
            )
    finally:
        session.close()

    return visualization_permissions


def update_visualization_permissions(updated_permissions):
    """
    Update visualization permissions in the system.

    Only users with 'manage_visualizations' permission can update visualization
    permissions.

    Args:
        user: The user attempting to update permissions
        updated_permissions: Dictionary mapping visualization names to permission data:
                           {
                               'visualization_name': {
                                   'users': [list of usernames],
                                   'groups': [list of group names]
                               }
                           }

    Returns:
        dict: Result with success status and message
    """
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    User = get_user_model()
    nonexistent_users = []
    nonexistent_groups = []

    try:
        # First, get all existing visualization permissions
        existing_perms = session.query(VisualizationPermission).all()

        # Create lookup for existing permissions
        existing_by_viz = {}
        for perm in existing_perms:
            if perm.visualization not in existing_by_viz:
                existing_by_viz[perm.visualization] = {"users": [], "groups": []}
            if perm.username:
                existing_by_viz[perm.visualization]["users"].append(perm)
            elif perm.group_id:
                existing_by_viz[perm.visualization]["groups"].append(perm)

        # Process each visualization in the updated permissions
        for viz_name, new_perms in updated_permissions.items():
            existing_viz_perms = existing_by_viz.get(
                viz_name, {"users": [], "groups": []}
            )

            # Handle user permissions
            new_usernames = set(new_perms.get("users", []))
            existing_usernames = {perm.username for perm in existing_viz_perms["users"]}

            # Remove users that are no longer in the new list
            for perm in existing_viz_perms["users"]:
                if perm.username not in new_usernames:
                    session.delete(perm)

            # Add new users
            for username in new_usernames - existing_usernames:
                try:
                    User.objects.get(username=username)
                except User.DoesNotExist:
                    nonexistent_users.append(username)
                    continue

                new_perm = VisualizationPermission(
                    visualization=viz_name, username=username
                )
                session.add(new_perm)

            # Handle group permissions
            new_group_names = set(new_perms.get("groups", []))
            existing_groups = {
                perm.group.name: perm
                for perm in existing_viz_perms["groups"]
                if perm.group
            }
            existing_group_names = set(existing_groups.keys())

            # Remove groups that are no longer in the new list
            for group_name in existing_group_names - new_group_names:
                if group_name in existing_groups:
                    session.delete(existing_groups[group_name])

            # Add new groups
            for group_name in new_group_names - existing_group_names:
                # Find the group by name
                group = (
                    session.query(PermissionGroup).filter_by(name=group_name).first()
                )
                if group:
                    new_perm = VisualizationPermission(
                        visualization=viz_name, group_id=group.id
                    )
                    session.add(new_perm)
                else:
                    nonexistent_groups.append(group_name)
                    continue

        if nonexistent_users and nonexistent_groups:
            raise Exception(
                f"The following users do not exist: {', '.join(nonexistent_users)}; The following groups do not exist: {', '.join(nonexistent_groups)}"  # noqa: E501
            )
        elif nonexistent_users:
            raise Exception(
                f"The following users do not exist: {', '.join(nonexistent_users)}"
            )
        elif nonexistent_groups:
            raise Exception(
                f"The following groups do not exist: {', '.join(nonexistent_groups)}"
            )

        session.commit()

    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()


def update_dashboard_permissions(session, db_dashboard, user, updated_permissions):
    """
    Update permissions for a dashboard.

    Modifies user and group permissions for the specified dashboard.
    Only users with admin permission can update dashboard permissions.
    Validates that all referenced users and groups exist.

    Args:
        session: SQLAlchemy database session
        db_dashboard: Dashboard object to update permissions for
        user: User object attempting to update permissions
        updated_permissions (list): List of permission dictionaries containing
                                   username/group and permission level

    Raises:
        Exception: If user lacks admin permission, or if referenced users
                  or groups don't exist
    """

    # Check if user has admin permission
    user_permission = get_dashboard_user_permission(session, db_dashboard, user)
    if user_permission != DashboardPermissionLevel.admin:
        raise Exception(
            "User does not have admin permission to change the permissions of the dashboard."  # noqa: E501
        )

    # Existing permissions
    existing_user_perms = {
        p.username: p for p in db_dashboard.permissions if p.username
    }
    existing_group_perms = {
        p.group.name: p for p in db_dashboard.permissions if p.group_id
    }

    # Build lookup for updated permissions
    updated_user_lookup = {}
    updated_group_lookup = {}
    nonexistent_users = []
    nonexistent_groups = []

    User = get_user_model()

    for p in updated_permissions:
        if "username" in p:
            try:
                User.objects.get(username=p["username"])
            except User.DoesNotExist:
                nonexistent_users.append(p["username"])
                continue

            updated_user_lookup[p["username"]] = p["permission"]
        if "group" in p:
            if (
                session.query(PermissionGroup).filter_by(name=p["group"]).first()
                is None
            ):  # noqa: E501
                nonexistent_groups.append(p["group"])
                continue

            updated_group_lookup[p["group"]] = p["permission"]

    if nonexistent_users and nonexistent_groups:
        raise Exception(
            f"The following users do not exist: {', '.join(nonexistent_users)}; The following groups do not exist: {', '.join(nonexistent_groups)}"  # noqa: E501
        )
    elif nonexistent_users:
        raise Exception(
            f"The following users do not exist: {', '.join(nonexistent_users)}"
        )
    elif nonexistent_groups:
        raise Exception(
            f"The following groups do not exist: {', '.join(nonexistent_groups)}"
        )

    # Add or update user permissions
    for username, perm_level in updated_user_lookup.items():
        if username == user.username or username == db_dashboard.owner:
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
    for group_name, perm_level in updated_group_lookup.items():

        if group_name in existing_group_perms:
            perm_obj = existing_group_perms[group_name]
            if perm_obj.permission.value != perm_level:
                perm_obj.permission = DashboardPermissionLevel(perm_level)
        else:
            group = session.query(PermissionGroup).filter_by(name=group_name).first()
            new_perm = DashboardPermission(
                dashboard_id=db_dashboard.id,
                group_id=group.id,
                permission=DashboardPermissionLevel(perm_level),
            )
            session.add(new_perm)

    # Delete user permissions not in updated list
    to_delete_users = [
        p
        for username, p in existing_user_perms.items()
        if username not in updated_user_lookup
        and username != user.username
        and username != db_dashboard.owner
    ]
    for perm_obj in to_delete_users:
        session.delete(perm_obj)

    # Delete group permissions not in updated list
    to_delete_groups = [
        p for gid, p in existing_group_perms.items() if gid not in updated_group_lookup
    ]
    for perm_obj in to_delete_groups:
        session.delete(perm_obj)

    session.commit()


def get_user_permission_groups(user):
    """
    Get all permission groups a user belongs to.

    Retrieves detailed information about all permission groups the user
    is a member of, including group metadata, all members, and the user's
    permission level within each group.

    Args:
        user: User object to get groups for

    Returns:
        list: List of dictionaries containing group information:
              [
                  {
                      'id': group_id,
                      'name': group_name,
                      'description': group_description,
                      'owner': owner_username,
                      'members': [{'username': str, 'permission': str}],
                      'user_permission': user's_permission_in_group
                  }
              ]
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
            .filter(PermissionGroupUser.username == user.username)
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

    Creates a new permission group if no ID is provided, or updates an existing
    group if the user has appropriate permissions (owner or admin). Validates
    that all member usernames exist in the system.

    Args:
        user: User object creating or updating the group
        group_data (dict): Group data containing:
            - id: Group ID (None for new groups)
            - name: Group name
            - description: Group description
            - members: List of member dictionaries with username and permission

    Returns:
        dict: Updated group information or error status:
              - If successful: parsed group data
              - If error: {'status': 'error', 'message': error_description}

    Raises:
        Exception: If group update fails for unexpected reasons
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
            group = PermissionGroup(
                name=name, description=description, owner=user.username
            )
            session.add(group)
            session.flush()  # get group.id

            nonexistent_users = add_permission_group_members(session, group, members)
            if nonexistent_users:
                return {
                    "status": "error",
                    "message": f"Users don't exist: {', '.join(nonexistent_users)}",
                }
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
            if group.owner != user.username:
                admin_member = (
                    session.query(PermissionGroupUser)
                    .filter(
                        PermissionGroupUser.group_id == group.id,
                        PermissionGroupUser.username == user.username,
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
            nonexistent_users = add_permission_group_members(session, group, members)
            if nonexistent_users:
                return {
                    "status": "error",
                    "message": f"Users don't exist: {', '.join(nonexistent_users)}",
                }

        permission_group_dict = parse_group_permissions(user, group)

    finally:
        session.close()

    return permission_group_dict


def add_permission_group_members(session, group, members):
    """
    Add members to a permission group.

    Validates that all usernames exist in the system and adds them to the
    specified permission group with their assigned permission levels.

    Args:
        session: SQLAlchemy database session
        group: PermissionGroup object to add members to
        members (list): List of member dictionaries containing:
                       - username: Username to add
                       - permission: Permission level ('admin' or 'member')

    Returns:
        list: List of usernames that don't exist in the system
    """
    nonexistent_users = []
    User = get_user_model()

    # Add members
    for member in members:
        try:
            db_user = User.objects.get(username=member["username"])
        except User.DoesNotExist:
            nonexistent_users.append(member["username"])
            continue

        session.add(
            PermissionGroupUser(
                username=db_user.username,
                group_id=group.id,
                permission=GroupPermissionLevel[member["permission"]],
            )
        )
    session.commit()

    return nonexistent_users


def delete_permission_groups(user, permission_group_id):
    """
    Delete a permission group.

    Removes the specified permission group if the user has appropriate
    permissions (owner or admin in the group). Also removes all group
    memberships and related permissions.

    Args:
        user: User object attempting to delete the group
        permission_group_id (int): ID of the group to delete

    Returns:
        dict: Status dictionary:
              - If successful: {'status': 'deleted'}
              - If error: {'status': 'error', 'message': error_description}
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
        if group.owner != user.username:
            # Check if user is admin in group
            admin_member = (
                session.query(PermissionGroupUser)
                .filter(
                    PermissionGroupUser.group_id == group.id,
                    PermissionGroupUser.username == user.username,
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
    """
    Convert a PermissionGroup object to a dictionary format.

    Transforms the group data into a dictionary suitable for API responses,
    including the user's permission level within the group.

    Args:
        user: User object to determine permission level for
        group: PermissionGroup object to parse

    Returns:
        dict: Dictionary containing:
              - id: Group ID
              - name: Group name
              - description: Group description
              - owner: Owner username
              - members: List of member dictionaries
              - user_permission: User's permission level in the group
    """
    members = [
        {"username": member.username, "permission": member.permission.value}
        for member in group.members
    ]
    user_permission = next(
        (m["permission"] for m in members if m["username"] == user.username), None
    )

    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "owner": group.owner,
        "members": members,
        "user_permission": user_permission,
    }


def parse_db_dashboard(session, dashboards, user, dashboard_view):
    """
    Convert Dashboard objects to dictionary format for API responses.

    Transforms dashboard database objects into dictionaries suitable for
    frontend consumption, including permission information and grid items
    if in dashboard view mode.

    Args:
        session: SQLAlchemy database session
        dashboards (list): List of Dashboard objects to parse
        user: User object to determine permissions for
        dashboard_view (bool): Whether to include detailed grid item data

    Returns:
        list: List of dashboard dictionaries containing metadata,
              permissions, and optionally grid items
    """
    dashboard_list = []
    MEDIA_URL = settings.MEDIA_URL
    PREFIX_URL = settings.PREFIX_URL
    if PREFIX_URL is not None and PREFIX_URL != "/":
        MEDIA_URL = f"/{PREFIX_URL}/{MEDIA_URL.strip('/')}/"

    for dashboard in dashboards:
        dashboard_image = os.path.join(
            MEDIA_URL, App.root_url, f"app/{dashboard.uuid}.png"
        )
        app_media = get_app_media(App)
        if not os.path.exists(os.path.join(app_media.path, f"{dashboard.uuid}.png")):
            dashboard_image = os.path.join(
                settings.STATIC_URL, App.root_url, "images", "default_dashboard.png"
            )
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
            elif perm.group_id:
                permissions_list.append(
                    {
                        "group": perm.group.name,
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

            tabs = []
            for tab in dashboard.tabs:
                griditems = []
                for griditem in tab.grid_items:
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

                tab_data = {
                    "id": tab.id,
                    "name": tab.name,
                    "gridItems": griditems,
                }
                tabs.append(tab_data)

            dashboard_dict["tabs"] = tabs

        dashboard_list.append(dashboard_dict)

    return dashboard_list


def get_dashboards(user, dashboard_view=False, id=None):
    """
    Retrieve dashboards accessible to a user.

    Gets dashboards that the user can access through direct permissions,
    group membership, or public availability. Can retrieve a specific
    dashboard by ID or all accessible dashboards.

    Args:
        user: User object to get dashboards for
        dashboard_view (bool): Whether to include detailed grid item data
        id (int, optional): Specific dashboard ID to retrieve

    Returns:
        dict or list: Single dashboard dict if ID provided,
                     otherwise list of dashboard dicts
    """
    # Get connection/session to database
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()

    try:
        if id:
            dashboard = session.query(Dashboard).filter(Dashboard.id == id).first()
            return parse_db_dashboard(session, [dashboard], user, dashboard_view)[0]

        # Get all group ids the user belongs to
        user_groups = (
            session.query(PermissionGroup.id)
            .join(
                PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id
            )
            .filter(PermissionGroupUser.username == user.username)
            .all()
        )
        user_group_ids = [g[0] for g in user_groups]

        # Dashboards user has direct or group permissions for
        user_dashboards = (
            session.query(Dashboard)
            .join(DashboardPermission)
            .filter(
                (DashboardPermission.username == user.username)
                | (DashboardPermission.group_id.in_(user_group_ids))
            )
        ).all()

        # Public dashboards (not already included)
        public_dashboards = (
            session.query(Dashboard)
            .filter(Dashboard.public == True)  # noqa: E712
            .filter(
                ~Dashboard.permissions.any(
                    DashboardPermission.username == user.username
                )
            )
            .filter(
                ~Dashboard.permissions.any(
                    DashboardPermission.group_id.in_(user_group_ids)
                )
            )
        ).all()

        dashboards = user_dashboards + public_dashboards
        return parse_db_dashboard(session, dashboards, user, dashboard_view)
    finally:
        session.close()


def upload_json_to_workspace(
    user, dashboard_folder, filename, clean_data, dashboard_uuid
):
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    saved = False

    try:
        db_dashboard = (
            session.query(Dashboard).filter(Dashboard.uuid == dashboard_uuid).first()
        )
        if not db_dashboard:
            raise Exception("This dashboard does not exist for this user")
        user_permission = get_dashboard_user_permission(session, db_dashboard, user)

        # Check if user has editor or admin permission
        if (
            user_permission != DashboardPermissionLevel.editor
            and user_permission != DashboardPermissionLevel.admin
        ):
            raise Exception(
                "User does not have admin or editor permissions to update the dashboard."  # noqa: E501
            )

        dashboard_file = os.path.join(dashboard_folder, filename)
        with open(dashboard_file, "w") as outfile:
            outfile.write(clean_data)

        saved = True
    finally:
        session.close()

    return saved


def clean_up_jsons(user):
    """
    Remove unused JSON files from the workspace.

    Identifies and removes JSON files that are no longer referenced by any
    of the user's dashboards, particularly GeoJSON and style files used
    in map visualizations.

    Args:
        user: User object to clean up files for
    """

    print("Checking to see if there are any unused json files to remove")
    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        # Get all dashboards the user can edit (editor or admin permission)
        user_dashboards = (
            session.query(Dashboard)
            .join(DashboardPermission)
            .filter(
                (DashboardPermission.username == user.username)
                & (
                    DashboardPermission.permission.in_(
                        [
                            DashboardPermissionLevel.admin,
                            DashboardPermissionLevel.editor,
                        ]
                    )
                )
            )
            .all()
        )
        # Also include dashboards where user is in a group with editor/admin permission
        user_groups = (
            session.query(PermissionGroup.id)
            .join(
                PermissionGroupUser, PermissionGroup.id == PermissionGroupUser.group_id
            )
            .filter(PermissionGroupUser.username == user.username)
            .all()
        )
        user_group_ids = [g[0] for g in user_groups]
        group_dashboards = (
            session.query(Dashboard)
            .join(DashboardPermission)
            .filter(
                (DashboardPermission.group_id.in_(user_group_ids))
                & (
                    DashboardPermission.permission.in_(
                        [
                            DashboardPermissionLevel.admin,
                            DashboardPermissionLevel.editor,
                        ]
                    )
                )
            )
            .all()
        )
        # Combine and deduplicate dashboards
        all_dashboards = {d.id: d for d in user_dashboards + group_dashboards}.values()

        app_workspace = get_app_workspace(App)
        for dashboard in all_dashboards:
            dashboard_uuid = dashboard.uuid
            dashboard_folder = os.path.join(app_workspace.path, dashboard_uuid)
            if not os.path.exists(dashboard_folder):
                continue
            # Collect all in-use jsons for this dashboard
            in_use_jsons = []
            maps_grid_items_layers = flatten(
                [
                    json.loads(grid_item.args_string)["layers"]
                    for grid_item in dashboard.grid_items
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
                in_use_jsons.extend(json_files)

                stylejson_files = [
                    maps_grid_items_layer["configuration"]["style"]
                    for maps_grid_items_layer in maps_grid_items_layers
                    if "style" in maps_grid_items_layer["configuration"]
                ]
                in_use_jsons.extend(stylejson_files)

            # Remove unused files in dashboard folder
            existing_files = os.listdir(dashboard_folder)
            unused_files = [f for f in existing_files if f not in in_use_jsons]
            for unused_file in unused_files:
                print(f"Removing the {unused_file} file from {dashboard_folder}")
                os.remove(os.path.join(dashboard_folder, unused_file))
    finally:
        session.close()

    return


def flatten(xss):
    """
    Flatten a list of lists into a single list.

    Args:
        xss (list): List of lists to flatten

    Returns:
        list: Flattened list containing all elements
    """
    return [x for xs in xss for x in xs]


def get_user_app_permissions(user):
    """
    Get application-specific permissions for a user.

    Extracts permissions specific to the TethysDash application from
    the user's complete permission set.

    Args:
        user: User object to get permissions for

    Returns:
        list: List of permission strings specific to this application
    """
    user_permissions = [
        perm.split(":")[-1]
        for perm in user.get_all_permissions()
        if perm.startswith(f"tethys_apps.{App.package}")
    ]

    return user_permissions


def init_primary_db(engine, first_time):
    """
    Initialize and upgrade the primary database schema.

    Sets up the database schema using Alembic migrations, handling both
    initial setup and upgrades from existing versions. Manages migration
    conflicts for existing installations.

    Args:
        engine: SQLAlchemy database engine
        first_time (bool): Whether this is the first time setup

    Raises:
        ProgrammingError: If migration fails due to schema conflicts
        OperationalError: If database operation fails
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
