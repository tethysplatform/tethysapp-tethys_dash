"""Multi-mode runtime-capable plugin fixture for integration tests.

This is NOT a shipped plugin. It exists only to exercise the backend contract
end-to-end (controller + get_visualization + plugin base class + validator)
across the full error-path taxonomy defined by Unit 1 of the runtime map-layer
plan. Each mode deterministically triggers one code path so tests can assert
the expected response shape.

Usage in tests:
    >>> import intake
    >>> intake.register_driver("echo_runtime", EchoRuntimePlugin)
    >>> plugin = intake.open_echo_runtime(mode="happy")
    >>> plugin.read_features("req-1:grid-1:layer-1")
"""

from tethysapp.tethysdash.plugin_helpers import (
    LayerConfigurationBuilder,
    TethysDashPlugin,
)

_VALID_FC = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {"id": 1, "label": "A"},
            "geometry": {"type": "Point", "coordinates": [-112.0, 40.0]},
        }
    ],
    "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
}


class EchoRuntimePlugin(TethysDashPlugin):
    """Runtime-capable plugin whose ``fetch_features`` branches on ``mode``.

    ``mode`` values:

    - ``"happy"`` — returns a valid one-feature FeatureCollection.
    - ``"empty"`` — returns a valid FeatureCollection with zero features.
    - ``"none"`` — returns ``None`` (protocol error).
    - ``"scaffold"`` — returns a configure-time scaffold dict (shape error).
    - ``"raise"`` — raises ``RuntimeError`` during fetch.
    - ``"bad_crs"`` — returns a FeatureCollection without ``crs``.
    - ``"slow_progress"`` — emits one ``send_update`` then returns happy.
    """

    name = "echo_runtime"
    group = "Test"
    label = "Echo Runtime"
    type = "map_layer"
    args = {"mode": "text"}
    dynamic_map_layer = True

    def run(self):
        builder = LayerConfigurationBuilder("Echo", "GeoJSON")
        builder.set_plugin_source("echo_runtime", {"mode": self.mode})
        return builder.build()

    def fetch_features(self):
        mode = getattr(self, "mode", "happy")
        if mode == "happy":
            return _VALID_FC
        if mode == "empty":
            return {
                "type": "FeatureCollection",
                "features": [],
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
            }
        if mode == "none":
            return None
        if mode == "scaffold":
            return {
                "type": "FeatureCollection",
                "style": {"fill": "red"},
                "features": [],
                "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
            }
        if mode == "raise":
            raise RuntimeError("Echo plugin intentional failure")
        if mode == "bad_crs":
            return {"type": "FeatureCollection", "features": []}
        if mode == "slow_progress":
            self.send_update("computing", percentage_complete=50)
            return _VALID_FC
        raise ValueError(f"Unknown echo mode: {mode}")
