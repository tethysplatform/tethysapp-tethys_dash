from django.http import JsonResponse
import json

from tethys_sdk.routing import controller
from .app import App
from .model import (
    get_dashboards,
    add_new_dashboard,
    delete_named_dashboard,
    update_named_dashboard,
)
from .data.usace import get_usace_data
from .data.cdec import get_cdec_data
from .data.cnrfc import get_cnrfc_river_forecast_data, get_impact_statement, get_cnrfc_hefs_data


@controller
def home(request):
    """Controller for the app home page."""
    # The index.html template loads the React frontend
    return App.render(request, "index.html")


@controller
def data(request):
    """API controller for the plot page."""
    metadata = json.loads(request.GET["metadata"])
    data = None
    success = True

    try:
        if request.GET["type"] == "USACEPlot":
            data = get_usace_data(metadata["location"], metadata["year"])

        elif request.GET["type"] == "CDECPlot":
            data = get_cdec_data(
                metadata["station"], metadata.get("start"), metadata.get("end")
            )

        elif request.GET["type"] == "CNRFCRiverForecastPlot":
            data = get_cnrfc_river_forecast_data(metadata["location"])

        elif request.GET["type"] == "CNRFCHEFSPlot":
            data = get_cnrfc_hefs_data(metadata["location"], metadata["location_proper_name"])

        elif request.GET["type"] == "ImpactStatement":
            data = get_impact_statement(metadata["location"])
    except Exception as e:
        print("Failed to retrieve data")
        print(e)
        success = False

    return JsonResponse({"success": success, "data": data})


@controller
def dashboards(request):
    """API controller for the dashboards page."""
    dashboards = get_dashboards()

    return JsonResponse(dashboards)


@controller(
    url="aquainsight/dashboards/add",
)
def add_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]
    label = dashboard_metadata["label"]
    image = dashboard_metadata["image"]
    notes = dashboard_metadata["notes"]
    row_data = dashboard_metadata["rowData"]
    print(f"Creating a dashboard named {label}")

    try:
        add_new_dashboard(label, name, image, notes, row_data)
        new_dashboard = get_dashboards(name=name)[name]
        print(f"Successfully created the dashboard named {name}")

        return JsonResponse({"success": True, "new_dashboard": new_dashboard})
    except Exception as e:
        print(f"Failed to create the dashboard named {name}")
        print(e)

        return JsonResponse({"success": False})


@controller(
    url="aquainsight/dashboards/delete",
)
def delete_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]

    try:
        delete_named_dashboard(name)
        print(f"Successfully deleted the dashboard named {name}")

        return JsonResponse({"success": True})
    except Exception as e:
        print(f"Failed to delete the dashboard named {name}")
        print(e)

        return JsonResponse({"success": False})


@controller(
    url="aquainsight/dashboards/update",
)
def update_dashboard(request):
    """API controller for the dashboards page."""
    dashboard_metadata = json.loads(request.body)
    name = dashboard_metadata["name"]
    label = dashboard_metadata["label"]
    image = dashboard_metadata["image"]
    notes = dashboard_metadata["notes"]
    row_data = dashboard_metadata["rowData"]

    try:
        update_named_dashboard(name, label, image, notes, row_data)
        updated_dashboard = get_dashboards(name=name)[name]
        print(f"Successfully updated the dashboard named {name}")

        return JsonResponse({"success": True, "updated_dashboard": updated_dashboard})
    except Exception as e:
        print(f"Failed to update the dashboard named {name}")
        print(e)

        return JsonResponse({"success": False})
