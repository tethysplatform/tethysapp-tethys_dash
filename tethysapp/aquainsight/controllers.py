from django.http import JsonResponse
import pandas as pd
import json

from tethys_sdk.routing import controller
from .app import App
from .model import get_all_dashboards, add_new_dashboard, delete_named_dashboard


@controller
def home(request):
    """Controller for the app home page."""
    # The index.html template loads the React frontend
    return App.render(request, 'index.html')


@controller
def data(request):
    """API controller for the plot page."""
    # Download example data from GitHub
    df = pd.read_csv('https://raw.githubusercontent.com/plotly/datasets/master/finance-charts-apple.csv')

    # Do data processing in Python
    l_date = df['Date'].tolist()

    # Then return JSON containing data
    return JsonResponse({
        'series': [
            {
                'title': 'AAPL High',
                'x': l_date,
                'y': df['AAPL.High'].tolist()
            },
            {
                'title': 'AAPL Low',
                'x': l_date,
                'y': df['AAPL.Low'].tolist()
            }
        ],
    })


@controller
def dashboards(request):
    """API controller for the dashboards page."""
    dashboards = get_all_dashboards()
    dashboard_dict = {}
    for dashboard in dashboards:
        dashboard_dict[dashboard.name] = {
            "name": dashboard.name,
            "label": dashboard.label,
            "image": dashboard.image,
            "notes": dashboard.notes,
            "rows": dashboard.rows
        }
    
    return JsonResponse(dashboard_dict)


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
    rows = dashboard_metadata["rows"]
    cols = dashboard_metadata["cols"]
    print(f"Creating a dashboard named {label}")

    col_width = round(100/cols)
    row_data = {}
    for row in range(1, rows+1):
        row_name = f"row{row}"
        row_data[row_name] = {}
        for col in range(1,cols+1):
            col_name = f"col{col}"
            row_data[row_name][col_name] = {"type": "plot","width": col_width}

    try:
        add_new_dashboard(label, name, image, notes, json.dumps(row_data))
        print(f"Successfully created the dashboard named {name}")
        
        return JsonResponse({"success": True})
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
