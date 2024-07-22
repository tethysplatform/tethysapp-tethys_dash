import requests
import pandas as pd


def get_stations(station_id=None):
    stations_url = "https://cdec.water.ca.gov/dynamicapp/QueryF/getStations?stationId"

    if station_id:
        stations_url += f"={station_id}"

    res = requests.get(stations_url)
    return res.json()


def get_station_data(station, start, end, duration, data_type):
    print("Creating data url")
    data_url = (
        f"https://cdec.water.ca.gov/dynamicapp/req/CSVDataServlet?Stations={station}"
    )
    if data_type == "storage":
        data_type_number = 15
    elif data_type == "elevation":
        data_type_number = 6

    if not data_type_number:
        raise Exception(f"{data_type} is not configured for this plot.")
    data_url += f"&SensorNums={data_type_number}"

    valid_durations = ["D", "H", "M"]
    if duration not in valid_durations:
        raise Exception(f"duration must be one of {valid_durations}.")
    data_url += f"&dur_code={duration}"

    data_url += f"&Start={start}"

    if end:
        data_url += f"&End={end}"

    print(f"Retrieving data from {data_url}")
    df = pd.read_csv(data_url)

    print(f"Parsing station data for {station}")
    df["Datetime"] = pd.to_datetime(df["DATE TIME"])
    units = df.loc[0, "UNITS"]
    sensor_type = df.loc[0, "SENSOR_TYPE"]
    df = df[["Datetime", "VALUE"]]
    df = df.rename(columns={"VALUE": f"{sensor_type} ({units})"})

    return df.set_index("Datetime")


def get_cdec_data(station, start, end):
    storage_data = get_station_data(station, start, end, "H", "storage")
    elevation_data = get_station_data(station, start, end, "H", "elevation")
    cdec_data = pd.merge(
        elevation_data, storage_data, left_index=True, right_index=True
    )
    cdec_data_columns = cdec_data.columns
    cdec_data = cdec_data.reset_index()

    print("Creating CDEC Data Series for Plots")
    series = []
    for column in cdec_data_columns:
        sub_df = cdec_data[[column, "Datetime"]].dropna(how="any")
        valid_dates = sub_df["Datetime"].dt.strftime("%Y-%m-%dT%H").tolist()

        series.append({"title": column, "x": valid_dates, "y": sub_df[column].tolist()})

    print(f"Getting metadata for station {station}")
    station_metadata = get_stations(station)[0]

    print("CWMS Data Series for Plots Ready")
    return {"series": series, "title": f"{station_metadata['stationName']} Hourly Data"}
