"""refresh_rate to metadata_string

Revision ID: b4f03a66239a
Revises:
Create Date: 2024-11-13 11:00:08.308270

"""

from typing import Sequence, Union
import json
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b4f03a66239a"
down_revision: Union[str, None] = "ed97dcad9e2b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("griditems", sa.Column("metadata_string", sa.String))

    t_griditems = sa.Table(
        "griditems",
        sa.MetaData(),
        sa.Column("id", sa.String(32)),
        sa.Column("refresh_rate", sa.Integer()),
        sa.Column("metadata_string", sa.String()),
    )

    connection = op.get_bind()
    results = connection.execute(
        sa.select(
            [
                t_griditems.c.id,
                t_griditems.c.refresh_rate,
            ]
        )
    ).fetchall()

    for id_, refresh_rate in results:
        refreshRate = refresh_rate if refresh_rate else 0
        connection.execute(
            t_griditems.update()
            .where(t_griditems.c.id == id_)
            .values(metadata_string=json.dumps({"refreshRate": refreshRate}))
        )

    op.drop_column("griditems", "refresh_rate")


def downgrade() -> None:
    op.add_column("griditems", sa.Column("refresh_rate", sa.Integer()))

    t_griditems = sa.Table(
        "griditems",
        sa.MetaData(),
        sa.Column("id", sa.String(32)),
        sa.Column("refresh_rate", sa.Integer()),
        sa.Column("metadata_string", sa.String()),
    )

    connection = op.get_bind()
    results = connection.execute(
        sa.select(
            [
                t_griditems.c.id,
                t_griditems.c.metadata_string,
            ]
        )
    ).fetchall()

    for id_, metadata_string in results:
        metadata = json.loads(metadata_string)
        refresh_rate = metadata.get("refreshRate", 0)
        connection.execute(
            t_griditems.update()
            .where(t_griditems.c.id == id_)
            .values(refresh_rate=refresh_rate)
        )

    op.drop_column("griditems", "metadata_string")
