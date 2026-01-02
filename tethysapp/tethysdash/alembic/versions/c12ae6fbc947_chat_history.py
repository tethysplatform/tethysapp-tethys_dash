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
    # Ensure griditems.uuid is unique and not null
    op.create_unique_constraint("uq_griditems_uuid", "griditems", ["uuid"])

    # Create the messages table with partitioning by RANGE (timestamp),
    # and request_id as a foreign key to griditems.uuid with ON DELETE CASCADE
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL,
            timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            request_id VARCHAR NOT NULL REFERENCES griditems(uuid) ON DELETE CASCADE,
            session_id VARCHAR NOT NULL,
            message_id VARCHAR NOT NULL,
            sender VARCHAR NOT NULL,
            message VARCHAR NOT NULL,
            edited BOOLEAN NOT NULL DEFAULT FALSE,
            PRIMARY KEY (id, timestamp)
        ) PARTITION BY RANGE (timestamp);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS messages CASCADE;")
    # Remove the unique constraint on griditems.uuid if it exists
    op.drop_constraint("uq_griditems_uuid", "griditems", type_="unique")
