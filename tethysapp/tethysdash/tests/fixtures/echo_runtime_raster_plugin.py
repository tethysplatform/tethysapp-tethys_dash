"""Multi-mode dynamic GeoTIFF plugin fixture for integration tests.

The raster counterpart of ``echo_runtime_plugin.py``. This is NOT a shipped
plugin. It exists only to exercise the GeoTIFF runtime contract end-to-end
(controller + get_visualization + plugin base class + source-description
validator). Each mode deterministically triggers one code path so tests can
assert the expected response shape.

Usage in tests:
    >>> import intake
    >>> intake.register_driver("echo_runtime_raster", EchoRuntimeRasterPlugin)
    >>> plugin = intake.open_echo_runtime_raster(mode="happy")
    >>> plugin.read_source("req-1:grid-1:layer-1")
"""

from tethysapp.tethysdash.plugin_helpers import (
    LayerConfigurationBuilder,
    TethysDashPlugin,
    geotiff_source,
)

ECHO_RASTER_URL = "https://example.com/rasters/echo.tif"


class EchoRuntimeRasterPlugin(TethysDashPlugin):
    """Dynamic GeoTIFF plugin whose ``fetch_source`` branches on ``mode``.

    ``mode`` values:

    - ``"happy"`` — returns ``geotiff_source(ECHO_RASTER_URL)``.
    - ``"styled"`` — returns a description with a projection and a mask.
    - ``"with_style"`` — returns a description carrying a ``style``, which a
      fetch may not: the layer's styling is its author's.
    - ``"none"`` — returns ``None`` (protocol error).
    - ``"scaffold"`` — returns the configure-time scaffold (shape error).
    - ``"wrong_type"`` — returns a description of type ``"XYZ"``.
    - ``"empty_url"`` — returns a description with an empty URL.
    - ``"file_url"`` — returns a ``file:///`` URL (disallowed scheme).
    - ``"bad_mask"`` — returns a non-numeric ``mask_below``.
    - ``"raise"`` — raises ``RuntimeError`` during fetch.
    - ``"slow_progress"`` — emits one ``send_update`` then returns happy.
    """

    name = "echo_runtime_raster"
    group = "Test"
    label = "Echo Runtime Raster"
    type = "map_layer"
    args = {"mode": "text"}
    dynamic_map_layer = True
    dynamic_map_layer_source = "GeoTIFF"

    def run(self):
        builder = LayerConfigurationBuilder("Echo Raster", "GeoTIFF")
        builder.set_plugin_source("echo_runtime_raster", {"mode": self.mode})
        builder.set_raster_ramp("viridis")
        return builder.build()

    def fetch_source(self):
        mode = getattr(self, "mode", "happy")
        if mode == "happy":
            return geotiff_source(ECHO_RASTER_URL)
        if mode == "styled":
            return geotiff_source(
                ECHO_RASTER_URL,
                projection="EPSG:32612",
                mask_below=-9999,
            )
        if mode == "with_style":
            return {
                **geotiff_source(ECHO_RASTER_URL),
                "style": {"rampName": "magma"},
            }
        if mode == "none":
            return None
        if mode == "scaffold":
            return self.run()
        if mode == "wrong_type":
            return {"type": "XYZ", "props": {"url": ECHO_RASTER_URL}}
        if mode == "empty_url":
            return geotiff_source("")
        if mode == "file_url":
            return geotiff_source("file:///etc/passwd")
        if mode == "bad_mask":
            return geotiff_source(ECHO_RASTER_URL, mask_below="abc")
        if mode == "raise":
            raise RuntimeError("Echo raster plugin intentional failure")
        if mode == "slow_progress":
            self.send_update("computing", percentage_complete=50)
            return geotiff_source(ECHO_RASTER_URL)
        raise ValueError(f"Unknown echo mode: {mode}")
