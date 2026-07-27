"""Shared read/write access to a dashboard's visualization tiles."""
from tethysapp.tethysdash.model import get_dashboards, update_named_dashboard


def load_dashboard_tabs(user, dashboard_id):
    """Return the dashboard's tabs list, or an empty list when it has none."""
    dashboard = get_dashboards(user, id=dashboard_id, dashboard_view=True)
    return list(dashboard.get("tabs", []))


def save_dashboard_tabs(user, dashboard_id, tabs) -> None:
    """Persist the dashboard's tabs list."""
    update_named_dashboard(user, dashboard_id, {"tabs": tabs})


def list_tiles(tabs):
    """Return every grid-item across all tabs as ``(tab_index, item_index, tile)``.

    The order is stable so a caller can address a tile by its position and
    write the change back to the correct tab.
    """
    tiles = []
    for tab_index, tab in enumerate(tabs):
        for item_index, tile in enumerate(tab.get("gridItems", [])):
            tiles.append((tab_index, item_index, tile))
    return tiles
