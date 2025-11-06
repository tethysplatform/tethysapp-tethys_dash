"""remove griditem i contraint

Revision ID: 488ef941ec3a
Revises: 20f22416d985
Create Date: 2025-11-04 11:03:07.776655

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "488ef941ec3a"
down_revision: Union[str, None] = "20f22416d985"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = '_dashboard_i'
            ) THEN
                ALTER TABLE griditems DROP CONSTRAINT "_dashboard_i";
            END IF;
        END$$;
        """
    )


def downgrade() -> None:
    op.create_unique_constraint("_dashboard_i", "griditems", ["dashboard_id", "i"])
