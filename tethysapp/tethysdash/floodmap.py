"""On-demand EF5 floodmap reading and conversion.

Opens a public Zarr flood-depth store, slices one storm scenario, and converts
it to a Cloud-Optimized GeoTIFF (COG) entirely in memory -- nothing is written
to disk or S3. Kept free of Django so the conversion logic is unit-testable in
isolation; ``controllers.py`` wraps these functions with request handling.

The public store is read over HTTPS via fsspec (see EF5_FLOODMAPS_SPEC.md 3.4);
we intentionally avoid s3fs so no AWS stack or credentials are required.
"""

from __future__ import annotations

import time
from functools import lru_cache

import numpy as np
import zarr
from zarr.storage import FsspecStore
from rasterio.io import MemoryFile
from rasterio.transform import Affine
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles

DEFAULT_VARIABLE = "depth"
STORM_DIM = 0  # arrays are [storm, y, x]; storms are the leading dimension
# Dry/no-data cells get this concrete nodata value. We deliberately avoid NaN:
# OpenLayers masks cells with `value == nodata`, and `NaN == NaN` is always
# false, so NaN dry cells would never render transparent. Depth is always >= 0,
# so a negative sentinel is unambiguous.
NODATA = -9999.0


class FloodmapError(Exception):
    """A floodmap store could not be read or converted."""


class StoreOpenError(FloodmapError):
    """The store URL could not be opened (network/URL error, not a read error)."""


def _retry(fn, attempts=3, base_delay=0.25):
    """Call ``fn`` and retry on any exception, with linear backoff. The remote
    store is read live over HTTP, so a single range read occasionally fails
    transiently; retrying re-issues it rather than failing the whole request."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            last = e
            if i < attempts - 1:
                time.sleep(base_delay * (i + 1))
    raise last


def open_store(src):
    """Open the Zarr group at ``src`` (a public https URL) read-only."""
    try:
        return _retry(lambda: zarr.open_group(FsspecStore.from_url(src), mode="r"))
    except Exception as e:  # surface a clean message to the API layer
        raise StoreOpenError(f"could not open zarr store: {e}") from e


# EF5 stores served over HTTP can't be listed (no directory enumeration), so we
# probe these known array names by direct access when listing returns nothing.
CANDIDATE_VARIABLES = ("depth", "extent", "magnitude_mm", "storm_id")


def _get_array(group, name):
    """Return array ``name`` by direct access, or None. Direct access works over
    HTTP-backed stores, which cannot enumerate their members."""
    try:
        return group[name]
    except KeyError:
        return None


def _discover_variables(group):
    """Array names; falls back to probing known candidates when the store cannot
    be listed (HTTP-backed stores)."""
    names = list(group.array_keys())
    if names:
        return names
    return [n for n in CANDIDATE_VARIABLES if _get_array(group, n) is not None]


def _storm_labels(group, n_storms):
    """Human-readable per-storm labels for the selector: rainfall magnitude when
    a ``magnitude_mm`` array is present, else the storm index as a string."""
    mag = _get_array(group, "magnitude_mm")
    if mag is not None and int(mag.shape[0]) == n_storms:
        return [f"{float(v):.0f} mm" for v in np.asarray(mag[:])]
    return [str(i) for i in range(n_storms)]


def read_metadata(group):
    """Return selectable metadata: variables, storm count, crs, extent, grid."""
    variables = _discover_variables(group)
    if not variables:
        raise FloodmapError("store has no readable arrays")
    attrs = dict(group.attrs)
    ref_name = DEFAULT_VARIABLE if DEFAULT_VARIABLE in variables else variables[0]
    ref = group[ref_name]
    n_storms = int(ref.shape[STORM_DIM])
    height, width = int(ref.shape[1]), int(ref.shape[2])
    transform = Affine(*attrs["transform"])
    minx, top = transform.c, transform.f
    maxx = minx + transform.a * width
    bottom = top + transform.e * height  # e is negative -> bottom < top
    return {
        "variables": variables,
        "storm_count": n_storms,
        "storm_labels": _storm_labels(group, n_storms),
        "crs": attrs.get("crs"),
        "grid_shape": [height, width],
        "extent": [minx, min(top, bottom), maxx, max(top, bottom)],
    }


def build_storm_cog(group, variable=DEFAULT_VARIABLE, storm=0):
    """Slice one storm from ``variable`` and return COG bytes (in memory).

    Dry cells (depth <= the store's ``extent_threshold_m``) and the source
    nodata value are set to ``NODATA`` (-9999) so they render transparent.
    """
    arr_z = _get_array(group, variable)
    if arr_z is None:
        raise FloodmapError(f"variable '{variable}' not found")
    n = int(arr_z.shape[STORM_DIM])
    if not (0 <= storm < n):
        raise FloodmapError(f"storm {storm} out of range 0..{n - 1}")

    attrs = dict(group.attrs)
    if "crs" not in attrs or "transform" not in attrs:
        raise FloodmapError("store missing 'crs'/'transform' attrs; cannot georeference")
    crs = attrs["crs"]
    transform = Affine(*attrs["transform"])
    threshold = float(attrs.get("extent_threshold_m", 0.0))
    source_nodata = attrs.get("source_nodata")

    arr = _retry(lambda: np.asarray(arr_z[storm], dtype="float32"))
    dry = arr <= threshold
    if source_nodata is not None:
        dry = dry | (arr == np.float32(source_nodata))
    arr = np.where(dry, NODATA, arr).astype("float32")

    # Embed the storm's wet-cell range as band statistics so the map layer can
    # normalize the color ramp to this storm (OpenLayers reads STATISTICS_*).
    valid = arr[arr != NODATA]
    vmin = float(valid.min()) if valid.size else 0.0
    vmax = float(valid.max()) if valid.size else 0.0

    profile = {
        "driver": "GTiff", "dtype": "float32", "count": 1,
        "height": arr.shape[0], "width": arr.shape[1],
        "crs": crs, "transform": transform, "nodata": NODATA,
    }
    with MemoryFile() as src_mem:
        with src_mem.open(**profile) as src_ds:
            src_ds.write(arr, 1)
            src_ds.update_tags(
                1, STATISTICS_MINIMUM=repr(vmin), STATISTICS_MAXIMUM=repr(vmax)
            )
        with MemoryFile() as dst_mem:
            cog_translate(
                src_mem.name, dst_mem.name, cog_profiles.get("deflate"),
                in_memory=True, quiet=True, forward_band_tags=True,
            )
            return dst_mem.read()


@lru_cache(maxsize=64)
def read_storm_cog(src, variable=DEFAULT_VARIABLE, storm=0):
    """COG bytes for one storm, cached by (src, variable, storm). A map layer
    reads a COG via several HTTP range requests; caching means those don't each
    re-open the store and rebuild the file."""
    return build_storm_cog(open_store(src), variable, storm)


def parse_byte_range(range_header, total):
    """Parse an HTTP ``Range`` header against a ``total``-byte payload.

    Returns an inclusive ``(start, end)`` clamped to the payload, or ``None``
    when there is no usable byte range (the caller then sends the full body).
    """
    if not range_header or not range_header.startswith("bytes="):
        return None
    spec = range_header[len("bytes=") :].split(",", 1)[0].strip()
    start_s, sep, end_s = spec.partition("-")
    if not sep:
        return None
    try:
        if start_s == "":  # suffix range: final N bytes
            n = int(end_s)
            if n <= 0:
                return None
            start, end = max(0, total - n), total - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else total - 1
    except ValueError:
        return None
    end = min(end, total - 1)
    if start < 0 or start > end or start >= total:
        return None
    return (start, end)
