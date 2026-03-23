"""add_formats_to_date_variables

Revision ID: 78188f76ffa0
Revises: c12ae6fbc947
Create Date: 2026-02-11 15:28:22.498133

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
import json

# revision identifiers, used by Alembic.
revision: str = "78188f76ffa0"
down_revision: Union[str, None] = "c12ae6fbc947"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    griditems_table = table(
        "griditems", column("id", sa.Integer), column("args_string", sa.Text)
    )

    # Select all griditems
    result = conn.execute(sa.text("SELECT id, args_string FROM griditems"))
    for row in result:
        args_string = row["args_string"]
        try:
            args = json.loads(args_string)
        except Exception:
            continue
        # Check for variable_options_source
        source = args.get("variable_options_source")
        if source in ["date", "date-hour"]:
            # Set new source
            args["variable_options_source"] = "date"
            # Add metadata
            fmt = "MM/dd/yyyy h:mm aa" if source == "date-hour" else "MM/dd/yyyy"
            args["variable_options_source.metadata"] = {"format": fmt}
            new_args_string = json.dumps(args)
            conn.execute(
                griditems_table.update()
                .where(griditems_table.c.id == row["id"])
                .values(args_string=new_args_string)
            )


def downgrade() -> None:
    from sqlalchemy.sql import table, column
    import json

    conn = op.get_bind()
    griditems_table = table(
        "griditems", column("id", sa.Integer), column("args_string", sa.Text)
    )

    result = conn.execute(sa.text("SELECT id, args_string FROM griditems"))
    for row in result:
        args_string = row["args_string"]
        try:
            args = json.loads(args_string)
        except Exception:
            continue
        meta = args.pop("variable_options_source.metadata", None)
        # Only revert if metadata was present
        if meta:
            fmt = meta.get("format") if isinstance(meta, dict) else None
            if fmt == "MM/dd/yyyy h:mm aa":
                args["variable_options_source"] = "date-hour"
            elif fmt == "MM/dd/yyyy":
                args["variable_options_source"] = "date"
            new_args_string = json.dumps(args)
            conn.execute(
                griditems_table.update()
                .where(griditems_table.c.id == row["id"])
                .values(args_string=new_args_string)
            )
