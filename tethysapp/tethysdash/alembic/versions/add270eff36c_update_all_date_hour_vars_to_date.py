"""update all date-hour vars to date

Revision ID: add270eff36c
Revises: 9d81090ceb84
Create Date: 2026-04-08 10:10:28.348509

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
import json

# revision identifiers, used by Alembic.
revision: str = "add270eff36c"
down_revision: Union[str, None] = "9d81090ceb84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    griditems_table = table(
        "griditems",
        column("id", sa.Integer),
        column("source", sa.String),
        column("args_string", sa.Text),
    )

    result = conn.execute(
        sa.text(
            "SELECT id, args_string FROM griditems " "WHERE source = 'Variable Input'"
        )
    )
    for row in result:
        args_string = row["args_string"]
        try:
            args = json.loads(args_string)
        except Exception:
            continue

        source = args.get("variable_options_source")
        if source == "date-hour":
            args["variable_options_source"] = "date"
            args["variable_options_source.metadata"] = {"format": "MM/dd/yyyy h:mm aa"}
            conn.execute(
                griditems_table.update()
                .where(griditems_table.c.id == row["id"])
                .values(args_string=json.dumps(args))
            )


def downgrade() -> None:
    conn = op.get_bind()
    griditems_table = table(
        "griditems",
        column("id", sa.Integer),
        column("source", sa.String),
        column("args_string", sa.Text),
    )

    result = conn.execute(
        sa.text(
            "SELECT id, args_string FROM griditems " "WHERE source = 'Variable Input'"
        )
    )
    for row in result:
        args_string = row["args_string"]
        try:
            args = json.loads(args_string)
        except Exception:
            continue

        meta = args.pop("variable_options_source.metadata", None)
        if isinstance(meta, dict) and meta.get("format") == "MM/dd/yyyy h:mm aa":
            args["variable_options_source"] = "date-hour"
            conn.execute(
                griditems_table.update()
                .where(griditems_table.c.id == row["id"])
                .values(args_string=json.dumps(args))
            )
