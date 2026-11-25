import intake
import json
from dataclasses import dataclass
from django.core.serializers.json import DjangoJSONEncoder
from django.views.decorators.debug import sensitive_variables
from tethysapp.tethysdash.model import (
    find_viewable_dashboard,
    find_viewable_dashboard_and_permission,
    get_visualization_user_permission,
    Message,
    TileSecret,
    permission_may_edit,
)
from tethysapp.tethysdash.exceptions import (
    DASHBOARD_CHANGED,
    SECRET_NEEDED,
    SECRET_NOT_SET_UP,
    SECRET_RETURNED,
    SECRET_UNREADABLE,
    DataRequestRefused,
    VisualizationError,
)
from tethysapp.tethysdash.plugin_helpers import (
    get_plugin_prop,
    run_secrets,
    secret_arg_names,
    validate_feature_collection,
)
from tethysapp.tethysdash.layer_sources import validate_layer_source_description
from tethysapp.tethysdash.saved_settings import (
    LAYER,
    LIVE_CHAT,
    TILE,
    SavedLayer,
    SavedSettingsError,
    SavedSettingsMismatch,
    build_viewer_args,
    locate,
    locate_tile,
)
from tethysapp.tethysdash.tile_secrets import (
    SecretIdentity,
    SecretUnavailable,
    SecretValue,
    contains_secret,
    decrypt,
)
import inspect
import logging

logger = logging.getLogger(__name__)


def warm_visualization_cache():
    """Import every registered visualization plugin, off the request path.

    Discovery reads each plugin's class attributes to build the visualization
    picker, and reading them imports the plugin module (and the heavy packages
    it pulls in). The first ``get_available_visualizations`` call per process
    therefore pays that import cost. Calling this at startup moves it off the
    user's first request. Best effort and idempotent: a plugin that fails to
    import is logged and skipped, and imports are cached after the first call.

    Returns:
        int: Number of plugins successfully warmed.
    """
    warmed = 0
    for source in intake.source.registry:
        try:
            get_plugin_prop(getattr(intake, f"open_{source}"), "label")
            warmed += 1
        except Exception:
            logger.warning(
                "Visualization plugin warm-up failed for '%s'", source, exc_info=True
            )
    logger.debug("Warmed %d visualization plugins", warmed)
    return warmed


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
        "dynamic_map_layer": get_plugin_prop(plugin, "dynamic_map_layer", False),
        "dynamic_map_layer_source": get_plugin_prop(
            plugin, "dynamic_map_layer_source", "GeoJSON"
        ),
        "optional_args": list(get_plugin_prop(plugin, "optional_args", ())),
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


# What a data request asks a plugin for: its configure-time scaffold from ``run``, or
# a dynamic map layer's render-time data.
MODE_SCAFFOLD = "scaffold"
MODE_FEATURES = "features"
DATA_REQUEST_MODES = (MODE_SCAFFOLD, MODE_FEATURES)


@dataclass(frozen=True)
class DataRequest:
    """
    A data request: the tile, or the dynamic layer within it, that it runs, and the
    args the browser resolved for it.

    The identity fields are taken as sent. Nothing trusts them until the dashboard
    they name is found and the caller may view it, and a tile or layer is then looked
    up only among that dashboard's own. ``request_id`` only lets progress messages
    find the tile that asked; nothing is looked up by it.

    Attributes:
        dashboard: The dashboard's uuid
        tile: The tile's uuid, top-level or in a Map tile's layer popup
        layer (str): A dynamic layer's ``layerId`` within the tile, or ""
        source (str): The plugin source, or "Live Chat"
        args (dict): The args the browser resolved
        mode (str): One of :data:`DATA_REQUEST_MODES`
        request_id: The id progress messages carry
        all_args (bool): Whether ``args`` holds every arg (``allArgs``), as the
            browser sends them for a caller who may edit the dashboard, rather than
            only the ones a viewer's request carries
    """

    dashboard: object
    tile: object
    layer: object
    source: str
    args: dict
    mode: str
    request_id: object
    all_args: bool = False

    @property
    def kind(self):
        """The saved-settings request kind: a layer's when the request names one."""
        return LAYER if self.layer else TILE

    @classmethod
    def from_body(cls, body):
        """
        Read a data request from its parsed JSON body.

        Raises:
            ValueError: The body is not an object, or has no string ``source``, an
                ``args`` that is not an object, an unknown ``mode``, or an
                ``allArgs`` that is not a boolean.
        """
        if not isinstance(body, dict):
            raise ValueError("A data request must be a JSON object.")
        source = body.get("source")
        args = body.get("args", {})
        mode = body.get("mode", MODE_SCAFFOLD)
        all_args = body.get("allArgs", False)
        if (
            not isinstance(source, str)
            or not isinstance(args, dict)
            or mode not in DATA_REQUEST_MODES
            or not isinstance(all_args, bool)
        ):
            raise ValueError(
                "A data request needs a source, args as an object, a known mode and "
                "a boolean allArgs."
            )
        return cls(
            dashboard=body.get("dashboard"),
            tile=body.get("tile"),
            layer=body.get("layer") or "",
            source=source,
            args=args,
            mode=mode,
            request_id=body.get("requestId"),
            all_args=all_args,
        )


