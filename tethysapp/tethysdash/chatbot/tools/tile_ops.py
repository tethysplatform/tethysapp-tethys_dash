"""Shared tile matching, formatting, validation, and apply helpers.

Used by both the patch tool (tools/patch.py) and the disambiguation resolver
(chatbot/disambiguation.py). Kept in one leaf module so neither of those has to
import the other, which would form a cycle.
"""
import hashlib
import json
import re

from .catalog import get_plugin
from .dashboard import list_tiles, load_dashboard_tabs

_ARG_NAME_RE = re.compile(r"^[A-Za-z0-9_.]+$")

# The visible disambiguation prompt ends with this phrase; the resolver uses it
# to confirm the immediately-preceding turn was actually a "which one?" ask.
DISAMBIGUATION_MARKER = "Reply with the number, 'all', or 'cancel'"


def _tile_args(tile) -> dict:
    """Parse a tile's stored ``args_string`` into a dict, empty on any problem."""
    try:
        parsed = json.loads(tile.get("args_string") or "{}")
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _normalize(name) -> str:
    """Reduce a source name to comparable letters/digits (drop case, _, spaces)."""
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def _describe_tile(tile) -> str:
    """Format one tile as its source and current args (no index number)."""
    args = _tile_args(tile)
    args_line = ", ".join(f"{key}={value!r}" for key, value in args.items())
    return f"{tile.get('source', '?')} - args: {args_line or '(none)'}"


def _format_tiles(tiles) -> str:
    """Render tiles as a bullet list of source and current args."""
    if not tiles:
        return "The dashboard has no visualizations yet."
    return "\n".join(f"- {_describe_tile(tile)}" for _tab, _item, tile in tiles)


def format_dashboard_state_for_llm(user, dashboard_id) -> str:
    """Render the dashboard's current tiles as a source-keyed list for the model."""
    return _format_tiles(list_tiles(load_dashboard_tabs(user, dashboard_id)))


def _matching_tiles(tiles, source):
    """Return the ``(tab, item, tile)`` entries whose source matches ``source``."""
    query = _normalize(source)
    if not query:
        return []
    matches = []
    for entry in tiles:
        candidate = _normalize(entry[2].get("source"))
        if candidate and (query == candidate or query in candidate or candidate in query):
            matches.append(entry)
    return matches


def _distinct_sources(tiles) -> str:
    """Comma-list the distinct source names currently on the dashboard."""
    seen = []
    for _tab, _item, tile in tiles:
        source = tile.get("source")
        if source and source not in seen:
            seen.append(source)
    return ", ".join(f"`{source}`" for source in seen) or "(none)"


def _filter_by_where(matches, where):
    """Keep matches whose current args equal every key/value in ``where``."""
    return [
        entry
        for entry in matches
        if all(
            str(_tile_args(entry[2]).get(key)) == str(value)
            for key, value in where.items()
        )
    ]


def _auto_select(matches, prompt, exclude=()):
    """Return the one match whose current value the user named in the prompt.

    Resolves the common disambiguation case without a follow-up: when the user
    named a distinguishing current value (e.g. a river id), exactly one
    same-source tile carries it. A value that is a substring of one of the new
    values being set (``exclude``) does not count as a selector, so a new value
    that contains another tile's current value cannot auto-pick the wrong tile.
    Returns None when zero or several tiles match.
    """
    if not prompt:
        return None
    new_values = [str(value) for value in exclude]
    hits = [
        entry
        for entry in matches
        if any(
            str(v)
            and str(v) in prompt
            and not any(str(v) in new_value for new_value in new_values)
            for v in _tile_args(entry[2]).values()
        )
    ]
    return hits[0] if len(hits) == 1 else None


def _disambiguation_reply(source, matches) -> str:
    """Ask the user to pick among same-source tiles by number, 'all', or 'cancel'."""
    lines = "\n".join(
        f"{number}. {_describe_tile(tile)}"
        for number, (_tab, _item, tile) in enumerate(matches, start=1)
    )
    return (
        f"There are {len(matches)} {source} visualizations. Which one did you "
        f"mean? {DISAMBIGUATION_MARKER}:\n"
        f"{lines}"
    )


def candidate_signature(matches) -> tuple[list, str]:
    """Ordered ``(tab, item)`` identities plus a content hash for matched tiles.

    The identities let a follow-up resolve a numbered pick to the exact tile; the
    hash (which includes each tile's uuid) lets the resolver detect that the
    dashboard changed since the ask, even a delete-plus-identical-add swap.
    """
    ids = [[tab, item] for tab, item, _tile in matches]
    blob = json.dumps(
        [[t.get("uuid"), t.get("source"), t.get("args_string")] for _tab, _item, t in matches],
        sort_keys=True,
    )
    return ids, hashlib.sha1(blob.encode()).hexdigest()


def _invalid_arg_names(source, args) -> list[str]:
    """Return supplied arg names the tile's plugin does not define, sorted."""
    spec = get_plugin(source) if source else None
    if spec is None:
        return []
    return sorted(name for name in args if name not in spec.args)


def _looks_like_corruption(names) -> bool:
    """True when any supplied name is not a plausible identifier (mangled JSON)."""
    return any(not _ARG_NAME_RE.match(str(name)) for name in names)


def _invalid_args_reply(source, invalid) -> str:
    """Respond to argument names the plugin does not define.

    When the names are plausible identifiers the model simply picked the wrong
    ones, so echoing them helps it self-correct. When they look like mangled
    JSON the model corrupted its own tool call, so echoing the garbage is
    useless - ask for a clean restatement instead.
    """
    spec = get_plugin(source)
    valid = ", ".join(f"`{name}`" for name in spec.args) if spec else "(unknown)"
    if _looks_like_corruption(invalid):
        return (
            f"I couldn't read the arguments for {source}. Please restate the "
            f"change naming the argument and its new value. Its arguments "
            f"are: {valid}."
        )
    listed = ", ".join(f"`{name}`" for name in invalid)
    return f"{source} has no argument(s) {listed}. Its arguments are: {valid}."


def check_args(source, args) -> str | None:
    """Return an error reply if args are invalid/corrupt for the source, else None."""
    invalid = _invalid_arg_names(source, args)
    return _invalid_args_reply(source, invalid) if invalid else None


def _pairs(args) -> str:
    """Format an args dict as a human-readable ``k=v, ...`` string."""
    return ", ".join(f"{key}={value!r}" for key, value in args.items())


def _apply_arg_changes(tile, args) -> None:
    """Merge new argument values into the tile's ``args_string`` in place."""
    tile["args_string"] = json.dumps({**_tile_args(tile), **args})


def _is_noop(tile, args) -> bool:
    """True when every supplied value already equals the tile's current value.

    Weak models sometimes echo a tile's current argument (copied from the
    'Current visualizations' list) instead of the user's new value; treating
    that as a no-op avoids a misleading 'Updated' confirmation.
    """
    current = _tile_args(tile)
    return all(str(current.get(key)) == str(value) for key, value in args.items())
