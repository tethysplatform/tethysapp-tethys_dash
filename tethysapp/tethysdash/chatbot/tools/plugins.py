"""Chat tool for adding visualization tiles to the active dashboard."""
import json
import uuid as uuid_lib
from typing import Any, List

from pydantic_ai import ModelRetry, RunContext

from ..models import ChatDeps, PluginRequest, PluginSpec
from ..utils import emit_progress
from .catalog import format_catalog_for_llm, get_plugin, list_visualization_plugins
from .dashboard import load_dashboard_tabs, save_dashboard_tabs


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


def append_tiles_to_dashboard(user, dashboard_id: int, tiles: list[dict]) -> None:
    """Append tiles to the dashboard's first tab in one read-modify-write.

    Raises:
        ModelRetry: when the dashboard has no tabs to place tiles on.
    """
    tabs = load_dashboard_tabs(user, dashboard_id)
    if not tabs:
        raise ModelRetry(f"Dashboard {dashboard_id} has no tabs; cannot add a tile.")
    active_tab = dict(tabs[0])
    active_tab["gridItems"] = list(active_tab.get("gridItems", [])) + tiles
    tabs[0] = active_tab
    save_dashboard_tabs(user, dashboard_id, tabs)


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


def _added_summary(resolved, dashboard_id: int) -> str:
    """Build the confirmation message listing the visualizations that were added."""
    added = ", ".join(f"'{spec.source}' ({spec.viz_type})" for spec, _ in resolved)
    return f"Added {added} to dashboard {dashboard_id}."


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

    tiles = [build_tile(spec.source, args) for spec, args in resolved]
    emit_progress(
        ctx.deps.chat_id,
        f"Placing {len(tiles)} visualization(s) on dashboard {ctx.deps.dashboard_id}...",
    )
    append_tiles_to_dashboard(ctx.deps.user, ctx.deps.dashboard_id, tiles)
    return _added_summary(resolved, ctx.deps.dashboard_id)
