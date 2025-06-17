"""adding_variable_to_map_extent

Revision ID: 0597a408202d
Revises: f6488db5f489
Create Date: 2025-06-17 09:25:08.744194

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json


# revision identifiers, used by Alembic.
revision: str = "0597a408202d"
down_revision: Union[str, None] = "f6488db5f489"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    metadata = sa.MetaData()
    metadata.reflect(bind=connection)

    t_griditems = metadata.tables["griditems"]

    # Fetch all existing IDs
    results = connection.execute(
        sa.select(t_griditems.c.id, t_griditems.c.args_string).where(
            t_griditems.c.source == "Map"
        )
    ).fetchall()

    for row in results:
        viz_args = json.loads(row.args_string)

        if "map_extent" in viz_args:
            viz_args["map_extent"] = {"extent": viz_args["map_extent"]}
            new_config_str = json.dumps(viz_args)
            connection.execute(
                t_griditems.update()
                .where(t_griditems.c.id == row.id)
                .values(args_string=new_config_str)
            )


def downgrade() -> None:
    connection = op.get_bind()
    metadata = sa.MetaData()
    metadata.reflect(bind=connection)

    t_griditems = metadata.tables["griditems"]

    # Fetch all existing IDs
    results = connection.execute(
        sa.select(t_griditems.c.id, t_griditems.c.args_string).where(
            t_griditems.c.source == "Map"
        )
    ).fetchall()

    for row in results:
        viz_args = json.loads(row.args_string)

        if "map_extent" in viz_args:
            viz_args["map_extent"] = viz_args["map_extent"]["extent"]
            new_config_str = json.dumps(viz_args)
            connection.execute(
                t_griditems.update()
                .where(t_griditems.c.id == row.id)
                .values(args_string=new_config_str)
            )
