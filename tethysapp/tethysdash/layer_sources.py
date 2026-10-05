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


_LAYER_SOURCE_DESCRIPTION_KEYS = frozenset({"type", "props", "style"})
_LAYER_SOURCE_PROPS_KEYS = frozenset({"url", "projection", "mask_below"})
_LAYER_SOURCE_STYLE_KEYS = frozenset(
    {"rampName", "rampMin", "rampMax", "rampReverse"}
)
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
    "mask_below"?}, "style"?: {"rampName", "rampMin", "rampMax",
    "rampReverse"}}``, the keys :py:func:`geotiff_source` writes. Every rejection
    names what to change, so plugin authors can self-diagnose from the
    per-layer error UI.

    Args:
        data: The return value of a plugin's ``fetch_source()``.
        expected_type (str): The plugin's ``dynamic_map_layer_source``.

    Raises:
        ValueError: If ``data`` is ``None``, not a dict, a configure-time
            scaffold, of another source type, carries unknown keys, has a
            missing or disallowed URL (see :py:func:`is_allowed_layer_url`), a
            projection that is not a string of at most 2000 characters, or
            style values of the wrong type.

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
            "Allowed keys are type, props and style."
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
            "Allowed keys are url, projection and mask_below; ramp settings "
            "go in style."
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

    if "style" not in data:
        return True
    style = data["style"]
    if not isinstance(style, dict):
        raise ValueError(
            "source description style must be a dict of ramp settings; omit it "
            "to keep the layer's saved style."
        )
    unknown_style = sorted(set(style) - _LAYER_SOURCE_STYLE_KEYS)
    if unknown_style:
        raise ValueError(
            f"source description style has unknown keys: {', '.join(unknown_style)}. "
            "Allowed keys are " + ", ".join(sorted(_LAYER_SOURCE_STYLE_KEYS)) + "."
        )
    if "rampName" in style and (
        not isinstance(style["rampName"], str) or not style["rampName"].strip()
    ):
        raise ValueError(
            "source description style.rampName must be a non-empty ramp name "
            "such as 'viridis'."
        )
    for bound in ("rampMin", "rampMax"):
        value = style.get(bound)
        if value is not None and not _is_numeric_bound(value):
            raise ValueError(
                f"source description style.{bound} must be a finite number or "
                f"numeric string, got {value!r}; omit it (or pass None) to "
                "resolve it from the file."
            )
    if "rampReverse" in style and not isinstance(style["rampReverse"], bool):
        raise ValueError(
            "source description style.rampReverse must be True or False, got "
            f"{style['rampReverse']!r}."
        )
    return True


def geotiff_source(
    url,
    projection=None,
    ramp_name=None,
    ramp_min=None,
    ramp_max=None,
    ramp_reverse=None,
    mask_below=None,
):
    """
    Build the source description a GeoTIFF plugin's ``fetch_source`` returns.

    Unset arguments are omitted, and ``style`` is omitted entirely when no
    style argument is set, in which case the layer keeps its saved style. When
    a ``style`` is returned it replaces the layer's saved ramp settings as a
    whole (unless the dashboard author has pinned the style); a missing
    ``ramp_min``/``ramp_max`` is resolved from the file's statistics. The
    ``style`` keys are the ones a raster layer saves in its
    ``configuration.style``, so no translation happens between the two.

    Args:
        url (str): ``http(s)`` URL, or a path on this server, of the GeoTIFF.
        projection (str, optional): CRS to read the file in, e.g.
            ``"EPSG:32612"``, when its own GeoKeys are missing or wrong.
        ramp_name (str, optional): Color ramp name, e.g. ``"viridis"``.
        ramp_min (float | str, optional): Value at the ramp's low end.
        ramp_max (float | str, optional): Value at the ramp's high end.
        ramp_reverse (bool, optional): Reverse the ramp.
        mask_below (float, optional): Hide values at or below this. A source
            property, so it applies even when the author has pinned styling.

    Example:
        return geotiff_source(f"https://example.com/{self.date}.tif",
                              ramp_name="viridis", ramp_min=0, ramp_max=50)

    Returns:
        dict: ``{"type": "GeoTIFF", "props": {url, projection?, mask_below?},
        "style"?: {...}}``.
    """
    props = {"url": url}
    if projection is not None:
        props["projection"] = projection
    # A source property, not a style one: it decides which values the file
    # publishes as data. It is therefore applied whether or not the dashboard
    # author has pinned the layer's styling.
    if mask_below is not None:
        props["mask_below"] = mask_below
    style_values = {
        "rampName": ramp_name,
        "rampMin": ramp_min,
        "rampMax": ramp_max,
        "rampReverse": ramp_reverse,
    }
    style = {key: value for key, value in style_values.items() if value is not None}

    description = {"type": "GeoTIFF", "props": props}
    if style:
        description["style"] = style
    return description
