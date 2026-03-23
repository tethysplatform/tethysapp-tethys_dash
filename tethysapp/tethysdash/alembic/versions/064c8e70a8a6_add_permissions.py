"""add permissions

Revision ID: 064c8e70a8a6
Revises: 0597a408202d
Create Date: 2025-08-18 09:37:33.893386

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "064c8e70a8a6"
down_revision: Union[str, None] = "0597a408202d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add a public boolean column to dashboards, default False
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.add_column(
            "dashboards",
            sa.Column(
                "public", sa.Boolean(), nullable=False, server_default=sa.text("FALSE")
            ),
        )
        op.execute(
            "UPDATE dashboards SET public = TRUE WHERE 'public' = ANY(access_groups)"
        )
        op.drop_column("dashboards", "access_groups")
    else:
        op.add_column(
            "dashboards",
            sa.Column("public", sa.Boolean(), nullable=False, server_default="0"),
        )
        op.execute(
            "UPDATE dashboards SET public = 1 WHERE access_groups LIKE '%public%'"
        )
        op.drop_column("dashboards", "access_groups")
    # Create the dashboard_permissions table
    op.create_table(
        "dashboard_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "dashboard_id", sa.Integer(), sa.ForeignKey("dashboards.id"), nullable=False
        ),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column("group", sa.String(), nullable=True),
        sa.Column("permission", sa.String(), nullable=False),
    )

    # Add admin permission for each dashboard owner
    op.execute(
        "INSERT INTO dashboard_permissions (dashboard_id, username, permission) "
        "SELECT id, owner, 'admin' FROM dashboards WHERE owner IS NOT NULL"
    )

    # Create the permission_groups table
    op.create_table(
        "permission_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), unique=True, nullable=False),
        sa.Column("description", sa.String()),
        sa.Column("owner", sa.String(), nullable=False),
    )

    # Create the permission_group_user table with ON DELETE CASCADE
    op.create_table(
        "permission_group_user",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("permission_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("permission", sa.String(), nullable=False),
    )


def downgrade() -> None:
    # Restore the access_groups column to dashboards
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        op.add_column(
            "dashboards",
            sa.Column("access_groups", postgresql.ARRAY(sa.String()), nullable=True),
        )
        op.execute(
            "UPDATE dashboards SET access_groups = ARRAY['public'] WHERE public = TRUE"
        )
        op.execute(
            "UPDATE dashboards SET access_groups = ARRAY[]::varchar[] WHERE public = FALSE"  # noqa: E501
        )
        op.drop_column("dashboards", "public")
        op.drop_table("dashboard_permissions")
        op.execute("DROP TABLE permission_group_user CASCADE")
        op.execute("DROP TABLE permission_groups CASCADE")
    else:
        op.add_column(
            "dashboards",
            sa.Column("access_groups", sa.String(), nullable=True),
        )
        op.execute("UPDATE dashboards SET access_groups = 'public' WHERE public = 1")
        op.execute("UPDATE dashboards SET access_groups = '' WHERE public = 0")
        op.drop_column("dashboards", "public")
        op.drop_table("dashboard_permissions")
        op.execute("DROP TABLE IF EXISTS permission_group_user")
        op.execute("DROP TABLE IF EXISTS permission_groups")
