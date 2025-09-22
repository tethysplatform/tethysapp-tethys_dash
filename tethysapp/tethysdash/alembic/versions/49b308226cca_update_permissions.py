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

    # DASHBOARD PERMISSIONS TABLE
    op.add_column(
        "dashboard_permissions",
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("permission_groups.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )

    op.execute(
        """
        UPDATE dashboard_permissions dp
        SET group_id = pg.id
        FROM permission_groups pg
        WHERE dp."group" = pg.name
        """
    )

    op.drop_column("dashboard_permissions", "group")

    # VISUALIZATION PERMISSIONS TABLE
    op.create_table(
        "visualization_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("visualization", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=True),
        sa.Column(
            "group_id",
            sa.Integer(),
            sa.ForeignKey("permission_groups.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )


def downgrade() -> None:

    # VISUALIZATION PERMISSIONS TABLE
    op.drop_table("visualization_permissions")

    # DASHBOARD PERMISSIONS TABLE
    op.add_column(
        "dashboard_permissions",
        sa.Column("group", sa.String(), nullable=True),
    )

    op.execute(
        """
        UPDATE dashboard_permissions dp
        SET "group" = pg.name
        FROM permission_groups pg
        WHERE dp.group_id = pg.id
        """
    )

    op.drop_column("dashboard_permissions", "group_id")
