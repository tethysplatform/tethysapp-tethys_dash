"""add layer_files

Revision ID: c4e8a2f1d6b3
Revises: 09d4203a610a
Create Date: 2026-11-12 12:00:00.000000

Map layer GeoJSON and style files move from the app workspace, on the disk of
whichever server took the upload, into the default storage. This table indexes
them: which files each dashboard holds, their sizes, and whose layer storage
allowance each counts against. The files themselves are moved by
``move_workspace_layer_files`` when the app's database is synced, since a
migration may run where neither the workspace nor the storage is configured.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c4e8a2f1d6b3"
down_revision: Union[str, None] = "09d4203a610a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "layer_files",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "dashboard_id", sa.Integer(), sa.ForeignKey("dashboards.id"), nullable=False
        ),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.UniqueConstraint("dashboard_id", "filename", name="_dashboard_layer_file"),
    )
    op.create_index("ix_layer_files_username", "layer_files", ["username"])


def downgrade() -> None:
    op.drop_index("ix_layer_files_username", table_name="layer_files")
    op.drop_table("layer_files")
