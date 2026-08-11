"""Django-free zarr -> Cloud-Optimized GeoTIFF conversion.

Opens a public Zarr store, slices one 2-D grid from a variable (a plain
``[y, x]`` grid, or one ``index`` along a leading ``[n, y, x]`` dimension), and
converts it to a COG entirely in memory -- nothing is written to disk or S3.
Kept free of Django so the conversion logic is unit-testable in isolation;
``controllers.py`` wraps these functions with request handling.

The store is read over HTTPS via fsspec (see EF5_FLOODMAPS_SPEC.md 3.4); we
intentionally avoid s3fs so no AWS stack or credentials are required.
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

# Masked cells get this concrete nodata value. We deliberately avoid NaN:
# OpenLayers masks cells with `value == nodata`, and `NaN == NaN` is always
# false, so NaN cells would never render transparent. A negative sentinel suits
# the non-negative grids this is typically used with.
NODATA = -9999.0


class ZarrCogError(Exception):
    """A zarr store could not be read or converted to a COG."""


class StoreOpenError(ZarrCogError):
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


def _get_array(group, name):
    """Return array ``name`` by direct access, or None. Direct access works over
    HTTP-backed stores, which cannot enumerate their members."""
    try:
        return group[name]
    except KeyError:
        return None


def _discover_variables(group, candidates=None):
    """Array names. Lists the store when it can be enumerated; otherwise probes
    the caller-supplied ``candidates`` (HTTP-backed stores can't be listed)."""
    names = list(group.array_keys())
    if names:
        return names
    if candidates:
        return [n for n in candidates if _get_array(group, n) is not None]
    return []


def _slice_labels(group, n_slices, label_var=None):
    """Per-slice labels for a selector: values of the 1-D ``label_var`` array
    when present and matching the slice count, else the slice index string."""
    if label_var is not None:
        arr = _get_array(group, label_var)
        if arr is not None and arr.ndim == 1 and int(arr.shape[0]) == n_slices:
            return [f"{float(v):g}" for v in np.asarray(arr[:])]
    return [str(i) for i in range(n_slices)]


def _grid_dims(shape):
    """(n_slices, height, width) for a 2-D ``[y, x]`` or 3-D ``[n, y, x]`` array."""
    if len(shape) == 2:
        return 1, int(shape[0]), int(shape[1])
    if len(shape) == 3:
        return int(shape[0]), int(shape[1]), int(shape[2])
    raise ZarrCogError(
        f"expected a 2D [y, x] or 3D [n, y, x] array, got shape {tuple(shape)}"
    )


def _is_griddable(group, name):
    """True when array ``name`` is a 2-D or 3-D grid (not a 1-D coord/label)."""
    arr = _get_array(group, name)
    return arr is not None and arr.ndim in (2, 3)


def read_metadata(group, variable=None, candidates=None, label_var=None):
    """Return selectable metadata: variables, slice count, crs, extent, grid.

    ``variable`` picks the reference array (else the first griddable one);
    ``candidates`` seeds discovery for non-listable stores; ``label_var`` names a
    1-D array whose values label each slice.
    """
    variables = _discover_variables(group, candidates)
    if variable is not None:
        ref_name = variable
    else:
        # Auto-pick the first griddable array; skip 1-D coordinate/label arrays
        # a store may also expose. List order is hash-dependent, so filtering by
        # shape keeps selection deterministic.
        ref_name = next((n for n in variables if _is_griddable(group, n)), None)
    if ref_name is None:
        raise ZarrCogError("could not determine a griddable variable; pass `variable`")
    ref = _get_array(group, ref_name)
    if ref is None:
        raise ZarrCogError(f"variable '{ref_name}' not found")
    attrs = dict(group.attrs)
    if "transform" not in attrs:
        raise ZarrCogError("store missing 'transform' attr; cannot georeference")
    n_slices, height, width = _grid_dims(ref.shape)
    transform = Affine(*attrs["transform"])
    minx, top = transform.c, transform.f
    maxx = minx + transform.a * width
    bottom = top + transform.e * height  # e is negative -> bottom < top
    return {
        "variables": variables,
        "slice_count": n_slices,
        "slice_labels": _slice_labels(group, n_slices, label_var),
        "crs": attrs.get("crs"),
        "grid_shape": [height, width],
        "extent": [minx, min(top, bottom), maxx, max(top, bottom)],
    }


def build_cog(
    group, variable, index=0, *, nodata=NODATA, mask_below=None, source_nodata=None
):
    """Slice one 2-D grid from ``variable`` and return COG bytes (in memory).

    The slice is a plain ``[y, x]`` array, or ``index`` along a leading
    ``[n, y, x]`` dimension. Cells are masked to ``nodata`` (rendered
    transparent) only when asked: ``mask_below`` masks values ``<=`` it and
    ``source_nodata`` masks an upstream sentinel. Both default to the store's
    ``extent_threshold_m`` / ``source_nodata`` attrs when present, so a store can
    declare its own masking; a store that declares neither is left untouched.
    """
    arr_z = _get_array(group, variable)
    if arr_z is None:
        raise ZarrCogError(f"variable '{variable}' not found")

    attrs = dict(group.attrs)
    if "crs" not in attrs or "transform" not in attrs:
        raise ZarrCogError("store missing 'crs'/'transform' attrs; cannot georeference")
    crs = attrs["crs"]
    transform = Affine(*attrs["transform"])
    if mask_below is None:
        mask_below = attrs.get("extent_threshold_m")
    if source_nodata is None:
        source_nodata = attrs.get("source_nodata")

    ndim = len(arr_z.shape)
    if ndim == 2:
        if index != 0:
            raise ZarrCogError("2D array has a single slice; index must be 0")
        arr = _retry(lambda: np.asarray(arr_z, dtype="float32"))
    elif ndim == 3:
        n = int(arr_z.shape[0])
        if not (0 <= index < n):
            raise ZarrCogError(f"index {index} out of range 0..{n - 1}")
        arr = _retry(lambda: np.asarray(arr_z[index], dtype="float32"))
    else:
        raise ZarrCogError(
            f"expected a 2D [y, x] or 3D [n, y, x] array, got shape {tuple(arr_z.shape)}"
        )

    mask = None
    if mask_below is not None:
        mask = arr <= float(mask_below)
    if source_nodata is not None:
        sn = arr == np.float32(source_nodata)
        mask = sn if mask is None else (mask | sn)
    if mask is not None:
        arr = np.where(mask, nodata, arr).astype("float32")

    # Embed the slice's value range as band statistics so the map layer can
    # normalize the color ramp to this slice (OpenLayers reads STATISTICS_*).
    valid = arr[arr != nodata]
    vmin = float(valid.min()) if valid.size else 0.0
    vmax = float(valid.max()) if valid.size else 0.0

    profile = {
        "driver": "GTiff", "dtype": "float32", "count": 1,
        "height": arr.shape[0], "width": arr.shape[1],
        "crs": crs, "transform": transform, "nodata": nodata,
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
def read_cog(src, variable, index=0, mask_below=None):
    """COG bytes for one slice, cached by (src, variable, index, mask_below). A
    map layer reads a COG via several HTTP range requests; caching means those
    don't each re-open the store and rebuild the file. Masking otherwise follows
    the store's declared attrs (see ``build_cog``)."""
    return build_cog(open_store(src), variable, index, mask_below=mask_below)


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
