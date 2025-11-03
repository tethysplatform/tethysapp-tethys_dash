from django.http import JsonResponse
import json
import os
import shutil
import nh3
from rest_framework.decorators import api_view
import uuid
from datetime import datetime
from django.core.exceptions import RequestDataTooBig
from tethys_sdk.permissions import has_permission
from django.contrib.sessions.backends.db import SessionStore
from django.conf import settings
from tethys_sdk.routing import controller
from tethysapp.tethysdash.app import App
from tethysapp.tethysdash.model import (
    get_dashboards,
    add_new_dashboard,
    copy_named_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
    clean_up_jsons,
    get_user_permission_groups,
    update_permission_groups,
    delete_permission_groups,
    get_visualization_permissions,
    get_user_app_permissions,
    update_visualization_permissions as update_viz_perms,
    upload_json_to_workspace,
)
from tethysapp.tethysdash.visualizations import (
    get_available_visualizations,
    get_visualization,
    get_restricted_visualizations,
)
from tethysapp.tethysdash.exceptions import VisualizationError


@controller(login_required=False)
def home(request):
    """
    Controller for the app home page.

    Renders the main application interface by loading the React frontend
    through the index.html template.

    Args:
        request: Django HTTP request object

    Returns:
        Rendered HTML response containing the React application
    """
    # The index.html template loads the React frontend
    return App.render(request, "index.html")


@api_view(["GET"])
@controller(url="tethysdash/app/permissions", login_required=False)
def permissions(request):
    """
    API controller for retrieving user permissions.

    Gets the current user's permissions for the TethysDash application.

    Args:
        request: Django HTTP request object

    Returns:
        JsonResponse: Dictionary containing user permissions
    """
    user_permissions = get_user_app_permissions(request.user)

    return JsonResponse({"permissions": user_permissions})


@api_view(["GET"])
@controller(login_required=False)
def ping(request):
    """
    API controller for checking application activity and session status.

    Monitors user session activity and handles session security. Updates the last
    activity time if the user is active and validates session expiration.

    Args:
        request: Django HTTP request object

    Returns:
        JsonResponse: Dictionary containing session status and timeout settings
            - status: Integer indicating session state
                -1: Session security not set up
                -2: User is logged out
                 1: User is logged in
                 2: Public login (no session)
            - EXPIRE_AFTER: Session expiration timeout in seconds
            - WARN_AFTER: Session warning timeout in seconds
    """
    session_id = request.COOKIES.get("sessionid", None)

    if not session_id:
        # Session is missing meaning this is a public login
        return JsonResponse({"status": 2, "EXPIRE_AFTER": 0, "WARN_AFTER": 0})

    session = SessionStore(session_key=session_id)
    session_security = session.get("_session_security", None)

    if not session_security:
        # User is logged out (session missing)
        # This could also mean that the django-session-security package isn't installed
        return JsonResponse({"status": -1, "EXPIRE_AFTER": 0, "WARN_AFTER": 0})

    EXPIRE_AFTER = getattr(settings, "SESSION_SECURITY_EXPIRE_AFTER", 600)  # 10 minutes
    WARN_AFTER = getattr(settings, "SESSION_SECURITY_WARN_AFTER", 540)  # 9 minutes
    request.session = session

    try:
        from tethysapp.tethysdash.sessions import SessionSecurityMiddleware

        middleware = SessionSecurityMiddleware()
        is_user_logged_out = middleware.is_user_session_expired(request)
        if is_user_logged_out:
            return JsonResponse({"status": -2, "EXPIRE_AFTER": 0, "WARN_AFTER": 0})

        now = datetime.now()
        middleware.update_last_activity(request, now)
        return JsonResponse(
            {
                "status": 1,
                "EXPIRE_AFTER": EXPIRE_AFTER + 1,
                "WARN_AFTER": WARN_AFTER + 1,
            }
        )
    except NameError:
        # This is caused by trying to use a function that doesn't exist
        # Useful for resetting a website that used to have the session security.
        delattr(request, "session")
        print(
            "Deleting session information due to django-session-security being uninstalled."  # noqa: E501
        )
        return JsonResponse({"status": -1, "EXPIRE_AFTER": 0, "WARN_AFTER": 0})


