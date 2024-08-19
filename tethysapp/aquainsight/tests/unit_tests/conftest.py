import pytest
from datetime import datetime
import pandas as pd
import json


@pytest.fixture(scope="function")
def cnrfc_det_forecast():
    forecast_file = "./tethysapp/aquainsight/tests/files/cnrfc_river_forecast.html"
    with open(forecast_file) as f:
        forecast_text = f.read()

    return forecast_text


@pytest.fixture(scope="function")
def cnrfc_det_forecast_hydro_series():
    return [
        {
            "title": "Observed (Raw Gauge)",
            "x": ["2024-08-09T15:30", "2024-08-09T15:45"],
            "y": [4.8, 4.8],
            "text": [
                "<i>Observed (Raw Gauge)</i>: 4.8 feet (347 cfs)",
                "<i>Observed (Raw Gauge)</i>: 4.8 feet (347 cfs)",
            ],
        },
        {
            "title": "Observed (Simulated)",
            "x": ["2024-08-09T15:30", "2024-08-09T15:45"],
            "y": [4.8, 4.8],
            "text": [
                "<i>Observed (Simulated)</i>: 4.8 feet (347 cfs)",
                "<i>Observed (Simulated)</i>: 4.8 feet (347 cfs)",
            ],
        },
        {
            "title": "Forecast",
            "x": ["2024-08-09T16:00", "2024-08-09T17:00"],
            "y": [4.79, 4.79],
            "text": [
                "<i>Forecast</i>: 4.79 feet (342 cfs)",
                "<i>Forecast</i>: 4.79 feet (342 cfs)",
            ],
        },
        {
            "title": "Guidance",
            "x": ["2024-08-09T18:00", "2024-08-09T19:00"],
            "y": [4.77, 4.77],
            "text": [
                "<i>Guidance</i>: 4.77 feet",
                "<i>Guidance</i>: 4.77 feet",
            ],
        },
    ]


@pytest.fixture(scope="function")
def cnrfc_det_forecast_forcing_series():
    return [
        {
            "title": "6 Hr Observed",
            "x": ["2024-08-09T18", "2024-08-10T00"],
            "y": [0, 0.1],
        },
        {
            "title": "6Hr Forecast",
            "x": ["2024-08-10T06", "2024-08-10T12"],
            "y": [0.2, 0.3],
        },
    ]


@pytest.fixture(scope="function")
def cnrfc_det_forecast_hydro_thresholds():
    return [
        {
            "name": "Monitor: 25.0 Ft (5104307.75 cfs)",
            "color": "rgb(255,153,0)",
            "value": 25,
        },
        {
            "name": "Flood: 29.0 Ft (12100717.04 cfs)",
            "color": "rgb(255,0,0)",
            "value": 29,
        },
    ]


@pytest.fixture(scope="function")
def cnrfc_det_forecast_chart_title():
    return "Smith River - Jedediah Smith SP (CREC1)<br>River Forecast Plot<br><b>Forecast Posted:</b> 08/14/2024 at  8:08 AM PDT"  # noqa: E501


@pytest.fixture(scope="function")
def cnrfc_det_forecast_forcing_ymin():
    return 0.0


@pytest.fixture(scope="function")
def cnrfc_det_forecast_forcing_ymax():
    return 0.3


@pytest.fixture(scope="function")
def cnrfc_det_forecast_hydro_range_ymin():
    return 4.77


@pytest.fixture(scope="function")
def cnrfc_det_forecast_hydro_range_ymax():
    return 4.8


@pytest.fixture(scope="function")
def cnrfc_det_forecast_observed_forecast_split_dt():
    return "2024-08-09T15:45"


@pytest.fixture(scope="function")
def cnrfc_det_forecast_all_dates():
    return [
        datetime(2024, 8, 9, 15, 30),
        datetime(2024, 8, 9, 15, 45),
        datetime(2024, 8, 9, 16, 00),
        datetime(2024, 8, 9, 17, 00),
        datetime(2024, 8, 9, 18, 00),
        datetime(2024, 8, 9, 19, 00),
    ]


@pytest.fixture(scope="function")
def cnrfc_rating_curve():
    rating_curve_file = "./tethysapp/aquainsight/tests/files/cnrfc_rating_curve.js"
    with open(rating_curve_file) as f:
        rating_curve_text = f.read()

    return rating_curve_text


