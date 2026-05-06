"""Layer 1 tests for the runtime plugin registry loader.

Covers the error paths (missing file, malformed JSON) that previously
had only-transitive coverage via the deleted build-time loader.
"""

from __future__ import annotations

from unittest import mock

from tethysapp.tethysdash.plugin_registry_loader import (
    load_runtime_plugin_registry,
)


def test_load_runtime_plugin_registry_missing_file_returns_empty():
    """A missing JSON file yields [] without raising."""
    with mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.open",
        side_effect=FileNotFoundError,
    ):
        assert load_runtime_plugin_registry() == []


def test_load_runtime_plugin_registry_malformed_json_returns_empty():
    """A corrupted JSON file yields [] and logs a warning rather than raising."""
    fake_handle = mock.mock_open(read_data="{not valid json")
    with mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.open", fake_handle
    ):
        assert load_runtime_plugin_registry() == []


def test_load_runtime_plugin_registry_valid_payload_returns_entries():
    """A well-formed list of plugin dicts is returned verbatim."""
    payload = '[{"source": "querix", "type": "client_custom_remote"}]'
    fake_handle = mock.mock_open(read_data=payload)
    with mock.patch(
        "tethysapp.tethysdash.plugin_registry_loader.open", fake_handle
    ):
        assert load_runtime_plugin_registry() == [
            {"source": "querix", "type": "client_custom_remote"}
        ]
