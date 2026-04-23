"""Contract tests for the plugin-side editable-path resolver.

Covers Intake backend plugins (via intake.source.registry) and client_custom
plugins (via the webpack-built clientPluginRegistry.json). Built-in viz types
stay out of scope here — they are pinned by test_editable_schema.py against
the static JSON whitelist.

Layer 1 tests — no server, milliseconds per test.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from tethysapp.tethysdash.editable_schemas_plugin import (
    is_path_allowed_plugin,
    resolve_editable_paths,
)


# ---------------------------------------------------------------------------
# Fakes for Intake plugin classes and client_custom registry entries
# ---------------------------------------------------------------------------


def _fake_intake_plugin(
    args=None, llm_editable_args=None, llm_non_editable_args=None
):
    """Build a stand-in for an intake.source.base.DataSource subclass.

    Only the attributes ``get_plugin_prop`` reads are needed —
    ``args``, ``llm_editable_args``, ``llm_non_editable_args``.
    """
    plugin_attrs = {"args": args or {}}
    if llm_editable_args is not None:
        plugin_attrs["llm_editable_args"] = llm_editable_args
    if llm_non_editable_args is not None:
        plugin_attrs["llm_non_editable_args"] = llm_non_editable_args
    return SimpleNamespace(**plugin_attrs)


def _fake_client_entry(source, args, **extra):
    return {"source": source, "args": args, **extra}


@pytest.fixture
def intake_registry():
    """Patch intake.source.registry so tests can inject fake plugins.

    Yields a dict the test populates with ``{source: fake_plugin}``.
    """
    registry = {}
    with patch(
        "tethysapp.tethysdash.editable_schemas_plugin.intake.source.registry",
        registry,
    ):
        yield registry


@pytest.fixture
def client_registry():
    """Patch the client plugin registry loader to return a test list.

    Yields a list the test populates with dict entries.
    """
    entries = []
    with patch(
        "tethysapp.tethysdash.editable_schemas_plugin._load_client_plugin_registry_cached",
        return_value=entries,
    ):
        yield entries


# ---------------------------------------------------------------------------
# Intake resolver
# ---------------------------------------------------------------------------


class TestIntakeResolver:
    """resolve_editable_paths for Intake plugin sources."""

    def test_no_author_attrs_returns_all_registered_args(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text", "end_date": "text", "station_id": "text"},
        )
        result = resolve_editable_paths("my_plugin")
        assert sorted(result) == sorted(
            ["/args/start_date", "/args/end_date", "/args/station_id"]
        )

    def test_allow_list_intersects_with_registered_args(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text", "end_date": "text", "station_id": "text"},
            llm_editable_args=["start_date"],
        )
        assert resolve_editable_paths("my_plugin") == ["/args/start_date"]

    def test_deny_list_subtracts_from_registered_args(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text", "end_date": "text", "station_id": "text"},
            llm_non_editable_args=["station_id"],
        )
        assert sorted(resolve_editable_paths("my_plugin")) == sorted(
            ["/args/start_date", "/args/end_date"]
        )

    def test_both_present_intersects_then_subtracts(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text", "end_date": "text", "station_id": "text"},
            llm_editable_args=["start_date", "end_date"],
            llm_non_editable_args=["end_date"],
        )
        assert resolve_editable_paths("my_plugin") == ["/args/start_date"]

    def test_no_project_wide_deny_list(self, intake_registry):
        """URL/credential/filesystem-named args are editable by default.

        Editors are trusted with the chatbox (R11 mount gate) and can set
        any arg via the edit modal today. No project-wide name-pattern
        deny-list — authors opt out per-arg via llm_non_editable_args
        when a specific arg should not be chat-editable.
        """
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={
                "service_url": "text",
                "api_key": "text",
                "data_dir": "text",
                "sql_query": "text",
                "callback_endpoint": "text",
                "start_date": "text",
            },
        )
        assert sorted(resolve_editable_paths("my_plugin")) == sorted(
            [
                "/args/service_url",
                "/args/api_key",
                "/args/data_dir",
                "/args/sql_query",
                "/args/callback_endpoint",
                "/args/start_date",
            ]
        )

    def test_author_can_still_opt_out_of_sensitive_name_args(self, intake_registry):
        """With the pattern deny-list removed, llm_non_editable_args is the only
        mechanism to block a specific arg (e.g., a hardcoded credential).
        """
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"api_key": "text", "username": "text"},
            llm_non_editable_args=["api_key"],
        )
        assert resolve_editable_paths("my_plugin") == ["/args/username"]

    def test_unknown_source_fails_closed(self, intake_registry):
        assert resolve_editable_paths("does_not_exist") == []

    def test_malformed_llm_editable_args_falls_back_closed(self, intake_registry):
        """Malformed declarations should not propagate exceptions.

        The resolver returns ``[]`` and the tool handler surfaces
        ``whitelist_rejected`` with empty ``allowed_prefixes``.
        """
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text"},
            llm_editable_args="not-a-list",  # type: ignore[arg-type]
        )
        assert resolve_editable_paths("my_plugin") == []

    def test_empty_args_dict(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(args={})
        assert resolve_editable_paths("my_plugin") == []


# ---------------------------------------------------------------------------
# client_custom resolver
# ---------------------------------------------------------------------------


class TestClientCustomResolver:
    """resolve_editable_paths for client_custom plugin sources.

    Source store is the webpack-built clientPluginRegistry.json (List[Dict]).
    Resolver iterates to find by source.
    """

    def test_no_author_attrs_returns_all_registered_args(self, client_registry):
        client_registry.append(
            _fake_client_entry(
                "nwm-flood-map",
                args={"title": "text", "dataUrl": "text"},
            )
        )
        assert sorted(resolve_editable_paths("nwm-flood-map")) == sorted(
            ["/args/title", "/args/dataUrl"]
        )

    def test_deny_list_from_registry_json(self, client_registry):
        client_registry.append(
            _fake_client_entry(
                "nwm-flood-map",
                args={"title": "text", "dataUrl": "text", "token": "text"},
                llmNonEditableArgs=["token"],
            )
        )
        assert sorted(resolve_editable_paths("nwm-flood-map")) == sorted(
            ["/args/title", "/args/dataUrl"]
        )

    def test_allow_list_from_registry_json(self, client_registry):
        client_registry.append(
            _fake_client_entry(
                "nwm-flood-map",
                args={"title": "text", "dataUrl": "text", "theme": "text"},
                llmEditableArgs=["title"],
            )
        )
        assert resolve_editable_paths("nwm-flood-map") == ["/args/title"]

    def test_client_custom_no_project_wide_deny_list(self, client_registry):
        """Sensitive-named args are editable by default for client_custom too.

        Same trust model: authors opt out per-arg via llmNonEditableArgs.
        """
        client_registry.append(
            _fake_client_entry(
                "nwm-flood-map",
                args={"title": "text", "auth_token": "text", "data_dir": "text"},
            )
        )
        assert sorted(resolve_editable_paths("nwm-flood-map")) == sorted(
            ["/args/title", "/args/auth_token", "/args/data_dir"]
        )

    def test_unknown_source_fails_closed(self, client_registry):
        # Empty registry.
        assert resolve_editable_paths("nwm-flood-map") == []

    def test_malformed_entry_missing_args(self, client_registry):
        client_registry.append({"source": "broken_plugin"})
        assert resolve_editable_paths("broken_plugin") == []


# ---------------------------------------------------------------------------
# is_path_allowed_plugin — structural prefix match
# ---------------------------------------------------------------------------


class TestIsPathAllowedPlugin:
    """Prefix-matching semantics mirror editable_schemas.is_path_allowed."""

    def test_exact_match_is_allowed(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text"},
        )
        assert is_path_allowed_plugin("my_plugin", "/args/start_date") is True

    def test_structural_prefix_is_allowed(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text"},
        )
        # /args/start_date/year is a deeper path under /args/start_date.
        assert (
            is_path_allowed_plugin("my_plugin", "/args/start_date/year") is True
        )

    def test_partial_string_prefix_without_slash_is_rejected(self, intake_registry):
        """``/args/start_date2`` should NOT match ``/args/start_date``."""
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text"},
        )
        assert (
            is_path_allowed_plugin("my_plugin", "/args/start_date2") is False
        )

    def test_path_outside_whitelist_is_rejected(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"start_date": "text"},
        )
        assert is_path_allowed_plugin("my_plugin", "/args/other_field") is False

    def test_unknown_source_rejects_any_path(self, intake_registry):
        assert is_path_allowed_plugin("missing_plugin", "/args/anything") is False
