"""Dashboard-manipulation tools for the chat agent."""
import json
import uuid as uuid_lib
from typing import Any

from pydantic_ai import RunContext, ModelRetry

from tethysapp.tethysdash.model import get_dashboards, update_named_dashboard
from ..plugins import format_catalog_for_llm, get_plugin
from ..streaming import emit_progress
from ..validation import ChatDeps

def add_visualization_from_plugin(
    ctx: RunContext[ChatDeps],
    source: str,
    args: dict[str, Any] | None = None,
) -> str:
    """Add a visualization tile to the active dashboard.

    Args:
        source: Registered intake plugin name. On an unknown value the
            error message lists every available option.
        args: Plugin-specific argument object. Pass an empty object for
            plugins that require no arguments. Keys and value types are
            defined by the plugin's own arg schema.
    """
    # Deterministic authorization gate - the router already hides this
    # candidate from non-owners (UX steering), but the schema is not a
    # security boundary; this check is. update_named_dashboard enforces
    # editor/admin again at the model layer (defense in depth).
    if not ctx.deps.can_add_visualizations:
        return (
            "Only the dashboard owner can add visualizations to this "
            "dashboard."
        )

    args = args or {}
    if not isinstance(args, dict):
        raise ModelRetry(
            f"args must be an object, got {type(args).__name__}."
        )

    emit_progress(ctx.deps.chat_id, f"Looking up plugin {source!r}...")
    spec = get_plugin(source)
    if spec is None:
        raise ModelRetry(
            f"Unknown plugin source {source!r}. Choose one and retry:\n"
            f"{format_catalog_for_llm()}"
        )

    missing = sorted(set(spec.args) - set(args))
    if missing:
        raise ModelRetry(
            f"Missing required args for {source!r}: {missing}. "
            f"Expected: {sorted(spec.args)}. Got: {sorted(args)}."
        )

    user = ctx.deps.user
    dashboard_id = ctx.deps.dashboard_id
    dashboard = get_dashboards(user, id=dashboard_id, dashboard_view=True)
    tabs = list(dashboard.get("tabs", []))
    if not tabs:
        raise ModelRetry(f"Dashboard {dashboard_id} has no tabs; cannot add a tile.")

    active_tab = dict(tabs[0])
    new_tile = {
        "uuid": str(uuid_lib.uuid4()),
        "i": str(uuid_lib.uuid4())[:8],
        "source": source,
        "args_string": json.dumps(args),
        "metadata_string": "{}",
        "x": 0, "y": 0, "w": 50, "h": 40,
    }
    active_tab["gridItems"] = list(active_tab.get("gridItems", [])) + [new_tile]
    tabs[0] = active_tab
    emit_progress(ctx.deps.chat_id, f"Placing {source!r} on dashboard {dashboard_id}...")
    update_named_dashboard(user, dashboard_id, {"tabs": tabs})

    return f"Added '{source}' ({spec.viz_type}) to dashboard {dashboard_id}."