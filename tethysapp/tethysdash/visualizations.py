import intake
from tethysapp.tethysdash.model import get_visualization_user_permission
from tethysapp.tethysdash.app import App
from tethysapp.tethysdash.exceptions import VisualizationError


def get_available_visualizations(user):

    default_intake_sources = {
        "csv",
        "jsonfiles",
        "ndzarr",
        "numpy",
        "textfiles",
        "tiled_cat",
        "yaml_file_cat",
        "yaml_files_cat",
    }
    valid_intake_sources = [
        s for s in intake.source.registry if s not in default_intake_sources
    ]

    def build_metadata(plugin, source):
        return {
            "source": source,
            "value": plugin.visualization_label,
            "label": plugin.visualization_label,
            "args": plugin.visualization_args,
            "type": plugin.visualization_type,
            "tags": getattr(plugin, "visualization_tags", []),
            "attribution": getattr(plugin, "visualization_attribution", ""),
            "description": getattr(plugin, "visualization_description", ""),
            "loading_icon": getattr(plugin, "visualization_loading_icon", True),
            "restricted": getattr(plugin, "visualization_restricted", False),
        }

    def add_to_group(groups, group_label, metadata):
        for group in groups:
            if group["label"] == group_label:
                group["options"].append(metadata)
                return
        groups.append({"label": group_label, "options": [metadata]})

    available_visualizations = []
    restricted_visualizations = []

    for source in valid_intake_sources:
        plugin = getattr(intake, f"open_{source}")
        metadata = build_metadata(plugin, source)
        if metadata["restricted"]:
            restricted_visualizations.append((plugin, metadata))
        else:
            add_to_group(available_visualizations, plugin.visualization_group, metadata)

    if restricted_visualizations:
        Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
        session = Session()
        try:
            for plugin, metadata in restricted_visualizations:
                if get_visualization_user_permission(session, metadata["source"], user):
                    add_to_group(
                        available_visualizations, plugin.visualization_group, metadata
                    )
        finally:
            session.close()

    return {"visualizations": available_visualizations}


def get_visualization(viz_source, viz_args, user):
    plugin = getattr(intake, f"open_{viz_source}")
    restricted = getattr(plugin, "visualization_restricted", False)
    if restricted:
        Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
        session = Session()
        try:
            if not get_visualization_user_permission(session, viz_source, user):
                raise VisualizationError(
                    "User does not have permission to access this visualization."
                )
        finally:
            session.close()

    data = plugin(**viz_args).read()

    return plugin.visualization_type, data