@pytest.fixture(scope="function")
def cnrfc_rating_curve_flows():
    return [329.9, 334.02, 338.18, 342.35, 346.55, 350.77]


@pytest.fixture(scope="function")
def cnrfc_rating_curve_stages():
    return [4.76, 4.77, 4.78, 4.79, 4.8, 4.81]


@pytest.fixture(scope="function")
def cnrfc_hefs_stage_forecast():
    hefs_csv = "./tethysapp/aquainsight/tests/files/cnrfc_hefs_csv_hourly_sstg.csv"
    return pd.read_csv(hefs_csv)


@pytest.fixture(scope="function")
def cnrfc_hefs_stage_ensembles():
    return [
        {
            "title": "Ensemble 0",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53658, 4.54174, 4.54594],
        },
        {
            "title": "Ensemble 1",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.5121, 4.5119, 4.5117],
        },
        {
            "title": "Ensemble 2",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.51278, 4.51252, 4.51227],
        },
        {
            "title": "Ensemble 3",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.5186, 4.51831, 4.51806],
        },
        {
            "title": "Ensemble 4",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.51369, 4.51343, 4.51318],
        },
        {
            "title": "Ensemble 5",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.92073, 4.96912, 5.00867],
        },
        {
            "title": "Ensemble 6",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.51298, 4.51269, 4.51241],
        },
        {
            "title": "Ensemble 7",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.51224, 4.51201, 4.51181],
        },
        {
            "title": "Ensemble 8",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.51338, 4.51318, 4.51295],
        },
        {
            "title": "Ensemble 9",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.51224, 4.51204, 4.51184],
        },
    ]


@pytest.fixture(scope="function")
def cnrfc_hefs_stage_stats():
    return {
        "min": {
            "title": "Minimum",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.5121, 4.5119, 4.5117],
            "text": [
                "<i>Minimum</i>: 4.51 feet (227.77 cfs)",
                "<i>Minimum</i>: 4.51 feet (227.68 cfs)",
                "<i>Minimum</i>: 4.51 feet (227.6 cfs)",
            ],
        },
        "max": {
            "title": "Maximum",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.92073, 4.96912, 5.00867],
            "text": [
                "<i>Maximum</i>: 4.92 feet (400.41 cfs)",
                "<i>Maximum</i>: 4.97 feet (423.86 cfs)",
                "<i>Maximum</i>: 5.01 feet (443.86 cfs)",
            ],
        },
        "5%": {
            "title": "5% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.512163, 4.5119495, 4.5117495],
            "text": [
                "<i>5%</i>: 4.51 feet (227.79 cfs)",
                "<i>5%</i>: 4.51 feet (227.7 cfs)",
                "<i>5%</i>: 4.51 feet (227.62 cfs)",
            ],
        },
        "25%": {
            "title": "25% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.5123750000000005, 4.51216, 4.5119475],
            "text": [
                "<i>25%</i>: 4.51 feet (227.88 cfs)",
                "<i>25%</i>: 4.51 feet (227.79 cfs)",
                "<i>25%</i>: 4.51 feet (227.7 cfs)",
            ],
        },
        "40%": {
            "title": "40% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.5129, 4.512622, 4.512354],
            "text": [
                "<i>40%</i>: 4.51 feet (228.09 cfs)",
                "<i>40%</i>: 4.51 feet (227.98 cfs)",
                "<i>40%</i>: 4.51 feet (227.87 cfs)",
            ],
        },
        "60%": {
            "title": "60% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.513504, 4.51328, 4.513042],
            "text": [
                "<i>60%</i>: 4.51 feet (228.34 cfs)",
                "<i>60%</i>: 4.51 feet (228.25 cfs)",
                "<i>60%</i>: 4.51 feet (228.15 cfs)",
            ],
        },
        "75%": {
            "title": "75% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.5173725000000005, 4.51709, 4.51684],
            "text": [
                "<i>75%</i>: 4.52 feet (229.94 cfs)",
                "<i>75%</i>: 4.52 feet (229.82 cfs)",
                "<i>75%</i>: 4.52 feet (229.72 cfs)",
            ],
        },
        "95%": {
            "title": "95% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.747862499999999, 4.776799, 4.8004415],
            "text": [
                "<i>95%</i>: 4.75 feet (324.9 cfs)",
                "<i>95%</i>: 4.78 feet (336.84 cfs)",
                "<i>95%</i>: 4.8 feet (346.74 cfs)",
            ],
        },
        "hourly_probabilities": [
            {
                "title": "0-5% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [4.512163, 4.5119495, 4.5117495, 4.5117, 4.5119, 4.5121],
                "color": "lightgray",
                "showlegend": True,
            },
            {
                "title": "0-5% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.92073,
                    4.96912,
                    5.00867,
                    4.8004415,
                    4.776799,
                    4.747862499999999,
                ],
                "color": "lightgray",
                "showlegend": False,
            },
            {
                "title": "5-25% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.747862499999999,
                    4.776799,
                    4.8004415,
                    4.51684,
                    4.51709,
                    4.5173725000000005,
                ],
                "color": "#B6BEFC",
                "showlegend": True,
            },
            {
                "title": "5-25% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.5123750000000005,
                    4.51216,
                    4.5119475,
                    4.5117495,
                    4.5119495,
                    4.512163,
                ],
                "color": "#B6BEFC",
                "showlegend": False,
            },
            {
                "title": "25-40% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.5173725000000005,
                    4.51709,
                    4.51684,
                    4.513042,
                    4.51328,
                    4.513504,
                ],
                "color": "#FBFBCF",
                "showlegend": True,
            },
            {
                "title": "25-40% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.5129,
                    4.512622,
                    4.512354,
                    4.5119475,
                    4.51216,
                    4.5123750000000005,
                ],
                "color": "#FBFBCF",
                "showlegend": False,
            },
            {
                "title": "40-60% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [4.513504, 4.51328, 4.513042, 4.512354, 4.512622, 4.5129],
                "color": "#F7EBA7",
                "showlegend": True,
            },
        ],
        "mean": {
            "title": "Ensemble Mean",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.556531999999999, 4.561693999999999, 4.565883],
            "text": [
                "<i>Mean</i>: 4.56 feet (246.07 cfs)",
                "<i>Mean</i>: 4.56 feet (248.2 cfs)",
                "<i>Mean</i>: 4.57 feet (249.92 cfs)",
            ],
        },
    }


