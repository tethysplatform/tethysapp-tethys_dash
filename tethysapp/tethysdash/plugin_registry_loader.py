"""Shared loader for the runtime plugin registry.

The registry is a JSON file under ``reactapp/generated/`` persisted from
browser state (``runtimePluginRegistry.json``) — written when the user
registers a Module Federation remote plugin via the chatbox UI.

Consumed by two Django controllers in ``controllers.py``:

- ``runtime_plugins_sync`` (``login_required=True``, GET + POST): the
  authenticated browser-side endpoint the chatbox UI posts to when a
  user registers / removes a runtime plugin. Writes the file via
  ``save_runtime_plugin_registry``; reads it via
  ``load_runtime_plugin_registry`` on GET.
- ``runtime_plugins_list`` (``login_required=False``, GET-only): the
  anonymous read-only sibling endpoint the standalone tethysdash MCP
  server (``Aquaveo/tethysdash_mcps``, image
  ``ghcr.io/aquaveo/tethysdash-mcps``) reads over HTTP via
  ``${TETHYSDASH_BASE_URL}/runtime-plugins/list/`` to discover
  registered runtime plugins. Calls ``load_runtime_plugin_registry``.

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


def save_runtime_plugin_registry(plugins: List[Dict[str, Any]]) -> None:
    """Persist the runtime plugin registry list to the canonical JSON path.

    Creates the parent directory if needed. Overwrites any existing file.
    Centralized here so the path construction (`reactapp/generated/
    runtimePluginRegistry.json`) lives in exactly one place — previously
    re-derived inline by ``controllers.runtime_plugins_sync`` and the
    ``register_runtime_plugin`` MCP tool, each with a per-file-depth
    ``__file__`` walk.
    """
    os.makedirs(os.path.dirname(_RUNTIME_REGISTRY_PATH), exist_ok=True)
    with open(_RUNTIME_REGISTRY_PATH, "w") as f:
        json.dump(plugins, f, indent=2)
    LOGGER.info(
        "Wrote %d runtime plugin(s) to %s",
        len(plugins),
        _RUNTIME_REGISTRY_PATH,
    )
