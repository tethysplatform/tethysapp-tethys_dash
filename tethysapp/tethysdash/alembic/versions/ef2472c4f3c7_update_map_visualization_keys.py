"""update_map_visualization_keys

Revision ID: ef2472c4f3c7
Revises: 115022bfef13
Create Date: 2025-04-17 09:41:38.656264

"""

from typing import Sequence, Union
import json
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "ef2472c4f3c7"
down_revision: Union[str, None] = "115022bfef13"
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
        "additional_layers": "layers",
        "base_map": "baseMap",
        "initial_view": "viewConfig",
        "show_layer_controls": "layerControl",
        "map_config": "mapConfig",
    }

    for row in results:
        viz_args = json.loads(row.args_string)
        updated = False

        for old_key, new_key in rename_keys.items():
            if old_key in viz_args:
                viz_args[new_key] = viz_args.pop(old_key)
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
        "layers": "additional_layers",
        "baseMap": "base_map",
        "viewConfig": "initial_view",
        "layerControl": "show_layer_controls",
        "mapConfig": "map_config",
    }

    for row in results:
        viz_args = json.loads(row.args_string)
        updated = False

        for old_key, new_key in rename_keys.items():
            if old_key in viz_args:
                viz_args[new_key] = viz_args.pop(old_key)
                updated = True

        if updated:
            new_config_str = json.dumps(viz_args)
            connection.execute(
                t_griditems.update()
                .where(t_griditems.c.id == row.id)
                .values(args_string=new_config_str)
            )
