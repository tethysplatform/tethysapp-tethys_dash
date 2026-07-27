"""Discovery and formatting of installed TethysDash visualization plugins."""
import intake

from ..models import PluginSpec


def _is_visualization_plugin(plugin_cls) -> bool:
    """Return True for TethysDash visualization plugins, False for generic intake drivers."""
    return hasattr(plugin_cls, "visualization_type")


def _plugin_attr(plugin_cls, name: str, default=None):
    """Read a plugin attribute, preferring the legacy ``visualization_<name>`` form."""
    if hasattr(plugin_cls, f"visualization_{name}"):
        return getattr(plugin_cls, f"visualization_{name}")
    if hasattr(plugin_cls, name):
        return getattr(plugin_cls, name)
    return default


def list_visualization_plugins() -> list[PluginSpec]:
    """Return a PluginSpec for every installed visualization plugin, sorted by source."""
    specs = []
    for name in sorted(intake.source.registry):
        cls = intake.source.registry[name]
        if not _is_visualization_plugin(cls):
            continue
        specs.append(
            PluginSpec(
                name=str(_plugin_attr(cls, "label", name)),
                source=name,
                viz_type=str(_plugin_attr(cls, "type", "?")),
                args=_plugin_attr(cls, "args", {}) or {},
                description=(_plugin_attr(cls, "description", "") or "").strip(),
            )
        )
    return specs


def get_plugin(source: str) -> PluginSpec | None:
    """Return the PluginSpec matching a plugin by its source name or label, else None."""
    for spec in list_visualization_plugins():
        if source in (spec.source, spec.name):
            return spec
    return None


def format_catalog_for_llm() -> str:
    """Render the installed plugin catalog as Markdown for inclusion in a prompt."""
    specs = list_visualization_plugins()
    if not specs:
        return "No visualization plugins are installed."
    blocks = []
    for spec in specs:
        args_line = ", ".join(spec.args) if spec.args else "(none)"
        description = spec.description or "(no description)"
        blocks.append(
            f"**{spec.name}** ({spec.viz_type})\n"
            f" `{spec.source}` - `args: {args_line}` \n\n"
            f"  {description}"
        )
    return "\n\n".join(blocks)
