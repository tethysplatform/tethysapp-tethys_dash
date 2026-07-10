"""DB round-trip tests for the ChatProviderSetting model helpers.

Uses the house mock_app_get_ps_db fixture so get/upsert hit the test
database created by conftest (which runs the alembic migrations,
including b7d1c4a9e2f3 that creates chat_provider_settings).
"""
from tethysapp.tethysdash.model import (
    get_chat_provider_setting,
    upsert_chat_provider_setting,
)

_APP = "tethysapp.tethysdash.app.App"


def test_missing_user_returns_none(mock_app_get_ps_db):
    mock_app_get_ps_db(_APP)
    assert get_chat_provider_setting("nobody") is None


def test_upsert_and_get_round_trip(mock_app_get_ps_db):
    mock_app_get_ps_db(_APP)
    upsert_chat_provider_setting("alice", "anthropic", "claude-sonnet-4-6",
                                 api_key_enc="enc-blob")
    row = get_chat_provider_setting("alice")
    assert row == {
        "provider": "anthropic",
        "model_name": "claude-sonnet-4-6",
        "api_key_enc": "enc-blob",
    }


def test_update_without_key_preserves_stored_key(mock_app_get_ps_db):
    """POSTing settings with a blank key must not wipe the saved key -
    the Ellipsis sentinel default means 'leave unchanged'."""
    mock_app_get_ps_db(_APP)
    upsert_chat_provider_setting("bob", "openai", None, api_key_enc="enc-1")
    upsert_chat_provider_setting("bob", "local", "qwen3:1.7b")  # no key arg
    row = get_chat_provider_setting("bob")
    assert row["provider"] == "local"
    assert row["model_name"] == "qwen3:1.7b"
    assert row["api_key_enc"] == "enc-1", "stored key must survive"


def test_clear_key_deletes_it(mock_app_get_ps_db):
    mock_app_get_ps_db(_APP)
    upsert_chat_provider_setting("carol", "openai", None, api_key_enc="enc-2")
    upsert_chat_provider_setting("carol", "openai", None, clear_key=True)
    assert get_chat_provider_setting("carol")["api_key_enc"] is None


def test_one_row_per_user(mock_app_get_ps_db):
    mock_app_get_ps_db(_APP)
    upsert_chat_provider_setting("dave", "openai", None)
    upsert_chat_provider_setting("dave", "anthropic", None)
    upsert_chat_provider_setting("erin", "local", None)
    assert get_chat_provider_setting("dave")["provider"] == "anthropic"
    assert get_chat_provider_setting("erin")["provider"] == "local"
