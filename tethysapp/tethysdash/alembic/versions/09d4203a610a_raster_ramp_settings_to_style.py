"""move raster ramp settings from the layer source into the layer style

Revision ID: 09d4203a610a
Revises: 7a3c91be04d2
Create Date: 2026-10-01 12:00:00.000000

A raster map layer (a WebGLTile over a GeoTIFF or Zarr source) used to save its
authored styling on its source -- ``rampName``, ``rampMin``, ``rampMax``,
``rampReverse``, ``styleMode``, ``classes`` and ``fallbackColor`` on
``configuration.props.source`` -- while
``configuration.style`` held a compiled OpenLayers ``{"color": [...]}``
expression the frontend rebuilds on every load anyway. Every other layer type
keeps its style in ``configuration.style``, so the authored settings move there
and the compiled copy is dropped:

    configuration.style = {rampName?, rampMin?, rampMax?, rampReverse?,
                           styleMode?, classes?, fallbackColor?}

``mask_below`` is deliberately not moved: it decides which values the file
publishes as data rather than how they are coloured, so it stays on
``source.props`` and keeps its snake_case name. Values keep their
saved types (the bounds
stay numeric strings). ``normalize`` -- and, for a GeoTIFF, ``interpolate`` --
were written onto the source's props by the editor as a function of the ramp
settings, and the frontend now derives them at load, so they are dropped from
ramp-styled layers. A Zarr's ``interpolate`` is an author-settable source
property and is kept.

The transformation is pure and lives in this file so the migration stays
frozen; ``tests/unit_tests/test_raster_style_migration.py`` loads it from here.
It is idempotent: a layer with no ramp fields on its source -- a non-raster
layer, a raster with a hand-authored OpenLayers style, or one already in the
new shape -- is left exactly as it is, and only rows that change are written.
Map layers nested in a layer's popup layout (``popupConfig.gridItems``) are
converted too.
"""

import copy
import json
import math
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "09d4203a610a"
down_revision: Union[str, None] = "7a3c91be04d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


MAP_SOURCE = "Map"
RASTER_SOURCE_TYPES = ("GeoTIFF", "Zarr")
# The authored ramp settings, saved under these names in both shapes.
RAMP_FIELDS = (
    "rampName",
    "rampMin",
    "rampMax",
    "rampReverse",
    "styleMode",
    "classes",
    "fallbackColor",
)
CLASS_STYLE_MODES = ("categorical", "ranges")


def _is_dict(value):
    return isinstance(value, dict)


def _raster_parts(layer):
    """The (configuration, source, source props) of a raster layer, or None."""
    configuration = layer.get("configuration") if _is_dict(layer) else None
    props = configuration.get("props") if _is_dict(configuration) else None
    source = props.get("source") if _is_dict(props) else None
    if not _is_dict(source) or source.get("type") not in RASTER_SOURCE_TYPES:
        return None
    source_props = source.get("props")
    if not _is_dict(source_props):
        source_props = {}
    return configuration, source, source_props


def _is_blank(value):
    return value is None or (isinstance(value, str) and value.strip() == "")


def _is_bound_set(value):
    if _is_blank(value) or isinstance(value, bool):
        return False
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _is_usable_class(entry):
    # Mirrors isUsableClass in reactapp/components/map/geoTIFFStyle.js.
    if not _is_dict(entry) or not entry.get("color"):
        return False
    return _is_bound_set(entry.get("value"))


def upgrade_layer(layer):
    """
    Move one map layer's ramp settings from its source into its style.

    Args:
        layer (dict): One entry of a Map grid item's ``layers``. Mutated.

    Returns:
        bool: Whether the layer changed.
    """
    parts = _raster_parts(layer)
    if parts is None:
        return False
    configuration, source, source_props = parts
    if not any(field in source for field in RAMP_FIELDS):
        return False

    # A style already holding settings (a half-converted layer) keeps what
    # the source does not override. Anything else there -- the compiled
    # expression, inline or as an uploaded style file's name -- is derived
    # from the fields being moved, and the app recompiles it at load.
    existing = configuration.get("style")
    style = {}
    if _is_dict(existing):
        style = {
            key: value
            for key, value in existing.items()
            if key in RAMP_FIELDS
        }
    for field in RAMP_FIELDS:
        if field in source:
            style[field] = source.pop(field)

    # `mask_below` stays on the source props: it decides which values the file
    # publishes as data rather than how they are coloured, so it is not part of
    # this move.

    # Derived from the ramp settings, and derived again at load.
    source_props.pop("normalize", None)
    if source["type"] == "GeoTIFF":
        source_props.pop("interpolate", None)
    if "props" in source:
        source["props"] = source_props

    if style:
        configuration["style"] = style
    else:
        configuration.pop("style", None)
    return True


