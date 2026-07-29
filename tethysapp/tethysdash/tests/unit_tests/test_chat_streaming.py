"""Tests for the chat progress-sink registry in chatbot/utils.py.

emit_progress / emit_delta push structured events onto a per-request sink
registered by chat_id; with no sink (or no chat_id) they are silent no-ops.
"""
import queue

import pytest

from tethysapp.tethysdash.chatbot.utils import (
    emit_delta,
    emit_progress,
    register_progress_sink,
    unregister_progress_sink,
)


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - no DB involved."""
    yield


def test_empty_chat_id_is_silent_noop():
    sink = queue.Queue()
    register_progress_sink("", sink)  # empty id is ignored
    emit_progress("", "dropped")
    emit_delta("", "dropped")
    assert sink.empty()


def test_no_registered_sink_is_silent_noop():
    # Nothing registered for this id: must not raise, must drop the event.
    emit_progress("unknown-id", "dropped")
    emit_delta("unknown-id", "dropped")


def test_emit_progress_puts_a_progress_event():
    sink = queue.Queue()
    register_progress_sink("c1", sink)
    try:
        emit_progress("c1", "working...")
    finally:
        unregister_progress_sink("c1")
    assert sink.get_nowait() == {"type": "progress", "text": "working..."}


def test_emit_delta_puts_delta_events_in_order():
    sink = queue.Queue()
    register_progress_sink("c1", sink)
    try:
        emit_delta("c1", "Hel")
        emit_delta("c1", "lo")
    finally:
        unregister_progress_sink("c1")
    assert sink.get_nowait() == {"type": "delta", "text": "Hel"}
    assert sink.get_nowait() == {"type": "delta", "text": "lo"}


def test_unregister_stops_delivery():
    sink = queue.Queue()
    register_progress_sink("c1", sink)
    unregister_progress_sink("c1")
    emit_progress("c1", "after unregister")
    assert sink.empty()


def test_stream_immediate_emits_single_done_ndjson_event():
    import asyncio
    import json

    from tethysapp.tethysdash.chatbot.streaming import stream_immediate

    resp = stream_immediate("hello there")

    async def collect():
        return [chunk async for chunk in resp.streaming_content]

    chunks = asyncio.run(collect())
    assert len(chunks) == 1
    line = chunks[0].decode() if isinstance(chunks[0], (bytes, bytearray)) else chunks[0]
    assert json.loads(line.strip()) == {
        "type": "done",
        "text": "hello there",
        "changed": False,
    }
    assert resp.headers["Content-Type"].startswith("application/x-ndjson")


def test_stream_immediate_carries_changed_flag():
    """A disambiguation that applied a change flags the done event so the UI
    refetches; the default (e.g. a cancel) leaves it False."""
    import asyncio
    import json

    from tethysapp.tethysdash.chatbot.streaming import stream_immediate

    async def collect(resp):
        return [chunk async for chunk in resp.streaming_content]

    changed_resp = stream_immediate("Updated #1 (chart).", changed=True)
    line = asyncio.run(collect(changed_resp))[0]
    line = line.decode() if isinstance(line, (bytes, bytearray)) else line
    assert json.loads(line.strip())["changed"] is True


def test_sink_is_duck_typed_on_put():
    """The controller registers an asyncio-bridging sink, not a queue.Queue -
    anything with a put(event) method works."""
    seen = []

    class Sink:
        def put(self, event):
            seen.append(event)

    register_progress_sink("c2", Sink())
    try:
        emit_progress("c2", "hi")
    finally:
        unregister_progress_sink("c2")
    assert seen == [{"type": "progress", "text": "hi"}]
