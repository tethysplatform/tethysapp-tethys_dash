"""A dashboard's saved settings for one data request, and the args a viewer runs.

A data request names its tile, and for a dynamic map layer the layer, and carries the
args the browser resolved from the saved ones. The browser keeps substituting: it fills
in variable inputs and resolves date args to the viewer's local time, which the server
cannot reproduce. So a caller who cannot edit the dashboard runs the saved args, taking
from the request only what the browser fills in for them. Each saved arg falls under
one row of the overlay, and :func:`classify_arg` names it:

* ``secret``: a declared secret, resolved server-side even when the saved value holds a
  token. Its run value is :data:`SECRET_ARG` until then.
* ``exact token``: exactly ``${Var}`` (``${feature.*}`` included) takes the request's
  value, of any JSON type, or ``""`` when the request leaves it out.
* ``inline template``: a string with tokens among other text takes the request's
  string only if it has the saved literal text where the template does. A date arg on
  a tile request also takes an ISO date or a preset, since the browser resolves the
  date after substituting and the template's text is gone from what it sends.
* ``nested tokens``: an object or list whose string leaves hold tokens keeps its saved
  structure and takes those leaves from the request by the two rules above. The
  request must have the same shape.
* ``refused``: a token in an object key, or one that spans the structure's JSON text.
* ``date: relative or preset`` (tile requests): a saved ``now...`` or preset takes the
  request's value when it is an ISO date or a preset.
* ``date: fixed`` (tile requests): any other saved date takes the request's value when
  it is an ISO date within :data:`MAX_UTC_OFFSET_SPREAD` of the saved one read as UTC.
  The browser sends a fixed date as local wall clock plus offset, and reads a
  date-only value as UTC midnight but a date and time as local time, so what it sends
  can be up to that far from the saved value in either direction.
* ``date range`` (tile requests): an object applies the date rows to each string
  endpoint.
* ``saved``: anything else runs as saved.

Dynamic layer requests resolve no dates in the browser, so their date args follow the
plain rows. Keys the request adds are ignored.

The token pattern is the browser's (``updateObjectWithVariableInputs`` in
``reactapp/components/visualizations/utilities.js``), which also works on top-level
args only and reads a non-string arg as its JSON text.
"""

import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from dateutil.parser import parse as parse_date

from tethysapp.tethysdash.plugin_helpers import DATE_PRESET_SENTINELS

# Request kinds. A tile request resolves its date args in the browser; a dynamic
# layer request resolves none.
TILE = "tile"
LAYER = "layer"

LIVE_CHAT = "Live Chat"

# Tiles that are not plugins. The browser draws all but Live Chat itself, and Live
# Chat's history is read by the endpoint with no args.
BUILT_IN_SOURCES = frozenset(
    {"", "Map", "Text", "Custom Image", "Variable Input", LIVE_CHAT}
)

# The farthest a UTC offset can move a wall clock: -12:00 to +14:00.
MAX_UTC_OFFSET_SPREAD = timedelta(hours=14)

ROW_SECRET = "secret"
ROW_EXACT = "exact token"
ROW_INLINE = "inline template"
ROW_NESTED = "nested tokens"
ROW_REFUSED = "refused"
ROW_DATE_RELATIVE = "date: relative or preset"
ROW_DATE_FIXED = "date: fixed"
ROW_DATE_RANGE = "date range"
ROW_SAVED = "saved"

TOKEN = re.compile(r"\$\{([^}]+)\}")
# A JSON escape sequence, the only place a backslash appears in JSON text.
_JSON_ESCAPE = re.compile(r"\\.")


def _token_end(text):
    """
    How far into text a token can reach: just past its last "}".

    Searches for :data:`TOKEN` stop there. Past it, each "${" reads on to the end of the
    text before failing, so a long run of "${" would take time quadratic in its length.
    """
    return text.rfind("}") + 1


def _has_token(text):
    return TOKEN.search(text, 0, _token_end(text)) is not None


class _SecretArg:
    """The run value of a secret arg until the run resolves it server-side."""

    __slots__ = ()

    def __repr__(self):
        return "SECRET_ARG"


SECRET_ARG = _SecretArg()

# A request arg the request does not carry.
_MISSING = object()


class SavedSettingsError(Exception):
    """Raised when a request cannot be matched to the dashboard's saved settings.

    The message is a diagnostic for logs, not for the browser.
    """


