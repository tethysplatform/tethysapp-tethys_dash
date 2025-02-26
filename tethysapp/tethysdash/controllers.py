from django.http import JsonResponse
import json
import os
import nh3
from rest_framework.decorators import api_view

from tethys_sdk.routing import controller
from .app import App
from .model import (
    get_dashboards,
    add_new_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
    clean_up_jsons
)
from .visualizations import get_available_visualizations, get_visualization

tethysdash_base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
geojson_folder = os.path.join(tethysdash_base, "geojson")

@controller(login_required=True)
def home(request):
    """Controller for the app home page."""
    # The index.html template loads the React frontend
    return App.render(request, "index.html")


@api_view(["GET"])
@controller(login_required=True)
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
@controller(login_required=True)
def dashboards(request):
    """API controller for the dashboards page."""
    user = str(request.user)
    dashboards = get_dashboards(user)
    clean_up_jsons(user)

    return JsonResponse(dashboards)


@api_view(["GET"])
@controller(login_required=True)
def visualizations(request):
    """API controller for the visualizations page."""
    visualizations = get_available_visualizations()

    return JsonResponse(visualizations)


@api_view(["POST"])
@controller(url="tethysdash/dashboards/add", login_required=True)
def add_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]
    description = dashboard_metadata["description"]
    notes = dashboard_metadata.get("notes", "")
    access_groups = dashboard_metadata.get("accessGroups", [])
    grid_items = dashboard_metadata.get("gridItems", [])
    owner = str(request.user)
    print(f"Creating a dashboard named {name}")

    try:
        add_new_dashboard(description, name, notes, owner, access_groups, grid_items)
        new_dashboard = get_dashboards(owner, name=name)["user"][name]
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
@controller(url="tethysdash/dashboards/delete", login_required=True)
def delete_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]
    user = str(request.user)

    try:
        delete_named_dashboard(user, name)
        print(f"Successfully deleted the dashboard named {name}")

        return JsonResponse({"success": True})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = (
                f"Failed to delete the dashboard named {name}. Check server for logs."
            )

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/dashboards/update", login_required=True)
def update_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    original_name = dashboard_metadata["originalName"]
    original_access_groups = dashboard_metadata["originalAccessGroups"]
    name = dashboard_metadata["name"]
    description = dashboard_metadata["description"]
    notes = dashboard_metadata["notes"]
    grid_items = dashboard_metadata["gridItems"]
    access_groups = dashboard_metadata["accessGroups"]
    user = str(request.user)

    try:
        update_named_dashboard(
            original_name,
            original_access_groups,
            user,
            name,
            description,
            notes,
            grid_items,
            access_groups,
        )
        updated_dashboard = get_dashboards(user, name=name)["user"][name]
        print(f"Successfully updated the dashboard named {name}")

        return JsonResponse({"success": True, "updated_dashboard": updated_dashboard})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = (
                f"Failed to update the dashboard named {name}. Check server for logs."
            )

        return JsonResponse({"success": False, "message": message})


@api_view(["POST"])
@controller(url="tethysdash/json/upload", login_required=True)
def upload_geojson(request):
    """API controller for the dashboards page."""
    geojson_data = json.loads(request.body)
    user = str(request.user)
    
    data = geojson_data["data"]
    filename = geojson_data["filename"]
    clean_data = nh3.clean(data)

    try:
        if not os.path.exists(geojson_folder):
            os.mkdir(geojson_folder)
            
        geojson_user_folder = os.path.join(geojson_folder, user)
        if not os.path.exists(geojson_user_folder):
            os.mkdir(geojson_user_folder)
    
        geojson_user_file = os.path.join(geojson_user_folder, filename)
        # Writing to sample.json
        with open(geojson_user_file, "w") as outfile:
            outfile.write(clean_data)

        return JsonResponse({"success": True})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = (
                f"Failed to upload the geojson. Check server for logs."
            )

        return JsonResponse({"success": False, "message": message})


@api_view(["GET"])
@controller(url="tethysdash/json/download", login_required=True)
def download_geojson(request):
    """API controller for the dashboards page."""
    filename = request.GET["filename"]
    user = str(request.user)

    try:
        geojson_user_file = os.path.join(geojson_folder, user, filename)
        # Writing to sample.json
        with open(geojson_user_file, 'r') as file:
            data = json.load(file)
            data = json.loads(nh3.clean(json.dumps(data)))

        return JsonResponse({"success": True, "data": data})
    except Exception as e:
        print(e)
        try:
            message = e.args[0]
        except Exception:
            message = (
                f"Failed to upload the geojson. Check server for logs."
            )

        return JsonResponse({"success": False, "message": message})
