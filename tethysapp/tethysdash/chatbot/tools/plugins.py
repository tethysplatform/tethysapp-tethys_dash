"""Dashboard-manipulation tools for the chat agent."""
import json
import intake
import uuid as uuid_lib
from typing import Any

from pydantic_ai import RunContext, ModelRetry

from tethysapp.tethysdash.model import get_dashboards, update_named_dashboard
from ..utils import emit_progress
from ..models import ChatDeps, PluginSpec

def _is_visualization_plugin(plugin_cls) -> bool:
    """True for TethysDash visualization plugins; False for generic intake drivers."""
    return hasattr(plugin_cls, "visualization_type") 


def _plugin_attr(plugin_cls, name: str, default=None):
    """Read a plugin attribute supporting both new (``args``) and legacy
    (``visualization_args``) names."""
    if hasattr(plugin_cls, f"visualization_{name}"):
        return getattr(plugin_cls, f"visualization_{name}")
    if hasattr(plugin_cls, name):
        return getattr(plugin_cls, name)
    return default

def list_visualization_plugins() -> list[PluginSpec]:
    specs = []
    for name in sorted(intake.source.registry):
        cls = intake.source.registry[name]
        if not _is_visualization_plugin(cls):
            continue
        specs.append(PluginSpec(
            source=name,
            viz_type=str(_plugin_attr(cls, "type", "?")),
            args=_plugin_attr(cls, "args", {}) or {},
            description=(_plugin_attr(cls, "description", "") or "").strip(),
        ))
    return specs

def get_plugin(source: str) -> PluginSpec | None:
    for spec in list_visualization_plugins():
        if spec.source == source:
            return spec
    return None

def format_catalog_for_llm() -> str:
    specs = list_visualization_plugins()
    if not specs:
        return "No visualization plugins are installed."
    blocks = []
    for s in specs:
        args_line = ", ".join(s.args) if s.args else "(none)"
        desc = s.description or "(no description)"
        blocks.append(
            f"**{s.source}** ({s.viz_type})\n"
            f"  args: {args_line}\n"
            f"  {desc}"
        )
    return "\n\n".join(blocks)

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
        if ctx.retry >= ctx.max_retries:
            example = next(iter(spec.args))
            return (
                f"The **{source}** plugin needs these arguments: "
                f"{', '.join(f'`{a}`' for a in spec.args)}. "
                f"Tell me the values and I'll add it - for example: "
                f"*add {source} with {example} = <value>*."
            )
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