@api_view(["GET"])
@controller(url="tethysdash/visualizations/get", login_required=False)
def visualization(request):
    """
    API controller for retrieving visualization data.

    Fetches visualization data based on the provided source and arguments.
    Handles visualization errors and returns appropriate responses.

    Args:
        request: Django HTTP request object with query parameters:
            - source: String identifying the visualization source
            - args: JSON string containing visualization arguments

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if the request was successful
            - data: Visualization data or error information
            - viz_type: Type of visualization returned
    """
    viz_source = request.GET["source"]
    viz_args = json.loads(request.GET["args"])
    data = None
    viz_type = None
    success = True

    try:
        viz_type, data = get_visualization(viz_source, viz_args, request.user)
    except VisualizationError as e:
        print(f"VisualizationError: {e}")
        data = {"error": str(e)}
        success = False
    except Exception as e:
        data = {"error": "Failed to retrieve data"}
        print(e)
        success = False

    return JsonResponse({"success": success, "data": data, "viz_type": viz_type})


@api_view(["GET"])
@controller(url="tethysdash/dashboards/list", login_required=False)
def dashboards(request):
    """
    API controller for retrieving user and public dashboards.

    Gets all dashboards accessible to the current user, along with their
    permission groups. Also performs cleanup of old JSON files.

    Args:
        request: Django HTTP request object

    Returns:
        JsonResponse: Dictionary containing:
            - dashboards: List of dashboard objects accessible to the user
            - permission_groups: List of permission groups for the user
    """
    user = request.user
    dashboards = get_dashboards(user)
    permission_groups = get_user_permission_groups(user)
    clean_up_jsons(user)

    return JsonResponse(
        {"dashboards": dashboards, "permission_groups": permission_groups}
    )


@api_view(["GET"])
@controller(url="tethysdash/visualizations/list", login_required=False)
def visualizations(request):
    """
    API controller for retrieving available visualizations.

    Gets all visualizations that are available to the current user based on
    their permissions and access rights.

    Args:
        request: Django HTTP request object

    Returns:
        JsonResponse: Dictionary containing available visualizations
    """
    visualizations = get_available_visualizations(request.user)

    return JsonResponse(visualizations)


@api_view(["GET"])
@controller(url="tethysdash/visualizations/permissions/list", login_required=True)
def visualization_permissions(request):
    """
    API controller for retrieving visualization permissions.

    Gets visualization permissions for users who have the 'manage_visualizations'
    permission. Returns empty dictionary if user lacks this permission.

    Args:
        request: Django HTTP request object

    Returns:
        JsonResponse: Dictionary containing:
            - visualization_permissions: Dictionary of visualization permissions
              (empty if user lacks manage_visualizations permission)
    """
    try:
        if has_permission(request, "manage_visualizations"):
            visualization_permissions = get_restricted_visualizations()
            db_perms = get_visualization_permissions()
        else:
            return JsonResponse(
                {
                    "success": False,
                    "message": "User doesn't have permission to view visualization permissions.",  # noqa: E501
                }
            )

        for viz_name in db_perms.keys():
            visualization_permissions[viz_name]["users"] = db_perms[viz_name]["users"]
            visualization_permissions[viz_name]["groups"] = db_perms[viz_name]["groups"]

    except Exception as e:
        return JsonResponse(
            {
                "success": False,
                "message": f"Failed to get visualization permissions: {str(e)}",
            }
        )

    return JsonResponse(
        {"success": True, "visualization_permissions": visualization_permissions}
    )


