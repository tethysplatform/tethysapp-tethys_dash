"""add unrestricted_placement

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
        "dashboards", sa.Column("unrestricted_placement", sa.Boolean(), nullable=True)
    )
    op.execute("UPDATE dashboards SET unrestricted_placement = FALSE")

    op.add_column("griditems", sa.Column("order", sa.Integer(), nullable=True))

    # Populate 'order' using row_number() grouped by dashboard_id
    op.execute(
        """
        WITH numbered AS (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY dashboard_id ORDER BY id) AS rn
            FROM griditems
        )
        UPDATE griditems
        SET "order" = numbered.rn
        FROM numbered
        WHERE griditems.id = numbered.id
    """
    )

    # Make 'order' column non-nullable
    op.alter_column("griditems", "order", nullable=False)


def downgrade() -> None:
    op.drop_column("griditems", "order")
    op.drop_column("dashboards", "unrestricted_placement")
