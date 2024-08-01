import requests
import hjson
import re
from datetime import datetime, timedelta
from .utilities import interpolate_flow_from_rating_curve, interpolate_stage_from_rating_curve
from bs4 import BeautifulSoup
import pandas as pd


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

    rating_curve_flows, rating_curve_stages = get_location_rating_curve(location)
    hydro_thresholds = get_hydro_thresholds(rating_curve_flows, rating_curve_stages, response.text)

    print(f"-> Parsing series data")
    (forcing_series, forcing_ymin, forcing_ymax) = get_forcing_data(response.text)

    chart_title = get_title(response.text)

    all_dates.sort()
    dateticks = [
        (all_dates[0] + timedelta(days=i)).strftime("%Y-%m-%dT%H") for i in range(11)
    ]

    return {
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

def get_cnrfc_hefs_data(location, location_proper_name):
    rating_curve_flows, rating_curve_stages = get_location_rating_curve(location)
    hefs_series = get_hefs_data(location, rating_curve_flows, rating_curve_stages)
    
    hefs_metadata = get_hefs_metadata(location)

    print(f"Getting river forecast plot data for {location}")
    river_forecast_plot_web = (
        f"https://www.cnrfc.noaa.gov/graphicalRVF_printer.php?id={location}&scale=1"
    )
    response = requests.get(river_forecast_plot_web)

    print(f"-> Parsing series data")
    (
        deterministic_dates,
        deterministic_series,
        deterministic_range_ymin,
        deterministic_range_ymax,
        observed_forecast_split_dt,
    ) = get_hydro_data(response.text)

    hydro_thresholds = get_hydro_thresholds(rating_curve_flows, rating_curve_stages, response.text)

    chart_title = f"Hourly River Level Probabilities<br>{location_proper_name}<br><b>Issuance Time</b>: {hefs_metadata["issuance_time"]}"

    deterministic_dates.sort()
    hefs_last_date = hefs_series['mean']['x'][-1]
    
    dateticks = pd.date_range(deterministic_dates[0], hefs_series['mean']['x'][-1], 10)
    dateticks = [datetick.strftime("%Y-%m-%dT%H") for datetick in dateticks]
    ten_day_hefs_min = min(hefs_series['min']['y'][:239])
    ten_day_hefs_max = max(hefs_series['max']['y'][:239])

    return {
        "hefs_series": hefs_series,
        "range_ymin": min(deterministic_range_ymin, ten_day_hefs_min),
        "range_ymax": max(deterministic_range_ymax, ten_day_hefs_max),
        "range_xmin": deterministic_dates[0],
        "range_xmax": hefs_series['mean']['x'][239],
        "deterministic_series": deterministic_series,
        "hydro_thresholds": hydro_thresholds,
        "observed_forecast_split_dt": observed_forecast_split_dt,
        "title": chart_title,
        "dateticks": dateticks,
    }


def get_hefs_data(location, rating_curve_flows, rating_curve_stages):
    print(f"Getting HEFS plot data for {location}")
    try:
        unit = "feet"
        hefs_csv_url = (
            f"https://www.cnrfc.noaa.gov/csv/{location}_hefs_csv_hourly_sstg.csv"
        )
        df = pd.read_csv(hefs_csv_url)
    except:
        unit = "cfs"
        hefs_csv_url = (
            f"https://www.cnrfc.noaa.gov/csv/{location}_hefs_csv_hourly.csv"
        )
        df = pd.read_csv(hefs_csv_url)
    df = df.drop(0)
    df = df.set_index("GMT")
    df = df.astype(float)
    if unit == "cfs":
        df = df * 1000
    ens_columns = [f"Ensemble {i}" for i in range(len(df.columns))]
    df.columns = ens_columns
    df_stats = df.T.quantile([0, .05, .25, .4, .6, .75, .95, 1]).T
    df_stats['mean'] = df.T.mean()
    df = df.merge(df_stats, how="left", left_index=True, right_index=True)
    dates = df.index.tolist()
    if unit == "cfs":
        df_flow = df
        df_stage = df.map(lambda x: interpolate_stage_from_rating_curve(rating_curve_stages, rating_curve_flows, x))
        df_flow = df_flow.reset_index()
        df_stage = df_stage.reset_index()
    else:
        df_stage = df
        df_flow = df.map(lambda x: interpolate_flow_from_rating_curve(rating_curve_stages, rating_curve_flows, x))
        df_flow = df_flow.reset_index()
        df_stage = df_stage.reset_index()
    del df

    ensemble_series = []
    for ens in ens_columns:
        ensemble_series.append({
            "title": ens,
            "x": dates,
            "y": df_stage[ens].tolist()
        })
    hefs_series = {
        "ensembles": ensemble_series,
        "min": {
            "title": "Minimum",
            "x": dates,
            "y": df_stage[0].tolist(),
            "text": [f"<i>Minimum</i>: {round(df_stage.loc[i, 0], 2)} feet ({round(df_flow.loc[i, 0], 2)} cfs)" for i in range(len(dates))]
        },
        "max": {
            "title": "Maximum",
            "x": dates,
            "y": df_stage[1].tolist(),
            "text": [f"<i>Maximum</i>: {round(df_stage.loc[i, 1], 2)} feet ({round(df_flow.loc[i, 1], 2)} cfs)" for i in range(len(dates))]
        },
        "5%": {
            "title": "5% Percentile",
            "x": dates,
            "y": df_stage[.05].tolist(),
            "text": [f"<i>5%</i>: {round(df_stage.loc[i, .05], 2)} feet ({round(df_flow.loc[i, .05], 2)} cfs)" for i in range(len(dates))]
        },
        "25%": {
            "title": "25% Percentile",
            "x": dates,
            "y": df_stage[.25].tolist(),
            "text": [f"<i>25%</i>: {round(df_stage.loc[i, .25], 2)} feet ({round(df_flow.loc[i, .25], 2)} cfs)" for i in range(len(dates))]
        },
        "40%": {
            "title": "40% Percentile",
            "x": dates,
            "y": df_stage[.4].tolist(),
            "text": [f"<i>40%</i>: {round(df_stage.loc[i, .4], 2)} feet ({round(df_flow.loc[i, .4], 2)} cfs)" for i in range(len(dates))]
        },
        "60%": {
            "title": "60% Percentile",
            "x": dates,
            "y": df_stage[.6].tolist(),
            "text": [f"<i>60%</i>: {round(df_stage.loc[i, .6], 2)} feet ({round(df_flow.loc[i, .6], 2)} cfs)" for i in range(len(dates))]
        },
        "75%": {
            "title": "75% Percentile",
            "x": dates,
            "y": df_stage[.75].tolist(),
            "text": [f"<i>75%</i>: {round(df_stage.loc[i, .75], 2)} feet ({round(df_flow.loc[i, .75], 2)} cfs)" for i in range(len(dates))]
        },
        "95%": {
            "title": "95% Percentile",
            "x": dates,
            "y": df_stage[.95].tolist(),
            "text": [f"<i>95%</i>: {round(df_stage.loc[i, .95], 2)} feet ({round(df_flow.loc[i, .95], 2)} cfs)" for i in range(len(dates))]
        },
        "hourly_probabilities": [{
            "title": "0-5% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[.05], df_stage[0][::-1]]).tolist(),
            "color": "lightgray",
            "showlegend": True
        },{
            "title": "0-5% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[1], df_stage[.95][::-1]]).tolist(),
            "color": "lightgray",
            "showlegend": False
        },{
            "title": "5-25% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[.95], df_stage[.75][::-1]]).tolist(),
            "color": "#B6BEFC",
            "showlegend": True
        },{
            "title": "5-25% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[.25], df_stage[.05][::-1]]).tolist(),
            "color": "#B6BEFC",
            "showlegend": False
        },{
            "title": "25-40% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[.75], df_stage[.6][::-1]]).tolist(),
            "color": "#FBFBCF",
            "showlegend": True
        },{
            "title": "25-40% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[.4], df_stage[.25][::-1]]).tolist(),
            "color": "#FBFBCF",
            "showlegend": False
        },{
            "title": "40-60% chance",
            "x": dates + dates[::-1],
            "y": pd.concat([df_stage[.6], df_stage[.4][::-1]]).tolist(),
            "color": "#F7EBA7",
            "showlegend": True
        }],
        "mean": {
            "title": "Ensemble Mean",
            "x": dates,
            "y": df_stage["mean"].tolist(),
            "text": [f"<i>Mean</i>: {round(df_stage.loc[i, "mean"], 2)} feet ({round(df_flow.loc[i, "mean"], 2)} cfs)" for i in range(len(dates))]
        }
        
    }

    return hefs_series

def get_hefs_metadata(location):
    print(f"Getting HEFS metadata for {location}")
    hefs_plot_web = (
        f"https://www.cnrfc.noaa.gov/ensembleProduct.php?id={location}"
    )
    response = requests.get(hefs_plot_web)
    issuance_time_tag = re.findall(r"(Issuance Time: .*?<\/tr>)", response.text)[0]
    issuance_time_tag = issuance_time_tag.split("</td>", 1)[1]
    soup = BeautifulSoup(issuance_time_tag, "html.parser")
    issuance_time = soup.td.contents[0]
    
    return {
        "issuance_time": issuance_time
    }
    


def get_hydro_data(charting_data):
    chart_series = re.findall(r"chart.addSeries\((.*),false\);", charting_data)
    all_dates = []
    hydro_series = []
    hydro_ymin = None
    hydro_ymax = None
    observed_forecast_split_dt = None
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


def get_hydro_thresholds(rating_curve_flows, rating_curve_stages, charting_data):
    hydro_thresholds = []
    for threshold in re.findall(
        r"chart.yAxis\[0\].addPlotLine\((.*)\);", charting_data
    ):
        threshold_json = hjson.loads(threshold)
        interpolated_flow = interpolate_flow_from_rating_curve(
            rating_curve_stages, rating_curve_flows, threshold_json["value"]
        )
        hydro_thresholds.append(
            {
                "name": threshold_json["label"]["text"] + f" ({round(interpolated_flow, 2)} cfs)",
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


def get_impact_statement(location):
    metadata = get_nwps_location_metadata(location)
    return metadata['flood'].get('impacts', {})

def get_nwps_location_metadata(location):
    response = requests.get(f"https://api.water.noaa.gov/nwps/v1/gauges/{location}")
    return response.json()
    