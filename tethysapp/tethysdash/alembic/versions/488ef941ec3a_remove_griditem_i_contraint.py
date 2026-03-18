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
    import sqlalchemy as sa

    bind = op.get_bind()
    dialect = bind.dialect.name
    constraint_exists = False
    if dialect == "sqlite":
        # Check for constraint existence in SQLite
        pragma = bind.execute(sa.text("PRAGMA index_list('griditems')")).fetchall()
        for row in pragma:
            if row[1] == "_dashboard_i":
                constraint_exists = True
        if constraint_exists:
            with op.batch_alter_table("griditems") as batch_op:
                batch_op.drop_constraint("_dashboard_i", type_="unique")
    else:
        # Check for constraint existence in PostgreSQL
        result = bind.execute(
            sa.text("SELECT 1 FROM pg_constraint WHERE conname = '_dashboard_i'")
        )
        if result.fetchone():
            with op.batch_alter_table("griditems") as batch_op:
                batch_op.drop_constraint("_dashboard_i", type_="unique")


def downgrade() -> None:
    with op.batch_alter_table("griditems") as batch_op:
        batch_op.create_unique_constraint("_dashboard_i", ["dashboard_id", "i"])
