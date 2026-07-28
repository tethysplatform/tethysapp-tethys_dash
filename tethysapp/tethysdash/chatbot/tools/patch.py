"""Chat tool for changing the arguments of an existing dashboard visualization.

Tiles are targeted by their plugin ``source`` name, not by a number. Weak models
reliably extract the source and the new value from a request but cannot map a
description to a 1-based index or judge ambiguity, so matching and
disambiguation are done here in deterministic code - the model never counts.
"""
import hashlib
import json
import re
from typing import Any

from pydantic_ai import ModelRetry, RunContext

from ..models import ChatDeps
from ..utils import emit_progress
from .catalog import get_plugin
from .dashboard import list_tiles, load_dashboard_tabs, save_dashboard_tabs

_ARG_NAME_RE = re.compile(r"^[A-Za-z0-9_.]+$")


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
    same-source tile carries it. Values in ``exclude`` (the new values being
    set) are ignored, so a new value that happens to equal other tiles' current
    values does not count as a selector. Returns None when zero or several
    tiles match.
    """
    if not prompt:
        return None
    skip = {str(value) for value in exclude}
    hits = [
        entry
        for entry in matches
        if any(
            str(v) and str(v) in prompt and str(v) not in skip
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
        "mean? Reply with the number, 'all', or 'cancel':\n"
        f"{lines}"
    )


def candidate_signature(matches) -> tuple[list, str]:
    """Ordered ``(tab, item)`` identities plus a content hash for matched tiles.

    The identities let a follow-up resolve a numbered pick to the exact tile; the
    hash lets the resolver detect that the dashboard changed since the ask.
    """
    ids = [[tab, item] for tab, item, _tile in matches]
    blob = json.dumps(
        [[t.get("source"), t.get("args_string")] for _tab, _item, t in matches],
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


def patch_visualization(
    ctx: RunContext[ChatDeps],
    source: str,
    args: dict[str, Any],
    where: dict[str, Any] | None = None,
) -> str:
    """Change the arguments of a visualization already on the dashboard.

    Args:
        source: The plugin source name of the tile to change, taken from the
            'Current visualizations' list in this system prompt.
        args: The NEW argument values to set, merged into the tile's existing
            arguments; arguments not listed here are left unchanged. Only put
            the values the user asked for - never copy a tile's current values.
        where: Optional current argument values used to pick a single tile when
            several tiles share the same source.
    """
    if not ctx.deps.can_add_visualizations:
        return "Only the dashboard owner can change visualizations on this dashboard."

    tabs = load_dashboard_tabs(ctx.deps.user, ctx.deps.dashboard_id)
    tiles = list_tiles(tabs)
    if not tiles:
        return "There are no visualizations on the dashboard to change yet."
    if not args:
        raise ModelRetry("Provide the argument values to set in 'args'.")

    matches = _matching_tiles(tiles, source)
    if not matches:
        raise ModelRetry(
            f"No visualization named '{source}'. The dashboard has: "
            f"{_distinct_sources(tiles)}."
        )
    if where:
        matches = _filter_by_where(matches, where)
        if not matches:
            return (
                f"No {source} visualization matches those current values. "
                f"Its tiles are:\n{_format_tiles(_matching_tiles(tiles, source))}"
            )
    if len(matches) > 1:
        auto = _auto_select(matches, ctx.deps.original_prompt, args.values())
        matches = [auto] if auto is not None else matches
    if len(matches) > 1:
        from ..disambiguation import PendingDisambiguation, set_pending

        candidates, version = candidate_signature(matches)
        set_pending(
            ctx.deps.dashboard_id,
            ctx.deps.user,
            PendingDisambiguation(
                source=source,
                args=args,
                candidates=candidates,
                version=version,
                where=where or {},
            ),
        )
        return _disambiguation_reply(source, matches)

    _tab, _item, tile = matches[0]
    real_source = tile.get("source")
    err = check_args(real_source, args)
    if err:
        return err
    if _is_noop(tile, args):
        return (
            f"{real_source} already has {_pairs(args)}, so nothing changed. If "
            "you meant a different value, tell me the new one."
        )

    emit_progress(ctx.deps.chat_id, f"Updating {real_source}...")
    _apply_arg_changes(tile, args)
    save_dashboard_tabs(ctx.deps.user, ctx.deps.dashboard_id, tabs)
    from ..disambiguation import clear_pending

    clear_pending(ctx.deps.dashboard_id, ctx.deps.user)
    return f"Updated {real_source}: {_pairs(args)}."
