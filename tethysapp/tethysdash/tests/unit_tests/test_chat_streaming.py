"""Tests for chat/streaming.py - emit_progress's context-agnostic contract.

send_websocket_message uses async_to_sync internally, which raises when
called from a thread with a running event loop; emit_progress dispatches
from a fresh daemon thread so it is safe from sync views, async output
functions, and executor threads alike.
"""
import asyncio
import threading
from unittest.mock import patch

import pytest

from tethysapp.tethysdash.chatbot.streaming import emit_progress

_SEND = "tethysapp.tethysdash.chat.streaming.send_websocket_message"


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - no DB involved."""
    yield


def test_empty_chat_id_is_silent_noop():
    with patch(_SEND) as send:
        emit_progress("", "should be dropped")
    assert not send.called


def test_dispatches_message_on_background_thread():
    done = threading.Event()
    seen = {}

    def fake_send(**kwargs):
        seen.update(kwargs)
        seen["thread"] = threading.current_thread().name
        done.set()

    with patch(_SEND, side_effect=fake_send):
        emit_progress("chat-123", "working...")
        assert done.wait(2.0), "send_websocket_message never ran"

    assert seen["request_id"] == "chat-123"
    assert seen["message"] == "working..."
    assert seen["thread"] != threading.current_thread().name


def test_safe_to_call_from_inside_a_running_event_loop():
    """The regression that motivated the thread wrap: calling from an
    async context must neither raise nor drop the message."""
    done = threading.Event()

    async def call_from_loop():
        emit_progress("chat-456", "from async land")

    with patch(_SEND, side_effect=lambda **kw: done.set()):
        asyncio.run(call_from_loop())
        assert done.wait(2.0), "message dropped when emitted from a running loop"
