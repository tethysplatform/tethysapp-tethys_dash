"""Intake visualization plugin introspection (no pydantic-ai imports)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import intake

from .utils import _is_visualization_plugin, _plugin_attr


@dataclass(frozen=True)
class PluginSpec:
    source: str
    viz_type: str
    args: dict[str, Any]
    description: str


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