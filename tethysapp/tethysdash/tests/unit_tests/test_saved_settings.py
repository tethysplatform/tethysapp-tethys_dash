"""Contract tests for the saved-settings locator and the viewer arg builder.

The parity fixture is shared with
reactapp/__tests__/components/visualizations/substitutionParity.test.js, which holds
the browser to each case's sent args; here the builder is held to the run args it
makes of them.
"""

import copy
import json
import re
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

from tethysapp.tethysdash.saved_settings import (
    LAYER,
    ROW_DATE_FIXED,
    ROW_DATE_RANGE,
    ROW_DATE_RELATIVE,
    ROW_EXACT,
    ROW_INLINE,
    ROW_NESTED,
    ROW_REFUSED,
    ROW_SAVED,
    ROW_SECRET,
    SECRET_ARG,
    TILE,
    AmbiguousSavedSetting,
    PluginArgPath,
    SavedSettingNotFound,
    SavedSettingsMismatch,
    _matches_template,
    blank_secret_args,
    build_viewer_args,
    classify_arg,
    iter_plugin_arg_paths,
    locate,
    locate_layer,
    locate_tile,
)

FIXTURE = json.loads(
    (Path(__file__).parents[1] / "fixtures" / "substitution_parity.json").read_text()
)
SECRET_MARKER = FIXTURE["secret_marker"]
RUN_CASES = [case for case in FIXTURE["cases"] if "expected_run_args" in case]
ERROR_CASES = [case for case in FIXTURE["cases"] if "expected_error" in case]


def _request(case):
    return case.get("request_args", case["sent_args"])


def _expected(case):
    return {
        name: SECRET_ARG if value == SECRET_MARKER else value
        for name, value in case["expected_run_args"].items()
    }


@pytest.mark.parametrize("case", RUN_CASES, ids=[case["name"] for case in RUN_CASES])
def test_parity_fixture_run_args(case):
    run_args = build_viewer_args(
        case["saved_args"], _request(case), case["arg_types"], case["kind"]
    )
    assert run_args == _expected(case)


@pytest.mark.parametrize(
    "case", ERROR_CASES, ids=[case["name"] for case in ERROR_CASES]
)
def test_parity_fixture_refusals(case):
    assert case["expected_error"] == "mismatch"
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args(
            case["saved_args"], _request(case), case["arg_types"], case["kind"]
        )


def test_every_parity_case_expects_run_args_or_a_refusal():
    assert len(RUN_CASES) + len(ERROR_CASES) == len(FIXTURE["cases"])


def _viewer_request(case):
    """The request as a viewer's browser sends it: the case's viewer_sent_keys only."""
    keys = set(case["viewer_sent_keys"])
    return {name: value for name, value in _request(case).items() if name in keys}


@pytest.mark.parametrize(
    "case", FIXTURE["cases"], ids=[case["name"] for case in FIXTURE["cases"]]
)
def test_parity_fixture_viewer_request_needs_only_the_args_it_sends(case):
    """For a caller who may not edit the dashboard the browser sends only the wired
    and date args; the saved settings supply the rest, to the same run args or the
    same refusal."""
    build = lambda: build_viewer_args(  # noqa: E731
        case["saved_args"], _viewer_request(case), case["arg_types"], case["kind"]
    )
    if "expected_error" in case:
        with pytest.raises(SavedSettingsMismatch):
            build()
    else:
        assert build() == _expected(case)


# The browser sends a fixed date as local wall clock plus offset. A date and time is
# read as local time, so the moment it sends sits up to 14 hours before the saved
# value read as UTC (at +14:00) or 12 after (at -12:00). The window is 14 hours
# either way.
@pytest.mark.parametrize(
    "sent",
    [
        "2024-01-15T00:00:00+14:00",
        "2024-01-15T00:00:00-12:00",
        "2024-01-15T00:00:00+00:00",
        "2024-01-15T05:30:00+05:30",
        "2024-01-15T00:00:00",
    ],
)
def test_a_fixed_date_takes_any_offset_reading_of_its_wall_clock(sent):
    run_args = build_viewer_args(
        {"at": "01/15/2024 12:00 AM"}, {"at": sent}, {"at": "date"}, TILE
    )
    assert run_args == {"at": sent}


