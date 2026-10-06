"""
Source descriptions for dynamic map layers in TethysDash.

A dynamic map_layer plugin whose ``dynamic_map_layer_source`` is not GeoJSON
returns a source description from ``fetch_source()``. This module builds those
descriptions (:py:func:`geotiff_source`) and validates them
(:py:func:`validate_layer_source_description`). Every public name is
re-exported from :py:mod:`tethysapp.tethysdash.plugin_helpers`, which remains
the import path for plugin authors.
"""

import math
from urllib.parse import urlsplit


def is_allowed_layer_url(url):
    """
    Whether ``url`` may be handed to the browser as a runtime layer source.

    Accepts an absolute ``http``/``https`` URL (scheme case-insensitive) with a
    host, or a path on this server that starts with exactly one ``/``. Rejects
    everything else: other schemes (``javascript:``, ``file:``, ``data:``,
    ``ftp:``, ...), protocol-relative ``//host`` URLs, relative paths, and any
    URL containing a backslash or an ASCII control character, or with
    whitespace at either end -- browsers normalize those away, so
    ``"/\\host"`` or ``" javascript:..."`` would otherwise slip past a prefix
    check as another host or scheme.

    Args:
        url: The candidate URL.

    Returns:
        bool: True when the URL is allowed.
    """
    if not isinstance(url, str) or not url:
        return False
    if url != url.strip() or "\\" in url:
        return False
    if any(ord(char) < 0x20 or ord(char) == 0x7F for char in url):
        return False
    if url.startswith("/"):
        return len(url) > 1 and url[1] != "/"
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    return parts.scheme.lower() in {"http", "https"} and bool(parts.netloc)


# A fetch names a file and describes the data in it. It carries no styling: a
# raster layer's style is the author's, saved as ``configuration.style`` and
# edited on the Style tab. A plugin offers its preferred styling once, through
# the scaffold ``run()`` returns (see ``LayerConfigurationBuilder``), which the
# editor loads when the plugin is picked or Fetch defaults is pressed.
_LAYER_SOURCE_DESCRIPTION_KEYS = frozenset({"type", "props"})
_LAYER_SOURCE_PROPS_KEYS = frozenset({"url", "projection", "mask_below"})
# A source description legitimately carries "props" and "style", so a
# scaffold is recognized by the keys only a configure-time layer config has.
_LAYER_SOURCE_SCAFFOLD_KEYS = frozenset({"configuration", "legend", "source"})
_MAX_PROJECTION_LENGTH = 2000


def _is_finite_number(value):
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and math.isfinite(value)
    )


def _is_numeric_bound(value):
    if _is_finite_number(value):
        return True
    if isinstance(value, str):
        try:
            return math.isfinite(float(value))
        except ValueError:
            return False
    return False