@pytest.fixture(scope="function")
def cnrfc_hefs_flow_forecast():
    hefs_csv = "./tethysapp/aquainsight/tests/files/cnrfc_hefs_csv_hourly.csv"
    return pd.read_csv(hefs_csv)


@pytest.fixture(scope="function")
def cnrfc_hefs_flow_ensembles():
    return [
        {
            "title": "Ensemble 0",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.55, 4.56, 4.56],
        },
        {
            "title": "Ensemble 1",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
        {
            "title": "Ensemble 2",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
        {
            "title": "Ensemble 3",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.54, 4.54, 4.54],
        },
        {
            "title": "Ensemble 4",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
        {
            "title": "Ensemble 5",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.68, 4.64, 4.61],
        },
        {
            "title": "Ensemble 6",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
        {
            "title": "Ensemble 7",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
        {
            "title": "Ensemble 8",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
        {
            "title": "Ensemble 9",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
        },
    ]


@pytest.fixture(scope="function")
def cnrfc_hefs_flow_stats():
    return {
        "min": {
            "title": "Minimum",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
            "text": [
                "<i>Minimum</i>: 4.53 feet (235.24 cfs)",
                "<i>Minimum</i>: 4.53 feet (235.17 cfs)",
                "<i>Minimum</i>: 4.53 feet (235.1 cfs)",
            ],
        },
        "max": {
            "title": "Maximum",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.68, 4.64, 4.61],
            "text": [
                "<i>Maximum</i>: 4.68 feet (399.14 cfs)",
                "<i>Maximum</i>: 4.64 feet (421.17 cfs)",
                "<i>Maximum</i>: 4.61 feet (439.98 cfs)",
            ],
        },
        "5%": {
            "title": "5% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
            "text": [
                "<i>5%</i>: 4.53 feet (235.26 cfs)",
                "<i>5%</i>: 4.53 feet (235.19 cfs)",
                "<i>5%</i>: 4.53 feet (235.12 cfs)",
            ],
        },
        "25%": {
            "title": "25% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
            "text": [
                "<i>25%</i>: 4.53 feet (235.34 cfs)",
                "<i>25%</i>: 4.53 feet (235.26 cfs)",
                "<i>25%</i>: 4.53 feet (235.19 cfs)",
            ],
        },
        "40%": {
            "title": "40% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
            "text": [
                "<i>40%</i>: 4.53 feet (235.52 cfs)",
                "<i>40%</i>: 4.53 feet (235.43 cfs)",
                "<i>40%</i>: 4.53 feet (235.33 cfs)",
            ],
        },
        "60%": {
            "title": "60% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
            "text": [
                "<i>60%</i>: 4.53 feet (235.73 cfs)",
                "<i>60%</i>: 4.53 feet (235.66 cfs)",
                "<i>60%</i>: 4.53 feet (235.57 cfs)",
            ],
        },
        "75%": {
            "title": "75% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.53, 4.53, 4.53],
            "text": [
                "<i>75%</i>: 4.53 feet (237.1 cfs)",
                "<i>75%</i>: 4.53 feet (237.0 cfs)",
                "<i>75%</i>: 4.53 feet (236.91 cfs)",
            ],
        },
        "95%": {
            "title": "95% Percentile",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.76, 4.79, 4.78],
            "text": [
                "<i>95%</i>: 4.76 feet (329.3 cfs)",
                "<i>95%</i>: 4.79 feet (342.24 cfs)",
                "<i>95%</i>: 4.78 feet (353.27 cfs)",
            ],
        },
        "hourly_probabilities": [
            {
                "title": "0-5% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                ],
                "color": "lightgray",
                "showlegend": True,
            },
            {
                "title": "0-5% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.68,
                    4.64,
                    4.61,
                    4.78,
                    4.79,
                    4.76,
                ],
                "color": "lightgray",
                "showlegend": False,
            },
            {
                "title": "5-25% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.76,
                    4.79,
                    4.78,
                    4.53,
                    4.53,
                    4.53,
                ],
                "color": "#B6BEFC",
                "showlegend": True,
            },
            {
                "title": "5-25% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                ],
                "color": "#B6BEFC",
                "showlegend": False,
            },
            {
                "title": "25-40% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                ],
                "color": "#FBFBCF",
                "showlegend": True,
            },
            {
                "title": "25-40% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                ],
                "color": "#FBFBCF",
                "showlegend": False,
            },
            {
                "title": "40-60% chance",
                "x": [
                    "2024-09-14 08:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 10:00:00",
                    "2024-09-14 09:00:00",
                    "2024-09-14 08:00:00",
                ],
                "y": [
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                    4.53,
                ],
                "color": "#F7EBA7",
                "showlegend": True,
            },
        ],
        "mean": {
            "title": "Ensemble Mean",
            "x": ["2024-09-14 08:00:00", "2024-09-14 09:00:00", "2024-09-14 10:00:00"],
            "y": [4.57, 4.58, 4.58],
            "text": [
                "<i>Mean</i>: 4.57 feet (252.89 cfs)",
                "<i>Mean</i>: 4.58 feet (255.21 cfs)",
                "<i>Mean</i>: 4.58 feet (257.18 cfs)",
            ],
        },
    }


