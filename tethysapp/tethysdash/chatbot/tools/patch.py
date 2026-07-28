"""Chat tool for changing the arguments of an existing dashboard visualization.

Tiles are targeted by their plugin ``source`` name, not a number. The shared
matching / validation / apply helpers live in tools/tile_ops.py so this module
and the disambiguation resolver can both use them without importing each other.
"""
from typing import Any

from pydantic_ai import ModelRetry, RunContext

from ..disambiguation import PendingDisambiguation, clear_pending, get_pending, set_pending
from ..models import ChatDeps
from ..utils import emit_progress
from .dashboard import list_tiles, load_dashboard_tabs, save_dashboard_tabs
from .tile_ops import (
    _apply_arg_changes,
    _auto_select,
    _disambiguation_reply,
    _distinct_sources,
    _filter_by_where,
    _format_tiles,
    _is_noop,
    _matching_tiles,
    _pairs,
    candidate_signature,
    check_args,
    format_dashboard_state_for_llm,
)

__all__ = ["patch_visualization", "format_dashboard_state_for_llm"]


def _clear_matching_pending(deps, patched_id) -> None:
    """Clear a pending disambiguation only if it targeted the just-patched tile.

    Scoped to the exact ``(tab, item)`` identity, not a fuzzy source-name match:
    a successful patch of ``chart_widget`` must not discard an unanswered "which
    one?" question about a different, substring-related source like ``chart``.
    """
    record = get_pending(deps.dashboard_id, deps.user)
    if record is not None and list(patched_id) in record.candidates:
        clear_pending(deps.dashboard_id, deps.user)


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

    tab, item, tile = matches[0]
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
    _clear_matching_pending(ctx.deps, (tab, item))
    return f"Updated {real_source}: {_pairs(args)}."
