"""convert label to description

Revision ID: ba25f182726d
Revises: b4f03a66239a
Create Date: 2025-02-26 12:41:56.531877

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ba25f182726d"
down_revision: Union[str, None] = "b4f03a66239a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("dashboards", sa.Column("description", sa.String))
    connection = op.get_bind()
    metadata = sa.MetaData()
    t_dashboards = sa.Table(
        "dashboards",
        metadata,
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("label", sa.String),
        sa.Column("description", sa.String),
        autoload_with=connection,
    )

    results = connection.execute(
        sa.select(t_dashboards.c.id, t_dashboards.c.label)
    ).fetchall()

    for id_, label in results:
        connection.execute(
            sa.update(t_dashboards)
            .where(t_dashboards.c.id == id_)
            .values(description=label)
        )

    op.drop_column("dashboards", "label")


def downgrade() -> None:
    op.add_column("dashboards", sa.Column("label", sa.String))
    connection = op.get_bind()
    metadata = sa.MetaData()
    t_dashboards = sa.Table(
        "dashboards",
        metadata,
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("description", sa.String),
        sa.Column("label", sa.String),
        autoload_with=connection,
    )

    results = connection.execute(
        sa.select(t_dashboards.c.id, t_dashboards.c.description)
    ).fetchall()

    for id_, description in results:
        connection.execute(
            sa.update(t_dashboards)
            .where(t_dashboards.c.id == id_)
            .values(label=description[:20])
        )

    op.drop_column("dashboards", "description")
