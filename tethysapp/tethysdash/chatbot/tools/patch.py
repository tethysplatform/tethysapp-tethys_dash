"""Chat tool for changing the arguments of an existing dashboard visualization."""
import json
import re
from typing import Any, List

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


def _describe_tile(number: int, tile) -> str:
    """Format one numbered tile line: its number, source, and current args."""
    args = _tile_args(tile)
    args_line = ", ".join(f"{key}={value!r}" for key, value in args.items())
    return f"{number}. {tile.get('source', '?')} - args: {args_line or '(none)'}"


def _format_tiles(tiles) -> str:
    """Render a list of ``(tab, item, tile)`` as a 1-indexed Markdown list."""
    if not tiles:
        return "The dashboard has no visualizations yet."
    return "\n".join(
        _describe_tile(number, tile)
        for number, (_tab, _item, tile) in enumerate(tiles, start=1)
    )


def format_dashboard_state_for_llm(user, dashboard_id) -> str:
    """Render the dashboard's current tiles as a 1-indexed list for the model."""
    return _format_tiles(list_tiles(load_dashboard_tabs(user, dashboard_id)))


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
        example = next(iter(spec.args), "<arg>") if spec else "<arg>"
        return (
            f"I couldn't read the arguments for {source}. Please restate the "
            f"change, for example: *change #<number> {example} = <value>*. "
            f"Its arguments are: {valid}."
        )
    listed = ", ".join(f"`{name}`" for name in invalid)
    return f"{source} has no argument(s) {listed}. Its arguments are: {valid}."


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
    target: int,
    args: dict[str, Any],
) -> str:
    """Change the arguments of one visualization already on the dashboard.

    Args:
        target: The 1-based number of the tile to change, as shown in the
            'Current visualizations' list in this system prompt.
        args: The argument values to set, merged into the tile's existing
            arguments; arguments not listed here are left unchanged.
    """
    if not ctx.deps.can_add_visualizations:
        return "Only the dashboard owner can change visualizations on this dashboard."

    tabs = load_dashboard_tabs(ctx.deps.user, ctx.deps.dashboard_id)
    tiles = list_tiles(tabs)
    if not tiles:
        return "There are no visualizations on the dashboard to change yet."
    if not isinstance(target, int) or not 1 <= target <= len(tiles):
        raise ModelRetry(
            f"'target' must be a number between 1 and {len(tiles)} "
            "(see the 'Current visualizations' list)."
        )
    if not args:
        raise ModelRetry("Provide the argument values to set in 'args'.")

    _tab, _item, tile = tiles[target - 1]
    source = tile.get("source")
    invalid = _invalid_arg_names(source, args)
    if invalid:
        return _invalid_args_reply(source, invalid)
    if _is_noop(tile, args):
        pairs = ", ".join(f"{key}={value!r}" for key, value in args.items())
        return (
            f"{source} (#{target}) already has {pairs}, so nothing changed. If "
            "you meant a different value, tell me the new one."
        )

    emit_progress(ctx.deps.chat_id, f"Updating visualization {target}...")
    _apply_arg_changes(tile, args)
    save_dashboard_tabs(ctx.deps.user, ctx.deps.dashboard_id, tabs)
    changed = ", ".join(f"{key}={value!r}" for key, value in args.items())
    return f"Updated {source} (#{target}): {changed}."


def ask_which_visualization(
    ctx: RunContext[ChatDeps],
    candidates: List[int],
    reason: str,
) -> str:
    """Ask the user which visualization they meant when a description is ambiguous.

    Args:
        candidates: The 1-based numbers of the visualizations that match the
            user's description, from the 'Current visualizations' list.
        reason: A short explanation of why the choice is ambiguous.
    """
    tiles = list_tiles(load_dashboard_tabs(ctx.deps.user, ctx.deps.dashboard_id))
    valid = [n for n in candidates if isinstance(n, int) and 1 <= n <= len(tiles)]
    if len(valid) < 2:
        raise ModelRetry(
            "ask_which_visualization needs at least two valid candidate numbers "
            f"between 1 and {len(tiles)}."
        )
    numbers = " or ".join(str(number) for number in valid)
    return (
        f"{reason} Which one did you mean - {numbers}? All visualizations on the "
        f"dashboard are listed below; reply with the number and the change (for "
        f"example 'change {valid[0]} to <arg> = <value>'):\n{_format_tiles(tiles)}"
    )
