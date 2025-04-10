"""add unrestricted_movement

Revision ID: 115022bfef13
Revises: 663c69fd7709
Create Date: 2025-04-09 15:49:18.501609

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "115022bfef13"
down_revision: Union[str, None] = "663c69fd7709"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns with correct types
    op.add_column(
        "dashboards", sa.Column("unrestricted_movement", sa.Boolean(), nullable=True)
    )
    op.execute("UPDATE dashboards SET unrestricted_movement = FALSE")
    op.execute("ALTER TABLE griditems ALTER COLUMN i TYPE INTEGER USING i::INTEGER")


def downgrade() -> None:
    op.drop_column("dashboards", "unrestricted_movement")
    op.execute("ALTER TABLE griditems ALTER COLUMN i TYPE VARCHAR USING i::VARCHAR")
