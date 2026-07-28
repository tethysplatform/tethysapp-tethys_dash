"""Chat tool for adding visualization tiles to the active dashboard."""
import json
import math
import uuid as uuid_lib
from typing import Any, List

from pydantic_ai import ModelRetry, RunContext

from ..models import ChatDeps, PluginRequest, PluginSpec
from ..utils import emit_progress
from .catalog import format_catalog_for_llm, get_plugin, list_visualization_plugins
from .dashboard import load_dashboard_tabs, save_dashboard_tabs
from .tile_ops import _tile_args


def arg_is_blank(value: Any) -> bool:
    """Return True when a supplied arg value carries no usable input.

    Weak models often include a required key with an empty placeholder
    (``""``, ``{}``, ``[]``, ``None``) instead of omitting it; that is still
    missing input and must trigger the ask-for-args flow, not a broken tile.
    """
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, (dict, list, tuple, set)):
        return len(value) == 0
    return False


def missing_required_args(spec: PluginSpec, args: dict) -> list[str]:
    """Return the sorted names of a plugin's required args that are absent or blank."""
    return sorted(name for name in spec.args if arg_is_blank(args.get(name)))


def build_tile(source: str, args: dict) -> dict:
    """Build a single dashboard grid-item for a plugin visualization."""
    return {
        "uuid": str(uuid_lib.uuid4()),
        "i": str(uuid_lib.uuid4())[:8],
        "source": source,
        "args_string": json.dumps(args),
        "metadata_string": "{}",
        "x": 0,
        "y": 0,
        "w": 50,
        "h": 40,
    }


_STRING_ARG_TYPES = {"text", "dropdown", "date", "date-range", "csv-uploader", "textarea"}
_NUMBER_ARG_TYPES = {"number", "slider"}


def _normalize_arg_value(value: Any, declared_type: Any) -> Any:
    """Coerce one arg value to its plugin-declared type so equal values store alike.

    A weak model may send the same logical value two ways (``441057380`` and
    ``"441057380"``); storing per the plugin's declared arg type gives one
    canonical representation. Only scalars are canonicalized - dicts and lists
    (e.g. date-range) are returned untouched, as are types the plugin does not
    declare. Non-finite numbers (NaN/Infinity) are stringified so they cannot
    serialize to invalid JSON and break the dashboard load.
    """
    if not isinstance(value, (str, int, float, bool)):
        return value
    kind = str(declared_type).strip().lower()
    if kind in _STRING_ARG_TYPES:
        return value if isinstance(value, str) else str(value)
    if kind in _NUMBER_ARG_TYPES:
        try:
            number = float(value)
        except (TypeError, ValueError):
            return value
        if not math.isfinite(number):
            return str(value)
        return int(number) if number.is_integer() else number
    return value


def _normalize_args(spec: PluginSpec | None, args: dict) -> dict:
    """Return args with each value coerced to its plugin-declared type."""
    if not spec:
        return dict(args)
    return {
        name: (_normalize_arg_value(value, spec.args[name]) if name in spec.args else value)
        for name, value in args.items()
    }


def _dedup_key(source: str, args: dict) -> tuple:
    """A source + canonical-args key for detecting duplicate tiles."""
    return (source, json.dumps(args, sort_keys=True))


def _existing_tile_key(tile: dict) -> tuple:
    """Dedup key for a tile already stored on the dashboard (type-normalized)."""
    source = tile.get("source")
    spec = get_plugin(source) if source else None
    return _dedup_key(source, _normalize_args(spec, _tile_args(tile)))


def append_new_tiles(
    user: object,
    dashboard_id: int,
    candidates: list[tuple[PluginSpec, dict]],
) -> tuple[list[PluginSpec], list[PluginSpec]]:
    """Append candidate ``(spec, tile)`` pairs, skipping duplicates, in one read.

    Dedupe and the read-modify-write share a single load so this request cannot
    slip a duplicate past its own stale read. It is not a cross-request lock:
    two concurrent writers (or a chat turn racing a manual edit) can still
    interleave, since the underlying save replaces the whole tab. Returns
    ``(added, skipped)`` spec lists.

    Raises:
        ModelRetry: when the dashboard has no tabs to place a tile on.
    """
    tabs = load_dashboard_tabs(user, dashboard_id)
    if not tabs:
        raise ModelRetry(f"Dashboard {dashboard_id} has no tabs; cannot add a tile.")
    active_tab = dict(tabs[0])
    existing = list(active_tab.get("gridItems", []))
    seen = {_existing_tile_key(tile) for tile in existing}
    added, skipped, new_tiles = [], [], []
    for spec, tile in candidates:
        key = _dedup_key(spec.source, _tile_args(tile))
        if key in seen:
            skipped.append(spec)
        else:
            seen.add(key)
            added.append(spec)
            new_tiles.append(tile)
    if new_tiles:
        active_tab["gridItems"] = existing + new_tiles
        tabs[0] = active_tab
        save_dashboard_tabs(user, dashboard_id, tabs)
    return added, skipped


