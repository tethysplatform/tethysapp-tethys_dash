"""Dashboard-manipulation tools for the chat agent."""
import json
import uuid as uuid_lib

from pydantic_ai import RunContext, ModelRetry

from tethysapp.tethysdash.model import get_dashboards, update_named_dashboard
from .plugins import format_catalog_for_llm, get_plugin
from .validation import ChatDeps


def add_visualization_from_plugin(
    ctx: RunContext[ChatDeps],
    source: str,
    args_json: str,
) -> str:
    """Add a visualization tile to the active dashboard.

    Args:
        source: Registered intake plugin name. On an unknown value the
            error message lists every available option.
        args_json: JSON-encoded dict of args the plugin expects. Pass "{}"
            for plugins with no required args.
    """
    try:
        args = json.loads(args_json or "{}")
    except json.JSONDecodeError as exc:
        raise ModelRetry(f"args_json must be valid JSON. Got {args_json!r}. {exc}")
    if not isinstance(args, dict):
        raise ModelRetry(
            f"args_json must decode to a JSON object, got {type(args).__name__}."
        )

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
    update_named_dashboard(user, dashboard_id, {"tabs": tabs})

    return f"Added '{source}' ({spec.viz_type}) to dashboard {dashboard_id}."
