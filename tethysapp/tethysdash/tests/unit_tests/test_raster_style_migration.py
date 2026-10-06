"""
The raster-ramp-settings-to-style data migration (revision 09d4203a610a).

The transformation is pure and lives in the migration file itself, so the
migration stays frozen; it is loaded from there by path. The same cases are
covered on the frontend by convertLegacyRasterLayers in
reactapp/__tests__/components/dashboard/importIdentity.test.js, which applies
the same conversion to imported files.
"""

import copy
import importlib.util
import json
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION_PATH = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "09d4203a610a_raster_ramp_settings_to_style.py"
)


@pytest.fixture(scope="module")
def migration():
    spec = importlib.util.spec_from_file_location("raster_style_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


COMPILED = {"color": ["interpolate", ["linear"], ["band", 1], 0, "#000", 1, "#fff"]}


def raster(source, style=None, layer_type="WebGLTile", **extra):
    configuration = {
        "type": layer_type,
        "props": {"name": "Raster", "opacity": ".5", "source": source},
    }
    if style is not None:
        configuration["style"] = style
    return {"configuration": configuration, **extra}


def map_args(*layers):
    return {"baseMap": "https://basemap", "layers": list(layers)}


# The second layer of TethysDashGridItem.json, an exported static GeoTIFF with a
# pinned range.
def old_continuous():
    return raster(
        {
            "type": "GeoTIFF",
            "props": {
                "url": "https://x/median.${Date}.tif",
                "mask_below": "0",
                "normalize": False,
            },
            "rampName": "YlGnBu",
            "rampMin": "0",
            "rampMax": "20",
        },
        style=copy.deepcopy(COMPILED),
        legend="default",
    )


def new_continuous():
    return raster(
        {
            "type": "GeoTIFF",
            "props": {"url": "https://x/median.${Date}.tif", "mask_below": "0"},
        },
        style={"rampName": "YlGnBu", "rampMin": "0", "rampMax": "20"},
        legend="default",
    )


CLASSES = [
    {"value": "1", "color": "#ff0000", "label": "Low"},
    {"value": "2", "color": "#00ff00", "label": "High"},
]


def test_static_continuous_geotiff(migration):
    converted, changed = migration.upgrade_map_args(map_args(old_continuous()))

    assert changed is True
    assert converted == map_args(new_continuous())


def test_upgrade_is_pure(migration):
    args = map_args(old_continuous())
    snapshot = copy.deepcopy(args)

    migration.upgrade_map_args(args)

    assert args == snapshot


@pytest.mark.parametrize("style_mode", ["categorical", "ranges"])
def test_class_styled_geotiff(migration, style_mode):
    layer = raster(
        {
            "type": "GeoTIFF",
            "props": {
                "url": "https://x/classes.tif",
                "mask_below": "0",
                "normalize": False,
                "interpolate": False,
            },
            "styleMode": style_mode,
            "classes": CLASSES,
            "fallbackColor": "#888888",
            "rampName": "turbo",
            "rampReverse": True,
        },
        style=copy.deepcopy(COMPILED),
    )

    converted, changed = migration.upgrade_map_args(map_args(layer))

    assert changed is True
    assert converted["layers"][0]["configuration"] == {
        "type": "WebGLTile",
        "props": {
            "name": "Raster",
            "opacity": ".5",
            "source": {
                "type": "GeoTIFF",
                "props": {"url": "https://x/classes.tif", "mask_below": "0"},
            },
        },
        "style": {
            "styleMode": style_mode,
            "classes": CLASSES,
            "fallbackColor": "#888888",
            "rampName": "turbo",
            "rampReverse": True,
        },
    }


def test_zarr_keeps_its_authored_interpolate(migration):
    layer = raster(
        {
            "type": "Zarr",
            "props": {
                "url": "https://x/store.zarr",
                "variable": "depth",
                "index": "${Storm}",
                "mask_below": "0.1",
                "interpolate": "true",
                "normalize": True,
            },
            "rampName": "blues",
        },
        style=copy.deepcopy(COMPILED),
    )

    converted, changed = migration.upgrade_map_args(map_args(layer))

    assert changed is True
    configuration = converted["layers"][0]["configuration"]
    assert configuration["props"]["source"] == {
        "type": "Zarr",
        "props": {
            "url": "https://x/store.zarr",
            "variable": "depth",
            "index": "${Storm}",
            "mask_below": "0.1",
            "interpolate": "true",
        },
    }
    assert configuration["style"] == {"rampName": "blues"}


def test_dynamic_geotiff_keeps_its_plugin_binding(migration):
    plugin_source = {
        "source": "echo_runtime_raster",
        "args": {"mode": "${Mode}"},
        "stylePinned": True,
    }
    layer = raster(
        {"type": "GeoTIFF", "props": {"mask_below": "-9999"}, "rampName": "magma"}
    )
    layer["configuration"]["props"]["pluginSource"] = plugin_source
    layer["configuration"]["props"]["layerId"] = "layer-1"

    converted, changed = migration.upgrade_map_args(map_args(layer))

    assert changed is True
    configuration = converted["layers"][0]["configuration"]
    assert configuration["props"]["source"] == {
        "type": "GeoTIFF",
        "props": {"mask_below": "-9999"},
    }
    assert configuration["props"]["pluginSource"] == plugin_source
    assert configuration["props"]["layerId"] == "layer-1"
    assert configuration["style"] == {"rampName": "magma"}


def test_uploaded_compiled_style_file_is_dropped(migration):
    # An imported layer's style was uploaded as a JSON file; the file held the
    # compiled expression, which the app now builds at load.
    layer = old_continuous()
    layer["configuration"]["style"] = "c0ffee.json"

    converted, _ = migration.upgrade_map_args(map_args(layer))

    assert converted["layers"][0]["configuration"]["style"] == (
        new_continuous()["configuration"]["style"]
    )


def test_non_raster_layer_untouched(migration):
    vector = {
        "configuration": {
            "type": "VectorLayer",
            "props": {
                "name": "Points",
                "source": {"type": "GeoJSON", "props": {}, "geojson": "a.json"},
            },
            "style": "style.json",
        }
    }
    args = map_args(vector)

    converted, changed = migration.upgrade_map_args(args)

    assert changed is False
    assert converted is args


def test_hand_authored_raster_style_untouched(migration):
    # An RGB band expression: no ramp keys anywhere, so nothing to move.
    rgb = raster(
        {"type": "GeoTIFF", "props": {"url": "https://x/rgb.tif", "normalize": True}},
        style={"color": ["array", ["band", 1], ["band", 2], ["band", 3], 1]},
    )
    args = map_args(rgb)

    converted, changed = migration.upgrade_map_args(args)

    assert changed is False
    assert converted is args


def test_already_migrated_is_a_no_op(migration):
    args = map_args(new_continuous())

    converted, changed = migration.upgrade_map_args(args)

    assert changed is False
    assert converted is args


def test_rerun_is_a_no_op(migration):
    once, _ = migration.upgrade_map_args(map_args(old_continuous()))

    twice, changed = migration.upgrade_map_args(once)

    assert changed is False
    assert twice == once


def test_nested_popup_layers(migration):
    nested_object_args = {
        "i": "1",
        "source": "Map",
        "args_string": map_args(old_continuous()),
    }
    nested_string_args = {
        "i": "2",
        "source": "Map",
        "args_string": json.dumps(map_args(old_continuous())),
    }
    not_a_map = {"i": "3", "source": "Text", "args_string": {"text": "hi"}}
    parent = map_args(
        {
            "configuration": {
                "type": "VectorLayer",
                "props": {"name": "Sites", "source": {"type": "GeoJSON"}},
            },
            "popupConfig": {
                "mode": "layout",
                "gridItems": [nested_object_args, nested_string_args, not_a_map],
            },
        }
    )

    converted, changed = migration.upgrade_map_args(parent)

    assert changed is True
    items = converted["layers"][0]["popupConfig"]["gridItems"]
    assert items[0]["args_string"] == map_args(new_continuous())
    # A string args_string stays a string.
    assert isinstance(items[1]["args_string"], str)
    assert json.loads(items[1]["args_string"]) == map_args(new_continuous())
    assert items[2] == not_a_map


def test_args_without_layers_untouched(migration):
    for args in ({}, {"layers": None}, {"layers": "nope"}):
        assert migration.upgrade_map_args(args) == (args, False)


def test_downgrade_restores_old_fields(migration):
    converted, changed = migration.downgrade_map_args(map_args(new_continuous()))

    assert changed is True
    configuration = converted["layers"][0]["configuration"]
    # The compiled style.color cannot be rebuilt in Python; the app that reads
    # the old shape recompiles it at load.
    assert "style" not in configuration
    assert configuration["props"]["source"] == {
        "type": "GeoTIFF",
        "props": {
            "url": "https://x/median.${Date}.tif",
            "mask_below": "0",
            "normalize": False,
        },
        "rampName": "YlGnBu",
        "rampMin": "0",
        "rampMax": "20",
    }


def test_downgrade_derives_normalize_and_interpolate(migration):
    half_range = raster(
        {"type": "GeoTIFF", "props": {"url": "https://x/a.tif"}},
        style={"rampName": "viridis", "rampMin": "0"},
    )
    classes = raster(
        {"type": "GeoTIFF", "props": {"url": "https://x/b.tif"}},
        style={"styleMode": "categorical", "classes": CLASSES, "rampName": "turbo"},
    )
    zarr = raster(
        {
            "type": "Zarr",
            # A source property on both sides of the move, so the downgrade
            # leaves it exactly where it found it.
            "props": {
                "url": "https://x/c.zarr",
                "variable": "v",
                "mask_below": "1",
            },
        },
        style={"rampName": "blues"},
    )

    converted, _ = migration.downgrade_map_args(map_args(half_range, classes, zarr))

    sources = [layer["configuration"]["props"]["source"] for layer in converted["layers"]]
    assert sources[0]["props"]["normalize"] is True
    assert sources[1]["props"]["normalize"] is False
    assert sources[1]["props"]["interpolate"] is False
    assert sources[2]["props"] == {
        "url": "https://x/c.zarr",
        "variable": "v",
        "mask_below": "1",
    }


def test_downgrade_leaves_hand_authored_style(migration):
    rgb = raster(
        {"type": "GeoTIFF", "props": {"url": "https://x/rgb.tif"}},
        style={"color": ["band", 1]},
    )
    args = map_args(rgb)

    assert migration.downgrade_map_args(args) == (args, False)


def test_round_trip_through_downgrade(migration):
    downgraded, _ = migration.downgrade_map_args(map_args(new_continuous()))

    upgraded, _ = migration.upgrade_map_args(downgraded)

    assert upgraded == map_args(new_continuous())


@pytest.fixture
def griditems_connection():
    engine = sa.create_engine("sqlite://")
    metadata = sa.MetaData()
    sa.Table(
        "griditems",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("source", sa.String),
        sa.Column("args_string", sa.String),
    )
    metadata.create_all(engine)
    with engine.begin() as connection:
        yield connection


def _run(migration, connection, step):
    context = MigrationContext.configure(connection)
    with Operations.context(context):
        getattr(migration, step)()


def _rows(connection):
    return {
        row.id: row.args_string
        for row in connection.execute(sa.text("SELECT id, args_string FROM griditems"))
    }


def test_upgrade_and_downgrade_rewrite_only_map_rows(migration, griditems_connection):
    connection = griditems_connection
    untouched_map = json.dumps(map_args(new_continuous()))
    connection.execute(
        sa.text("INSERT INTO griditems (id, source, args_string) VALUES (:i, :s, :a)"),
        [
            {"i": 1, "s": "Map", "a": json.dumps(map_args(old_continuous()))},
            {"i": 2, "s": "Map", "a": untouched_map},
            {"i": 3, "s": "Text", "a": json.dumps({"layers": [old_continuous()]})},
            {"i": 4, "s": "Map", "a": "not json"},
        ],
    )
    before = _rows(connection)

    _run(migration, connection, "upgrade")
    after = _rows(connection)

    assert json.loads(after[1]) == map_args(new_continuous())
    assert after[2] == untouched_map
    assert after[3] == before[3]
    assert after[4] == "not json"

    # Idempotent: a second run changes nothing.
    _run(migration, connection, "upgrade")
    assert _rows(connection) == after

    _run(migration, connection, "downgrade")
    downgraded = json.loads(_rows(connection)[1])
    source = downgraded["layers"][0]["configuration"]["props"]["source"]
    assert source["rampName"] == "YlGnBu"
    assert source["props"]["mask_below"] == "0"
    assert "style" not in downgraded["layers"][0]["configuration"]


def test_migration_extends_the_head(migration):
    versions = MIGRATION_PATH.parent
    down_revisions = set()
    for path in versions.glob("*.py"):
        text = path.read_text()
        for line in text.splitlines():
            if line.startswith("down_revision"):
                down_revisions.add(line.split("=")[-1].strip().strip('"'))
    assert migration.down_revision == "7a3c91be04d2"
    # Nothing revises this one, so it is the single head.
    assert migration.revision not in down_revisions
