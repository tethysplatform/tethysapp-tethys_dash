"""convert_tables_for_sqlite_usage

Revision ID: 9d81090ceb84
Revises: 78188f76ffa0
Create Date: 2026-03-13 14:48:09.561735

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9d81090ceb84"
down_revision: Union[str, None] = "78188f76ffa0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# TODO: test this on PostgreSQL with existing data to ensure it works as expected and doesn't cause data loss
def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # Change dashboard_permissions.permission to String
    with op.batch_alter_table("dashboard_permissions") as batch_op:
        batch_op.alter_column("permission", type_=sa.String())
        batch_op.create_check_constraint(
            "ck_dashboard_permission_level",
            "permission IN ('admin', 'editor', 'viewer')",
        )
    with op.batch_alter_table("permission_group_user") as batch_op:
        batch_op.alter_column("permission", type_=sa.String())
        batch_op.create_check_constraint(
            "ck_group_permission_level", "permission IN ('admin', 'member')"
        )

    # TODO: If we had a messages table with partitioning, we would need to remove the partitioning here and convert it to a regular table for SQLite compatibility
    # if dialect == "postgresql":
    #     # Remove partitioning from Message table
    #     op.execute(
    #         """
    #         CREATE TABLE IF NOT EXISTS messages (
    #             id INTEGER PRIMARY KEY AUTOINCREMENT,
    #             timestamp DATETIME NOT NULL,
    #             request_id VARCHAR NOT NULL,
    #             session_id VARCHAR NOT NULL,
    #             message_id VARCHAR NOT NULL,
    #             sender VARCHAR NOT NULL,
    #             message VARCHAR NOT NULL,
    #             edited BOOLEAN NOT NULL DEFAULT 0
    #         );
    #         """
    #     )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        # Revert Enum columns to original type if needed (not strictly possible in SQLite)
        # Drop messages table if needed
        op.execute("DROP TABLE IF EXISTS messages;")
