import pytest
from tethysapp.aquainsight.data.utilities import (
    set_nonzero,
    interpolate_stage_from_rating_curve,
    interpolate_flow_from_rating_curve,
)


@pytest.mark.parametrize("value,expected", [(0, 0.003), (0.01, 0.01)])
def test_set_nonzero(value, expected):
    new_value = set_nonzero(value)

    assert new_value == expected


# Feels like 7.71 is not correct but this function should match the cnrfc function at https://www.cnrfc.noaa.gov/includes/rating.js for consistency  # noqa: E501
@pytest.mark.parametrize(
    "flow,expected_stage", [(20, 2), (25, 2.5), (-1, -9999), (5, 0.5), (105, 7.71)]
)
def test_interpolate_stage_from_rating_curve(flow, expected_stage):
    ratingStage = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    ratingFlow = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    interpolated_stage = interpolate_stage_from_rating_curve(
        ratingStage, ratingFlow, flow
    )

    assert interpolated_stage == expected_stage


@pytest.mark.parametrize("flow,expected_stage", [(5, 0), (15, 0)])
def test_interpolate_stage_from_rating_curve_bad_curves(flow, expected_stage):
    ratingStage = [1, 1, 1, 1, 1]
    ratingFlow = [10, 10, 10, 10, 10]
    interpolated_stage = interpolate_stage_from_rating_curve(
        ratingStage, ratingFlow, flow
    )

    assert interpolated_stage == expected_stage


@pytest.mark.parametrize("flow,expected_stage", [(5, 1.0)])
def test_interpolate_stage_from_rating_curve_negative_curves(flow, expected_stage):
    ratingStage = [1, 1, 1, 1, 1]
    ratingFlow = [-1, 10, 10, 10, 10]

    interpolated_stage = interpolate_stage_from_rating_curve(
        ratingStage, ratingFlow, flow
    )

    assert interpolated_stage == expected_stage


# Feels like 7.71 is not correct but this function should match the cnrfc function at https://www.cnrfc.noaa.gov/includes/rating.js for consistency  # noqa: E501
@pytest.mark.parametrize(
    "expected_flow,stage", [(20, 2), (25, 2.5), (-9999, -1), (5, 0.5), (105, 10.5)]
)
def test_interpolate_flow_from_rating_curve(expected_flow, stage):
    ratingStage = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    ratingFlow = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    interpolated_flow = interpolate_flow_from_rating_curve(
        ratingStage, ratingFlow, stage
    )

    assert interpolated_flow == expected_flow


@pytest.mark.parametrize("expected_flow,stage", [(0, 0.5), (0, 1.5)])
def test_interpolate_flow_from_rating_curve_bad_curves(expected_flow, stage):
    ratingStage = [1, 1, 1, 1, 1]
    ratingFlow = [10, 10, 10, 10, 10]
    interpolated_flow = interpolate_flow_from_rating_curve(
        ratingStage, ratingFlow, stage
    )

    assert interpolated_flow == expected_flow


@pytest.mark.parametrize("expected_flow,stage", [(7.25, 0.5)])
def test_interpolate_flow_from_rating_curve_negative_curves(expected_flow, stage):
    ratingStage = [-1, 1, 1, 1, 1]
    ratingFlow = [-1, 10, 10, 10, 10]

    interpolated_flow = interpolate_flow_from_rating_curve(
        ratingStage, ratingFlow, stage
    )

    assert interpolated_flow == expected_flow
