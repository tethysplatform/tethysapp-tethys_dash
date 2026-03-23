"""add dashboard tabs

Revision ID: 20f22416d985
Revises: 49b308226cca
Create Date: 2025-10-15 11:34:59.498429

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "20f22416d985"
down_revision: Union[str, None] = "49b308226cca"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create dashboard_tabs table
    op.create_table(
        "dashboard_tabs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("dashboard_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("tab_order", sa.Integer(), default=0),
        sa.ForeignKeyConstraint(
            ["dashboard_id"],
            ["dashboards.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("griditems") as batch_op:
            batch_op.add_column(sa.Column("tab_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_griditems_tab_id", "dashboard_tabs", ["tab_id"], ["id"]
            )
    else:
        op.add_column("griditems", sa.Column("tab_id", sa.Integer(), nullable=True))
        op.create_foreign_key(
            "fk_griditems_tab_id", "griditems", "dashboard_tabs", ["tab_id"], ["id"]
        )

    # default "Main" tab for all existing dashboards and associate existing grid items
    connection = op.get_bind()

    # Get all existing dashboards
    result = connection.execute(sa.text("SELECT id FROM dashboards"))
    dashboard_ids = [row[0] for row in result.fetchall()]

    # For each dashboard, create a default "Main" tab
    for dashboard_id in dashboard_ids:
        # Insert the default tab
        tab_result = connection.execute(
            sa.text(
                "INSERT INTO dashboard_tabs (dashboard_id, name, tab_order) VALUES (:dashboard_id, 'Main', 0) RETURNING id"  # noqa: E501
            ),
            {"dashboard_id": dashboard_id},
        )
        tab_id = tab_result.fetchone()[0]

        # Update all existing grid items for this dashboard to belong to the new tab
        connection.execute(
            sa.text(
                "UPDATE griditems SET tab_id = :tab_id WHERE dashboard_id = :dashboard_id"  # noqa: E501
            ),
            {"tab_id": tab_id, "dashboard_id": dashboard_id},
        )


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint("fk_griditems_tab_id", "griditems", type_="foreignkey")

    # Remove tab_id column from griditems
    op.drop_column("griditems", "tab_id")

    # Drop dashboard_tabs table
    op.drop_table("dashboard_tabs")
