import requests
import hjson
from django.http import JsonResponse
import re
from datetime import datetime, timedelta
from .utilities import interpolate_flow_from_rating_curve
from bs4 import BeautifulSoup


def get_cnrfc_river_forecast_data(location):
    print(f"Getting river forecast plot data for {location}")
    river_forecast_plot_web = (
        f"https://www.cnrfc.noaa.gov/graphicalRVF_printer.php?id={location}&scale=1"
    )
    response = requests.get(river_forecast_plot_web)

    print(f"-> Parsing series data")
    (
        all_dates,
        hydro_series,
        hydro_range_ymin,
        hydro_range_ymax,
        observed_forecast_split_dt,
    ) = get_hydro_data(response.text)

    hydro_thresholds = get_hydro_thresholds(location, response.text)

    print(f"-> Parsing series data")
    (forcing_series, forcing_ymin, forcing_ymax) = get_forcing_data(response.text)

    chart_title = get_title(response.text)

    all_dates.sort()
    dateticks = [
        (all_dates[0] + timedelta(days=i)).strftime("%Y-%m-%dT%H") for i in range(11)
    ]

    return JsonResponse(
        {
            "forcing_series": forcing_series,
            "forcing_ymin": forcing_ymin,
            "forcing_ymax": forcing_ymax,
            "hydro_range_ymin": hydro_range_ymin,
            "hydro_range_ymax": hydro_range_ymax,
            "hydro_series": hydro_series,
            "hydro_thresholds": hydro_thresholds,
            "observed_forecast_split_dt": observed_forecast_split_dt,
            "title": chart_title,
            "dateticks": dateticks,
        }
    )


def get_hydro_data(charting_data):
    chart_series = re.findall(r"chart.addSeries\((.*),false\);", charting_data)
    all_dates = []
    hydro_series = []
    hydro_ymin = None
    hydro_ymax = None
    for chart_data in chart_series:
        chart_data_json = hjson.loads(chart_data)
        series_name = chart_data_json["name"]
        if not series_name:
            continue
        print(f"--> Parsing {series_name} data")
        valid_dates = []
        valid_values = []
        valid_texts = []
        for data in chart_data_json["data"]:
            valid_date = datetime.fromtimestamp(data["x"] / 1000)
            valid_dates.append(valid_date.strftime("%Y-%m-%dT%H"))
            valid_values.append(data["y"])

            if data.get("flow"):
                valid_texts.append(
                    f"<i>{series_name}</i>: {data['y']} feet ({data['flow']} cfs) <extra></extra>"
                )
            else:
                valid_texts.append(f"<i>{series_name}</i>: {data['y']} feet")

            if valid_date not in all_dates:
                all_dates.append(valid_date)

        if valid_values:
            hydro_series.append(
                {
                    "title": series_name,
                    "x": valid_dates,
                    "y": valid_values,
                    "text": valid_texts,
                }
            )

            if not hydro_ymin:
                hydro_ymin = min(valid_values)
            else:
                hydro_ymin = min(hydro_ymin, min(valid_values))

            if not hydro_ymax:
                hydro_ymax = max(valid_values)
            else:
                hydro_ymax = max(hydro_ymax, max(valid_values))

            if "Observed" in series_name:
                observed_forecast_split_dt = valid_dates[-1]

    return [
        all_dates,
        hydro_series,
        hydro_ymin,
        hydro_ymax,
        observed_forecast_split_dt,
    ]


def get_hydro_thresholds(location, charting_data):
    hydro_thresholds = []
    rating_curve_flows, rating_curve_stages = get_location_rating_curve(location)
    for threshold in re.findall(
        r"chart.yAxis\[0\].addPlotLine\((.*)\);", charting_data
    ):
        threshold_json = hjson.loads(threshold)
        interpolated_flow = interpolate_flow_from_rating_curve(
            rating_curve_stages, rating_curve_flows, threshold_json["value"]
        )
        hydro_thresholds.append(
            {
                "name": threshold_json["label"]["text"] + f" ({interpolated_flow} cfs)",
                "color": threshold_json["color"],
                "value": threshold_json["value"],
            }
        )

    return hydro_thresholds


def get_forcing_data(charting_data):
    chart_series = re.findall(r"chart2.addSeries\((.*),false\);", charting_data)
    forcing_series = []
    for chart_data in chart_series:
        chart_data_json = hjson.loads(chart_data)
        series_name = chart_data_json["name"]
        if not series_name:
            continue
        print(f"--> Parsing {series_name} data")
        valid_dates = []
        valid_values = []
        for data in chart_data_json["data"]:
            valid_date = datetime.fromtimestamp(data[0] / 1000)
            valid_dates.append(valid_date.strftime("%Y-%m-%dT%H"))
            valid_values.append(data[1])

        forcing_series.append(
            {"title": series_name, "x": valid_dates, "y": valid_values}
        )

    forcing_ymin = re.findall(r"chart2.yAxis\[0\].options.min = (.*)\n", charting_data)[
        0
    ]
    forcing_ymax = re.findall(r"chart2.yAxis\[0\].options.max = (.*)\n", charting_data)[
        0
    ]

    return [forcing_series, forcing_ymin, forcing_ymax]


def get_location_rating_curve(location):
    print(f"Getting river rating curve data for {location}")
    location_rating_curve_url = (
        f"https://www.cnrfc.noaa.gov/data/ratings/{location}_rating.js"
    )
    response = requests.get(location_rating_curve_url)
    flows = [
        float(flow) for flow in re.findall(r"ratingFlow.push\((.*)\);", response.text)
    ]
    stages = [
        float(stage)
        for stage in re.findall(r"ratingStage.push\((.*)\);", response.text)
    ]

    return [flows, stages]


def get_title(charting_data):
    chart_title = re.findall(r"chart2.setTitle\((.*), false\);", charting_data)[0]
    chart_titles = hjson.loads(f"[{chart_title}]")

    main_title = chart_titles[0]
    soup = BeautifulSoup(main_title["text"], "html.parser")
    main_title_text = soup.div.contents[0]

    sub_title = chart_titles[1]
    sub_title_text = sub_title["text"]
    sub_title_text = re.findall(r"(<b>Forecast Posted:</b> .*) <b>", sub_title_text)[0]

    return main_title_text + "<br>River Forecast Plot<br>" + sub_title_text
