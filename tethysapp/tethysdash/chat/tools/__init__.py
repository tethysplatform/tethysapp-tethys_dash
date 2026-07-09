"""Chat tools, split by domain.

Re-exports keep the flat ``from ..tools import ...`` import shape working
for callers after the module became a package. Add new tool modules
alongside ``plugins_tools.py`` and re-export their public names here.

Map tools live on the ``feat/map-agent`` branch — parked until the
routing model is capable enough to carry them (see memory:
chat-map-tools-mcp-consumption-trigger).
"""
from .plugins_tools import add_visualization_from_plugin

__all__ = [
    "add_visualization_from_plugin",
]
