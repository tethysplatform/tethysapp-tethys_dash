"""Unit tests for the Django-free floodmap zarr->COG conversion logic.

Hermetic: each test builds a fresh in-memory Zarr v3 group (no network, no S3).
"""

import numpy as np
import pytest
import zarr
from rasterio.io import MemoryFile

import tethysapp.tethysdash.floodmap as fm
from tethysapp.tethysdash.floodmap import (
    NODATA,
    FloodmapError,
    build_storm_cog,
    read_metadata,
)

CRS = "EPSG:3857"
TRANSFORM = [5.0, 0.0, -100.0, 0.0, -5.0, 200.0]  # 5 m pixels, origin (-100, 200)


def _make_group():
    """Build an in-memory Zarr v3 group: 3 storms, 4x5 depth grid."""
    g = zarr.open_group(store=zarr.storage.MemoryStore(), mode="w")
    g.attrs["crs"] = CRS
    g.attrs["transform"] = TRANSFORM
    g.attrs["extent_threshold_m"] = 0.05
    g.attrs["source_nodata"] = NODATA
    data = np.zeros((3, 4, 5), dtype="float32")
    data[0, 0, 0] = 2.5       # wet
    data[0, 1, 1] = 0.01      # dry (below threshold)
    data[0, 2, 2] = NODATA    # nodata
    arr = g.create_array("depth", shape=(3, 4, 5), dtype="float32")
    arr[:] = data
    return g


def test_build_storm_cog_is_valid_georeferenced_cog():
    cog_bytes = build_storm_cog(_make_group(), "depth", 0)
    with MemoryFile(cog_bytes) as mem, mem.open() as ds:
        assert ds.crs.to_string() == CRS
        assert (ds.width, ds.height) == (5, 4)
        assert ds.transform.a == 5.0 and ds.transform.e == -5.0
        assert ds.nodata == NODATA
        band = ds.read(1)
    assert band[0, 0] == pytest.approx(2.5)   # wet preserved
    assert band[1, 1] == NODATA               # dry -> nodata (maskable)
    assert band[2, 2] == NODATA               # source nodata -> nodata


def test_storm_out_of_range_raises():
    with pytest.raises(FloodmapError, match="out of range"):
        build_storm_cog(_make_group(), "depth", 99)


def test_unknown_variable_raises():
    with pytest.raises(FloodmapError, match="not found"):
        build_storm_cog(_make_group(), "nope", 0)


def test_missing_georeference_attrs_raises():
    g = _make_group()
    del g.attrs["transform"]
    with pytest.raises(FloodmapError, match="georeference"):
        build_storm_cog(g, "depth", 0)


def test_read_metadata_reports_storms_and_extent():
    meta = read_metadata(_make_group())
    assert meta["variables"] == ["depth"]
    assert meta["storm_count"] == 3
    assert meta["crs"] == CRS
    assert meta["grid_shape"] == [4, 5]
    # extent = [minx, miny, maxx, maxy]; 5 cols x 5m = 25 wide, 4 rows x 5m = 20 tall
    assert meta["extent"] == [-100.0, 180.0, -75.0, 200.0]
    # no magnitude_mm array -> labels fall back to storm indices
    assert meta["storm_labels"] == ["0", "1", "2"]


def test_read_metadata_uses_magnitude_labels_when_present():
    g = _make_group()
    mag = g.create_array("magnitude_mm", shape=(3,), dtype="float32")
    mag[:] = np.array([10.0, 20.0, 30.0], dtype="float32")
    meta = read_metadata(g)
    assert meta["storm_labels"] == ["10 mm", "20 mm", "30 mm"]
    assert set(meta["variables"]) == {"depth", "magnitude_mm"}


def test_retry_recovers_after_transient_failures(monkeypatch):
    monkeypatch.setattr(fm.time, "sleep", lambda _s: None)
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("transient")
        return "ok"

    assert fm._retry(flaky) == "ok"
    assert calls["n"] == 3


def test_retry_raises_after_exhausting_attempts(monkeypatch):
    monkeypatch.setattr(fm.time, "sleep", lambda _s: None)

    def always_fail():
        raise ConnectionError("boom")

    with pytest.raises(ConnectionError, match="boom"):
        fm._retry(always_fail, attempts=2)


@pytest.mark.parametrize(
    "header,total,expected",
    [
        ("", 100, None),
        (None, 100, None),
        ("items=0-10", 100, None),  # wrong unit
        ("bytes=abc", 100, None),  # malformed
        ("bytes=0-49", 100, (0, 49)),
        ("bytes=0-65536", 100, (0, 99)),  # end clamped to EOF
        ("bytes=50-", 100, (50, 99)),  # open-ended
        ("bytes=-10", 100, (90, 99)),  # suffix
        ("bytes=200-300", 100, None),  # start past EOF
    ],
)
def test_parse_byte_range(header, total, expected):
    assert fm.parse_byte_range(header, total) == expected
