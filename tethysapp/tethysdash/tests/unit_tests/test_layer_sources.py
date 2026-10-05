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


def test_geotiff_source_url_only_omits_everything_else():
    assert geotiff_source("https://x/a.tif") == {
        "type": "GeoTIFF",
        "props": {"url": "https://x/a.tif"},
    }


def test_geotiff_source_full():
    description = geotiff_source(
        "/files/a.tif", projection="EPSG:32612", mask_below=-1
    )

    assert description == {
        "type": "GeoTIFF",
        "props": {
            "url": "/files/a.tif",
            "projection": "EPSG:32612",
            "mask_below": -1,
        },
    }
    assert validate_layer_source_description(description, "GeoTIFF") is True


def test_geotiff_source_takes_no_styling():
    """A fetch names a file; the layer's style is the author's.

    The plugin offers its preferred styling once, through the scaffold ``run()``
    returns, which the editor loads when the plugin is picked and again on Fetch
    defaults. Passing a ramp here is a mistake, and a loud one rather than a
    value that would be quietly ignored on every fetch.
    """
    with pytest.raises(TypeError):
        geotiff_source("https://x/a.tif", ramp_name="magma")


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


def test_validate_layer_source_description_rejects_a_style():
    """A style on a fetch is refused, not ignored.

    A plugin that still sends one is styling a layer it does not own, and
    silently dropping it would leave its author wondering why the map never
    changes.
    """
    description = {
        "type": "GeoTIFF",
        "props": {"url": "https://x/a.tif"},
        "style": {"rampName": "viridis"},
    }
    with pytest.raises(ValueError, match="unknown keys: style"):
        validate_layer_source_description(description, "GeoTIFF")


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
            "props has unknown keys: nodata",
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
            "unknown keys: style",
        ),
        (
            {
                "type": "GeoTIFF",
                "props": {"url": "https://x/a.tif", "rampName": "viridis"},
            },
            "props has unknown keys: rampName",
        ),
        (
            geotiff_source("https://x/a.tif", mask_below="0"),
            "props.mask_below must be a finite number",
        ),
        (
            geotiff_source("https://x/a.tif", mask_below=float("nan")),
            "props.mask_below must be a finite number",
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
        geotiff_source("https://x/a.tif", mask_below="0"),
    ]
    messages = set()
    for data in bad_returns:
        with pytest.raises(ValueError) as excinfo:
            validate_layer_source_description(data, "GeoTIFF")
        messages.add(str(excinfo.value))
    assert len(messages) == len(bad_returns)
