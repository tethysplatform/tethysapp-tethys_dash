"""Unit tests for the Django-free GeoParquet->GeoJSON conversion logic.

Hermetic: each test writes a small GeoParquet to a temp file (no network).
"""

import json

import geopandas as gpd
import pytest
from shapely.geometry import Point

import tethysapp.tethysdash.geoparquet as gp
from tethysapp.tethysdash.geoparquet import (
    FileOpenError,
    GeoParquetError,
    read_geojson,
)


def _write_parquet(path, gdf):
    gdf.to_parquet(path)
    return str(path)


def test_read_geojson_returns_feature_collection(tmp_path):
    gdf = gpd.GeoDataFrame(
        {"name": ["a", "b"], "val": [1, 2]},
        geometry=[Point(0, 0), Point(10, 20)],
        crs="EPSG:4326",
    )
    fc = json.loads(read_geojson(_write_parquet(tmp_path / "pts.parquet", gdf)))
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) == 2
    props = fc["features"][0]["properties"]
    assert props["name"] == "a" and props["val"] == 1
    assert fc["features"][0]["geometry"]["type"] == "Point"


def test_read_geojson_reprojects_to_4326(tmp_path):
    # 1113194.9 m easting in Web Mercator is ~10 deg longitude at the equator.
    gdf = gpd.GeoDataFrame(
        {"n": [1]}, geometry=[Point(1113194.9, 0)], crs="EPSG:3857"
    )
    fc = json.loads(read_geojson(_write_parquet(tmp_path / "m.parquet", gdf)))
    lon, lat = fc["features"][0]["geometry"]["coordinates"]
    assert lon == pytest.approx(10.0, abs=1e-3)
    assert lat == pytest.approx(0.0, abs=1e-6)


def test_read_geojson_without_crs_is_not_reprojected(tmp_path):
    gdf = gpd.GeoDataFrame({"n": [1]}, geometry=[Point(5, 5)], crs=None)
    fc = json.loads(read_geojson(_write_parquet(tmp_path / "nocrs.parquet", gdf)))
    assert fc["features"][0]["geometry"]["coordinates"] == [5.0, 5.0]


def test_unreadable_file_raises_file_open_error(tmp_path, monkeypatch):
    monkeypatch.setattr(gp.time, "sleep", lambda _s: None)
    with pytest.raises(FileOpenError, match="could not open"):
        read_geojson(str(tmp_path / "does_not_exist.parquet"))


def test_invalid_parquet_raises_geoparquet_error(tmp_path):
    bad = tmp_path / "bad.parquet"
    bad.write_bytes(b"not a parquet file")
    with pytest.raises(GeoParquetError, match="could not read"):
        read_geojson(str(bad))


def test_retry_recovers_after_transient_failures(monkeypatch):
    monkeypatch.setattr(gp.time, "sleep", lambda _s: None)
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("transient")
        return "ok"

    assert gp._retry(flaky) == "ok"
    assert calls["n"] == 3


def test_retry_raises_after_exhausting_attempts(monkeypatch):
    monkeypatch.setattr(gp.time, "sleep", lambda _s: None)

    def always_fail():
        raise ConnectionError("boom")

    with pytest.raises(ConnectionError, match="boom"):
        gp._retry(always_fail, attempts=2)
