"""initial DB creation

Revision ID: ed97dcad9e2b
Revises: 115022bfef13
Create Date: 2025-04-11 12:50:38.403155

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "ed97dcad9e2b"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    op.create_table(
        "dashboards",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("label", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("owner", sa.String(), nullable=True),
        sa.Column("access_groups", postgresql.ARRAY(sa.String()), nullable=True),
    )

    op.create_table(
        "griditems",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "dashboard_id", sa.Integer(), sa.ForeignKey("dashboards.id"), nullable=False
        ),
        sa.Column("i", sa.String(), nullable=False),
        sa.Column("x", sa.Integer(), nullable=False),
        sa.Column("y", sa.Integer(), nullable=False),
        sa.Column("w", sa.Integer(), nullable=False),
        sa.Column("h", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("args_string", sa.String(), nullable=True),
        sa.Column("metadata_string", sa.String(), nullable=True),
    )


def downgrade():
    op.drop_table("griditems")
    op.drop_table("dashboards")