@pytest.mark.parametrize(
    "sent",
    [
        "2024-01-15T00:00:00+14:01",
        "2024-01-15T00:00:00-14:01",
        "2024-01-15T14:00:01",
        "15 January 2024",
        None,
        0,
    ],
)
def test_a_fixed_date_runs_as_saved_past_the_widest_offset_or_when_not_iso(sent):
    run_args = build_viewer_args(
        {"at": "01/15/2024 12:00 AM"}, {"at": sent}, {"at": "date"}, TILE
    )
    assert run_args == {"at": "01/15/2024 12:00 AM"}


@pytest.mark.parametrize("saved", ["", "not a date", "99/99/99999999999999999999"])
def test_a_fixed_date_that_does_not_parse_runs_as_saved(saved):
    run_args = build_viewer_args(
        {"at": saved}, {"at": "2024-01-15T00:00:00-07:00"}, {"at": "date"}, TILE
    )
    assert run_args == {"at": saved}


def test_a_relative_date_takes_a_preset_and_runs_as_saved_without_one():
    run_args = build_viewer_args(
        {"start": "now-1D", "end": "now"},
        {"start": "latest"},
        {"start": "date", "end": "date"},
        TILE,
    )
    assert run_args == {"start": "latest", "end": "now"}


def test_a_date_range_without_tokens_runs_as_saved_when_the_request_differs_in_shape():
    saved = {"window": {"Start Date": "now-7D", "End Date": "01/31/2024 12:00 AM"}}
    for sent in ({}, {"window": "2024-01-01"}, {"window": {"Start Date": "now"}}):
        assert build_viewer_args(saved, sent, {"window": "date-range"}, TILE) == saved


def test_a_date_range_with_a_wired_endpoint_refuses_a_request_of_another_shape():
    saved = {"window": {"Start Date": "${Start}", "End Date": "now"}}
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args(
            saved, {"window": ["2024-01-01"]}, {"window": "date-range"}, TILE
        )


def test_a_date_range_endpoint_that_is_not_a_string_follows_the_nested_rows():
    saved = {"window": {"Start Date": "now", "options": {"site": "${Site}", "n": 1}}}
    sent = {"window": {"Start Date": "2024-01-01", "options": {"site": "S2", "n": 9}}}
    run_args = build_viewer_args(saved, sent, {"window": "date-range"}, TILE)
    assert run_args == {
        "window": {"Start Date": "2024-01-01", "options": {"site": "S2", "n": 1}}
    }


def test_a_date_typed_object_that_is_not_a_range_follows_the_nested_rows():
    saved = {"at": {"site": "${Site}"}, "until": None}
    run_args = build_viewer_args(
        saved,
        {"at": {"site": "S2"}, "until": "2024-01-01"},
        {"at": "date", "until": "date"},
        TILE,
    )
    assert run_args == {"at": {"site": "S2"}, "until": None}


def test_a_missing_inline_arg_is_read_as_an_empty_string():
    saved = {"name": "${First}${Last}", "url": "https://x.org/${Site}"}
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args(saved, {}, {}, TILE)
    assert build_viewer_args({"name": saved["name"]}, {}, {}, TILE) == {"name": ""}


def test_an_inline_arg_refuses_a_request_value_that_is_not_a_string():
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args({"url": "https://x.org/${Site}"}, {"url": 5}, {}, TILE)


def test_a_nested_object_refuses_a_request_that_is_not_an_object():
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args({"query": {"site": "${Site}"}}, {"query": ["S1"]}, {}, TILE)


def test_a_nested_list_refuses_a_request_that_is_not_a_list():
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args({"sites": ["${Site}"]}, {"sites": "S1"}, {}, TILE)


def test_a_nested_token_in_a_missing_arg_refuses():
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args({"query": {"site": "${Site}"}}, {}, {}, LAYER)