def downgrade_layer(layer):
    """
    Move one map layer's ramp settings from its style back onto its source.

    The compiled ``style.color`` cannot be rebuilt here -- it needs the color
    ramp tables and the file's statistics -- so it is left absent. The app
    that reads the old shape recompiles it when the layer loads (applyAutoRamp
    writes it from the source's ramp fields once it has read the file's
    header). The derived ``normalize``/``interpolate`` source props the old
    editor saved are restored, since they need only the settings.

    Args:
        layer (dict): One entry of a Map grid item's ``layers``. Mutated.

    Returns:
        bool: Whether the layer changed.
    """
    parts = _raster_parts(layer)
    if parts is None:
        return False
    configuration, source, source_props = parts
    style = configuration.get("style")
    if not _is_dict(style) or not any(
        key in style for key in RAMP_FIELDS
    ):
        return False

    for field in RAMP_FIELDS:
        if field in style:
            source[field] = style.pop(field)
    if source["type"] == "GeoTIFF":
        is_class_styled = source.get("styleMode") in CLASS_STYLE_MODES and any(
            _is_usable_class(entry) for entry in source.get("classes") or []
        )
        if is_class_styled:
            source_props["normalize"] = False
            source_props["interpolate"] = False
        elif source.get("rampName"):
            source_props["normalize"] = not (
                _is_bound_set(source.get("rampMin"))
                and _is_bound_set(source.get("rampMax"))
            )
    source["props"] = source_props

    if not style:
        configuration.pop("style", None)
    return True


def _convert_args(args, convert_layer):
    """Apply ``convert_layer`` to every layer of a Map's args, in place."""
    layers = args.get("layers") if _is_dict(args) else None
    if not isinstance(layers, list):
        return False
    changed = False
    for layer in layers:
        if convert_layer(layer):
            changed = True
        popup = layer.get("popupConfig") if _is_dict(layer) else None
        nested_items = popup.get("gridItems") if _is_dict(popup) else None
        if not isinstance(nested_items, list):
            continue
        for nested in nested_items:
            if _is_dict(nested) and _convert_grid_item(nested, convert_layer):
                changed = True
    return changed


def _convert_grid_item(grid_item, convert_layer):
    """Convert a popup-nested Map grid item in place, keeping its args form."""
    if grid_item.get("source") != MAP_SOURCE:
        return False
    raw = grid_item.get("args_string")
    if isinstance(raw, str):
        try:
            args = json.loads(raw)
        except ValueError:
            return False
        if _convert_args(args, convert_layer):
            grid_item["args_string"] = json.dumps(args)
            return True
        return False
    return _convert_args(raw, convert_layer)


def upgrade_map_args(args):
    """
    Convert a Map grid item's parsed ``args_string`` to the new shape.

    Pure: the input is not changed.

    Args:
        args (dict): The parsed ``args_string`` of a Map grid item.

    Returns:
        tuple[dict, bool]: The converted args, and whether anything changed.
        When nothing changed the input itself is returned.
    """
    converted = copy.deepcopy(args)
    if _convert_args(converted, upgrade_layer):
        return converted, True
    return args, False


def downgrade_map_args(args):
    """
    Convert a Map grid item's parsed ``args_string`` back to the old shape.

    Pure: the input is not changed. See :py:func:`downgrade_layer` for what
    cannot be restored.

    Returns:
        tuple[dict, bool]: The converted args, and whether anything changed.
    """
    converted = copy.deepcopy(args)
    if _convert_args(converted, downgrade_layer):
        return converted, True
    return args, False


def _rewrite_map_grid_items(convert_args):
    connection = op.get_bind()
    metadata = sa.MetaData()
    metadata.reflect(bind=connection, only=["griditems"])
    t_griditems = metadata.tables["griditems"]

    rows = connection.execute(
        sa.select(t_griditems.c.id, t_griditems.c.args_string).where(
            t_griditems.c.source == MAP_SOURCE
        )
    ).fetchall()

    for row in rows:
        try:
            args = json.loads(row.args_string)
        except (TypeError, ValueError):
            continue
        converted, changed = convert_args(args)
        if changed:
            connection.execute(
                t_griditems.update()
                .where(t_griditems.c.id == row.id)
                .values(args_string=json.dumps(converted))
            )


def upgrade() -> None:
    _rewrite_map_grid_items(upgrade_map_args)


def downgrade() -> None:
    _rewrite_map_grid_items(downgrade_map_args)
