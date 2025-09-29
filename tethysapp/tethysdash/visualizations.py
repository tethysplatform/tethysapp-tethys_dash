import intake
from tethysapp.tethysdash.model import get_visualization_user_permission
from tethysapp.tethysdash.app import App
from tethysapp.tethysdash.exceptions import VisualizationError


def build_plugin_metadata(plugin, source):
    """
    Extract metadata from a visualization plugin.

    Args:
        plugin: Intake plugin object
        source (str): Source identifier for the plugin

    Returns:
        dict: Plugin metadata dictionary
    """
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


def get_restricted_visualizations():
    """
    Get a list of all restricted visualization sources.

    Returns:
        list: List of restricted visualization source identifiers
    """
    restricted_visualizations = {}
    for source in intake.source.registry:
        plugin = getattr(intake, f"open_{source}")
        if getattr(plugin, "visualization_restricted", False):
            restricted_visualizations[source] = {
                "info": {
                    "label": plugin.visualization_label,
                    "description": getattr(plugin, "visualization_description", ""),
                },
                "users": [],
                "groups": [],
            }

    return restricted_visualizations


def get_available_visualizations(user):
    """
    Get all visualization types available to a user.

    Retrieves visualization plugins from the intake registry, filtering out
    default sources and checking permissions for restricted visualizations.
    Groups visualizations by their category and includes metadata for each.

    Args:
        user: User object to check visualization permissions for

    Returns:
        dict: Dictionary containing visualization groups:
              {
                  'visualizations': [
                      {
                          'label': group_name,
                          'options': [
                              {
                                  'source': plugin_source,
                                  'value': plugin_label,
                                  'label': plugin_label,
                                  'args': plugin_args,
                                  'type': plugin_type,
                                  'tags': plugin_tags,
                                  'attribution': plugin_attribution,
                                  'description': plugin_description,
                                  'loading_icon': show_loading_icon,
                                  'restricted': is_restricted
                              }
                          ]
                      }
                  ]
              }
    """

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

    def add_to_group(groups, group_label, metadata):
        """
        Add visualization metadata to the appropriate group.

        Creates a new group if it doesn't exist, otherwise adds to existing group.

        Args:
            groups (list): List of visualization groups
            group_label (str): Name of the group to add to
            metadata (dict): Visualization metadata to add
        """
        for group in groups:
            if group["label"] == group_label:
                group["options"].append(metadata)
                return
        groups.append({"label": group_label, "options": [metadata]})

    available_visualizations = []
    restricted_visualizations = []

    for source in valid_intake_sources:
        plugin = getattr(intake, f"open_{source}")
        metadata = build_plugin_metadata(plugin, source)
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
    """
    Retrieve data from a specific visualization plugin.

    Loads data using the specified visualization plugin and arguments.
    Checks permissions for restricted visualizations before allowing access.

    Args:
        viz_source (str): Source identifier for the visualization plugin
        viz_args (dict): Arguments to pass to the visualization plugin
        user: User object to check permissions for

    Returns:
        tuple: (visualization_type, data)
            - visualization_type (str): Type of visualization
            - data: The actual visualization data

    Raises:
        VisualizationError: If user lacks permission for restricted visualization
        AttributeError: If visualization plugin doesn't exist
        Exception: If data loading fails
    """
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
