"""Dashboard-manipulation tools for the chat agent.

These functions are discovered by ``tethys_agents.discover()`` when the
operator includes ``"tethysapp.tethysdash"`` in ``settings.AGENT_TOOL_PACKAGES``.
The convention is: any public, type-annotated function in this module
becomes an LLM-callable tool — no ``@tool`` decorator required.

The two we expose are intentionally generic so they work with **any**
intake-registered visualization plugin without per-plugin glue:

* :func:`add_visualization_from_plugin` — add a tile pointing at any
  registered plugin source with arbitrary args.
* :func:`list_available_plugins` — surface the catalog the LLM should pick
  ``source`` values from.

The active user + dashboard come from the :data:`current_dashboard`
``ContextVar``, which the ``chat_agent`` controller sets before invoking
the agent. This keeps the tools' signatures simple (no LLM-visible user /
dashboard fields) while letting them mutate the right user's dashboard.
"""

import contextvars
import json
import uuid as uuid_lib

import intake

from tethysapp.tethysdash.model import get_dashboards, update_named_dashboard


# Holds the {"user": <User>, "dashboard_id": <int>} dict scoped to the
# current chat turn. The controller sets it; the tools read it.
current_dashboard: contextvars.ContextVar = contextvars.ContextVar(
    "current_dashboard", default=None
)


def _is_visualization_plugin(plugin_cls) -> bool:
    """True for TethysDash visualization plugins; False for generic intake drivers."""
    return hasattr(plugin_cls, "visualization_type") or hasattr(plugin_cls, "type")


def _plugin_attr(plugin_cls, name: str, default=None):
    """Read a plugin attribute supporting both new (``args``) and legacy
    (``visualization_args``) names."""
    if hasattr(plugin_cls, f"visualization_{name}"):
        return getattr(plugin_cls, f"visualization_{name}")
    if hasattr(plugin_cls, name):
        return getattr(plugin_cls, name)
    return default


def add_visualization_from_plugin(source: str, args_json: str) -> str:
    """Add a visualization tile to the active dashboard.

    Call ``list_available_plugins`` first to see what ``source`` values are
    valid and what args each one expects.

    Args:
        source: The intake plugin's registered name (e.g.
            ``"geoglows_forecast_viewer"``, ``"rfc_river_streamflow"``).
        args_json: JSON-encoded dict of args for the plugin (e.g.
            ``'{"river_id": "610217883"}'``). Pass ``"{}"`` for plugins
            with no required args. Keys must match the plugin's
            ``visualization_args`` schema.
    """
    ctx = current_dashboard.get()
    if ctx is None:
        return (
            "No active dashboard in the chat context. Open a dashboard in "
            "tethysdash before asking the agent to add a tile."
        )

    try:
        args = json.loads(args_json or "{}")
    except json.JSONDecodeError as exc:
        return f"Invalid args_json (must be a JSON object): {exc}"
    if not isinstance(args, dict):
        return (
            f"args_json must decode to a dict, got {type(args).__name__}. "
            "Example: '{\"river_id\": \"610217883\"}'."
        )

    if source not in intake.source.registry:
        candidates = sorted(
            name
            for name, cls in intake.source.registry.items()
            if _is_visualization_plugin(cls)
        )
        return f"Unknown plugin source '{source}'. Available: {candidates}"

    user = ctx["user"]
    dashboard_id = ctx["dashboard_id"]
    dashboard = get_dashboards(user, id=dashboard_id, dashboard_view=True)
    tabs = list(dashboard.get("tabs", []))
    if not tabs:
        return (
            f"Dashboard {dashboard_id} has no tabs; cannot add a tile. "
            "Ask the user to create a tab first."
        )

    # Append to the first tab. Multi-tab routing (which tab the user is
    # currently viewing) is a v0.2 concern — for v0.1 the workshop
    # convention is single-tab dashboards.
    active_tab = dict(tabs[0])  # shallow copy so we don't mutate the cached dict
    new_tile = {
        "uuid": str(uuid_lib.uuid4()),
        "i": str(uuid_lib.uuid4())[:8],  # display index; overwritten server-side
        "source": source,
        "args_string": json.dumps(args),
        "metadata_string": "{}",
        "x": 0,
        "y": 0,
        "w": 6,
        "h": 4,
    }
    active_tab["gridItems"] = list(active_tab.get("gridItems", [])) + [new_tile]
    tabs[0] = active_tab

    # update_named_dashboard's tabs branch (model.py:876) reads `id`,
    # `name`, `gridItems` per tab and `uuid`, `i`, `x/y/w/h`, `source`,
    # `args_string`, `metadata_string` per grid item. Missing any of those
    # raises KeyError, so we send the full tabs structure verbatim.
    update_named_dashboard(user, dashboard_id, {"tabs": tabs})

    return (
        f"Added '{source}' tile (args={args}) to dashboard {dashboard_id}. "
        "The user will see it after the dashboard refreshes."
    )


def list_available_plugins() -> str:
    """List the intake visualization plugins available on this server.

    Returns a multi-line summary of plugin name, type, args, and a short
    description. Use the output to pick a ``source`` and construct a valid
    ``args_json`` for :func:`add_visualization_from_plugin`.
    """
    lines = []
    for name in sorted(intake.source.registry):
        plugin_cls = intake.source.registry[name]
        if not _is_visualization_plugin(plugin_cls):
            continue

        viz_type = _plugin_attr(plugin_cls, "type", "?")
        viz_args = _plugin_attr(plugin_cls, "args", {}) or {}
        description = (_plugin_attr(plugin_cls, "description", "") or "").strip()
        first_line = description.split("\n")[0][:80]
        arg_names = list(viz_args.keys()) if isinstance(viz_args, dict) else []
        lines.append(f"- {name} ({viz_type}) — args={arg_names} — {first_line}")

    if not lines:
        return "No visualization plugins are installed on this server."
    return "\n".join(lines)
