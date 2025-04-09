"""add restricted movement

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
        "dashboards", sa.Column("restricted_movement", sa.Boolean(), nullable=True)
    )
    op.execute("UPDATE dashboards SET restricted_movement = TRUE")


def downgrade() -> None:
    op.drop_column("dashboards", "restricted_movement")
