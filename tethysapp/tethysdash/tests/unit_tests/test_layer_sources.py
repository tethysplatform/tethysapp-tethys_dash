from urllib.parse import urlsplit

import pytest

from tethysapp.tethysdash import layer_sources, plugin_helpers
from tethysapp.tethysdash.layer_sources import (
    geotiff_source,
    is_allowed_layer_url,
    validate_layer_source_description,
)


@pytest.mark.parametrize(
    "name",
    ["geotiff_source", "is_allowed_layer_url", "validate_layer_source_description"],
)
def test_plugin_helpers_re_exports_layer_sources(name):
    assert getattr(plugin_helpers, name) is getattr(layer_sources, name)


# --- geotiff_source ----------------------------------------------------------


def test_geotiff_source_url_only_omits_projection_and_style():
    assert geotiff_source("https://x/a.tif") == {
        "type": "GeoTIFF",
        "props": {"url": "https://x/a.tif"},
    }


def test_geotiff_source_full():
    description = geotiff_source(
        "/files/a.tif",
        projection="EPSG:32612",
        ramp_name="viridis",
        ramp_min=0,
        ramp_max="50",
        ramp_reverse=False,
        mask_below=-1,
    )

    assert description == {
        "type": "GeoTIFF",
        "props": {
            "url": "/files/a.tif",
            "projection": "EPSG:32612",
            "mask_below": -1,
        },
        "style": {
            "rampName": "viridis",
            "rampMin": 0,
            "rampMax": "50",
            "rampReverse": False,
        },
    }
    assert validate_layer_source_description(description, "GeoTIFF") is True


def test_geotiff_source_partial_style_omits_unset_keys():
    assert geotiff_source("https://x/a.tif", ramp_name="magma") == {
        "type": "GeoTIFF",
        "props": {"url": "https://x/a.tif"},
        "style": {"rampName": "magma"},
    }


# --- is_allowed_layer_url ----------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com/x.tif",
        "http://example.com/x.tif",
        "HTTP://h/x.tif",
        "HttpS://h/x.tif?time=2026-01-01",
        "/files/x.tif",
        "/tethysdash/files/a b.tif",
    ],
)
def test_is_allowed_layer_url_accepts(url):
    assert is_allowed_layer_url(url) is True


@pytest.mark.parametrize(
    "url",
    [
        "//host/x.tif",
        "/\\host/x.tif",
        "\\\\host",
        " javascript:alert(1)",
        "javascript:alert(1)",
        "JavaScript:alert(1)",
        "file:///etc/passwd",
        "data:image/tiff;base64,AAAA",
        "ftp://host/x.tif",
        "relative/x.tif",
        "x.tif",
        "/",
        "",
        "https://",
        "https:/x.tif",
        "https://h/x.tif ",
        "https://h/x\\y.tif",
        "java\tscript:alert(1)",
        "https://h/x.tif\n",
        "/files/x\x00.tif",
        "\x7f/files/x.tif",
        None,
        42,
    ],
)
def test_is_allowed_layer_url_rejects(url):
    assert is_allowed_layer_url(url) is False


@pytest.mark.parametrize(
    "url",
    ["http://[::1/x.tif", "https://[v1.fe80::a+en1]x/y.tif", "http://[]x/a.tif"],
)
def test_is_allowed_layer_url_rejects_an_unparseable_url(url):
    """A URL that urlsplit itself refuses is refused, not raised through.

    Every other rejection is a decision made about the parts urlsplit returns.
    A malformed IPv6 literal is the one input that never gets that far: urlsplit
    raises ValueError before there are parts to judge. Letting that escape would
    turn a plugin returning a bad URL into a crash rather than the per-layer
    error message every other bad URL produces.
    """
    with pytest.raises(ValueError):
        urlsplit(url)
    assert is_allowed_layer_url(url) is False


# --- validate_layer_source_description ---------------------------------------


def test_validate_layer_source_description_happy_path():
    assert (
        validate_layer_source_description(geotiff_source("https://x/a.tif"), "GeoTIFF")
        is True
    )


