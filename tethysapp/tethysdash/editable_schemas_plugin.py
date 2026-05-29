"""Per-source editable-path resolver for Intake-backed viz types.

Complements :mod:`tethysapp.tethysdash.editable_schemas` (which owns the
static 5-built-in-type whitelist) with runtime-derived whitelists for
**Intake backend plugins** — discovered via ``intake.source.registry``
and filtered by optional ``llm_editable_args`` / ``llm_non_editable_args``
class attributes on the plugin class (see the plugin_authors doc).

Default-permissive: when no author declarations are present, every
registered arg is editable. Plugin authors use ``llm_non_editable_args``
to carve out specific args (e.g., a hardcoded credential in the plugin
package). Matches TethysDash's existing trust model — editors can set
any arg via the edit modal today; the chatbox exposes the same surface
via natural language and is itself gated to editor/admin users.

Any lookup failure — unknown source, malformed declaration — fails
closed (returns an empty list). Callers surface ``whitelist_rejected``
with empty ``allowed_prefixes``.
"""

from __future__ import annotations

import logging
from typing import Iterable, List, Optional

import intake  # noqa: F401 — imported so tests can patch intake.source.registry

from tethysapp.tethysdash.plugin_helpers import get_plugin_prop

LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# R7 / R8 — author-declaration precedence
# ---------------------------------------------------------------------------


def _compose_author_filter(
    all_args: Iterable[str],
    allow: Optional[Iterable[str]],
    deny: Optional[Iterable[str]],
) -> List[str]:
    """Apply the R7 precedence matrix to ``all_args``.

    * ``allow`` absent, ``deny`` absent -> all_args
    * ``allow`` present, ``deny`` absent -> intersection(allow, all_args)
    * ``allow`` absent, ``deny`` present -> all_args minus deny
    * ``allow`` present, ``deny`` present -> intersection(allow, all_args) minus deny

    ``allow`` or ``deny`` values that aren't iterables raise; the caller
    catches and returns ``[]`` (fail-closed) so a malformed plugin
    declaration is indistinguishable from an unknown source from the
    patch_visualization tool's point of view.
    """
    all_args_list = list(all_args)
    if allow is not None:
        allow_set = set(allow)
        filtered = [n for n in all_args_list if n in allow_set]
    else:
        filtered = all_args_list
    if deny:
        deny_set = set(deny)
        filtered = [n for n in filtered if n not in deny_set]
    return filtered


# ---------------------------------------------------------------------------
# Intake resolver
# ---------------------------------------------------------------------------


def _resolve_intake(source: str) -> Optional[List[str]]:
    """Return editable paths for an Intake plugin, or None if not registered."""
    # intake.source.registry is a DriverRegistry in production (not a plain
    # dict). Both DriverRegistry and dict support __contains__ and __getitem__,
    # so use those rather than .get() which DriverRegistry doesn't expose.
    try:
        registry = intake.source.registry
        if source not in registry:
            return None
        plugin_class = registry[source]
    except (KeyError, TypeError):
        return None
    try:
        args = get_plugin_prop(plugin_class, "args", {}) or {}
        if not isinstance(args, dict):
            LOGGER.warning(
                "Intake plugin %r has non-dict args (%s); resolver returns empty.",
                source,
                type(args).__name__,
            )
            return []
        allow = get_plugin_prop(plugin_class, "llm_editable_args", None)
        deny = get_plugin_prop(plugin_class, "llm_non_editable_args", None)
        effective = _compose_author_filter(args.keys(), allow, deny)
    except (TypeError, ValueError) as exc:
        LOGGER.warning(
            "Intake plugin %r has malformed editability declarations: %s",
            source,
            exc,
        )
        return []
    return [f"/args/{name}" for name in effective]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def resolve_editable_paths(source: str) -> List[str]:
    """Resolve the LLM-editable JSON Pointer prefixes for ``source``.

    Dispatches to the Intake resolver. The caller is responsible for
    routing static-built-in sources to :mod:`tethysapp.tethysdash.editable_schemas`
    -- this module does not handle the 5 built-in viz types.

    Returns an empty list on any lookup failure (unknown source, malformed
    declaration, registry miss). The ``patch_visualization`` tool surfaces
    the empty list to the LLM as ``whitelist_rejected`` with empty
    ``allowed_prefixes``.
    """
    paths = _resolve_intake(source)
    if paths is not None:
        return paths
    return []


def is_path_allowed_plugin(source: str, json_pointer: str) -> bool:
    """Return True if ``json_pointer`` is whitelisted for plugin ``source``.

    Uses the same structural-prefix match semantics as
    :func:`tethysapp.tethysdash.editable_schemas.is_path_allowed` -- so
    ``/args/start_date`` allows ``/args/start_date/year`` but not
    ``/args/start_date2``.
    """
    prefixes = resolve_editable_paths(source)
    if not prefixes:
        return False
    for prefix in prefixes:
        if json_pointer == prefix:
            return True
        if json_pointer.startswith(prefix + "/"):
            return True
    return False