def _resolve_requests(requests: List[PluginRequest]):
    """Split requests into resolved ``(spec, args)`` pairs and unknown source names."""
    resolved = []
    unknown = []
    for req in requests:
        spec = get_plugin(req.source)
        if spec is None:
            unknown.append(req.source)
        else:
            resolved.append((spec, req.args or {}))
    return resolved, unknown


def _unknown_sources_reply(ctx: RunContext[ChatDeps], unknown: list[str]) -> str:
    """Respond to unrecognised plugin sources.

    Raises:
        ModelRetry: while retries remain, so the model can self-correct the names.
    """
    listed = ", ".join(f"{source!r}" for source in unknown)
    if ctx.retry >= ctx.max_retries:
        names = ", ".join(f"`{spec.source}`" for spec in list_visualization_plugins())
        return f"I couldn't match {listed} to an available plugin. You can add any of: {names}."
    raise ModelRetry(
        f"Unknown plugin source(s): {listed}. Choose from the catalog and retry:\n"
        f"{format_catalog_for_llm()}"
    )


def _plugins_needing_args(resolved) -> list[tuple[PluginSpec, list[str]]]:
    """Return ``(spec, missing-arg-names)`` for each resolved plugin missing required args."""
    needing = []
    for spec, args in resolved:
        missing = missing_required_args(spec, args)
        if missing:
            needing.append((spec, missing))
    return needing


def _missing_args_reply(needing: list[tuple[PluginSpec, list[str]]]) -> str:
    """Ask the user for the arguments the named plugins still need."""
    lines = []
    for spec, missing in needing:
        example = missing[0]
        arg_list = ", ".join(f"`{name}`" for name in spec.args)
        lines.append(
            f"**{spec.source}** needs {arg_list} "
            f"(e.g. *{spec.source} with {example} = <value>*)"
        )
    return "Some plugins still need arguments before I can add them:\n" + "\n".join(lines)


def _added_summary(added, skipped, dashboard_id: int) -> str:
    """Confirm what was added and name any duplicates that were skipped."""
    parts = []
    if added:
        names = ", ".join(f"'{spec.source}' ({spec.viz_type})" for spec in added)
        parts.append(f"Added {names} to dashboard {dashboard_id}.")
    if skipped:
        names = ", ".join(f"'{spec.source}'" for spec in skipped)
        parts.append(f"Skipped {names} - already on the dashboard.")
    return " ".join(parts) or f"Nothing to add to dashboard {dashboard_id}."


def add_visualizations_from_plugin(
    ctx: RunContext[ChatDeps],
    visualizations: List[PluginRequest],
) -> str:
    """Add one or more visualization tiles to the active dashboard.

    Args:
        visualizations: The plugins to add, each with a ``source`` (a plugin
            name from the catalog) and its ``args`` object. Pass ``{}`` for
            plugins that require no arguments.
    """
    if not ctx.deps.can_add_visualizations:
        return "Only the dashboard owner can add visualizations to this dashboard."
    if not visualizations:
        raise ModelRetry("Provide at least one plugin to add in 'visualizations'.")

    emit_progress(ctx.deps.chat_id, "Looking up plugins...")
    resolved, unknown = _resolve_requests(visualizations)
    if unknown:
        return _unknown_sources_reply(ctx, unknown)

    needing = _plugins_needing_args(resolved)
    if needing:
        return _missing_args_reply(needing)

    candidates = [
        (spec, build_tile(spec.source, _normalize_args(spec, args)))
        for spec, args in resolved
    ]
    emit_progress(
        ctx.deps.chat_id,
        f"Placing visualization(s) on dashboard {ctx.deps.dashboard_id}...",
    )
    added, skipped = append_new_tiles(ctx.deps.user, ctx.deps.dashboard_id, candidates)
    return _added_summary(added, skipped, ctx.deps.dashboard_id)