@pytest.fixture(scope="function")
def cnrfc_hefs_forecast_page():
    hefs_forecast_file = "./tethysapp/aquainsight/tests/files/cnrfc_hefs_metadata.html"
    with open(hefs_forecast_file) as f:
        hefs_forecast_text = f.read()

    return hefs_forecast_text


@pytest.fixture(scope="function")
def cnrfc_hefs_forecast_issuance_time():

    return "Aug 15, 2024 at 8:24 AM PDT"


@pytest.fixture(scope="function")
def nwps_api_data():
    nwps_api_file = "./tethysapp/aquainsight/tests/files/nwps_api.json"
    with open(nwps_api_file) as f:
        nwps_api_data = json.load(f)

    return nwps_api_data


@pytest.fixture(scope="function")
def nwps_impact_statements():

    return [
        {
            "stage": 39,
            "statement": "Extensive and severe flooding of all areas near the river will occur. Significant damage to roads, bridges and other structures near the river is likely. All low lying areas in and around the river will be flooded. All persons in the area should be prepared to take appropriate action to protect life and property.",  # noqa: E501
        },
        {
            "stage": 37,
            "statement": "Severe damage could be inflicted upon roads, bridges and other structures. All low lying areas in and around the river are likely to be flooded. Persons in these areas should be prepared to take appropriate actions to protect life and property.",  # noqa: E501
        },
        {
            "stage": 36,
            "statement": "Extensive is flooding possible along Highway 197 and US Highway 199 in the Gasquet area. Homes and campgrounds in these areas could be threatened, including portions of Jedediah Smith State Park.",  # noqa: E501
        },
        {
            "stage": 35,
            "statement": "Considerable flooding along Highway 197 and US Highway 199 in the Gasquet area will occur. Low lying homes in these areas are likely to be threatened.",  # noqa: E501
        },
        {
            "stage": 34,
            "statement": "Significant flooding along Highway 197 and along US Highway 199 in the Gasquet area. Some low-lying homes in these areas may be threatened.",  # noqa: E501
        },
        {
            "stage": 32,
            "statement": "Significant flooding along Highway 197 in the Gasquet area, with possible flooding of US Highway 199 near Gasquet. Some low-lying homes in these areas may be threatened.",  # noqa: E501
        },
        {
            "stage": 29,
            "statement": "Flooding along Highway 197 and low-lying roads near Gasquet is likely.",  # noqa: E501
        },
        {
            "stage": 28,
            "statement": "Flooding along lower portions of Highway 197 with possible flooding of roads near Gasquet.",  # noqa: E501
        },
        {
            "stage": 26,
            "statement": "Expect minor flooding along Highway 197 and other low-lying areas near the river.",  # noqa: E501
        },
        {
            "stage": 25,
            "statement": "Minor flooding of the lowest lying areas near the river may occur.",  # noqa: E501
        },
    ]