def test_a_token_in_a_nested_key_refuses():
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args(
            {"query": [{"fields": {"${Field}": 1}}]},
            {"query": [{"fields": {"flow": 1}}]},
            {},
            TILE,
        )


def test_unknown_arg_types_leave_every_arg_to_the_plain_rows():
    saved = {"start": "now-1D", "site": "${Site}"}
    sent = {"start": "2024-01-01T00:00:00Z", "site": "S1"}
    assert build_viewer_args(saved, sent, None, TILE) == {
        "start": "now-1D",
        "site": "S1",
    }


def test_build_refuses_request_args_that_are_not_an_object():
    with pytest.raises(SavedSettingsMismatch):
        build_viewer_args({"site": "${Site}"}, ["S1"], {}, TILE)


def test_build_refuses_an_unknown_request_kind():
    with pytest.raises(ValueError, match="Unknown request kind"):
        build_viewer_args({}, {}, {}, "popup")


def test_the_secret_placeholder_never_shows_a_value():
    assert repr(SECRET_ARG) == "SECRET_ARG"


@pytest.mark.parametrize(
    "saved, arg_type, kind, row",
    [
        ("${Key}", "secret", TILE, ROW_SECRET),
        ("plain", "secret", LAYER, ROW_SECRET),
        ("${Site}", "text", TILE, ROW_EXACT),
        ("${feature.id}", "text", LAYER, ROW_EXACT),
        ("${Start}", "date", TILE, ROW_EXACT),
        ("site=${Site}", "text", TILE, ROW_INLINE),
        ("${a}${b}", "text", TILE, ROW_INLINE),
        ("${Day} 12:00 AM", "date", TILE, ROW_INLINE),
        ({"a": ["${b}"]}, "text", TILE, ROW_NESTED),
        ({"${a}": 1}, "text", TILE, ROW_REFUSED),
        (["${a", "b}"], "text", TILE, ROW_REFUSED),
        ({"a": '${b"c}'}, "text", TILE, ROW_NESTED),
        ({"a": "${b\\c}"}, "text", TILE, ROW_NESTED),
        ({"Start Date": "now"}, "date-range", TILE, ROW_DATE_RANGE),
        ({"Start Date": "${S}"}, "date-range", TILE, ROW_DATE_RANGE),
        ({"${S}": "now"}, "date-range", TILE, ROW_REFUSED),
        ({"Start Date": "now"}, "date-range", LAYER, ROW_SAVED),
        ("now-1D", "date", TILE, ROW_DATE_RELATIVE),
        ("latest", "date-hour", TILE, ROW_DATE_RELATIVE),
        ("2024-01-15", "date", TILE, ROW_DATE_FIXED),
        ("", "date", TILE, ROW_DATE_FIXED),
        ("now-1D", "date", LAYER, ROW_SAVED),
        ("plain", "text", TILE, ROW_SAVED),
        ({"a": 1}, "text", TILE, ROW_SAVED),
        (5, "number", TILE, ROW_SAVED),
        (None, "date", TILE, ROW_SAVED),
        ("now", ["now", "later"], TILE, ROW_SAVED),
    ],
)
def test_classify_arg(saved, arg_type, kind, row):
    assert classify_arg(saved, arg_type, kind) == row


