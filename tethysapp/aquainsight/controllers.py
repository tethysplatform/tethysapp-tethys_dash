from django.http import JsonResponse
import pandas as pd

from tethys_sdk.routing import controller
from .app import App
from .model import get_all_dashboards


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
            "image": dashboard.image,
            "notes": dashboard.notes,
            "rows": dashboard.rows
        }
    
    return JsonResponse(dashboard_dict)
