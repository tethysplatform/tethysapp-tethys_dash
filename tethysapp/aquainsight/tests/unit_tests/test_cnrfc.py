from tethysapp.aquainsight.data.cnrfc import (
    get_cnrfc_river_forecast_data,
    get_hydro_data,
    get_location_rating_curve,
    get_hydro_thresholds,
    get_forcing_data,
    get_title,
    get_hefs_data,
    get_hefs_metadata,
    get_nwps_location_metadata,
    get_impact_statement,
    get_cnrfc_hefs_data,
)


def test_get_cnrfc_river_forecast_data(
    mocker,
    cnrfc_det_forecast,
    cnrfc_det_forecast_hydro_series,
    cnrfc_rating_curve_flows,
    cnrfc_rating_curve_stages,
    cnrfc_det_forecast_forcing_series,
    cnrfc_det_forecast_hydro_thresholds,
    cnrfc_det_forecast_chart_title,
    cnrfc_det_forecast_forcing_ymin,
    cnrfc_det_forecast_forcing_ymax,
    cnrfc_det_forecast_hydro_range_ymin,
    cnrfc_det_forecast_hydro_range_ymax,
    cnrfc_det_forecast_observed_forecast_split_dt,
    cnrfc_det_forecast_all_dates,
):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.cnrfc.requests")
    mock_requests.get().text = cnrfc_det_forecast

    mock_get_location_rating_curve = mocker.patch(
        "tethysapp.aquainsight.data.cnrfc.get_location_rating_curve"
    )
    mock_get_location_rating_curve.return_value = [
        cnrfc_rating_curve_flows,
        cnrfc_rating_curve_stages,
    ]

    location = "CREC1"

    forecast_data = get_cnrfc_river_forecast_data(location)

    expected_river_forecast_plot_web = (
        f"https://www.cnrfc.noaa.gov/graphicalRVF_printer.php?id={location}&scale=1"
    )
    mock_requests.get.assert_called_with(expected_river_forecast_plot_web)
    assert forecast_data["forcing_series"] == cnrfc_det_forecast_forcing_series
    assert forecast_data["forcing_ymin"] == cnrfc_det_forecast_forcing_ymin
    assert forecast_data["forcing_ymax"] == cnrfc_det_forecast_forcing_ymax
    assert forecast_data["hydro_range_ymin"] == cnrfc_det_forecast_hydro_range_ymin
    assert forecast_data["hydro_range_ymax"] == cnrfc_det_forecast_hydro_range_ymax
    assert forecast_data["hydro_series"] == cnrfc_det_forecast_hydro_series
    assert forecast_data["hydro_thresholds"] == cnrfc_det_forecast_hydro_thresholds
    assert (
        forecast_data["observed_forecast_split_dt"]
        == cnrfc_det_forecast_observed_forecast_split_dt
    )
    assert forecast_data["title"] == cnrfc_det_forecast_chart_title


def test_get_hydro_data(
    cnrfc_det_forecast,
    cnrfc_det_forecast_hydro_series,
    cnrfc_det_forecast_hydro_range_ymin,
    cnrfc_det_forecast_hydro_range_ymax,
    cnrfc_det_forecast_observed_forecast_split_dt,
    cnrfc_det_forecast_all_dates,
):
    (
        all_dates,
        hydro_series,
        hydro_range_ymin,
        hydro_range_ymax,
        observed_forecast_split_dt,
    ) = get_hydro_data(cnrfc_det_forecast)

    assert hydro_range_ymin == cnrfc_det_forecast_hydro_range_ymin
    assert hydro_range_ymax == cnrfc_det_forecast_hydro_range_ymax
    assert observed_forecast_split_dt == cnrfc_det_forecast_observed_forecast_split_dt
    assert all_dates == cnrfc_det_forecast_all_dates
    assert hydro_series == cnrfc_det_forecast_hydro_series


def test_get_location_rating_curve(
    mocker, cnrfc_rating_curve, cnrfc_rating_curve_flows, cnrfc_rating_curve_stages
):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.cnrfc.requests")
    mock_requests.get().text = cnrfc_rating_curve

    location = "CREC1"
    flows, stages = get_location_rating_curve(location)

    assert flows == cnrfc_rating_curve_flows
    assert stages == cnrfc_rating_curve_stages


def test_get_hydro_thresholds(
    cnrfc_det_forecast,
    cnrfc_rating_curve_flows,
    cnrfc_rating_curve_stages,
    cnrfc_det_forecast_hydro_thresholds,
):
    hydro_thresholds = get_hydro_thresholds(
        cnrfc_rating_curve_flows, cnrfc_rating_curve_stages, cnrfc_det_forecast
    )
    assert hydro_thresholds == cnrfc_det_forecast_hydro_thresholds


def test_get_forcing_data(
    cnrfc_det_forecast,
    cnrfc_det_forecast_forcing_series,
    cnrfc_det_forecast_forcing_ymin,
    cnrfc_det_forecast_forcing_ymax,
):
    forcing_series, forcing_ymin, forcing_ymax = get_forcing_data(cnrfc_det_forecast)

    assert forcing_series == cnrfc_det_forecast_forcing_series
    assert forcing_ymin == cnrfc_det_forecast_forcing_ymin
    assert forcing_ymax == cnrfc_det_forecast_forcing_ymax


