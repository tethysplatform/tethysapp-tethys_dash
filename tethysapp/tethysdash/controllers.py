from django.http import JsonResponse
import json
import os
import shutil
import nh3
from rest_framework.decorators import api_view
import uuid
from tethys_sdk.routing import controller
from tethysapp.tethysdash.app import App
from tethysapp.tethysdash.model import (
    get_dashboards,
    add_new_dashboard,
    copy_named_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
    clean_up_jsons,
)
from tethysapp.tethysdash.visualizations import (
    get_available_visualizations,
    get_visualization,
)
from pathlib import Path


@controller(login_required=False)
def home(request):
    """Controller for the app home page."""
    # The index.html template loads the React frontend
    return App.render(request, "index.html")


@api_view(["GET"])
@controller(login_required=False)
def data(request):
    """API controller for the plot page."""
    viz_source = request.GET["source"]
    viz_args = json.loads(request.GET["args"])
    data = None
    viz_type = None
    success = True

    try:
        viz_type, data = get_visualization(viz_source, viz_args)
    except Exception as e:
        print("Failed to retrieve data")
        print(e)
        success = False

    return JsonResponse({"success": success, "data": data, "viz_type": viz_type})


@api_view(["GET"])
@controller(login_required=False)
def dashboards(request):
    """API controller for the dashboards page."""
    user = str(request.user)
    dashboards = get_dashboards(user)
    clean_up_jsons(user)

    return JsonResponse(dashboards)


@api_view(["GET"])
@controller(login_required=False)
def visualizations(request):
    """API controller for the visualizations page."""
    visualizations = get_available_visualizations()

    return JsonResponse(visualizations)


@api_view(["GET"])
@controller(url="tethysdash/dashboards/get", login_required=False)
def get_dashboard(request):
    """API controller for the dashboards page."""
    user = str(request.user)
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
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]
    description = dashboard_metadata.get("description", "")
    notes = dashboard_metadata.get("notes", "")
    access_groups = dashboard_metadata.get("accessGroups", [])
    unrestricted_placement = dashboard_metadata.get("unrestrictedPlacement", False)
    grid_items = dashboard_metadata.get("gridItems", [])
    owner = str(request.user)
    dashboard_uuid = str(uuid.uuid4())
    print(f"Creating a dashboard named {name}")

    try:
        new_dashboard_id = add_new_dashboard(
            owner,
            dashboard_uuid,
            name,
            description,
            notes,
            access_groups,
            unrestricted_placement,
            grid_items,
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
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    id = dashboard_metadata["id"]
    new_name = dashboard_metadata["newName"]
    user = str(request.user)
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
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    id = dashboard_metadata["id"]
    user = str(request.user)

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
    """API controller for the dashboards page."""
    dashboard_updates = json.loads(request.body)
    id = dashboard_updates.pop("id")
    user = str(request.user)

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
@controller(url="tethysdash/json/upload", login_required=True, app_workspace=True)
def upload_json(request, app_workspace):
    """API controller for the dashboards page."""
    json_data = json.loads(request.body)
    user = str(request.user)

    data = json_data["data"]
    filename = json_data["filename"]
    clean_data = nh3.clean(data)
    json_folder = os.path.join(app_workspace.path, "json")
    print(f"Uploading {filename}")

    try:
        if not os.path.exists(json_folder):
            os.mkdir(json_folder)

        json_file = os.path.join(json_folder, filename)
        # Writing to sample.json
        with open(json_file, "w") as outfile:
            outfile.write(clean_data)

        json_user_folder = os.path.join(json_folder, user)
        if not os.path.exists(json_user_folder):
            os.mkdir(json_user_folder)

        json_user_file = os.path.join(json_user_folder, filename)
        Path(json_user_file).touch()
        return JsonResponse({"success": True, "filename": filename})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = "Failed to upload the json. Check server for logs."

        return JsonResponse({"success": False, "message": message})


@api_view(["GET"])
@controller(url="tethysdash/json/download", login_required=False, app_workspace=True)
def download_json(request, app_workspace):
    """API controller for the dashboards page."""
    filename = request.GET["filename"]
    json_folder = os.path.join(app_workspace.path, "json")
    print(f"Getting data from {filename}")

    try:
        json_user_file = os.path.join(json_folder, filename)
        # Writing to sample.json
        with open(json_user_file, "r") as file:
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
