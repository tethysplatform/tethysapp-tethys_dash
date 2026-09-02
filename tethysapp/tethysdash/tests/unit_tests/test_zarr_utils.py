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
        ("bytes=-0", 100, None),  # suffix of zero bytes asks for nothing
        # A non-numeric bound is refused rather than raising out of the view: the
        # header is caller-supplied, so a bad one must degrade to a full body.
        ("bytes=0-abc", 100, None),
        ("bytes=abc-def", 100, None),
        ("bytes=-xyz", 100, None),
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


class _StubFsspecStore:
    """Stands in for ``FsspecStore`` so ``open_store`` can be driven without a
    network. Patched onto the module rather than onto zarr's own class, which
    would mutate a dependency's internals for the duration of the test."""

    opened = []

    @classmethod
    def from_url(cls, src):
        cls.opened.append(src)
        return f"store:{src}"


def test_open_store_opens_the_url_read_only(monkeypatch):
    stub = type("Stub", (_StubFsspecStore,), {"opened": []})
    monkeypatch.setattr(zu, "FsspecStore", stub)
    group = object()
    seen = {}

    def fake_open_group(store, mode):
        seen.update(store=store, mode=mode)
        return group

    monkeypatch.setattr(zu.zarr, "open_group", fake_open_group)

    assert zu.open_store("https://host/s.zarr") is group
    assert stub.opened == ["https://host/s.zarr"]
    # Read-only is the whole contract here: the store belongs to whoever
    # published it, and this endpoint takes the URL from a query parameter.
    assert seen == {"store": "store:https://host/s.zarr", "mode": "r"}


def test_open_store_retries_a_transient_failure(monkeypatch):
    monkeypatch.setattr(zu.time, "sleep", lambda _s: None)
    stub = type("Stub", (_StubFsspecStore,), {"opened": []})
    monkeypatch.setattr(zu, "FsspecStore", stub)
    attempts = {"n": 0}
    group = object()

    def flaky_open_group(store, mode):
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise ConnectionError("transient")
        return group

    monkeypatch.setattr(zu.zarr, "open_group", flaky_open_group)

    # A single range read over HTTP fails transiently often enough that one
    # failure must not sink the request.
    assert zu.open_store("https://host/s.zarr") is group
    assert attempts["n"] == 3


def test_open_store_wraps_a_persistent_failure(monkeypatch):
    monkeypatch.setattr(zu.time, "sleep", lambda _s: None)

    class _Boom(_StubFsspecStore):
        @classmethod
        def from_url(cls, src):
            raise OSError("dns failure")

    monkeypatch.setattr(zu, "FsspecStore", _Boom)

    # Reported as StoreOpenError specifically, because the API layer maps that to
    # 502 (the store is unreachable) rather than 400 (the request is wrong).
    with pytest.raises(zu.StoreOpenError, match="could not open zarr store") as caught:
        zu.open_store("https://host/s.zarr")
    assert isinstance(caught.value, ZarrCogError)
    # The original is kept as the cause so a server log still names the reason.
    assert isinstance(caught.value.__cause__, OSError)


def test_read_cog_builds_from_the_opened_store(monkeypatch):
    zu.read_cog.cache_clear()
    monkeypatch.setattr(zu, "open_store", lambda src: f"group:{src}")
    calls = []

    def fake_build(group, variable, index, *, mask_below=None):
        calls.append((group, variable, index, mask_below))
        return b"COGBYTES"

    monkeypatch.setattr(zu, "build_cog", fake_build)

    assert zu.read_cog("https://a.zarr", "depth", 1, 0.5) == b"COGBYTES"
    assert calls == [("group:https://a.zarr", "depth", 1, 0.5)]
    zu.read_cog.cache_clear()


def test_read_cog_caches_per_argument_set(monkeypatch):
    zu.read_cog.cache_clear()
    opens = {"n": 0}

    def counting_open(src):
        opens["n"] += 1
        return "group"

    monkeypatch.setattr(zu, "open_store", counting_open)
    monkeypatch.setattr(zu, "build_cog", lambda *a, **k: b"COGBYTES")

    zu.read_cog("https://a.zarr", "depth", 0, None)
    zu.read_cog("https://a.zarr", "depth", 0, None)
    # A map layer reads one COG over several range requests, so without the cache
    # each of those would re-open the store and rebuild the whole file.
    assert opens["n"] == 1
    zu.read_cog("https://a.zarr", "depth", 1, None)
    assert opens["n"] == 2
    zu.read_cog.cache_clear()


def test_read_metadata_uses_the_requested_variable():
    g = _make_group()
    g.create_array("elevation", shape=(2, 3), dtype="float32")
    # Auto-selection would pick a griddable array in hash-dependent order, and
    # "depth" is 3x4x5 -- so the shape is what proves the request was honored.
    meta = read_metadata(g, variable="elevation")
    assert meta["grid_shape"] == [2, 3]
    assert meta["slice_count"] == 1


def test_read_metadata_unknown_requested_variable_raises():
    # Distinct from "could not determine a griddable variable": the caller named
    # something, and saying it is absent is more use than re-asking for a name.
    with pytest.raises(ZarrCogError, match="'nope' not found"):
        read_metadata(_make_group(), variable="nope")


def test_read_metadata_missing_transform_raises():
    g = _make_group()
    del g.attrs["transform"]
    # read_metadata needs only the transform -- it reports crs as-is, so unlike
    # build_cog it does not require one.
    with pytest.raises(ZarrCogError, match="transform"):
        read_metadata(g)


def test_read_metadata_rejects_unsupported_ndim():
    g = zarr.open_group(store=zarr.storage.MemoryStore(), mode="w")
    g.attrs["crs"] = CRS
    g.attrs["transform"] = TRANSFORM
    g.create_array("cube", shape=(2, 3, 4, 5), dtype="float32")
    # Named explicitly because auto-selection skips a 4-D array and would report
    # that nothing griddable was found instead.
    with pytest.raises(ZarrCogError, match=r"2D .* or 3D"):
        read_metadata(g, variable="cube")
