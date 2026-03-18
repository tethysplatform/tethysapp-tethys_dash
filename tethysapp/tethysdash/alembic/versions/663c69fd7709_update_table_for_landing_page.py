"""update table for landing page

Revision ID: 663c69fd7709
Revises: ba25f182726d
Create Date: 2025-03-03 12:39:15.121271

"""

from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "663c69fd7709"
down_revision: Union[str, None] = "ba25f182726d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns with correct types
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("dashboards") as batch_op:
            batch_op.add_column(sa.Column("uuid", sa.String(36)))
            batch_op.add_column(sa.Column("last_updated", sa.DateTime(), nullable=True))
            batch_op.create_unique_constraint("uq_dashboards_uuid", ["uuid"])
    else:
        op.add_column("dashboards", sa.Column("uuid", sa.String(36), unique=True))
        op.add_column(
            "dashboards", sa.Column("last_updated", sa.DateTime(), nullable=True)
        )

    # Populate uuid values for existing rows
    metadata = sa.MetaData()
    metadata.reflect(bind=bind)
    t_dashboards = metadata.tables["dashboards"]
    results = bind.execute(sa.select(t_dashboards.c.id)).fetchall()
    for row in results:
        id_ = row[0]
        dashboard_uuid = str(uuid.uuid4())
        bind.execute(
            sa.update(t_dashboards)
            .where(t_dashboards.c.id == id_)
            .values(uuid=dashboard_uuid)
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect == "sqlite":
        with op.batch_alter_table("dashboards") as batch_op:
            batch_op.drop_constraint("uq_dashboards_uuid", type_="unique")
            batch_op.drop_column("uuid")
            batch_op.drop_column("last_updated")
    else:
        op.drop_column("dashboards", "uuid")
        op.drop_column("dashboards", "last_updated")
