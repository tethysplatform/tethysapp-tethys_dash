"""Django-free GeoParquet -> GeoJSON conversion.

Reads a public GeoParquet file over HTTPS and returns it as a GeoJSON
FeatureCollection reprojected to EPSG:4326 (the projection OpenLayers assumes for
GeoJSON). Kept free of Django so the logic is unit-testable in isolation;
``controllers.py`` wraps it with request handling.

The file is read over HTTPS via fsspec (same approach as ``zarr_utils``); we
avoid s3fs so no AWS stack or credentials are required for the common case.
"""

from __future__ import annotations

import io
import time

import fsspec
import geopandas as gpd

# OpenLayers reads GeoJSON as EPSG:4326 by default, so normalize to it.
TARGET_CRS = "EPSG:4326"


class GeoParquetError(Exception):
    """A GeoParquet file could not be read or converted."""


class FileOpenError(GeoParquetError):
    """The file URL could not be opened (network/URL error, not a parse error)."""


def _retry(fn, attempts=3, base_delay=0.25):
    """Call ``fn`` and retry on any exception, with linear backoff. The file is
    read live over HTTP, so a single read occasionally fails transiently;
    retrying re-issues it rather than failing the whole request."""
    last = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as e:
            last = e
            if i < attempts - 1:
                time.sleep(base_delay * (i + 1))
    raise last


def _fetch_bytes(src):
    """Read the whole file into memory (public URL, read-only)."""
    with fsspec.open(src, "rb") as f:
        return f.read()


def read_geojson(src, target_crs=TARGET_CRS):
    """Read a public GeoParquet file and return a GeoJSON FeatureCollection
    string, reprojected to ``target_crs`` (default EPSG:4326).

    Raises ``FileOpenError`` if the URL cannot be opened, or ``GeoParquetError``
    if the bytes are not a valid GeoParquet.
    """
    try:
        data = _retry(lambda: _fetch_bytes(src))
    except Exception as e:
        raise FileOpenError(f"could not open geoparquet file: {e}") from e

    try:
        gdf = gpd.read_parquet(io.BytesIO(data))
    except Exception as e:
        raise GeoParquetError(f"could not read geoparquet: {e}") from e

    if target_crs and gdf.crs is not None:
        gdf = gdf.to_crs(target_crs)
    return gdf.to_json()