# The matcher must accept exactly what a full match of the template does with its
# literals escaped and each token a lazy any-character group.
@pytest.mark.parametrize(
    "template, value",
    [
        ("site=${a}&f=json", "site=1&f=json"),
        ("site=${a}&f=json", "site=&f=json"),
        ("site=${a}&f=json", "site=1&x=2&f=json"),
        ("site=${a}&f=json", "site=1&f=csv"),
        ("site=${a}&f=json", "xsite=1&f=json"),
        ("ab${a}ba", "aba"),
        ("ab${a}ba", "abba"),
        ("${a}-${b}-${c}", "1-2-3"),
        ("${a}-${b}-${c}", "1-2"),
        ("${a}-${b}-${c}", "--"),
        ("${a}${b}", ""),
        ("x${a}y${b}z", "xyz"),
        ("x${a}y${b}z", "xzy"),
        ("x${a}y${b}z", "x\ny\nz"),
        ("a.b*${a}(c)", "a.b*anything(c)"),
        ("a.b*${a}(c)", "aXb*anything(c)"),
        ("x${a}y${z", "x1y${z"),
        ("x${a}y${z", "x1y"),
        ("${a}}${${b", "1}${${b"),
        ("${a}}${${b", "1}${b"),
    ],
)
def test_matches_template_agrees_with_the_lazy_group_regex(template, value):
    pattern = r"(.*?)".join(
        re.escape(part) for part in re.split(r"\$\{[^}]+\}", template)
    )
    expected = re.fullmatch(pattern, value, re.DOTALL) is not None
    assert _matches_template(template, value) is expected


# Saved args with a long run of "${" and no "}" after it, which a token search that
# tried every "${" took quadratic time over, each with request args that reach every
# place the args are searched: a string, an inline template, a list's JSON text and
# leaves, and an object key.
LONG_RUN = "${" * 1_000_000
SLOW_ARGS = {
    "a string": ({"arg": LONG_RUN}, {"arg": "x"}),
    "an inline template": ({"arg": "${a}" + LONG_RUN}, {"arg": "x"}),
    "a list": ({"arg": ["${a}", LONG_RUN]}, {"arg": ["x", "y"]}),
    "an object key": ({"arg": {LONG_RUN: "${a}"}}, {"arg": {}}),
}


@pytest.mark.parametrize("saved, sent", SLOW_ARGS.values(), ids=SLOW_ARGS.keys())
def test_tokens_are_found_in_linear_time(saved, sent):
    start = time.perf_counter()
    try:
        build_viewer_args(saved, sent, {}, TILE)
    except SavedSettingsMismatch:
        pass

    assert time.perf_counter() - start < 1


def test_a_run_of_unclosed_tokens_is_text():
    saved = {"plain": LONG_RUN, "list": ["${a}", LONG_RUN]}

    assert classify_arg(LONG_RUN, None, TILE) == ROW_SAVED
    assert build_viewer_args(saved, {"list": ["x", "y"]}, {}, TILE) == {
        "plain": LONG_RUN,
        "list": ["x", LONG_RUN],
    }


def _item(uuid, source, args):
    return SimpleNamespace(uuid=uuid, source=source, args_string=json.dumps(args))


def _map_args(*layers):
    return {"baseMap": "", "layers": list(layers)}


def _popup_layer(*items, layer_id=None, plugin_source=None):
    props = {}
    if layer_id is not None:
        props["layerId"] = layer_id
    if plugin_source is not None:
        props["pluginSource"] = plugin_source
    return {
        "configuration": {"props": props},
        "popupConfig": {"gridItems": list(items)},
    }


def _popup_item(uuid, source, args, as_text=False):
    return {
        "uuid": uuid,
        "source": source,
        "args_string": json.dumps(args) if as_text else args,
    }


DEEP_TILE_ARGS = {"site": "${feature.id}"}


def _dashboard():
    """A plugin tile, a Text tile, and a Map whose layer popup holds a Map whose layer
    popup holds a plugin tile, two levels down, plus dynamic layers at both levels."""
    inner_map = _map_args(
        _popup_layer(
            _popup_item("deep-tile", "station_plot", DEEP_TILE_ARGS, as_text=True),
            layer_id="inner-layer",
            plugin_source={"source": "gauges_layer", "args": {"basin": "${Basin}"}},
        )
    )
    outer_map = _map_args(
        _popup_layer(
            _popup_item("popup-map", "Map", inner_map),
            _popup_item("popup-text", "Text", {"text": "hello"}),
            layer_id="outer-layer",
            plugin_source={
                "source": "rivers_layer",
                "args": json.dumps({"date": "now"}),
            },
        ),
        _popup_layer(layer_id="static-layer"),
    )
    return [
        _item("Top-Tile", "station_plot", {"site": "${Site}"}),
        _item("text-tile", "Text", {"text": "hi"}),
        _item("map-tile", "Map", outer_map),
    ]