def get_plugin_arg_types(source):
    """
    Get the arg types an installed plugin declares.

    Args:
        source (str): Source identifier for the visualization plugin

    Returns:
        dict or None: The plugin's declared args, arg name to type, or None when no
            installed plugin has the source.
    """
    try:
        intake.source.registry[source]
    except KeyError:
        return None
    return get_plugin_prop(getattr(intake, f"open_{source}"), "args", {})


def get_plugin_secret_args(source):
    """
    Get the args an installed plugin declares secret.

    Args:
        source (str): Source identifier for the visualization plugin

    Returns:
        frozenset or None: The names of the plugin's secret args, or None when no
            installed plugin has the source, in which case nothing is known about
            its args and callers leave them alone.
    """
    arg_types = get_plugin_arg_types(source)
    if arg_types is None:
        return None
    return secret_arg_names(arg_types)


def _viewer_run_args(dashboard, data_request):
    """
    Build the args a caller who may not edit the dashboard runs, from the saved
    settings of the tile or layer the request names (see saved_settings).

    Returns:
        tuple: The saved tile or layer (``SavedTile`` or ``SavedLayer``), and the
            args, a declared secret arg's value still ``saved_settings.SECRET_ARG``

    Raises:
        DataRequestRefused: With :data:`DASHBOARD_CHANGED` when no saved tile or
            layer has the request's identity, more than one has, it saves another
            plugin source, or the request's args cannot have come from its saved
            ones.
    """
    try:
        saved = locate(dashboard.grid_items, data_request.tile, data_request.layer)
        if saved.source != data_request.source:
            raise SavedSettingsMismatch("The saved plugin source is another one.")
        return saved, build_viewer_args(
            saved.args,
            data_request.args,
            get_plugin_arg_types(saved.source),
            data_request.kind,
        )
    except SavedSettingsError as error:
        print(
            f"Refused a data request for tile {data_request.tile!r} layer "
            f"{data_request.layer!r} of dashboard {dashboard.uuid}: {error}"
        )
        raise DataRequestRefused(DASHBOARD_CHANGED) from None


def _editor_saved(dashboard, data_request):
    """The saved tile or layer an editor's request names, or None when it has none.

    An editor may be running work not saved yet, on a tile or layer not saved yet,
    which has no stored secrets.
    """
    try:
        return locate(dashboard.grid_items, data_request.tile, data_request.layer)
    except SavedSettingsError:
        return None


def _stored_secrets(session, dashboard, saved):
    """The secrets stored for a saved tile or layer, by arg name.

    They are stored under the saved tile's own uuid, whatever case the request
    named it in.
    """
    if saved is None:
        return {}
    if isinstance(saved, SavedLayer):
        tile_uuid, layer_id = saved.tile.uuid, saved.layer_id
    else:
        tile_uuid, layer_id = saved.uuid, ""
    rows = session.query(TileSecret).filter_by(
        dashboard_id=dashboard.id, tile_uuid=tile_uuid, layer_id=layer_id
    )
    return {row.arg_name: row for row in rows}


