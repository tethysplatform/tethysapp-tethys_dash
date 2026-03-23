"""add dashboard item uuid

Revision ID: 5ffcfd93e61f
Revises: 488ef941ec3a
Create Date: 2025-12-19 14:21:14.767245

"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
import uuid

# revision identifiers, used by Alembic.
revision: str = "5ffcfd93e61f"
down_revision: Union[str, None] = "488ef941ec3a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'uuid' column to 'griditems' table
    bind = op.get_bind()
    op.add_column("griditems", sa.Column("uuid", sa.String(), nullable=True))

    griditems = table("griditems", column("id", sa.Integer), column("uuid", sa.String))
    results = bind.execute(sa.text("SELECT id FROM griditems")).fetchall()
    for row in results:
        bind.execute(
            griditems.update()
            .where(griditems.c.id == row.id)
            .values(uuid=str(uuid.uuid4()))
        )

    with op.batch_alter_table("griditems") as batch_op:
        batch_op.alter_column("uuid", nullable=False)


def downgrade() -> None:
    # Remove 'uuid' column from 'griditems' table
    op.drop_column("griditems", "uuid")
