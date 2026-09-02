"""add auto_thumbnail

Revision ID: 7a3c91be04d2
Revises: add270eff36c
Create Date: 2026-08-13 09:12:44.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "7a3c91be04d2"
down_revision: Union[str, None] = "add270eff36c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Added nullable, backfilled, then pinned: existing rows have no value, and
    # SQLite cannot add a NOT NULL column to a populated table in one step.
    op.add_column("dashboards", sa.Column("auto_thumbnail", sa.Boolean(), nullable=True))
    op.execute("UPDATE dashboards SET auto_thumbnail = TRUE")

    if op.get_bind().dialect.name == "sqlite":
        with op.batch_alter_table("dashboards") as batch_op:
            batch_op.alter_column("auto_thumbnail", nullable=False)
    else:
        op.alter_column("dashboards", "auto_thumbnail", nullable=False)


def downgrade() -> None:
    op.drop_column("dashboards", "auto_thumbnail")
