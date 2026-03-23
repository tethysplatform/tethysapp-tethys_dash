"""chat_history

Revision ID: c12ae6fbc947
Revises: 5ffcfd93e61f
Create Date: 2025-12-29 12:11:53.706502

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c12ae6fbc947"
down_revision: Union[str, None] = "5ffcfd93e61f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("griditems") as batch_op:
            batch_op.create_unique_constraint("uq_griditems_uuid", ["uuid"])
        op.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                request_id VARCHAR NOT NULL,
                session_id VARCHAR NOT NULL,
                message_id VARCHAR NOT NULL,
                sender VARCHAR NOT NULL,
                message VARCHAR NOT NULL,
                edited BOOLEAN NOT NULL DEFAULT 0
            );
            """)
    else:
        op.create_unique_constraint("uq_griditems_uuid", "griditems", ["uuid"])
        op.execute(
            "CREATE TABLE IF NOT EXISTS messages (id SERIAL, timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL, request_id VARCHAR NOT NULL REFERENCES griditems(uuid) ON DELETE CASCADE, session_id VARCHAR NOT NULL, message_id VARCHAR NOT NULL, sender VARCHAR NOT NULL, message VARCHAR NOT NULL, edited BOOLEAN NOT NULL DEFAULT FALSE, PRIMARY KEY (id, timestamp)) PARTITION BY RANGE (timestamp);"  # noqa:E501
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        op.execute("DROP TABLE IF EXISTS messages;")
        with op.batch_alter_table("griditems") as batch_op:
            batch_op.drop_constraint("uq_griditems_uuid", type_="unique")
    else:
        op.execute("DROP TABLE IF EXISTS messages CASCADE;")
        op.drop_constraint("uq_griditems_uuid", "griditems", type_="unique")
