

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