@pytest.fixture(scope="function")
def usace_time_series_plot_data():
    forecast_file = "./tethysapp/aquainsight/tests/files/usace_time_series_plot.txt"
    with open(forecast_file) as f:
        forecast_text = f.read()

    return forecast_text


@pytest.fixture(scope="function")
def usace_time_series_meta_json():
    meta_file = "./tethysapp/aquainsight/tests/files/usace_time_series_meta.json"
    with open(meta_file) as f:
        meta_json = json.load(f)

    return meta_json


@pytest.fixture(scope="function")
def usace_expected_ts_df():
    df = pd.read_csv("./tethysapp/aquainsight/tests/files/usace_expected_ts_df.csv")
    df["Datetime"] = pd.to_datetime(df["Datetime"])
    return df


@pytest.fixture(scope="function")
def usace_expected_ts_title():
    return " Coyote Valley Dam / Lake Mendocino - Russian River Basin<br>WY 2024 | Generated: 2024-08-16T12:06:15-0700"  # noqa: E501


@pytest.fixture(scope="function")
def usace_expected_ts_series():
    return {
        "storage": [
            {
                "title": "Top of Conservation High (ac-ft)",
                "x": ["2023-08-31T07"],
                "y": ["111000.00"],
            },
            {
                "title": "Top of Conservation (ac-ft)",
                "x": ["2023-08-31T07"],
                "y": ["86400.00"],
            },
            {
                "title": "Storage (ac-ft)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["84192.00", "84192.00", "84157.00", "84157.00"],
            },
            {"title": "Gross Pool", "x": [], "y": []},
        ],
        "elevation": [
            {
                "title": "Elevation (ft-NGVD29)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["746.75", "746.75", "746.73", "746.73"],
            },
            {"title": "Gross Pool(elev)", "x": [], "y": []},
        ],
        "flow": [
            {
                "title": "Inflow (cfs)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["189.00", "189.00", "-234.50", "189.00"],
            },
            {
                "title": "Outflow (cfs; 614 ft)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["189.00", "189.00", "189.00", "189.00"],
            },
            {
                "title": "Russian R @ Hopland (cfs; USGS)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["169.00", "169.50", "170.00", "171.67"],
            },
            {
                "title": "Russian R nr Ukiah (cfs)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["0.02", "0.02", "0.02", "0.02"],
            },
        ],
        "precip": [
            {
                "title": "Precip @ Dam (in; 670 ft)",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["0.00", "0.00", "0.00", "0.00"],
            },
            {"title": "Basin Precip", "x": [], "y": []},
        ],
        "swe": [
            {
                "title": "swe",
                "x": [
                    "2023-08-31T07",
                    "2023-08-31T08",
                    "2023-08-31T09",
                    "2023-08-31T10",
                ],
                "y": ["1", "2", "3", "4"],
            },
        ],
    }


@pytest.fixture(scope="function")
def usace_expected_ts_ymarkers():
    return {
        "Gross Pool(elev)": {
            "xlocation": "2023-12-09",
            "value": "764.8",
            "offset": 1.03,
        },
        "Gross Pool": {"xlocation": "2023-12-09", "value": "116470", "offset": 1.03},
    }
