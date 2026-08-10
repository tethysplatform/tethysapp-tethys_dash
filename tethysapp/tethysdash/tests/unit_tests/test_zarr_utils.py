"""Unit tests for the Django-free zarr->COG conversion logic.

Hermetic: each test builds a fresh in-memory Zarr v3 group (no network, no S3).
"""

import numpy as np
import pytest
import zarr
from rasterio.io import MemoryFile

import tethysapp.tethysdash.zarr_utils as zu
from tethysapp.tethysdash.zarr_utils import (
    NODATA,
    ZarrCogError,
    build_cog,
    read_metadata,
)

CRS = "EPSG:3857"
TRANSFORM = [5.0, 0.0, -100.0, 0.0, -5.0, 200.0]  # 5 m pixels, origin (-100, 200)


def _make_group(threshold=0.05, source_nodata=NODATA):
    """Build an in-memory Zarr v3 group: 3 slices, 4x5 grid.

    ``threshold``/``source_nodata`` default to a flood-style store that declares
    masking; pass ``None`` to build a plain store that declares neither.
    """
    g = zarr.open_group(store=zarr.storage.MemoryStore(), mode="w")
    g.attrs["crs"] = CRS
    g.attrs["transform"] = TRANSFORM
    if threshold is not None:
        g.attrs["extent_threshold_m"] = threshold
    if source_nodata is not None:
        g.attrs["source_nodata"] = source_nodata
    data = np.zeros((3, 4, 5), dtype="float32")
    data[0, 0, 0] = 2.5       # wet
    data[0, 1, 1] = 0.01      # below a 0.05 threshold
    data[0, 2, 2] = NODATA    # source nodata
    arr = g.create_array("depth", shape=(3, 4, 5), dtype="float32")
    arr[:] = data
    return g


def _make_2d_group(name, values):
    g = zarr.open_group(store=zarr.storage.MemoryStore(), mode="w")
    g.attrs["crs"] = CRS
    g.attrs["transform"] = TRANSFORM
    arr = g.create_array(name, shape=values.shape, dtype="float32")
    arr[:] = values
    return g


def test_build_cog_is_valid_georeferenced_cog():
    cog_bytes = build_cog(_make_group(), "depth", 0)
    with MemoryFile(cog_bytes) as mem, mem.open() as ds:
        assert ds.crs.to_string() == CRS
        assert (ds.width, ds.height) == (5, 4)
        assert ds.transform.a == 5.0 and ds.transform.e == -5.0
        assert ds.nodata == NODATA
        band = ds.read(1)
    assert band[0, 0] == pytest.approx(2.5)   # wet preserved
    assert band[1, 1] == NODATA               # below threshold -> nodata
    assert band[2, 2] == NODATA               # source nodata -> nodata


def test_build_cog_without_declared_masking_keeps_all_values():
    # fix #1: a store that declares no masking must not drop zeros/negatives --
    # the old dry-cell default (threshold 0.0) would have erased them.
    g = _make_group(threshold=None, source_nodata=None)
    vals = np.full((3, 4, 5), -3.0, dtype="float32")
    vals[0, 0, 0] = 5.0
    vals[0, 1, 1] = 0.0
    g["depth"][:] = vals
    cog_bytes = build_cog(g, "depth", 0)
    with MemoryFile(cog_bytes) as mem, mem.open() as ds:
        band = ds.read(1)
    assert band[0, 0] == pytest.approx(5.0)
    assert band[1, 1] == pytest.approx(0.0)    # zero survives
    assert band[2, 0] == pytest.approx(-3.0)   # negative survives
    assert not np.any(band == NODATA)


def test_explicit_mask_below_masks_without_store_attrs():
    g = _make_group(threshold=None, source_nodata=None)
    cog_bytes = build_cog(g, "depth", 0, mask_below=0.05)
    with MemoryFile(cog_bytes) as mem, mem.open() as ds:
        band = ds.read(1)
    assert band[0, 0] == pytest.approx(2.5)
    assert band[1, 1] == NODATA   # 0.01 <= 0.05


def test_index_out_of_range_raises():
    with pytest.raises(ZarrCogError, match="out of range"):
        build_cog(_make_group(), "depth", 99)


def test_unknown_variable_raises():
    with pytest.raises(ZarrCogError, match="not found"):
        build_cog(_make_group(), "nope", 0)


