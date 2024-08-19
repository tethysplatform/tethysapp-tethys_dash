import pytest
from tethysapp.aquainsight.data.usace import (
    get_usace_plot_data,
    parse_usace_data,
    merge_dataframe,
    get_water_year,
    get_usace_data,
)
from django.http import HttpResponse
from unittest.mock import MagicMock
from pandas.testing import assert_frame_equal
import pandas as pd
import numpy as np
from datetime import datetime


def test_get_usace_plot_data(mocker):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.usace.requests")
    mock_requests.get.return_value = HttpResponse(status=200)
    location = "coy"
    year = "2024"

    response = get_usace_plot_data(location, year)
    assert response.status_code == 200


def test_get_usace_plot_data_fail(mocker):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.usace.requests")
    mock_requests.get.return_value = HttpResponse(status=404)
    location = "coy"
    year = "2024"

    response = get_usace_plot_data(location, year)
    assert response is None


def test_parse_usace_data(mocker, usace_time_series_plot_data, usace_expected_ts_df):
    mock_data = MagicMock(text=usace_time_series_plot_data)
    df = parse_usace_data(mock_data)

    df = df.astype(usace_expected_ts_df.dtypes.to_dict())
    assert_frame_equal(df, usace_expected_ts_df)


def test_merge_dataframe():
    df1 = pd.DataFrame(
        [[1, 1], [2, 2], [3, np.nan], [4, 4]], columns=["Datetime", "flow"]
    )
    df2 = pd.DataFrame(
        [[1, np.nan], [2, 9], [3, 10], [4, 4]], columns=["Datetime", "flow"]
    )

    new_df = merge_dataframe(df1, df2)

    assert_frame_equal(
        new_df,
        pd.DataFrame(
            [[1, 1.0], [2, 2.0], [3, 10.0], [4, 4.0]], columns=["Datetime", "flow"]
        ),
    )


@pytest.mark.parametrize(
    "date,expected", [(datetime(2024, 10, 1), 2025), (datetime(2024, 9, 1), 2024)]
)
def test_get_water_year(date, expected):
    year = get_water_year(date)

    assert year == expected


def test_get_usace_data(
    mocker,
    usace_time_series_meta_json,
    usace_time_series_plot_data,
    usace_expected_ts_title,
    usace_expected_ts_series,
    usace_expected_ts_ymarkers,
):
    mock_get_usace_plot_data = mocker.patch(
        "tethysapp.aquainsight.data.usace.get_usace_plot_data"
    )
    mock_metadata = MagicMock()
    mock_metadata.json.return_value = usace_time_series_meta_json
    mock_data = MagicMock(text=usace_time_series_plot_data)
    mock_get_usace_plot_data.side_effect = [None, mock_metadata, mock_data, mock_data]

    location = "coy"
    year = 2024
    usace_data = get_usace_data(location, year)

    assert usace_data["title"] == usace_expected_ts_title
    assert usace_data["ymarkers"] == usace_expected_ts_ymarkers
    assert usace_data["series"] == usace_expected_ts_series


def test_get_usace_data_no_flows(
    mocker,
    usace_time_series_meta_json,
    usace_time_series_plot_data,
    usace_expected_ts_title,
    usace_expected_ts_series,
    usace_expected_ts_ymarkers,
):
    mock_get_usace_plot_data = mocker.patch(
        "tethysapp.aquainsight.data.usace.get_usace_plot_data"
    )
    mock_metadata = MagicMock()

    del usace_time_series_meta_json["groups"]["flow"]
    del usace_time_series_meta_json["groups"]["outflow"]
    del usace_time_series_meta_json["groups"]["inflow"]
    mock_metadata.json.return_value = usace_time_series_meta_json
    mock_data = MagicMock(text=usace_time_series_plot_data)
    mock_get_usace_plot_data.side_effect = [None, mock_metadata, mock_data, mock_data]

    location = "coy"
    year = 2024
    usace_data = get_usace_data(location, year)

    del usace_expected_ts_series["flow"]
    assert usace_data["title"] == usace_expected_ts_title
    assert usace_data["ymarkers"] == usace_expected_ts_ymarkers
    assert usace_data["series"] == usace_expected_ts_series