def test_locate_tile_matches_a_top_level_uuid_in_any_case():
    tile = locate_tile(_dashboard(), "top-TILE")
    assert (tile.uuid, tile.source, tile.args, tile.path) == (
        "Top-Tile",
        "station_plot",
        {"site": "${Site}"},
        ("Top-Tile",),
    )


def test_locate_tile_finds_a_popup_tile_two_levels_deep():
    tile = locate_tile(_dashboard(), "DEEP-TILE")
    assert (tile.uuid, tile.source, tile.args, tile.path) == (
        "deep-tile",
        "station_plot",
        DEEP_TILE_ARGS,
        ("map-tile", "popup-map", "deep-tile"),
    )


@pytest.mark.parametrize("tile_uuid", ["missing", "", None, 5])
def test_locate_tile_refuses_a_uuid_no_tile_has(tile_uuid):
    with pytest.raises(SavedSettingNotFound):
        locate_tile(_dashboard(), tile_uuid)


def test_locate_tile_refuses_a_duplicated_popup_uuid():
    grid_items = _dashboard() + [
        _item(
            "other-map",
            "Map",
            _map_args(_popup_layer(_popup_item("deep-tile", "station_plot", {}))),
        )
    ]
    with pytest.raises(AmbiguousSavedSetting):
        locate_tile(grid_items, "deep-tile")


def test_locate_tile_refuses_a_popup_uuid_that_is_also_a_top_level_one():
    grid_items = _dashboard() + [_item("DEEP-tile", "station_plot", {})]
    with pytest.raises(AmbiguousSavedSetting):
        locate_tile(grid_items, "deep-tile")


def test_the_walk_tolerates_shapes_it_does_not_expect():
    """Unreadable args read as empty, and an unexpected shape adds nothing, as in the
    layer-file scan."""
    odd_layers = [
        "not a layer",
        {"configuration": "not an object", "popupConfig": "not an object"},
        {"configuration": {"props": []}, "popupConfig": {"gridItems": "nope"}},
        {"popupConfig": {"gridItems": ["not an item", {"source": "Map"}]}},
        _popup_layer(_popup_item("found", "station_plot", "{not json")),
        _popup_layer(_popup_item("listed", "station_plot", ["a", "list"])),
    ]
    grid_items = [
        SimpleNamespace(uuid="bad-json", source="station_plot", args_string="{"),
        _item("no-layers", "Map", {"layers": "not a list"}),
        _item("odd-map", "Map", {"layers": odd_layers}),
    ]
    assert locate_tile(grid_items, "bad-json").args == {}
    assert locate_tile(grid_items, "found").args == {}
    assert locate_tile(grid_items, "listed").args == {}
    assert locate_tile(grid_items, "no-layers").args == {"layers": "not a list"}


def test_locate_layer_returns_a_dynamic_layer_with_its_raw_args():
    tile = locate_tile(_dashboard(), "map-tile")
    layer = locate_layer(tile, "outer-layer")
    assert (layer.tile, layer.layer_id, layer.source, layer.args) == (
        tile,
        "outer-layer",
        "rivers_layer",
        {"date": "now"},
    )


def test_locate_layer_finds_a_layer_of_a_popup_map():
    layer = locate(_dashboard(), "popup-map", "inner-layer")
    assert (layer.tile.uuid, layer.source, layer.args) == (
        "popup-map",
        "gauges_layer",
        {"basin": "${Basin}"},
    )


@pytest.mark.parametrize(
    "tile_uuid, layer_id",
    [
        ("map-tile", "missing"),
        ("map-tile", 5),
        ("map-tile", "static-layer"),
        ("Top-Tile", "outer-layer"),
    ],
)
def test_locate_layer_refuses_a_layer_id_no_dynamic_layer_has(tile_uuid, layer_id):
    with pytest.raises(SavedSettingNotFound):
        locate(_dashboard(), tile_uuid, layer_id)


