"""Shared loader for the runtime plugin registry.

The registry is a JSON file under ``reactapp/generated/`` persisted from
browser state (``runtimePluginRegistry.json``) — written when the user
registers a Module Federation remote plugin via the chatbox or the
``register_runtime_plugin`` MCP tool.

Currently consumed by ``tethysdash_mcp_server.py`` only. The module is
preserved as a focused loader so the JSON-read concern stays out of the
MCP server file and so a future runtime-remote editability resolver in
``editable_schemas_plugin.py`` can read the same registry without
re-implementing the I/O.

Returned shape: ``List[Dict[str, Any]]`` — a list of plugin entries, NOT
a dict keyed by source. Consumers that need lookup by source should
iterate or build their own lookup.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

LOGGER = logging.getLogger(__name__)

_RUNTIME_REGISTRY_PATH = os.path.normpath(
    os.path.join(
        os.path.dirname(__file__),
        "..",
        "..",
        "reactapp",
        "generated",
        "runtimePluginRegistry.json",
    )
)


def load_runtime_plugin_registry() -> List[Dict[str, Any]]:
    """Load the runtime plugin registry synced from browser localStorage."""
    try:
        with open(_RUNTIME_REGISTRY_PATH, "r") as f:
            registry = json.load(f)
        LOGGER.info(
            "Loaded %d runtime plugin(s) from %s",
            len(registry),
            _RUNTIME_REGISTRY_PATH,
        )
        return registry
    except FileNotFoundError:
        return []
    except json.JSONDecodeError as e:
        LOGGER.warning("Invalid JSON in runtime plugin registry: %s", e)
        return []
