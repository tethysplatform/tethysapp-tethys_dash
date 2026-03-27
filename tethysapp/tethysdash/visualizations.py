import intake
from tethysapp.tethysdash.model import get_visualization_user_permission, Message
from tethysapp.tethysdash.exceptions import VisualizationError
from tethysapp.tethysdash.plugin_helpers import get_plugin_prop


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
        "value": get_plugin_prop(plugin, "label"),
        "label": get_plugin_prop(plugin, "label"),
        "args": get_plugin_prop(plugin, "args"),
        "type": get_plugin_prop(plugin, "type"),
        "tags": get_plugin_prop(plugin, "tags", []),
        "attribution": get_plugin_prop(plugin, "attribution", ""),
        "description": get_plugin_prop(plugin, "description", ""),
        "loading_icon": get_plugin_prop(plugin, "loading_icon", True),
        "restricted": get_plugin_prop(plugin, "restricted", False),
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
        if get_plugin_prop(plugin, "restricted", False):
            restricted_visualizations[source] = {
                "info": {
                    "label": get_plugin_prop(plugin, "label"),
                    "description": get_plugin_prop(plugin, "description", ""),
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
    from tethysapp.tethysdash.app import App

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
            add_to_group(
                available_visualizations, get_plugin_prop(plugin, "group"), metadata
            )

    if restricted_visualizations:
        Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
        session = Session()
        try:
            for plugin, metadata in restricted_visualizations:
                if get_visualization_user_permission(session, metadata["source"], user):
                    add_to_group(
                        available_visualizations,
                        get_plugin_prop(plugin, "group"),
                        metadata,
                    )
        finally:
            session.close()

    return {"visualizations": available_visualizations}


def get_visualization(viz_source, viz_args, user, viz_request_id):
    """
    Retrieve data from a specific visualization plugin.

    Loads data using the specified visualization plugin and arguments.
    Checks permissions for restricted visualizations before allowing access.

    Args:
        viz_source (str): Source identifier for the visualization plugin
        viz_args (dict): Arguments to pass to the visualization plugin
        user: User object to check permissions for
        viz_request_id: Unique identifier for the visualization request
    Returns:
        tuple: (visualization_type, data)
            - visualization_type (str): Type of visualization
            - data: The actual visualization data

    Raises:
        VisualizationError: If user lacks permission for restricted visualization
        AttributeError: If visualization plugin doesn't exist
        Exception: If data loading fails
    """
    from tethysapp.tethysdash.app import App

    if viz_source == "Live Chat":
        print("Fetching live chat messages from database...")
        Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
        session = Session()
        try:
            messages = (
                session.query(Message)
                .filter_by(request_id=viz_request_id)
                .order_by(Message.timestamp.asc())
                .all()
            )
            result = [
                {
                    "sender": m.sender,
                    "sessionId": m.session_id,
                    "messageId": m.message_id,
                    "timestamp": m.timestamp.isoformat() + "Z",
                    "message": m.message,
                    "edited": m.edited,
                }
                for m in messages
            ]
        finally:
            session.close()
        return viz_source, {"chatHistory": result}

    try:
        intake.source.registry[viz_source]
    except KeyError:
        raise VisualizationError(f"Visualization ({viz_source}) is not installed.")

    plugin = getattr(intake, f"open_{viz_source}")
    restricted = get_plugin_prop(plugin, "restricted", False)
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

    plugin_instance = plugin(**viz_args)
    try:
        data = plugin_instance.read(request_id=viz_request_id)
    except TypeError:
        data = plugin_instance.read()

    return get_plugin_prop(plugin, "type"), data