class SavedSettingNotFound(SavedSettingsError):
    """No saved tile or layer has the identity the request names."""


class AmbiguousSavedSetting(SavedSettingsError):
    """More than one saved tile or layer has the identity the request names."""


class SavedSettingsMismatch(SavedSettingsError):
    """The request's args do not fit the saved ones: the dashboard has changed."""


@dataclass(frozen=True)
class SavedTile:
    """A saved tile: top-level, or in a Map tile's layer popup at any depth.

    ``path`` holds the tile uuids from the top-level tile down to this one.
    """

    uuid: str
    source: str
    args: dict
    path: tuple


@dataclass(frozen=True)
class SavedLayer:
    """A dynamic map layer: the plugin source and raw args of its ``pluginSource``."""

    tile: SavedTile
    layer_id: str
    source: str
    args: dict


@dataclass(frozen=True)
class PluginArgPath:
    """Where a plugin's saved args live: a tile, or its layer when ``layer_id``."""

    tile_uuid: str
    layer_id: str
    source: str
    args: dict


def _read_args(value):
    """Return saved args held as JSON text or an object, or {} if they are neither."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except ValueError:
            return {}
    return value if isinstance(value, dict) else {}


def _layers(args):
    layers = args.get("layers")
    if not isinstance(layers, list):
        return []
    return [layer for layer in layers if isinstance(layer, dict)]


def _layer_props(layer):
    configuration = layer.get("configuration")
    props = configuration.get("props") if isinstance(configuration, dict) else None
    return props if isinstance(props, dict) else {}


def _popup_items(layer):
    popup = layer.get("popupConfig")
    items = popup.get("gridItems") if isinstance(popup, dict) else None
    if not isinstance(items, list):
        return []
    return [item for item in items if isinstance(item, dict)]


def _any_uuid(uuid):
    return True


def _walk_tile(uuid, source, raw_args, parent_path, wanted):
    """Yield a tile, if it has a uuid ``wanted`` accepts, then every such popup tile
    its map layers hold, at any depth.

    Only the args of a tile yielded or of a Map tile are parsed: popup tiles live
    only under a Map tile's layers.
    """
    named = isinstance(uuid, str) and wanted(uuid)
    if not named and source != "Map":
        return
    args = _read_args(raw_args)
    path = parent_path + (uuid,)
    if named:
        yield SavedTile(uuid=uuid, source=source, args=args, path=path)
    if source == "Map":
        for layer in _layers(args):
            for item in _popup_items(layer):
                yield from _walk_tile(
                    item.get("uuid"),
                    item.get("source"),
                    item.get("args_string"),
                    path,
                    wanted,
                )


def _walk_tiles(grid_items, wanted=_any_uuid):
    for item in grid_items:
        yield from _walk_tile(item.uuid, item.source, item.args_string, (), wanted)


def _only(matches, what):
    if not matches:
        raise SavedSettingNotFound(f"No saved {what}.")
    if len(matches) > 1:
        raise AmbiguousSavedSetting(f"{len(matches)} saved places match {what}.")
    return matches[0]


def locate_tile(grid_items, tile_uuid):
    """Return the saved tile a request names, top-level or in a popup at any depth.

    Args:
        grid_items: The dashboard's grid items, each with ``uuid``, ``source`` and
            ``args_string`` (``GridItem`` rows).
        tile_uuid (str): The tile's uuid, in any case.

    Raises:
        SavedSettingNotFound: No tile has the uuid.
        AmbiguousSavedSetting: More than one tile has it.
    """
    wanted = tile_uuid.lower() if isinstance(tile_uuid, str) else None
    matches = (
        list(_walk_tiles(grid_items, lambda uuid: uuid.lower() == wanted))
        if wanted
        else []
    )
    return _only(matches, f"tile {tile_uuid!r}")


def locate_layer(tile, layer_id):
    """Return the dynamic layer a Map tile holds under a ``layerId``.

    Raises:
        SavedSettingNotFound: The tile is not a Map, or none of its layers has the
            id, or that layer is not a dynamic one.
        AmbiguousSavedSetting: More than one of its layers has the id.
    """
    what = f"layer {layer_id!r} in tile {tile.uuid!r}"
    nameable = tile.source == "Map" and isinstance(layer_id, str) and layer_id
    matches = [
        layer
        for layer in (_layers(tile.args) if nameable else [])
        if _layer_props(layer).get("layerId") == layer_id
    ]
    plugin_source = _layer_props(_only(matches, what)).get("pluginSource")
    if not isinstance(plugin_source, dict):
        raise SavedSettingNotFound(f"No saved plugin for {what}.")
    return SavedLayer(
        tile=tile,
        layer_id=layer_id,
        source=plugin_source.get("source"),
        args=_read_args(plugin_source.get("args")),
    )


def locate(grid_items, tile_uuid, layer_id=""):
    """Return the saved tile a request names, or its dynamic layer when ``layer_id``.

    Either result carries the ``source`` and raw ``args`` the request runs from.
    """
    tile = locate_tile(grid_items, tile_uuid)
    return locate_layer(tile, layer_id) if layer_id else tile


def _is_plugin_source(source):
    return isinstance(source, str) and source not in BUILT_IN_SOURCES


def iter_plugin_arg_paths(grid_items):
    """Yield every place a dashboard holds a plugin's saved args.

    That is each plugin tile, top-level or in a popup at any depth, and each dynamic
    layer of a Map tile at any depth, as :class:`PluginArgPath` (``layer_id`` empty
    for a tile).
    """
    for tile in _walk_tiles(grid_items):
        if _is_plugin_source(tile.source):
            yield PluginArgPath(tile.uuid, "", tile.source, tile.args)
        if tile.source != "Map":
            continue
        for layer in _layers(tile.args):
            props = _layer_props(layer)
            plugin_source = props.get("pluginSource")
            layer_id = props.get("layerId")
            if (
                isinstance(plugin_source, dict)
                and isinstance(layer_id, str)
                and layer_id
                and _is_plugin_source(plugin_source.get("source"))
            ):
                yield PluginArgPath(
                    tile.uuid,
                    layer_id,
                    plugin_source["source"],
                    _read_args(plugin_source.get("args")),
                )


def _json_text(value):
    """The value's JSON text as the browser's ``JSON.stringify`` writes it."""
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)


def _in_form_of(raw, args):
    """Args in the form ``raw`` held them in: JSON text, or an object."""
    return _json_text(args) if isinstance(raw, str) else args


def _blank_plugin_args(source, raw_args, secret_args_of, found):
    secret_names = secret_args_of(source) if _is_plugin_source(source) else None
    if not secret_names:
        return raw_args
    args = _read_args(raw_args)
    held = sorted(
        name for name in args.keys() & secret_names if args[name] not in ("", None)
    )
    if not held:
        return raw_args
    for name in held:
        value = args[name]
        found.append(value if isinstance(value, str) else _json_text(value))
    return _in_form_of(raw_args, {**args, **dict.fromkeys(held, "")})


def _blank_popup_item(item, secret_args_of, found):
    if not isinstance(item, dict):
        return item
    args = item.get("args_string")
    blanked = _blank_tile(item.get("source"), args, secret_args_of, found)
    return item if blanked is args else {**item, "args_string": blanked}


def _blank_layer(layer, secret_args_of, found):
    if not isinstance(layer, dict):
        return layer
    props = _layer_props(layer)
    plugin_source = props.get("pluginSource")
    if isinstance(plugin_source, dict):
        args = plugin_source.get("args")
        blanked = _blank_plugin_args(
            plugin_source.get("source"), args, secret_args_of, found
        )
        if blanked is not args:
            props = {**props, "pluginSource": {**plugin_source, "args": blanked}}
            layer = {
                **layer,
                "configuration": {**layer["configuration"], "props": props},
            }
    # The whole list, unlike _popup_items: only a secret may change in what is kept.
    popup = layer.get("popupConfig")
    items = popup.get("gridItems") if isinstance(popup, dict) else None
    if not isinstance(items, list):
        return layer
    blanked_items = [_blank_popup_item(item, secret_args_of, found) for item in items]
    if any(blanked is not item for blanked, item in zip(blanked_items, items)):
        layer = {**layer, "popupConfig": {**popup, "gridItems": blanked_items}}
    return layer


def _blank_tile(source, raw_args, secret_args_of, found):
    if source != "Map":
        return _blank_plugin_args(source, raw_args, secret_args_of, found)
    args = _read_args(raw_args)
    layers = args.get("layers")
    if not isinstance(layers, list):
        return raw_args
    blanked = [_blank_layer(layer, secret_args_of, found) for layer in layers]
    if all(new is old for new, old in zip(blanked, layers)):
        return raw_args
    return _in_form_of(raw_args, {**args, "layers": blanked})


def blank_secret_args(source, args, secret_args_of):
    """Return a tile's saved args with every secret arg's value blanked, at any depth.

    A secret's value is stored encrypted apart from the saved args (``TileSecret``),
    never in them. One can still turn up there, from a plugin that newly declares an
    existing arg secret or from a hand-written import file, and is treated as missing:
    it is blanked to ``""`` wherever saved args are stored, copied or served. That is
    the tile's own args, and for a Map tile each dynamic layer's plugin args and each
    popup tile's args, at any depth, whether or not the tile has a uuid or the layer
    an id.

    Each piece keeps its form, JSON text or an object, and is the very value given
    when nothing in it was blanked, so unchanged args are stored and served as they
    were. The plugin of a source ``secret_args_of`` answers None for is not installed,
    so nothing is known of its args and they are left as they are.

    Args:
        source (str): The tile's source
        args (str or dict): Its saved args, as JSON text or an object
        secret_args_of (callable): Returns the names of a plugin source's secret
            args, or None when its plugin is not installed
            (``visualizations.get_plugin_secret_args``)

    Returns:
        tuple: The args with every secret blanked, and the list of values blanked,
            each as text
    """
    found = []
    return _blank_tile(source, args, secret_args_of, found), found


def _has_key_token(value):
    if isinstance(value, dict):
        return any(
            _has_token(key) or _has_key_token(item) for key, item in value.items()
        )
    if isinstance(value, list):
        return any(_has_key_token(item) for item in value)
    return False


def _has_leaf_token(value):
    if isinstance(value, str):
        return _has_token(value)
    if isinstance(value, dict):
        return any(_has_leaf_token(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_leaf_token(item) for item in value)
    return False


def _structure_row(value):
    """The row of an object or list arg, whose tokens are found in its JSON text.

    A token there that crosses an unescaped quote spans the structure. The browser,
    which substitutes each string on its own, sends such an arg unchanged; it is
    refused rather than taken as a token.
    """
    text = _json_text(value)
    tokens = TOKEN.findall(text, 0, _token_end(text))
    if not tokens:
        return ROW_SAVED
    if _has_key_token(value) or any(
        '"' in _JSON_ESCAPE.sub("", token) for token in tokens
    ):
        return ROW_REFUSED
    return ROW_NESTED


def _is_date_type(arg_type):
    return isinstance(arg_type, str) and "date" in arg_type


def classify_arg(saved, arg_type, kind):
    """Return the overlay row a saved arg falls under for a request of ``kind``."""
    if arg_type == "secret":
        return ROW_SECRET
    dated = kind == TILE and _is_date_type(arg_type)
    if isinstance(saved, str):
        if TOKEN.fullmatch(saved):
            return ROW_EXACT
        if _has_token(saved):
            return ROW_INLINE
        if not dated:
            return ROW_SAVED
        if saved.startswith("now") or saved in DATE_PRESET_SENTINELS:
            return ROW_DATE_RELATIVE
        return ROW_DATE_FIXED
    if not isinstance(saved, (dict, list)):
        return ROW_SAVED
    row = _structure_row(saved)
    if dated and arg_type == "date-range" and isinstance(saved, dict):
        return ROW_REFUSED if row == ROW_REFUSED else ROW_DATE_RANGE
    return row


def _matches_template(template, value):
    """Whether value is template with each token replaced by any text.

    The same test as a full match of the template with its literal text escaped and
    each token a lazy any-character group, made without a regex so a long request
    value cannot make it backtrack.
    """
    end = _token_end(template)
    first, *middle, last = TOKEN.split(template[:end])[::2]
    last += template[end:]
    if (
        len(value) < len(first) + len(last)
        or not value.startswith(first)
        or not value.endswith(last)
    ):
        return False
    position, end = len(first), len(value) - len(last)
    for literal in middle:
        found = value.find(literal, position, end)
        if found < 0:
            return False
        position = found + len(literal)
    return True


def _as_utc_if_naive(moment):
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def _request_moment(value):
    """The moment an ISO date in a request names, naive read as UTC, or None."""
    if not isinstance(value, str):
        return None
    try:
        return _as_utc_if_naive(datetime.fromisoformat(value))
    except ValueError:
        return None


def _saved_moment(value):
    """The moment a saved date names, naive read as UTC, or None."""
    try:
        return _as_utc_if_naive(parse_date(value))
    except (ValueError, OverflowError):
        return None


def _is_preset(value):
    return isinstance(value, str) and value in DATE_PRESET_SENTINELS


def _overlay_inline(saved, sent, dated):
    if sent is _MISSING:
        sent = ""
    # The browser resolves a date arg after substituting, so the template's text
    # is gone from a date it sends.
    if dated and (_request_moment(sent) is not None or _is_preset(sent)):
        return sent
    if isinstance(sent, str) and _matches_template(saved, sent):
        return sent
    raise SavedSettingsMismatch("A request value does not fit its saved template.")


def _overlay_nested(saved, sent):
    if isinstance(saved, str):
        if TOKEN.fullmatch(saved):
            return sent
        if _has_token(saved):
            return _overlay_inline(saved, sent, dated=False)
        return saved
    if not _has_leaf_token(saved):
        return saved
    if isinstance(saved, dict):
        if not isinstance(sent, dict) or sent.keys() != saved.keys():
            raise SavedSettingsMismatch("A request value has another shape.")
        return {key: _overlay_nested(value, sent[key]) for key, value in saved.items()}
    if not isinstance(sent, list) or len(sent) != len(saved):
        raise SavedSettingsMismatch("A request value has another shape.")
    return [_overlay_nested(value, item) for value, item in zip(saved, sent)]


def _overlay_date_range(saved, sent):
    if not isinstance(sent, dict) or sent.keys() != saved.keys():
        if _has_leaf_token(saved):
            raise SavedSettingsMismatch("A request value has another shape.")
        return saved
    return {
        key: (
            _overlay(classify_arg(value, "date", TILE), value, sent[key], dated=True)
            if isinstance(value, str)
            else _overlay_nested(value, sent[key])
        )
        for key, value in saved.items()
    }


def _within_offset_spread(saved, sent):
    sent_moment = _request_moment(sent)
    saved_moment = _saved_moment(saved)
    return (
        sent_moment is not None
        and saved_moment is not None
        and abs(sent_moment - saved_moment) <= MAX_UTC_OFFSET_SPREAD
    )


def _overlay(row, saved, sent, dated):
    if row == ROW_SECRET:
        return SECRET_ARG
    if row == ROW_EXACT:
        return "" if sent is _MISSING else sent
    if row == ROW_INLINE:
        return _overlay_inline(saved, sent, dated)
    if row == ROW_NESTED:
        return _overlay_nested(saved, sent)
    if row == ROW_REFUSED:
        raise SavedSettingsMismatch("A saved token sits where it cannot be wired.")
    if row == ROW_DATE_RANGE:
        return _overlay_date_range(saved, sent)
    if row == ROW_DATE_RELATIVE:
        accepted = _request_moment(sent) is not None or _is_preset(sent)
        return sent if accepted else saved
    if row == ROW_DATE_FIXED:
        return sent if _within_offset_spread(saved, sent) else saved
    return saved


def build_viewer_args(saved_args, sent_args, arg_types, kind):
    """Return the args a viewer's request runs with, built from the saved ones.

    Args:
        saved_args (dict): The tile's or layer's raw saved args.
        sent_args (dict): The args the request carries.
        arg_types (dict): The plugin's declared arg types, by arg name.
        kind (str): :data:`TILE` or :data:`LAYER`.

    Returns:
        dict: One value per saved arg, :data:`SECRET_ARG` for a declared secret.

    Raises:
        SavedSettingsMismatch: The request's args cannot have come from the saved
            ones.
    """
    if kind not in (TILE, LAYER):
        raise ValueError(f"Unknown request kind {kind!r}.")
    if not isinstance(sent_args, dict):
        raise SavedSettingsMismatch("The request's args are not an object.")
    arg_types = arg_types or {}
    run_args = {}
    for name, saved in saved_args.items():
        arg_type = arg_types.get(name)
        row = classify_arg(saved, arg_type, kind)
        dated = kind == TILE and _is_date_type(arg_type)
        run_args[name] = _overlay(row, saved, sent_args.get(name, _MISSING), dated)
    return run_args
