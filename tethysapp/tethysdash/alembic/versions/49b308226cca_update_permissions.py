"""update permissions

Revision ID: 49b308226cca
Revises: 064c8e70a8a6
Create Date: 2025-09-19 10:33:14.926148

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "49b308226cca"
down_revision: Union[str, None] = "064c8e70a8a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # DASHBOARDS TABLE
    op.add_column(
        "dashboards",
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("auth_user.id"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE dashboards db
        SET owner_id = au.id
        FROM auth_user au
        WHERE db.owner = au.username
        """
    )

    op.drop_column("dashboards", "owner")

    # PERMISSION GROUPS TABLE
    op.add_column(
        "permission_groups",
        sa.Column(
            "owner_id",
            sa.Integer(),
            sa.ForeignKey("auth_user.id"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE permission_groups pg
        SET owner_id = au.id
        FROM auth_user au
        WHERE pg.owner = au.username
        """
    )

    op.drop_column("permission_groups", "owner")

    # PERMISSION GROUPS USER TABLE
    op.add_column(
        "permission_group_user",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("auth_user.id"), nullable=True
        ),
    )

    op.execute(
        """
        UPDATE permission_group_user pgu
        SET user_id = au.id
        FROM auth_user au
        WHERE pgu.username = au.username
        """
    )

    op.drop_column("permission_group_user", "username")

    # DASHBOARD PERMISSIONS TABLE
    op.add_column(
        "dashboard_permissions",
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("auth_user.id"), nullable=True
        ),
    )
    op.add_column(
        "dashboard_permissions",
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("permission_groups.id"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE dashboard_permissions dp
        SET user_id = au.id
        FROM auth_user au
        WHERE dp.username = au.username
        """
    )
    op.execute(
        """
        UPDATE dashboard_permissions dp
        SET group_id = pg.id
        FROM permission_groups pg
        WHERE dp."group" = pg.name
        """
    )

    op.drop_column("dashboard_permissions", "username")
    op.drop_column("dashboard_permissions", "group")

    # VISUALIZATION PERMISSIONS TABLE
    op.create_table(
        "visualization_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visualization", sa.String(), nullable=False),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("auth_user.id"), nullable=True
        ),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("permission_groups.id"),
            nullable=True,
        ),
    )


def downgrade() -> None:

    # VISUALIZATION PERMISSIONS TABLE
    op.drop_table("visualization_permissions")

    # DASHBOARD PERMISSIONS TABLE
    op.add_column(
        "dashboard_permissions",
        sa.Column("username", sa.String(), nullable=True),
    )
    op.add_column(
        "dashboard_permissions",
        sa.Column("group", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE dashboard_permissions dp
        SET username = au.username
        FROM auth_user au
        WHERE dp.user_id = au.id
        """
    )
    op.execute(
        """
        UPDATE dashboard_permissions dp
        SET "group" = pg.name
        FROM permission_groups pg
        WHERE dp.group_id = pg.id
        """
    )

    op.drop_column("dashboard_permissions", "user_id")
    op.drop_column("dashboard_permissions", "group_id")

    # PERMISSION GROUPS TABLE
    op.add_column(
        "permission_groups",
        sa.Column("owner", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE permission_groups pg
        SET owner = au.username
        FROM auth_user au
        WHERE pg.owner_id = au.id
        """
    )

    op.drop_column("permission_groups", "owner_id")

    # PERMISSION GROUPS USER TABLE
    op.add_column(
        "permission_group_user",
        sa.Column("username", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE permission_group_user pgu
        SET username = au.username
        FROM auth_user au
        WHERE pgu.user_id = au.id
        """
    )

    op.drop_column("permission_group_user", "user_id")

    # DASHBOARDS TABLE
    op.add_column(
        "dashboards",
        sa.Column("owner", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE dashboards db
        SET owner = au.username
        FROM auth_user au
        WHERE db.owner_id = au.id
        """
    )

    op.drop_column("dashboards", "owner_id")
