"""Plugins with a secret arg, for tests.

These are NOT shipped plugins. They prove a plugin received its secret without ever
returning it: the result carries the value's sha256 and length, never the value
itself, so a check that refuses any result holding a secret lets them through.

The ``site`` arg switches each one into a path that leaks the secret, so tests can
show it is scrubbed or refused:

- ``"raise"`` raises a :class:`VisualizationError` quoting the secret.
- ``"crash"`` raises a ``RuntimeError`` quoting the secret.
- ``"progress"`` sends a progress message quoting the secret, then answers as usual.
- ``"leak"`` returns the secret in its result: the raster plugin, URL-quoted in the
  query string of the file it names.

Any other value answers with the proof. :class:`EchoSecretEarlyPlugin` also sends a
progress message quoting the secret while it is constructed, before
``TethysDashPlugin.__init__`` has run.

Usage in tests:
    >>> mocker.patch(
    ...     "tethysapp.tethysdash.visualizations.intake", new=EchoSecretIntake()
    ... )
"""

import hashlib
import types
from urllib.parse import quote

from tethysapp.tethysdash.exceptions import VisualizationError
from tethysapp.tethysdash.plugin_helpers import (
    LayerConfigurationBuilder,
    TethysDashPlugin,
    geotiff_source,
)

SECRET_ARGS = {"api_key": "secret", "site": "text"}


def secret_proof(value):
    """What a result carries to show the plugin received ``value``."""
    return {
        "key_sha256": hashlib.sha256(value.encode("utf-8")).hexdigest(),
        "key_length": len(value),
    }


class _EchoSecret:
    """The switches both plugins share."""

    def _answer(self):
        """The fields a result carries: the site, and the secret's proof or value."""
        api_key = self.get_arg("api_key")
        site = self.get_arg("site")
        if site == "raise":
            raise VisualizationError(f"Could not sign in to {site} with {api_key}")
        if site == "crash":
            raise RuntimeError(f"Connection refused for {api_key}")
        if site == "progress":
            self.send_update(f"Signing in with {api_key}", percentage_complete=50)
        if site == "leak":
            return {"site": site, "api_key": api_key}
        return {"site": site, **secret_proof(api_key)}


class EchoSecretPlugin(_EchoSecret, TethysDashPlugin):
    """A table plugin with a secret arg."""

    name = "echo_secret"
    group = "Test"
    label = "Echo Secret"
    type = "table"
    args = SECRET_ARGS

    def run(self):
        return {"title": "Echo Secret", "data": [self._answer()]}


class EchoSecretLayerPlugin(_EchoSecret, TethysDashPlugin):
    """A dynamic GeoJSON map layer plugin with a secret arg."""

    name = "echo_secret_layer"
    group = "Test"
    label = "Echo Secret Layer"
    type = "map_layer"
    args = SECRET_ARGS
    dynamic_map_layer = True

    def run(self):
        # The scaffold's plugin source keeps the secret's slot, never its value.
        builder = LayerConfigurationBuilder("Echo Secret", "GeoJSON")
        builder.set_plugin_source(
            "echo_secret_layer", {"api_key": "", "site": self.get_arg("site")}
        )
        return builder.build()

    def fetch_features(self):
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": self._answer(),
                    "geometry": {"type": "Point", "coordinates": [-112.0, 40.0]},
                }
            ],
            "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        }


class EchoSecretRasterPlugin(_EchoSecret, TethysDashPlugin):
    """A dynamic GeoTIFF map layer plugin with a secret arg."""

    name = "echo_secret_raster"
    group = "Test"
    label = "Echo Secret Raster"
    type = "map_layer"
    args = SECRET_ARGS
    dynamic_map_layer = True
    dynamic_map_layer_source = "GeoTIFF"

    def run(self):
        builder = LayerConfigurationBuilder("Echo Secret Raster", "GeoTIFF")
        builder.set_plugin_source(
            "echo_secret_raster", {"api_key": "", "site": self.get_arg("site")}
        )
        return builder.build()

    def fetch_source(self):
        answer = self._answer()
        if answer["site"] == "leak":
            token = quote(answer["api_key"], safe="")
            return geotiff_source(f"https://data.example.org/latest.tif?token={token}")
        return geotiff_source(f"https://data.example.org/{answer['key_sha256']}.tif")


class EchoSecretEarlyPlugin(EchoSecretPlugin):
    """A table plugin that sends progress quoting its secret while it is constructed,
    before ``TethysDashPlugin.__init__`` has run."""

    name = "echo_secret_early"
    label = "Echo Secret Early"

    def __init__(self, *args, **kwargs):
        self.send_update(f"Connecting with {kwargs.get('api_key')}")
        super().__init__(*args, **kwargs)


class EchoSecretIntake:
    """Stands in for the ``intake`` module with only the echo secret plugins."""

    source = types.SimpleNamespace(
        registry={
            "echo_secret": EchoSecretPlugin,
            "echo_secret_layer": EchoSecretLayerPlugin,
            "echo_secret_raster": EchoSecretRasterPlugin,
            "echo_secret_early": EchoSecretEarlyPlugin,
        }
    )
    open_echo_secret = EchoSecretPlugin
    open_echo_secret_layer = EchoSecretLayerPlugin
    open_echo_secret_raster = EchoSecretRasterPlugin
    open_echo_secret_early = EchoSecretEarlyPlugin
