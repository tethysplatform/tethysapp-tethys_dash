"""add tile_secrets

Revision ID: d7f3b9a1c5e2
Revises: c4e8a2f1d6b3
Create Date: 2026-11-20 12:00:00.000000

Plugins can declare secret args, whose values must not live in a tile's
``args_string``: every save rewrites it from the browser, and copies, exports and
imports carry it along. This table holds each secret's encrypted value, keyed by
its dashboard, tile uuid, layer id ("" for a tile's own args) and arg name, with
the plugin source it was entered for. A dashboard's rows go with it.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d7f3b9a1c5e2"
down_revision: Union[str, None] = "c4e8a2f1d6b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "tile_secrets",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "dashboard_id",
            sa.Integer(),
            sa.ForeignKey("dashboards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tile_uuid", sa.String(), nullable=False),
        sa.Column("layer_id", sa.String(), nullable=False, server_default=""),
        sa.Column("arg_name", sa.String(), nullable=False),
        sa.Column("plugin_source", sa.String(), nullable=False),
        sa.Column("ciphertext", sa.String(), nullable=False),
        sa.Column("updated_by", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "dashboard_id",
            "tile_uuid",
            "layer_id",
            "arg_name",
            name="_tile_secret_path",
        ),
    )


def downgrade() -> None:
    op.drop_table("tile_secrets")