def _resolve_secret_args(
    session, dashboard, saved, secret_names, data_request, run_args, editor, as_sent
):
    """
    Give each secret arg the plugin declares its value for this run.

    An editor's request that runs as sent (``allArgs``) runs a non-empty string sent
    for the arg, which is the value they just typed and have not saved; otherwise, as
    any other request does, it runs the value stored for the arg (see
    model.TileSecret). A stored value recorded for another plugin source counts as
    none. So does a value found in the saved args, which only predates the secret,
    since none is saved there.

    Every value is handed on as a
    :class:`~tethysapp.tethysdash.tile_secrets.SecretValue`, which get_visualization
    unwraps only to construct the plugin.

    Args:
        session: The session the dashboard was read in
        dashboard (Dashboard): The dashboard the request names
        saved: The saved tile or layer the request names, or None for none
        secret_names (frozenset): The plugin's secret args
            (see get_plugin_secret_args), not empty
        data_request (DataRequest): The request
        run_args (dict): The args the run would take, secrets aside
        editor (bool): Whether the caller may edit the dashboard, which picks the
            message for a missing secret
        as_sent (bool): Whether the request runs its args as sent, which alone lets
            a typed secret run

    Returns:
        dict: ``run_args`` with every declared secret arg's value

    Raises:
        DataRequestRefused: A secret arg has no value, or its stored value cannot
            be read. The plugin is never constructed. An editor is told to enter
            the secret; a viewer only that the tile is not set up.
    """
    stored = _stored_secrets(session, dashboard, saved)
    resolved = dict(run_args)
    for name in sorted(secret_names):
        typed = run_args.get(name) if as_sent else None
        if isinstance(typed, str) and typed:
            resolved[name] = SecretValue(typed)
            continue
        row = stored.get(name)
        if row is None or row.plugin_source != data_request.source:
            raise DataRequestRefused(SECRET_NEEDED if editor else SECRET_NOT_SET_UP)
        identity = SecretIdentity(
            dashboard=dashboard.uuid,
            tile=row.tile_uuid,
            layer=row.layer_id,
            arg=row.arg_name,
            source=row.plugin_source,
        )
        try:
            resolved[name] = decrypt(identity, row.ciphertext)
        except SecretUnavailable:
            raise DataRequestRefused(
                SECRET_UNREADABLE if editor else SECRET_NOT_SET_UP
            ) from None
    return resolved


def secret_values_of(run_args):
    """The secret values among a run's args (see prepare_run_args), still wrapped."""
    return tuple(value for value in run_args.values() if isinstance(value, SecretValue))


@sensitive_variables()
def prepare_run_args(user, data_request):
    """
    Get the args a data request's plugin runs with, for this caller.

    The caller must be able to view the dashboard the request names. One who may also
    edit it (see permission_may_edit), in a request that carries every arg
    (``all_args``, which the browser sends for such a caller), runs the args as sent,
    which may be work not yet saved, on a tile that may not be saved yet either.
    Anyone else runs the saved settings of the tile or layer the request names,
    taking from the request only what the browser fills in for a viewer:
    variable-input values and date args. That includes an editor whose request
    carries only a viewer's args, as from a page loaded before they could edit.

    Either way, every arg the plugin declares secret takes its value here (see
    _resolve_secret_args), as a
    :class:`~tethysapp.tethysdash.tile_secrets.SecretValue`.

    Args:
        user: User object, authenticated or anonymous
        data_request (DataRequest): The request

    Returns:
        dict: The args to run the request's plugin with

    Raises:
        DashboardNotFound: No dashboard has the uuid, or the user may not view it.
            Nothing about the plugin is loaded.
        DataRequestRefused: The request does not fit the saved settings, or a
            secret arg has no value that can be run.
        ImproperlyConfigured: ``TETHYSDASH_SECRET_KEYS`` holds something not a key.
    """
    from tethysapp.tethysdash.app import App

    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        dashboard, permission = find_viewable_dashboard_and_permission(
            session, data_request.dashboard, user, "run a tile of"
        )
        editor = permission_may_edit(permission)
        as_sent = editor and data_request.all_args
        if as_sent:
            run_args = data_request.args
        else:
            saved, run_args = _viewer_run_args(dashboard, data_request)
        secret_names = get_plugin_secret_args(data_request.source)
        if not secret_names:
            return run_args
        if as_sent:
            # Only to find the secrets stored for it.
            saved = _editor_saved(dashboard, data_request)
        return _resolve_secret_args(
            session,
            dashboard,
            saved,
            secret_names,
            data_request,
            run_args,
            editor,
            as_sent,
        )
    finally:
        session.close()


