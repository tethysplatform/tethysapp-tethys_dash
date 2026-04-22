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
    SENSITIVE_NAME_PATTERNS,
    apply_pattern_deny_list,
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
# R10 pattern deny-list
# ---------------------------------------------------------------------------


class TestPatternDenyList:
    """R10 — project-wide sensitive-name pattern deny-list."""

    def test_empty_list_returns_empty(self):
        assert apply_pattern_deny_list([]) == []

    def test_benign_names_survive(self):
        assert apply_pattern_deny_list(
            ["start_date", "end_date", "station_id", "limit"]
        ) == ["start_date", "end_date", "station_id", "limit"]

    @pytest.mark.parametrize(
        "category,denied_names",
        [
            (
                "credentials",
                ["api_key", "auth_token", "client_secret", "user_password",
                 "service_credential"],
            ),
            (
                "network-targets",
                ["service_url", "api_endpoint", "map_service", "target_host",
                 "server_hostname", "dest_server", "request_target",
                 "http_proxy", "service_base_url", "weather_api_base",
                 "client_remote"],
            ),
            (
                "ssrf-adjacent",
                ["webhook_callback", "auth_webhook", "request_origin",
                 "login_redirect", "event_destination"],
            ),
            (
                "filesystem",
                ["data_path", "cache_dir", "source_file", "config_filepath",
                 "output_filename", "workspace_root", "plugin_base_dir",
                 "extract_data_dir"],
            ),
            (
                "injection-prone",
                ["custom_query", "filter_sql", "layout_template",
                 "where_expression", "row_filter"],
            ),
        ],
    )
    def test_pattern_categories_are_denied(self, category, denied_names):
        """Every listed name matches at least one pattern in SENSITIVE_NAME_PATTERNS."""
        result = apply_pattern_deny_list(denied_names)
        assert result == [], (
            f"Category {category!r}: expected all denied, got survivors: {result}"
        )

    def test_case_insensitive(self):
        # API_KEY (uppercase), Token (mixed case) should still be denied.
        assert apply_pattern_deny_list(
            ["API_KEY", "Auth_Token", "Service_URL"]
        ) == []

    def test_name_without_pattern_suffix_is_kept(self):
        # "key_store" — doesn't end in _key; should be kept.
        # "urlbuilder" — doesn't end in _url; should be kept.
        # "pathmaker" — doesn't end in _path; should be kept.
        assert apply_pattern_deny_list(
            ["key_store", "urlbuilder", "pathmaker"]
        ) == ["key_store", "urlbuilder", "pathmaker"]

    def test_sensitive_patterns_are_compiled_regexes(self):
        """Pins that SENSITIVE_NAME_PATTERNS is a collection of compiled patterns.

        Protects against accidental conversion to plain strings.
        """
        assert len(SENSITIVE_NAME_PATTERNS) > 0
        for pat in SENSITIVE_NAME_PATTERNS:
            # ``re.Pattern.pattern`` attribute exists on compiled patterns.
            assert hasattr(pat, "pattern")
            assert hasattr(pat, "search")


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

    def test_pattern_deny_overrides_allow_list(self, intake_registry):
        """Even if author allow-lists a pattern-denied arg, it stays denied.

        This is R10's defense-in-depth property and the footgun plugin authors
        are warned about in the author docs.
        """
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"api_key": "text", "username": "text"},
            llm_editable_args=["api_key", "username"],
        )
        assert resolve_editable_paths("my_plugin") == ["/args/username"]

    def test_pattern_deny_applies_without_any_author_attrs(self, intake_registry):
        intake_registry["my_plugin"] = _fake_intake_plugin(
            args={"service_url": "text", "data_dir": "text", "sql_query": "text",
                  "callback_endpoint": "text", "start_date": "text"},
        )
        assert resolve_editable_paths("my_plugin") == ["/args/start_date"]

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

    def test_pattern_deny_applies_to_client_custom(self, client_registry):
        client_registry.append(
            _fake_client_entry(
                "nwm-flood-map",
                args={"title": "text", "auth_token": "text", "data_dir": "text"},
            )
        )
        assert resolve_editable_paths("nwm-flood-map") == ["/args/title"]

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
