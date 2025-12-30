"""chat_history

Revision ID: c12ae6fbc947
Revises: 5ffcfd93e61f
Create Date: 2025-12-29 12:11:53.706502

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c12ae6fbc947"
down_revision: Union[str, None] = "5ffcfd93e61f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the messages table with partitioning by RANGE (timestamp)
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS messages (
            id SERIAL,
            timestamp TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            request_id VARCHAR NOT NULL,
            session_id VARCHAR,
            message_id VARCHAR,
            sender VARCHAR NOT NULL,
            message VARCHAR NOT NULL,
            PRIMARY KEY (id, timestamp)
        ) PARTITION BY RANGE (timestamp);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS messages CASCADE;")
