"""add map_layer_popups

Revision ID: c3cdf1b6dbc7
Revises: add270eff36c
Create Date: 2026-05-04 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3cdf1b6dbc7"
down_revision: Union[str, None] = "add270eff36c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create the map_layer_popups table.
    op.create_table(
        "map_layer_popups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("grid_item_id", sa.Integer(), nullable=False),
        sa.Column("layer_name", sa.String(), nullable=False),
        sa.Column(
            "mode", sa.String(), nullable=False, server_default="table"
        ),
        sa.Column("size_json", sa.String(), nullable=True),
        sa.Column("anchor_json", sa.String(), nullable=True),
        sa.Column("title_template", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["grid_item_id"],
            ["griditems.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "grid_item_id",
            "layer_name",
            name="uq_map_layer_popups_grid_item_layer",
        ),
    )

    # 2. Add the popup_id FK column on griditems and the
    #    "(tab_id IS NULL) <> (popup_id IS NULL)" check constraint.
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("griditems") as batch_op:
            batch_op.add_column(sa.Column("popup_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_griditems_popup_id",
                "map_layer_popups",
                ["popup_id"],
                ["id"],
                ondelete="CASCADE",
            )
            batch_op.create_check_constraint(
                "ck_griditems_tab_xor_popup",
                "(tab_id IS NULL) <> (popup_id IS NULL)",
            )
    else:
        op.add_column(
            "griditems", sa.Column("popup_id", sa.Integer(), nullable=True)
        )
        op.create_foreign_key(
            "fk_griditems_popup_id",
            "griditems",
            "map_layer_popups",
            ["popup_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_check_constraint(
            "ck_griditems_tab_xor_popup",
            "griditems",
            "(tab_id IS NULL) <> (popup_id IS NULL)",
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("griditems") as batch_op:
            batch_op.drop_constraint(
                "ck_griditems_tab_xor_popup", type_="check"
            )
            batch_op.drop_constraint(
                "fk_griditems_popup_id", type_="foreignkey"
            )
            batch_op.drop_column("popup_id")
    else:
        op.drop_constraint(
            "ck_griditems_tab_xor_popup", "griditems", type_="check"
        )
        op.drop_constraint(
            "fk_griditems_popup_id", "griditems", type_="foreignkey"
        )
        op.drop_column("griditems", "popup_id")

    op.drop_table("map_layer_popups")