@api_view(["POST"])
@controller(url="tethysdash/visualizations/permissions/update", login_required=True)
def update_visualization_permissions(request):
    """
    API controller for updating visualization permissions.

    Updates visualization permissions for users who have the 'manage_visualizations'
    permission. Expects JSON data with permissions structure.

    Args:
        request: Django HTTP request object with JSON body containing:
            - permissions: Dictionary mapping visualization names to permission data

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating operation success
            - message: Success or error message
    """
    if not has_permission(request, "manage_visualizations"):
        return JsonResponse(
            {
                "success": False,
                "message": "User does not have permission to manage visualization permissions.",  # noqa: E501
            }
        )

    try:
        permission_updates = json.loads(request.body)
        update_viz_perms(permission_updates.get("permissions", {}))

        return JsonResponse({"success": True})

    except Exception as e:
        return JsonResponse(
            {
                "success": False,
                "message": f"Failed to update visualization permissions: {str(e)}",
            }
        )


@api_view(["GET"])
@controller(url="tethysdash/dashboards/get", login_required=False)
def get_dashboard(request):
    """
    API controller for retrieving a specific dashboard.

    Gets a single dashboard by ID for the current user in dashboard view mode.

    Args:
        request: Django HTTP request object with query parameter:
            - id: String ID of the dashboard to retrieve

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if the request was successful
            - dashboard: Dashboard object if successful
            - message: Error message if unsuccessful
    """
    user = request.user
    dashboard_id = request.GET["id"]

    try:
        dashboard = get_dashboards(user, id=dashboard_id, dashboard_view=True)
        return JsonResponse({"success": True, "dashboard": dashboard})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = "Failed to get the dashboard. Check server for logs."

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/dashboards/add", login_required=True, app_media=True)
def add_dashboard(request, app_media):
    """
    API controller for creating a new dashboard.

    Creates a new dashboard with the provided metadata and generates a default
    dashboard image. Requires user to be logged in.

    Args:
        request: Django HTTP request object with JSON body containing:
            - name: String name for the dashboard
            - description: Optional string description
            - notes: Optional string notes
            - public: Optional boolean for public access
            - unrestrictedPlacement: Optional boolean for placement restrictions
            - gridItems: Optional list of grid items
        app_media: Tethys app media directory for storing dashboard images

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if creation was successful
            - new_dashboard: New dashboard object if successful
            - message: Error message if unsuccessful
    """

    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]
    description = dashboard_metadata.get("description", "")
    notes = dashboard_metadata.get("notes", "")
    public = dashboard_metadata.get("public", False)
    unrestricted_placement = dashboard_metadata.get("unrestrictedPlacement", False)
    tabs = dashboard_metadata.get("tabs", [])
    grid_items = dashboard_metadata.get("gridItems", [])
    owner = request.user
    dashboard_uuid = str(uuid.uuid4())
    print(f"Creating a dashboard named {name}")

    try:
        new_dashboard_id = add_new_dashboard(
            owner,
            dashboard_uuid,
            name,
            description,
            notes,
            public,
            unrestricted_placement,
            grid_items,
            tabs,
        )

        dashboard_image = os.path.join(
            os.path.dirname(__file__), "default_dashboard.png"
        )
        shutil.copyfile(
            dashboard_image, os.path.join(app_media.path, f"{dashboard_uuid}.png")
        )
        new_dashboard = get_dashboards(owner, id=new_dashboard_id)
        print(f"Successfully created the dashboard named {name}")

        return JsonResponse({"success": True, "new_dashboard": new_dashboard})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = (
                f"Failed to create the dashboard named {name}. Check server for logs."
            )

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/dashboards/copy", login_required=True, app_media=True)
def copy_dashboard(request, app_media):
    """
    API controller for copying an existing dashboard.

    Creates a copy of an existing dashboard with a new name and UUID.
    Copies the dashboard image if it exists.

    Args:
        request: Django HTTP request object with JSON body containing:
            - id: String ID of the dashboard to copy
            - newName: String name for the copied dashboard
        app_media: Tethys app media directory for storing dashboard images

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if copy was successful
            - new_dashboard: New dashboard object if successful
            - message: Error message if unsuccessful
    """

    dashboard_metadata = json.loads(request.body)
    id = dashboard_metadata["id"]
    new_name = dashboard_metadata["newName"]
    user = request.user
    dashboard_uuid = str(uuid.uuid4())
    print(f"Creating a dashboard {id}")

    try:
        new_dashboard_id, copied_dashboard_uuid = copy_named_dashboard(
            user, id, new_name, dashboard_uuid
        )

        copied_dashboard_image = os.path.join(
            os.path.join(app_media.path, f"{copied_dashboard_uuid}.png")
        )
        if os.path.exists(copied_dashboard_image):
            shutil.copyfile(
                copied_dashboard_image,
                os.path.join(app_media.path, f"{dashboard_uuid}.png"),
            )
        new_dashboard = get_dashboards(user, id=new_dashboard_id)
        print(f"Successfully copied dashboard {id}")

        return JsonResponse({"success": True, "new_dashboard": new_dashboard})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = f"Failed to create the dashboard named {new_name}. Check server for logs."  # noqa:E501

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/dashboards/delete", login_required=True, app_media=True)
def delete_dashboard(request, app_media):
    """
    API controller for deleting a dashboard.

    Deletes the specified dashboard and its associated image file.
    Requires user to be logged in.

    Args:
        request: Django HTTP request object with JSON body containing:
            - id: String ID of the dashboard to delete
        app_media: Tethys app media directory containing dashboard images

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if deletion was successful
            - message: Error message if unsuccessful
    """

    dashboard_metadata = json.loads(request.body)
    id = dashboard_metadata["id"]
    user = request.user

    try:
        dashboard_uuid = delete_named_dashboard(user, id)
        print(f"Successfully deleted dashboard {id}")

        dashboard_image = os.path.join(app_media.path, f"{dashboard_uuid}.png")
        if os.path.exists(dashboard_image):
            os.remove(dashboard_image)

        return JsonResponse({"success": True})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = f"Failed to delete the dashboard {id}. Check server for logs."

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/dashboards/update", login_required=True)
def update_dashboard(request):
    """
    API controller for updating an existing dashboard.

    Updates dashboard properties based on the provided data. Handles request
    size limitations and provides appropriate error messages.

    Args:
        request: Django HTTP request object with JSON body containing:
            - id: String ID of the dashboard to update
            - Additional fields to update (name, description, etc.)

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if update was successful
            - updated_dashboard: Updated dashboard object if successful
            - message: Error message if unsuccessful
    """

    try:
        dashboard_updates = json.loads(request.body)
    except RequestDataTooBig:
        return JsonResponse(
            {
                "success": False,
                "message": f"File size too big. Total request must be less than {settings.DATA_UPLOAD_MAX_MEMORY_SIZE/1024} KB",  # noqa: E501
            }
        )

    id = dashboard_updates.pop("id")
    user = request.user

    try:
        updated_dashboard = update_named_dashboard(user, id, dashboard_updates)
        print(f"Successfully updated the dashboard {id}")

        return JsonResponse({"success": True, "updated_dashboard": updated_dashboard})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = f"Failed to update the dashboard {id}. Check server for logs."

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/permission_groups/update", login_required=True)
def update_permission_group(request):
    """
    API controller for updating or creating permission groups.

    Updates an existing permission group or creates a new one if no ID is provided.
    Requires user to be logged in.

    Args:
        request: Django HTTP request object with JSON body containing:
            - id: Optional string ID of existing permission group
            - name: String name for the permission group
            - Additional permission group fields

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if operation was successful
            - updated_permission_group: Permission group object if successful
            - message: Error message if unsuccessful
    """
    permission_group_updates = json.loads(request.body)
    user = request.user
    existing_permission_group = True if permission_group_updates.get("id") else False

    try:
        updated_permission_group = update_permission_groups(
            user, permission_group_updates
        )

        if updated_permission_group.get("status") == "error":
            return JsonResponse(
                {
                    "success": False,
                    "message": updated_permission_group["message"],
                }
            )

        if existing_permission_group:
            print(
                f"Successfully updated the permission group {permission_group_updates['name']}"  # noqa: E501
            )
        else:
            print(
                f"Successfully created a new permission group {updated_permission_group['name']}"  # noqa: E501
            )

        return JsonResponse(
            {
                "success": True,
                "updated_permission_group": updated_permission_group,
            }
        )
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = f"Failed to update the permission group {permission_group_updates['name']}. Check server for logs."  # noqa: E501

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/permission_groups/delete", login_required=True)
def delete_permission_group(request):
    """
    API controller for deleting a permission group.

    Deletes the specified permission group. Requires user to be logged in.

    Args:
        request: Django HTTP request object with JSON body containing:
            - id: String ID of the permission group to delete

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if deletion was successful
            - message: Error message if unsuccessful
    """
    request_body = json.loads(request.body)
    user = request.user
    permission_group_id = request_body.get("id")

    try:
        deleteResponse = delete_permission_groups(user, permission_group_id)

        if deleteResponse["status"] == "error":
            return JsonResponse(
                {
                    "success": False,
                    "message": deleteResponse["message"],
                }
            )

        return JsonResponse({"success": True})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = f"Failed to delete the permission group {permission_group_id}. Check server for logs."  # noqa: E501

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/json/upload", login_required=True, app_workspace=True)
def upload_json(request, app_workspace):
    """
    API controller for uploading JSON data files.

    Uploads and sanitizes JSON data to the application workspace. Creates
    necessary directories and user-specific tracking files.

    Args:
        request: Django HTTP request object with JSON body containing:
            - data: String containing JSON data to upload
            - filename: String filename for the JSON file
        app_workspace: Tethys app workspace directory for storing files

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if upload was successful
            - filename: Name of the uploaded file if successful
            - message: Error message if unsuccessful
    """

    json_data = json.loads(request.body)
    user = request.user

    data = json_data["data"]
    filename = json_data["filename"]
    dashboard_uuid = json_data["dashboard_uuid"]
    clean_data = nh3.clean(data)
    print(f"Uploading {filename}")

    try:
        dashboard_folder = os.path.join(app_workspace.path, dashboard_uuid)
        if not os.path.exists(dashboard_folder):
            os.mkdir(dashboard_folder)

        upload_json_to_workspace(
            user, dashboard_folder, filename, clean_data, dashboard_uuid
        )

        return JsonResponse({"success": True, "filename": filename})

    except Exception as e:
        try:
            message = e.args[0]
        except Exception:
            message = "Failed to upload the json. Check server for logs."

        return JsonResponse({"success": False, "message": message})


@api_view(["GET"])
@controller(url="tethysdash/json/download", login_required=False, app_workspace=True)
def download_json(request, app_workspace):
    """
    API controller for downloading JSON data files.

    Downloads and sanitizes JSON data from the application workspace.

    Args:
        request: Django HTTP request object with query parameter:
            - filename: String name of the JSON file to download
        app_workspace: Tethys app workspace directory containing files

    Returns:
        JsonResponse: Dictionary containing:
            - success: Boolean indicating if download was successful
            - data: JSON data if successful
            - message: Error message if unsuccessful
    """
    filename = request.GET["filename"]
    dashboard_uuid = request.GET["dashboard_uuid"]
    dashboard_folder = os.path.join(app_workspace.path, dashboard_uuid)
    print(f"Getting data from {filename}")

    try:
        dashboard_file = os.path.join(dashboard_folder, filename)
        # Writing to sample.json
        with open(dashboard_file, "r") as file:
            data = json.load(file)
            data = json.loads(nh3.clean(json.dumps(data)))

        return JsonResponse({"success": True, "data": data})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = "Failed to upload the json. Check server for logs."

        return JsonResponse({"success": False, "message": message})
