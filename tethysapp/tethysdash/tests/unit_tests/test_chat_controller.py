"""Tests for the chat_message controller's pre-check hop.

A reply to a prior "which one?" prompt must be resolved deterministically
(``resolve_pending`` -> ``stream_immediate``) before the router/LLM ever runs;
everything else falls through to ``stream_chat_response``. These guard the
wiring the router flagged: a swapped ``None`` check or arg order would send a
resolved reply to the wrong path.
"""
import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from tethysapp.tethysdash.controllers import chat_message

_HASPERM = "tethysapp.tethysdash.controllers.has_permission"
_GETDASH = "tethysapp.tethysdash.controllers.get_dashboards"
_RESOLVE = "tethysapp.tethysdash.chatbot.disambiguation.resolve_pending"
_IMMEDIATE = "tethysapp.tethysdash.chatbot.streaming.stream_immediate"
_STREAM = "tethysapp.tethysdash.chatbot.streaming.stream_chat_response"


@pytest.fixture(autouse=True)
def truncate_tables():
    """Override the conftest DB fixture - the controller collaborators are mocked."""
    yield


def _request(prompt):
    return SimpleNamespace(
        method="POST",
        body=json.dumps(
            {"prompt": prompt, "dashboard_id": 6, "chat_id": "", "history": []}
        ).encode(),
        user=SimpleNamespace(username="alice", is_authenticated=True),
    )


def test_resolved_pending_reply_bypasses_the_router():
    with (
        patch(_HASPERM, return_value=True),
        patch(_GETDASH, return_value={"owner": "alice"}),
        patch(_RESOLVE, return_value="resolved reply") as resolve,
        patch(_IMMEDIATE, return_value="IMMEDIATE") as immediate,
        patch(_STREAM, return_value="STREAM") as stream,
    ):
        result = chat_message(_request("2"))
    resolve.assert_called_once()
    immediate.assert_called_once_with("resolved reply", changed=False)
    stream.assert_not_called()
    assert result == "IMMEDIATE"


def test_resolved_pending_that_changed_the_dashboard_flags_the_reply():
    """When resolve_pending applied a change, the immediate reply carries
    changed=True so the frontend refetches the dashboard."""

    def _apply(deps, _prompt):
        deps.dashboard_changed = True
        return "Updated #1 (chart)."

    with (
        patch(_HASPERM, return_value=True),
        patch(_GETDASH, return_value={"owner": "alice"}),
        patch(_RESOLVE, side_effect=_apply),
        patch(_IMMEDIATE, return_value="IMMEDIATE") as immediate,
        patch(_STREAM),
    ):
        chat_message(_request("2"))
    immediate.assert_called_once_with("Updated #1 (chart).", changed=True)


def test_no_pending_falls_through_to_the_stream():
    with (
        patch(_HASPERM, return_value=True),
        patch(_GETDASH, return_value={"owner": "alice"}),
        patch(_RESOLVE, return_value=None),
        patch(_IMMEDIATE) as immediate,
        patch(_STREAM, return_value="STREAM") as stream,
    ):
        result = chat_message(_request("where is bolivia?"))
    immediate.assert_not_called()
    stream.assert_called_once()
    assert result == "STREAM"


def test_resolve_failure_falls_through_instead_of_500ing():
    with (
        patch(_HASPERM, return_value=True),
        patch(_GETDASH, return_value={"owner": "alice"}),
        patch(_RESOLVE, side_effect=RuntimeError("boom")),
        patch(_IMMEDIATE) as immediate,
        patch(_STREAM, return_value="STREAM") as stream,
    ):
        result = chat_message(_request("2"))
    immediate.assert_not_called()
    stream.assert_called_once()
    assert result == "STREAM"
