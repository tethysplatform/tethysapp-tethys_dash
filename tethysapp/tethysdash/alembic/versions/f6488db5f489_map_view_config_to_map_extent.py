"""map_view_config_to_map_extent

Revision ID: f6488db5f489
Revises: c1142bdd517d
Create Date: 2025-06-09 15:55:53.207429

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json


# revision identifiers, used by Alembic.
revision: str = "f6488db5f489"
down_revision: Union[str, None] = "c1142bdd517d"
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

        if "viewConfig" in viz_args:
            viz_args["map_extent"] = f"{",".join([str(x) for x in viz_args['viewConfig']['center']])},{viz_args['viewConfig']['zoom']}"
            del viz_args["viewConfig"]  
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
            map_extent = viz_args["map_extent"].split(",")
            if len(map_extent) == 3:
                center, zoom  = map_extent[:-1], map_extent[-1]
                viz_args["viewConfig"] = {"center": center, "zoom": zoom}
            del viz_args["map_extent"]  
        
            new_config_str = json.dumps(viz_args)
            connection.execute(
                t_griditems.update()
                .where(t_griditems.c.id == row.id)
                .values(args_string=new_config_str)
            )
