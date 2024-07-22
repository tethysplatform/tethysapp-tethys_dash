import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta, timezone
import re


def get_usace_plot_data(location, year, time_period="h", metadata=False):
    print("Getting CWMS Metadata")
    data_type = "meta" if metadata else "plot"
    meta_url = f"https://www.spk-wc.usace.army.mil/fcgi-bin/compressed.py?href=/plots/csv/{location}{time_period}_{year}.{data_type}"
    res = requests.get(meta_url, verify=False)

    if res.status_code == 404:
        return None
    else:
        return res


def parse_usace_data(data):
    print("Parsing CWMS Data")
    data = [data_point.split(",") for data_point in data.text.split("\n")]
    columns = [data_point.replace('"', "") for data_point in data[0]]
    df = pd.DataFrame(data[1:-1], columns=columns)
    drop_columns = [column for column in columns if "notes" in column]
    drop_columns.append("ISO 8601 Date Time")
    dates = df["ISO 8601 Date Time"].tolist()
    # fix issue where hour 24 is used instead of hour 0
    dates = [
        (
            pd.to_datetime(date.replace("T24", "T00")).tz_convert("UTC")
            + timedelta(days=1)
            if re.findall(".*-(.*)T24", date)
            else pd.to_datetime(date).tz_convert("UTC")
        )
        for date in dates
    ]
    df["Datetime"] = dates
    df = df.drop(columns=drop_columns)
    df = df[~(df["Datetime"] >= pd.to_datetime(datetime.now(timezone.utc), utc=True))]
    df = df.replace("-", np.nan)

    return df


def merge_dataframe(df, new_df):
    df = df.set_index("Datetime")
    new_df = new_df.set_index("Datetime")
    df.update(new_df, overwrite=False)

    return df.reset_index()


def get_water_year(date):
    if date.month >= 10:
        return date.year + 1
    return date.year


def get_usace_data(location, year):
    """API controller for the plot page."""
    year = year if year else get_water_year(datetime.now())
    metadata = get_usace_plot_data(location, year, metadata=True)
    if not metadata:
        metadata = get_usace_plot_data(location, year, metadata=True, time_period="d")
    metadata = metadata.json()

    data_groups = {
        "storage": metadata["groups"]["storage"],
        "elevation": metadata["groups"]["elev"],
    }
    if metadata["groups"].get("topcon"):
        data_groups["storage"] = metadata["groups"]["topcon"] + data_groups["storage"]

    if metadata["groups"].get("inflow"):
        if "flow" not in data_groups:
            data_groups["flow"] = []
        data_groups["flow"] += metadata["groups"]["inflow"]

    if metadata["groups"].get("outflow"):
        if "flow" not in data_groups:
            data_groups["flow"] = []
        data_groups["flow"] += metadata["groups"]["outflow"]

    if metadata["groups"].get("flow"):
        if "flow" not in data_groups:
            data_groups["flow"] = []
        data_groups["flow"] += metadata["groups"]["flow"]

    if metadata["groups"].get("swe"):
        data_groups["swe"] = metadata["groups"]["swe"]

    if metadata["groups"].get("precip"):
        data_groups["precip"] = metadata["groups"]["precip"]

    print("Getting CWMS Data")
    hourly_data = get_usace_plot_data(location, year, time_period="h")
    hourly_data = parse_usace_data(hourly_data)
    daily_data = get_usace_plot_data(location, year, time_period="d")
    daily_data = parse_usace_data(daily_data)

    df = merge_dataframe(hourly_data, daily_data)

    print("Creating CWMS Data Series for Plots")
    series = {}
    for group_name, group_columns in data_groups.items():
        for column in group_columns:
            sub_df = df[[column, "Datetime"]].dropna(how="any")
            valid_dates = sub_df["Datetime"].dt.strftime("%Y-%m-%dT%H").tolist()
            if group_name not in series:
                series[group_name] = []

            series[group_name].append(
                {"title": column, "x": valid_dates, "y": sub_df[column].tolist()}
            )

    print("CWMS Data Series for Plots Ready")
    return {
        "series": series,
        "ymarkers": metadata["ymarkers"],
        "title": f"{metadata['title']}<br>WY {year} | Generated: {metadata['generated']}",
    }
