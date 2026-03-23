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


def upgrade() -> None:
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

    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "postgresql":
        # Step 1: Copy data to temp table
        op.execute("CREATE TABLE messages_backup AS TABLE messages;")
        # Step 2: Drop partitioned table
        op.execute("DROP TABLE IF EXISTS messages CASCADE;")
        # Step 3: Recreate messages table (non-partitioned)
        op.create_table(
            "messages",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("timestamp", sa.DateTime, nullable=False, index=True),
            sa.Column(
                "request_id",
                sa.String,
                sa.ForeignKey("griditems.uuid", ondelete="CASCADE"),
                nullable=False,
                index=True,
            ),
            sa.Column("session_id", sa.String, nullable=False, index=True),
            sa.Column("message_id", sa.String, nullable=False, index=True),
            sa.Column("sender", sa.String, nullable=False),
            sa.Column("message", sa.String, nullable=False),
            sa.Column("edited", sa.Boolean, nullable=False, default=False),
        )
        # Step 4: Restore data
        op.execute(
            "INSERT INTO messages (id, timestamp, request_id, session_id, message_id, sender, message, edited) SELECT id, timestamp, request_id, session_id, message_id, sender, message, edited FROM messages_backup;"  # noqa: E501
        )
        op.execute("DROP TABLE messages_backup;")


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        # Revert Enum columns to original type  (not strictly possible in SQLite)
        # Drop messages table if needed
        op.execute("DROP TABLE IF EXISTS messages;")
    elif dialect == "postgresql":
        # Drop non-partitioned messages table
        op.execute("DROP TABLE IF EXISTS messages CASCADE;")
        # Recreate partitioned messages table
        op.execute("""
        CREATE TABLE messages (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            request_id VARCHAR NOT NULL REFERENCES griditems(uuid) ON DELETE CASCADE,
            session_id VARCHAR NOT NULL,
            message_id VARCHAR NOT NULL,
            sender VARCHAR NOT NULL,
            message VARCHAR NOT NULL,
            edited BOOLEAN NOT NULL DEFAULT FALSE
        ) PARTITION BY RANGE (timestamp);
        """)