def test_validate_layer_source_description_allows_null_bounds_and_style_omission():
    description = {
        "type": "GeoTIFF",
        "props": {"url": "https://x/a.tif"},
        "style": {"rampName": "viridis", "rampMin": None, "rampMax": "1e3"},
    }
    assert validate_layer_source_description(description, "GeoTIFF") is True


@pytest.mark.parametrize(
    "data,message",
    [
        (None, "returned None"),
        ("https://x/a.tif", "must return a source description dict, not str"),
        (["https://x/a.tif"], "not list"),
        (
            {"configuration": {}, "type": "GeoTIFF"},
            "configure-time scaffold",
        ),
        ({"legend": "default"}, "configure-time scaffold"),
        ({"source": {"type": "GeoTIFF"}}, "configure-time scaffold"),
        (
            {"type": "XYZ", "props": {"url": "https://x/a.tif"}},
            "type 'XYZ', but the plugin declares dynamic_map_layer_source = 'GeoTIFF'",
        ),
        ({"props": {"url": "https://x/a.tif"}}, "type None"),
        (
            {"type": "GeoTIFF", "props": {"url": "https://x/a.tif"}, "url": "u"},
            "unknown keys: url",
        ),
        ({"type": "GeoTIFF"}, "must carry a 'props' dict"),
        ({"type": "GeoTIFF", "props": "https://x/a.tif"}, "must carry a 'props' dict"),
        (
            {"type": "GeoTIFF", "props": {"url": "https://x/a.tif", "nodata": 0}},
            "props has unknown keys: nodata.*ramp settings",
        ),
        ({"type": "GeoTIFF", "props": {}}, "props.url must be a non-empty string"),
        ({"type": "GeoTIFF", "props": {"url": ""}}, "non-empty string"),
        ({"type": "GeoTIFF", "props": {"url": 5}}, "non-empty string"),
        (geotiff_source("file:///etc/passwd"), "'file:///etc/passwd' is not allowed"),
        (geotiff_source("javascript:alert(1)"), "is not allowed"),
        (geotiff_source("//host/x.tif"), "is not allowed"),
        (
            geotiff_source("https://x/a.tif", projection=4326),
            "projection must be a string",
        ),
        (
            geotiff_source("https://x/a.tif", projection="x" * 2001),
            "longer than 2000 characters",
        ),
        (
            {"type": "GeoTIFF", "props": {"url": "https://x/a.tif"}, "style": "x"},
            "style must be a dict",
        ),
        (
            {
                "type": "GeoTIFF",
                "props": {"url": "https://x/a.tif"},
                "style": {"ramp": "viridis"},
            },
            "style has unknown keys: ramp",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_name="viridis", ramp_min="abc"),
            "style.rampMin must be a finite number or numeric string, got 'abc'",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_max=float("inf")),
            "style.rampMax must be a finite number",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_max="nan"),
            "style.rampMax must be a finite number",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_min=True),
            "style.rampMin must be a finite number",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_reverse="yes"),
            "rampReverse must be True or False",
        ),
        (
            geotiff_source("https://x/a.tif", mask_below="0"),
            "props.mask_below must be a finite number",
        ),
        (
            geotiff_source("https://x/a.tif", mask_below=float("nan")),
            "props.mask_below must be a finite number",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_name=""),
            "rampName must be a non-empty ramp name",
        ),
        (
            geotiff_source("https://x/a.tif", ramp_name=3),
            "rampName must be a non-empty ramp name",
        ),
    ],
)
def test_validate_layer_source_description_rejects(data, message):
    with pytest.raises(ValueError, match=message):
        validate_layer_source_description(data, "GeoTIFF")


def test_validate_layer_source_description_messages_are_distinct():
    bad_returns = [
        None,
        {"configuration": {}},
        {"type": "XYZ", "props": {"url": "https://x/a.tif"}},
        geotiff_source(""),
        geotiff_source("file:///etc/passwd"),
        geotiff_source("https://x/a.tif", ramp_min="abc"),
    ]
    messages = set()
    for data in bad_returns:
        with pytest.raises(ValueError) as excinfo:
            validate_layer_source_description(data, "GeoTIFF")
        messages.add(str(excinfo.value))
    assert len(messages) == len(bad_returns)