def test_locate_layer_refuses_a_layer_id_with_no_layer():
    """A blank id would otherwise match every layer saved without one."""
    tile = locate_tile(
        [_item("map", "Map", _map_args(_popup_layer(), _popup_layer()))], "map"
    )
    for layer_id in ("", None):
        with pytest.raises(SavedSettingNotFound):
            locate_layer(tile, layer_id)


def test_locate_layer_refuses_a_duplicated_layer_id():
    plugin_source = {"source": "gauges_layer", "args": {}}
    layers = [
        _popup_layer(layer_id="twice", plugin_source=plugin_source),
        _popup_layer(layer_id="twice", plugin_source=plugin_source),
    ]
    with pytest.raises(AmbiguousSavedSetting):
        locate([_item("map", "Map", _map_args(*layers))], "map", "twice")


def test_locate_without_a_layer_id_returns_the_tile():
    assert locate(_dashboard(), "map-tile").source == "Map"


def test_iter_plugin_arg_paths_lists_every_plugin_tile_and_dynamic_layer():
    unlisted_layers = [
        _popup_layer(plugin_source={"source": "no_id_layer", "args": {}}),
        _popup_layer(layer_id="", plugin_source={"source": "blank_id", "args": {}}),
        _popup_layer(layer_id="built-in", plugin_source={"source": "Map"}),
        _popup_layer(layer_id="no-source", plugin_source={"args": {}}),
        _popup_layer(layer_id="not-dynamic", plugin_source="rivers_layer"),
    ]
    grid_items = _dashboard() + [
        _item("other-map", "Map", _map_args(*unlisted_layers)),
        _item("nameless", None, {}),
        _item("chat", "Live Chat", {}),
        # Layers belong to Map tiles only.
        _item(
            "plugin-with-layers",
            "layer_lister",
            _map_args(
                _popup_layer(
                    layer_id="ignored", plugin_source={"source": "x", "args": {}}
                )
            ),
        ),
    ]
    assert list(iter_plugin_arg_paths(grid_items)) == [
        PluginArgPath("Top-Tile", "", "station_plot", {"site": "${Site}"}),
        PluginArgPath("map-tile", "outer-layer", "rivers_layer", {"date": "now"}),
        PluginArgPath(
            "popup-map", "inner-layer", "gauges_layer", {"basin": "${Basin}"}
        ),
        PluginArgPath("deep-tile", "", "station_plot", DEEP_TILE_ARGS),
        PluginArgPath(
            "plugin-with-layers",
            "",
            "layer_lister",
            _map_args(
                _popup_layer(
                    layer_id="ignored", plugin_source={"source": "x", "args": {}}
                )
            ),
        ),
    ]


def test_a_tile_without_a_uuid_is_skipped_but_its_popups_are_walked():
    nameless_map = SimpleNamespace(
        uuid=None,
        source="Map",
        args_string=json.dumps(
            _map_args(_popup_layer(_popup_item("inside", "station_plot", {})))
        ),
    )
    assert [path.tile_uuid for path in iter_plugin_arg_paths([nameless_map])] == [
        "inside"
    ]
    assert locate_tile([nameless_map], "inside").path == (None, "inside")


# Blanking secret args

INSTALLED_SECRET_ARGS = {
    "station_plot": frozenset({"token"}),
    "gauges_layer": frozenset({"key"}),
    "rivers_layer": frozenset(),
}


def _secret_args_of(source):
    """Each installed plugin's secret args; None for a plugin not installed."""
    return INSTALLED_SECRET_ARGS.get(source)