def validate_layer_source_description(data, expected_type):
    """
    Validate the return value of a dynamic-map-layer plugin's ``fetch_source``.

    The shape is ``{"type": expected_type, "props": {"url", "projection"?,
    "mask_below"?}}``, the keys :py:func:`geotiff_source` writes. Every rejection
    names what to change, so plugin authors can self-diagnose from the
    per-layer error UI.

    Args:
        data: The return value of a plugin's ``fetch_source()``.
        expected_type (str): The plugin's ``dynamic_map_layer_source``.

    Raises:
        ValueError: If ``data`` is ``None``, not a dict, a configure-time
            scaffold, of another source type, carries unknown keys -- a
            ``style`` among them, which a fetch no longer supplies -- has a
            missing or disallowed URL (see :py:func:`is_allowed_layer_url`), or
            a projection that is not a string of at most 2000 characters.

    Returns:
        True when ``data`` is a valid source description.
    """
    helper_hint = "build it with geotiff_source(url, ...)"
    if data is None:
        raise ValueError(
            f"fetch_source() returned None; return a {expected_type} source "
            f"description instead ({helper_hint})."
        )
    if not isinstance(data, dict):
        raise ValueError(
            "fetch_source() must return a source description dict, not "
            f"{type(data).__name__}; {helper_hint}."
        )
    if _LAYER_SOURCE_SCAFFOLD_KEYS.intersection(data.keys()):
        raise ValueError(
            "fetch_source() returned a configure-time scaffold; return only the "
            f"source description ({helper_hint}) and keep the layer config "
            "in run()."
        )

    returned_type = data.get("type")
    if returned_type != expected_type:
        raise ValueError(
            f"fetch_source() returned a source of type {returned_type!r}, but "
            f"the plugin declares dynamic_map_layer_source = '{expected_type}'; "
            f"return type '{expected_type}'."
        )

    unknown_keys = sorted(set(data) - _LAYER_SOURCE_DESCRIPTION_KEYS)
    if unknown_keys:
        raise ValueError(
            f"source description has unknown keys: {', '.join(unknown_keys)}. "
            "Allowed keys are type and props; a layer's styling is the "
            "author's, set on the Style tab, and a fetch does not carry it."
        )

    props = data.get("props")
    if not isinstance(props, dict):
        raise ValueError(
            "source description must carry a 'props' dict holding the url, "
            "e.g. {'url': 'https://example.com/data.tif'}."
        )
    unknown_props = sorted(set(props) - _LAYER_SOURCE_PROPS_KEYS)
    if unknown_props:
        raise ValueError(
            f"source description props has unknown keys: {', '.join(unknown_props)}. "
            "Allowed keys are url, projection and mask_below."
        )

    url = props.get("url")
    if not isinstance(url, str) or not url:
        raise ValueError(
            "source description props.url must be a non-empty string naming "
            "the file to draw."
        )
    if not is_allowed_layer_url(url):
        raise ValueError(
            f"source description props.url {url!r} is not allowed. Use an "
            "absolute http(s) URL or a path on this server starting with a "
            "single '/', with no backslashes, control characters or "
            "surrounding whitespace."
        )

    if "projection" in props:
        projection = props["projection"]
        if not isinstance(projection, str):
            raise ValueError(
                "source description props.projection must be a string such as "
                "'EPSG:32612'; omit it to use the file's own CRS."
            )
        if len(projection) > _MAX_PROJECTION_LENGTH:
            raise ValueError(
                "source description props.projection is longer than "
                f"{_MAX_PROJECTION_LENGTH} characters; pass an EPSG code or a "
                "shorter definition."
            )

    if "mask_below" in props and not _is_finite_number(props["mask_below"]):
        raise ValueError(
            "source description props.mask_below must be a finite number, got "
            f"{props['mask_below']!r}; omit it to mask nothing."
        )

    return True


def geotiff_source(url, projection=None, mask_below=None):
    """
    Build the source description a GeoTIFF plugin's ``fetch_source`` returns.

    It names the file and describes the data in it. It carries no styling: a
    raster layer's style is the author's, saved as ``configuration.style`` and
    edited on the Style tab, and a fetch never overrides it. A plugin offers its
    preferred styling once, through the scaffold ``run()`` returns -- see
    :py:meth:`LayerConfigurationBuilder.set_raster_ramp` -- which the editor
    loads when the plugin is picked, and again when the author presses Fetch
    defaults. Unset arguments are omitted.

    Args:
        url (str): ``http(s)`` URL, or a path on this server, of the GeoTIFF.
        projection (str, optional): CRS to read the file in, e.g.
            ``"EPSG:32612"``, when its own GeoKeys are missing or wrong.
        mask_below (float, optional): Hide values at or below this. A property
            of the data rather than of the palette -- the value decides what the
            file publishes as real data -- so it travels with each fetch.

    Example:
        return geotiff_source(f"https://example.com/{self.date}.tif",
                              mask_below=0)

    Returns:
        dict: ``{"type": "GeoTIFF", "props": {url, projection?, mask_below?}}``.
    """
    props = {"url": url}
    if projection is not None:
        props["projection"] = projection
    if mask_below is not None:
        props["mask_below"] = mask_below
    return {"type": "GeoTIFF", "props": props}