def get_chat_history(user, data_request):
    """
    Get the messages of the Live Chat tile a data request names, oldest first.

    The tile is looked up among the tiles of the dashboard the request names, once the
    caller may view it, so a chat tile of another dashboard has no history here. Nor
    has a tile not saved yet, or one that is not a top-level Live Chat tile: a popup
    tile's uuid is the editor's to choose, so one may repeat another dashboard's chat
    tile.

    Args:
        user: User object, authenticated or anonymous
        data_request (DataRequest): The request

    Returns:
        dict: ``{"chatHistory": [message, ...]}``

    Raises:
        DashboardNotFound: No dashboard has the uuid, or the user may not view it.
    """
    from tethysapp.tethysdash.app import App

    Session = App.get_persistent_store_database("primary_db", as_sessionmaker=True)
    session = Session()
    try:
        dashboard = find_viewable_dashboard(
            session, data_request.dashboard, user, "read the chat of"
        )
        try:
            tile = locate_tile(dashboard.grid_items, data_request.tile)
        except SavedSettingsError:
            return {"chatHistory": []}
        if len(tile.path) != 1 or tile.source != LIVE_CHAT:
            return {"chatHistory": []}
        messages = (
            session.query(Message)
            .filter_by(request_id=tile.uuid)
            .order_by(Message.timestamp.asc())
            .all()
        )
        return {
            "chatHistory": [
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
        }
    finally:
        session.close()


def _refuse_a_returned_secret(data, secret_values):
    """
    Refuse a plugin's result that holds one of the run's secret values, in any form,
    as the response would send it.

    Raises:
        VisualizationError: With :data:`SECRET_RETURNED`.
    """
    if secret_values and contains_secret(
        json.dumps(data, cls=DjangoJSONEncoder), secret_values
    ):
        raise VisualizationError(SECRET_RETURNED)


def _revealed(viz_args):
    return {
        name: value.reveal() if isinstance(value, SecretValue) else value
        for name, value in viz_args.items()
    }


@sensitive_variables()
def get_visualization(viz_source, viz_args, user, viz_request_id, mode=MODE_SCAFFOLD):
    """
    Retrieve data from a specific visualization plugin.

    Loads data using the specified visualization plugin and arguments.
    Checks permissions for restricted visualizations before allowing access.
    It runs the args it is given: a data request's are prepared, against the
    dashboard the request names, by :func:`prepare_run_args`.

    A secret arg's value arrives as a
    :class:`~tethysapp.tethysdash.tile_secrets.SecretValue` and is unwrapped only to
    construct the plugin. From just before the plugin is constructed until the run
    ends, progress messages are scrubbed of every such value (see
    plugin_helpers.run_secrets), and a result holding one, in any form, is refused.
    Django's error reports mask the variables of this function and of every one it
    calls, the plugin's own included (``sensitive_variables``).

    Args:
        viz_source (str): Source identifier for the visualization plugin
        viz_args (dict): Arguments to pass to the visualization plugin, a secret
            arg's value as a ``SecretValue``
        user: User object to check permissions for
        viz_request_id: Identifier progress messages carry back to the request.
            For runtime feature fetches, a composite id of the form
            ``{sessionNonce}:{gridItemUUID}:{layerId}`` is expected; the final
            suffix is parsed as ``layer_id`` and threaded into the plugin so
            progress messages carry it. Nothing is looked up by it.
        mode (str): ``"scaffold"`` (default) invokes the configure-time
            :py:meth:`TethysDashPlugin.run` method. ``"features"`` invokes
            the plugin's render-time method for its declared
            ``dynamic_map_layer_source``: a GeoJSON plugin's
            :py:meth:`TethysDashPlugin.fetch_features` (validated as a
            FeatureCollection) or a GeoTIFF plugin's
            :py:meth:`TethysDashPlugin.fetch_source` (validated as a source
            description).
    Returns:
        tuple: (visualization_type, data)
            - visualization_type (str): Type of visualization. For
              mode=features, ``"features"`` for a GeoJSON plugin and
              ``"source"`` for a GeoTIFF plugin.
            - data: The actual visualization data.

    Raises:
        VisualizationError: If user lacks permission, the plugin is not
            installed, the plugin does not support runtime features (in
            features-mode), the returned payload fails validation, or it holds a
            secret value (:data:`SECRET_RETURNED`).
        Exception: If data loading fails.
    """
    from tethysapp.tethysdash.app import App

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

    secret_values = secret_values_of(viz_args)
    with run_secrets(secret_values):
        plugin_instance = plugin(**_revealed(viz_args))
        viz_type, data = _read_plugin(
            plugin, plugin_instance, viz_source, viz_request_id, mode
        )
        _refuse_a_returned_secret(data, secret_values)
    return viz_type, data


def _read_plugin(plugin, plugin_instance, viz_source, viz_request_id, mode):
    """Run a constructed plugin for a request mode (see get_visualization)."""
    if mode == MODE_FEATURES:
        if not get_plugin_prop(plugin_instance, "dynamic_map_layer", False):
            raise VisualizationError(
                f"Visualization ({viz_source}) does not support dynamic features."
            )

        # read_features/read_source parse the composite requestId's suffix as
        # the layer id, so send_update calls within the runtime method attach
        # it for per-layer progress routing.
        layer_source = get_plugin_prop(
            plugin_instance, "dynamic_map_layer_source", "GeoJSON"
        )
        if layer_source == "GeoTIFF":
            data = plugin_instance.read_source(request_id=viz_request_id)
            validate_layer_source_description(data, layer_source)
            return "source", data

        data = plugin_instance.read_features(request_id=viz_request_id)
        validate_feature_collection(data)
        return "features", data

    if "request_id" in inspect.signature(plugin_instance.read).parameters:
        data = plugin_instance.read(request_id=viz_request_id)
    else:
        data = plugin_instance.read()

    return get_plugin_prop(plugin, "type"), data