def _secret_dashboard_map():
    """A Map whose dynamic layer and popups hold secrets two levels down, each piece
    of args in a different form."""
    inner_map = _map_args(
        _popup_layer(
            _popup_item(
                "deep-tile",
                "station_plot",
                {"token": "deep", "site": "x"},
                as_text=True,
            ),
            layer_id="inner-layer",
            plugin_source={
                "source": "gauges_layer",
                "args": json.dumps({"key": "inner", "basin": "b"}),
            },
        )
    )
    return _map_args(
        _popup_layer(
            _popup_item("popup-map", "Map", inner_map),
            _popup_item("popup-text", "Text", {"text": "hello"}),
            layer_id="outer-layer",
            plugin_source={
                "source": "gauges_layer",
                "args": {"key": {"held": "as an object"}, "basin": "b"},
            },
        ),
    )


@pytest.mark.parametrize("as_text", [True, False], ids=["JSON text", "object"])
def test_blank_secret_args_blanks_every_secret_at_any_depth_keeping_each_form(
    as_text,
):
    given = _secret_dashboard_map()
    unchanged = copy.deepcopy(given)

    blanked, found = blank_secret_args(
        "Map", json.dumps(given) if as_text else given, _secret_args_of
    )

    assert isinstance(blanked, str) == as_text
    blanked = json.loads(blanked) if as_text else blanked
    (outer,) = blanked["layers"]
    assert outer["configuration"]["props"]["pluginSource"]["args"] == {
        "key": "",
        "basin": "b",
    }
    popup_map, popup_text = outer["popupConfig"]["gridItems"]
    assert popup_text == {
        "uuid": "popup-text",
        "source": "Text",
        "args_string": {"text": "hello"},
    }
    (inner,) = popup_map["args_string"]["layers"]
    inner_args = inner["configuration"]["props"]["pluginSource"]["args"]
    assert json.loads(inner_args) == {"key": "", "basin": "b"}
    (deep_tile,) = inner["popupConfig"]["gridItems"]
    assert json.loads(deep_tile["args_string"]) == {"token": "", "site": "x"}
    assert found == ['{"held":"as an object"}', "inner", "deep"]
    assert given == unchanged


@pytest.mark.parametrize(
    "source, args",
    [
        ("station_plot", json.dumps({"token": "", "site": "x"})),
        ("station_plot", {"token": None, "site": "x"}),
        ("station_plot", {"site": "x"}),
        ("station_plot", "{not json"),
        ("rivers_layer", {"token": "an ordinary arg here"}),
        ("not_installed", {"token": "nothing is known of it"}),
        ("Text", {"token": "a built-in tile"}),
        (None, {"token": "no source"}),
        ("Map", "{not json"),
        ("Map", {"layers": "not a list"}),
        (
            "Map",
            {
                "layers": [
                    "not a layer",
                    {"configuration": "not an object"},
                    {"configuration": {"props": {"pluginSource": "not an object"}}},
                    {"configuration": {"props": {"pluginSource": {"args": {}}}}},
                    {"popupConfig": {"gridItems": ["not an item", {"source": "Map"}]}},
                    {"popupConfig": "not an object"},
                    {"popupConfig": {"gridItems": "not a list"}},
                    _popup_layer(_popup_item("t", "station_plot", {"token": ""})),
                ]
            },
        ),
    ],
)
def test_blank_secret_args_returns_args_holding_no_secret_as_given(source, args):
    blanked, found = blank_secret_args(source, args, _secret_args_of)

    assert blanked is args
    assert found == []


def test_blank_secret_args_blanks_a_value_of_any_type():
    blanked, found = blank_secret_args(
        "station_plot", json.dumps({"token": 1234, "site": "x"}), _secret_args_of
    )

    assert blanked == '{"token":"","site":"x"}'
    assert found == ["1234"]


def test_blank_secret_args_keeps_whatever_else_a_popup_list_holds():
    layer = _popup_layer(
        "not an item", _popup_item("t", "station_plot", {"token": "abc-123"}), None
    )

    blanked, found = blank_secret_args("Map", _map_args(layer), _secret_args_of)

    assert blanked["layers"][0]["popupConfig"]["gridItems"] == [
        "not an item",
        _popup_item("t", "station_plot", {"token": ""}),
        None,
    ]
    assert found == ["abc-123"]