def test_missing_georeference_attrs_raises():
    g = _make_group()
    del g.attrs["transform"]
    with pytest.raises(ZarrCogError, match="georeference"):
        build_cog(g, "depth", 0)


def test_build_cog_handles_2d_grid():
    # fix #3: a plain [y, x] grid is a single slice at index 0.
    g = _make_2d_group("elevation", np.arange(20, dtype="float32").reshape(4, 5))
    cog_bytes = build_cog(g, "elevation", 0)
    with MemoryFile(cog_bytes) as mem, mem.open() as ds:
        assert (ds.width, ds.height) == (5, 4)
        assert ds.read(1)[0, 1] == pytest.approx(1.0)


def test_build_cog_2d_grid_rejects_nonzero_index():
    g = _make_2d_group("elevation", np.zeros((4, 5), dtype="float32"))
    with pytest.raises(ZarrCogError, match="single slice"):
        build_cog(g, "elevation", 1)


def test_build_cog_rejects_unsupported_ndim():
    g = zarr.open_group(store=zarr.storage.MemoryStore(), mode="w")
    g.attrs["crs"] = CRS
    g.attrs["transform"] = TRANSFORM
    g.create_array("cube", shape=(2, 3, 4, 5), dtype="float32")
    with pytest.raises(ZarrCogError, match=r"2D .* or 3D"):
        build_cog(g, "cube", 0)


def test_read_metadata_reports_slices_and_extent():
    meta = read_metadata(_make_group())
    assert meta["variables"] == ["depth"]
    assert meta["slice_count"] == 3
    assert meta["crs"] == CRS
    assert meta["grid_shape"] == [4, 5]
    # extent = [minx, miny, maxx, maxy]; 5 cols x 5m = 25 wide, 4 rows x 5m = 20 tall
    assert meta["extent"] == [-100.0, 180.0, -75.0, 200.0]
    # no label_var -> labels fall back to slice indices
    assert meta["slice_labels"] == ["0", "1", "2"]


def test_read_metadata_uses_label_var_when_present():
    g = _make_group()
    mag = g.create_array("magnitude_mm", shape=(3,), dtype="float32")
    mag[:] = np.array([10.0, 20.0, 30.0], dtype="float32")
    meta = read_metadata(g, label_var="magnitude_mm")
    assert meta["slice_labels"] == ["10", "20", "30"]
    assert set(meta["variables"]) == {"depth", "magnitude_mm"}


def test_read_metadata_handles_2d_grid():
    meta = read_metadata(_make_2d_group("elevation", np.zeros((4, 5), dtype="float32")))
    assert meta["slice_count"] == 1
    assert meta["grid_shape"] == [4, 5]


def test_read_metadata_discovers_via_candidates_when_unlisted(monkeypatch):
    # fix #2: non-listable stores (HTTP) fall back to caller candidates rather
    # than a hardcoded flood list; without either, the error is explicit.
    g = _make_group()
    monkeypatch.setattr(type(g), "array_keys", lambda self: [])
    meta = read_metadata(g, candidates=("depth",))
    assert meta["variables"] == ["depth"]
    with pytest.raises(ZarrCogError, match="could not determine"):
        read_metadata(g)


def test_retry_recovers_after_transient_failures(monkeypatch):
    monkeypatch.setattr(zu.time, "sleep", lambda _s: None)
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise ConnectionError("transient")
        return "ok"

    assert zu._retry(flaky) == "ok"
    assert calls["n"] == 3


def test_retry_raises_after_exhausting_attempts(monkeypatch):
    monkeypatch.setattr(zu.time, "sleep", lambda _s: None)

    def always_fail():
        raise ConnectionError("boom")

    with pytest.raises(ConnectionError, match="boom"):
        zu._retry(always_fail, attempts=2)


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
    assert zu.parse_byte_range(header, total) == expected


def test_build_cog_embeds_band_statistics():
    cog_bytes = build_cog(_make_group(), "depth", 0)
    with MemoryFile(cog_bytes) as mem, mem.open() as ds:
        tags = ds.tags(1)
        # slice 0's only wet cell is 2.5 (see _make_group), so min == max == 2.5
        assert float(tags["STATISTICS_MINIMUM"]) == pytest.approx(2.5)
        assert float(tags["STATISTICS_MAXIMUM"]) == pytest.approx(2.5)