def test_get_title(cnrfc_det_forecast, cnrfc_det_forecast_chart_title):

    chart_title = get_title(cnrfc_det_forecast)
    assert chart_title == cnrfc_det_forecast_chart_title


def test_get_hefs_data_stage(
    mocker,
    cnrfc_rating_curve_flows,
    cnrfc_rating_curve_stages,
    cnrfc_hefs_stage_forecast,
    cnrfc_hefs_stage_ensembles,
    cnrfc_hefs_stage_stats,
):
    location = "CREC1"
    mock_pd = mocker.patch("tethysapp.aquainsight.data.cnrfc.pd.read_csv")
    mock_pd.return_value = cnrfc_hefs_stage_forecast

    hefs_series = get_hefs_data(
        location, cnrfc_rating_curve_flows, cnrfc_rating_curve_stages
    )

    assert (
        hefs_series
        == {"ensembles": cnrfc_hefs_stage_ensembles} | cnrfc_hefs_stage_stats
    )


def test_get_hefs_data_flow(
    mocker,
    cnrfc_rating_curve_flows,
    cnrfc_rating_curve_stages,
    cnrfc_hefs_flow_forecast,
    cnrfc_hefs_flow_ensembles,
    cnrfc_hefs_flow_stats,
):
    location = "CREC1"
    mock_pd = mocker.patch("tethysapp.aquainsight.data.cnrfc.pd.read_csv")
    mock_pd.side_effect = [Exception("failed"), cnrfc_hefs_flow_forecast]

    hefs_series = get_hefs_data(
        location, cnrfc_rating_curve_flows, cnrfc_rating_curve_stages
    )

    assert (
        hefs_series == {"ensembles": cnrfc_hefs_flow_ensembles} | cnrfc_hefs_flow_stats
    )


def test_get_hefs_metadata(
    mocker, cnrfc_hefs_forecast_page, cnrfc_hefs_forecast_issuance_time
):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.cnrfc.requests")
    mock_requests.get().text = cnrfc_hefs_forecast_page
    location = "CREC1"

    metadata = get_hefs_metadata(location)

    assert metadata["issuance_time"] == cnrfc_hefs_forecast_issuance_time


def test_get_nwps_location_metadata(mocker, nwps_api_data):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.cnrfc.requests")
    mock_requests.get().json.return_value = nwps_api_data
    location = "CREC1"

    nwps_data = get_nwps_location_metadata(location)

    assert nwps_data == nwps_api_data


def test_get_impact_statement(mocker, nwps_api_data, nwps_impact_statements):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.cnrfc.requests")
    mock_requests.get().json.return_value = nwps_api_data
    location = "CREC1"

    impact_statements = get_impact_statement(location)

    assert impact_statements == nwps_impact_statements


def test_get_cnrfc_hefs_data(
    mocker,
    cnrfc_det_forecast,
    cnrfc_det_forecast_hydro_series,
    cnrfc_rating_curve_flows,
    cnrfc_rating_curve_stages,
    cnrfc_hefs_forecast_issuance_time,
    cnrfc_hefs_stage_ensembles,
    cnrfc_hefs_stage_stats,
    cnrfc_det_forecast_hydro_thresholds,
    cnrfc_det_forecast_observed_forecast_split_dt,
):
    mock_requests = mocker.patch("tethysapp.aquainsight.data.cnrfc.requests")
    mock_requests.get().text = cnrfc_det_forecast

    mock_get_location_rating_curve = mocker.patch(
        "tethysapp.aquainsight.data.cnrfc.get_location_rating_curve"
    )
    mock_get_location_rating_curve.return_value = [
        cnrfc_rating_curve_flows,
        cnrfc_rating_curve_stages,
    ]

    mock_get_hefs_metadata = mocker.patch(
        "tethysapp.aquainsight.data.cnrfc.get_hefs_metadata"
    )
    mock_get_hefs_metadata.return_value = {
        "issuance_time": cnrfc_hefs_forecast_issuance_time
    }

    mock_get_hefs_data = mocker.patch("tethysapp.aquainsight.data.cnrfc.get_hefs_data")
    mock_get_hefs_data.return_value = {
        "ensembles": cnrfc_hefs_stage_ensembles
    } | cnrfc_hefs_stage_stats

    location = "CREC1"
    location_proper_name = "CREC1 Proper"
    forecast_data = get_cnrfc_hefs_data(location, location_proper_name)

    assert (
        forecast_data["hefs_series"]
        == {"ensembles": cnrfc_hefs_stage_ensembles} | cnrfc_hefs_stage_stats
    )
    assert forecast_data["range_ymin"] == 4.5117
    assert forecast_data["range_ymax"] == 5.00867
    assert forecast_data["range_xmin"] == "2024-08-09 15:30:00"
    assert forecast_data["range_xmax"] == "2024-09-14 10:00:00"
    assert forecast_data["deterministic_series"] == cnrfc_det_forecast_hydro_series
    assert forecast_data["hydro_thresholds"] == cnrfc_det_forecast_hydro_thresholds
    assert (
        forecast_data["observed_forecast_split_dt"]
        == cnrfc_det_forecast_observed_forecast_split_dt
    )
    assert (
        forecast_data["title"]
        == f"Hourly River Level Probabilities<br>{location_proper_name}<br><b>Issuance Time</b>: {cnrfc_hefs_forecast_issuance_time}"  # noqa: E501
    )
