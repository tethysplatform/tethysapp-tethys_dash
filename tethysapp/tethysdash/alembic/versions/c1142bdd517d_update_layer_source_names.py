"""update layer source names

Revision ID: c1142bdd517d
Revises: ef2472c4f3c7
Create Date: 2025-05-08 10:56:42.676639

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import json


# revision identifiers, used by Alembic.
revision: str = "c1142bdd517d"
down_revision: Union[str, None] = "ef2472c4f3c7"
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

    rename_keys = {
        "ImageTile": "Image Tile",
        "VectorTile": "Vector Tile",
        "ImageArcGISRest": "ESRI Image and Map Service",
        "ImageWMS": "WMS",
    }

    for row in results:
        updated = False
        viz_args = json.loads(row.args_string)
        map_layers = viz_args.get("layers", [])

        for map_layer in map_layers:
            source_type = map_layer["configuration"]["props"]["source"]["type"]
            if source_type in rename_keys:
                map_layer["configuration"]["props"]["source"]["type"] = rename_keys[
                    source_type
                ]
                updated = True

        if updated:
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

    rename_keys = {
        "Image Tile": "ImageTile",
        "Vector Tile": "VectorTile",
        "ESRI Image and Map Service": "ImageArcGISRest",
        "WMS": "ImageWMS",
    }

    for row in results:
        updated = False
        viz_args = json.loads(row.args_string)
        map_layers = viz_args.get("layers", [])

        for map_layer in map_layers:
            source_type = map_layer["configuration"]["props"]["source"]["type"]
            if source_type in rename_keys:
                map_layer["configuration"]["props"]["source"]["type"] = rename_keys[
                    source_type
                ]
                updated = True

        if updated:
            new_config_str = json.dumps(viz_args)
            connection.execute(
                t_griditems.update()
                .where(t_griditems.c.id == row.id)
                .values(args_string=new_config_str)
            )
