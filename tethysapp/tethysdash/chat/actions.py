"""Commit handlers for pending chat proposals.

When a chat tool stages a side effect (via
``chat/pending.store_pending``), it produces a proposal dict with a
``"kind"`` field. On user confirmation the controller calls
``commit_proposal(user, proposal)`` and this module dispatches to the
matching handler based on ``kind``.

Adding a new proposal type: add a ``kind`` string, a handler function,
and an entry in the dispatch table below. Handlers must be sync and
return a user-facing success/failure string.
"""
from __future__ import annotations

import json
import uuid as uuid_lib
from typing import Any

from tethysapp.tethysdash.model import get_dashboards, update_named_dashboard


def commit_proposal(user: Any, proposal: dict[str, Any]) -> str:
    """Dispatch a pending proposal to the right handler."""
    kind = proposal.get("kind")
    handler = _HANDLERS.get(kind)
    if handler is None:
        return f"Cannot commit proposal - unknown kind {kind!r}."
    return handler(user, proposal)


def _commit_add_map_tile(user: Any, proposal: dict[str, Any]) -> str:
    dashboard_id = proposal["dashboard_id"]
    dashboard = get_dashboards(user, id=dashboard_id, dashboard_view=True)
    tabs = list(dashboard.get("tabs", []))
    if not tabs:
        return f"Dashboard {dashboard_id} has no tabs; cannot add a tile."

    active_tab = dict(tabs[0])
    new_tile = {
        "uuid": str(uuid_lib.uuid4()),
        "i": str(uuid_lib.uuid4())[:8],
        "source": "Map",
        "args_string": json.dumps(proposal["args"]),
        "metadata_string": "{}",
        "x": 0,
        "y": 0,
        "w": proposal.get("w", 60),
        "h": proposal.get("h", 45),
    }
    active_tab["gridItems"] = list(active_tab.get("gridItems", [])) + [new_tile]
    tabs[0] = active_tab
    update_named_dashboard(user, dashboard_id, {"tabs": tabs})

    return f"Added map to dashboard {dashboard_id}."


_HANDLERS = {
    "add_map_tile": _commit_add_map_tile,
}
