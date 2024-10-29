from django.http import JsonResponse
import json
from rest_framework.decorators import api_view

from tethys_sdk.routing import controller
from .app import App
from .model import (
    get_dashboards,
    add_new_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
)
from .visualizations import get_available_visualizations, get_visualization


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
    label = dashboard_metadata["label"]
    notes = dashboard_metadata["notes"]
    owner = str(request.user)
    access_groups = []
    print(f"Creating a dashboard named {label}")

    try:
        add_new_dashboard(label, name, notes, owner, access_groups)
        new_dashboard = get_dashboards(owner, name=name)[name]
        print(f"Successfully created the dashboard named {name}")

        return JsonResponse({"success": True, "new_dashboard": new_dashboard})
    except Exception as e:
        print(f"Failed to create the dashboard named {name}")
        print(e)

        return JsonResponse({"success": False})


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
        print(f"Failed to delete the dashboard named {name}")
        print(e)

        return JsonResponse({"success": False})


@api_view(["POST"])
@controller(url="tethysdash/dashboards/update", login_required=True)
def update_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    original_name = dashboard_metadata["originalName"]
    name = dashboard_metadata["name"]
    label = dashboard_metadata["label"]
    notes = dashboard_metadata["notes"]
    grid_items = dashboard_metadata["gridItems"]
    access_groups = dashboard_metadata["access_groups"]
    user = str(request.user)

    try:
        update_named_dashboard(original_name, user, name, label, notes, grid_items, access_groups)
        updated_dashboard = get_dashboards(user, name=name)[name]
        print(f"Successfully updated the dashboard named {name}")

        return JsonResponse({"success": True, "updated_dashboard": updated_dashboard})
    except Exception as e:
        print(f"Failed to update the dashboard named {name}")
        print(e)

        return JsonResponse({"success": False})
