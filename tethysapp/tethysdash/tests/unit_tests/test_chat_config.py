"""Tests for chat/config.py - provider profiles, key encryption, and the
construction-settings regression that broke Anthropic (2026-07-09)."""
from unittest.mock import patch

import pytest
from pydantic_ai import ModelSettings, NativeOutput

from tethysapp.tethysdash.chatbot.config import (
    ChatProviderError,
    LLMProfile,
    _decrypt_key,
    encrypt_key,
    resolve_profile,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - DB access is mocked here."""
    yield


_GET_SETTING = "tethysapp.tethysdash.model.get_chat_provider_setting"
_OLLAMA_UP = "tethysapp.tethysdash.chatbot.config._ollama_reachable"


# --------------------------------------------------------------------------
# Fernet key handling
# --------------------------------------------------------------------------

def test_encrypt_round_trip_and_opaque_token():
    token = encrypt_key("sk-test-not-a-real-key")
    assert "sk-test" not in token, "plaintext must not appear in the token"
    assert _decrypt_key(token) == "sk-test-not-a-real-key"


def test_tampered_token_becomes_user_facing_error():
    with pytest.raises(ChatProviderError, match="Re-enter your key"):
        _decrypt_key("not-a-fernet-token")


# --------------------------------------------------------------------------
# Profile resolution
# --------------------------------------------------------------------------

def test_no_row_defaults_to_local_when_ollama_up():
    with patch(_GET_SETTING, return_value=None), patch(_OLLAMA_UP, return_value=True):
        p = resolve_profile("someone")
    assert p.provider == "local"
    assert p.native_output is True
    # the Ollama-only passthrough must be present on the LOCAL profile
    assert "chat_template_kwargs" in p.model_settings.get("extra_body", {})


def test_local_with_ollama_down_is_chat_reply_not_crash():
    with patch(_GET_SETTING, return_value=None), patch(_OLLAMA_UP, return_value=False):
        with pytest.raises(ChatProviderError, match="chat settings"):
            resolve_profile("someone")


def test_anthropic_profile_shape():
    row = {"provider": "anthropic", "model_name": None,
           "api_key_enc": encrypt_key("sk-fake")}
    with patch(_GET_SETTING, return_value=row):
        p = resolve_profile("someone")
    assert type(p.model).__name__ == "AnthropicModel"
    # Anthropic has no native JSON-schema output mode
    assert p.native_output is False
    # Anthropic strict-validates the request body: no passthrough fields
    assert "extra_body" not in p.model_settings


def test_openai_profile_shape():
    row = {"provider": "openai", "model_name": "gpt-5.2",
           "api_key_enc": encrypt_key("sk-fake")}
    with patch(_GET_SETTING, return_value=row):
        p = resolve_profile("someone")
    assert type(p.model).__name__ == "OpenAIChatModel"
    assert p.native_output is False
    assert "extra_body" not in p.model_settings


def test_paid_provider_without_key_names_the_problem():
    row = {"provider": "anthropic", "model_name": None, "api_key_enc": None}
    with patch(_GET_SETTING, return_value=row):
        with pytest.raises(ChatProviderError, match="anthropic"):
            resolve_profile("someone")


def test_unknown_provider_rejected():
    row = {"provider": "wat", "model_name": None, "api_key_enc": None}
    with patch(_GET_SETTING, return_value=row):
        with pytest.raises(ChatProviderError, match="wat"):
            resolve_profile("someone")


# --------------------------------------------------------------------------
# Output wrapping
# --------------------------------------------------------------------------

def test_wrap_output_native_vs_tool_mode():
    candidates = [lambda: "x"]
    local = LLMProfile("local", None, ModelSettings(), native_output=True)
    paid = LLMProfile("openai", None, ModelSettings(), native_output=False)
    assert isinstance(local.wrap_output(candidates), NativeOutput)
    assert paid.wrap_output(candidates) is candidates


# --------------------------------------------------------------------------
# Regression: 2026-07-09 Anthropic 400 "chat_template_kwargs: Extra inputs
# are not permitted". pydantic-ai merges agent-construction settings
# PER-FIELD under run settings, so provider-specific fields set at
# construction leak into every provider. They must only live in the
# per-provider profiles above.
# --------------------------------------------------------------------------

def test_no_agent_carries_provider_specific_construction_settings():
    from tethysapp.tethysdash.chatbot.agents.docs import docs_agent
    from tethysapp.tethysdash.chatbot.agents.plugin import plugin_agent

    for agent in (plugin_agent, docs_agent):
        settings = agent.model_settings or {}
        for forbidden in ("extra_body", "extra_headers"):
            assert forbidden not in settings, (
                f"{agent!r} sets {forbidden} at construction - it will leak "
                "into paid-provider requests via pydantic-ai's per-field "
                "settings merge and Anthropic will 400. Move it into the "
                "provider profile in chat/config.py."
            )
