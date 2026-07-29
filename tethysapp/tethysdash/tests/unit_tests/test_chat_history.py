"""Tests for chat/history.py - recent-conversation sanitization + framing."""
import pytest

from tethysapp.tethysdash.chatbot.messages.history import (
    MAX_CHARS_PER_TURN,
    MAX_TURNS,
    format_history_instruction,
    sanitize_history,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - pure-python tests, no DB."""
    yield


def test_sanitize_drops_malformed_entries():
    raw = [
        {"role": "user", "text": "keep me"},
        {"role": "assistant", "text": "keep me too"},
        {"role": "system", "text": "role not allowed"},
        {"role": "user"},                    # no text
        {"role": "user", "text": ""},        # empty text
        {"role": "user", "text": 42},        # non-string text
        "not-a-dict",
        None,
    ]
    clean = sanitize_history(raw)
    assert [m["text"] for m in clean] == ["keep me", "keep me too"]


def test_sanitize_never_raises_on_garbage_input():
    assert sanitize_history(None) == []
    assert sanitize_history("a string") == []
    assert sanitize_history({"role": "user"}) == []
    assert sanitize_history(12345) == []


def test_sanitize_caps_turns_and_truncates_text():
    raw = [{"role": "user", "text": f"turn {i} " + "x" * 1000} for i in range(20)]
    clean = sanitize_history(raw)
    assert len(clean) == MAX_TURNS
    assert clean[-1]["text"].startswith("turn 19")  # newest kept
    assert all(len(m["text"]) <= MAX_CHARS_PER_TURN for m in clean)


def test_format_empty_history_is_empty_string():
    assert format_history_instruction(None) == ""
    assert format_history_instruction([]) == ""


def test_format_carries_reference_data_and_advisory_framing():
    h = [
        {"role": "user", "text": "add bias corrected for river_id 610217883"},
        {"role": "assistant", "text": "Added."},
    ]
    block = format_history_instruction(h)
    # the id a follow-up like "the same id" must resolve against
    assert "610217883" in block
    assert "User:" in block and "Assistant:" in block
    # advisory-not-exclusive framing (escape-clause pattern) - without it
    # small models treat context as a constraint instead of a reference.
    assert "CURRENT message" in block
