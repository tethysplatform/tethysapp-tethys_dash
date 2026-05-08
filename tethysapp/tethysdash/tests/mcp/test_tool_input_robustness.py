"""Contract tests for `InputValidationEnvelopeMiddleware`.

Plan: ``docs/plans/2026-05-08-001-fix-mcp-validation-and-streamable-http-migration-plan.md``
Unit 1.

Verifies that an MCP tool called with one or more unexpected keyword
arguments produces a structured ``{"error": ..., "unexpected_kwargs": [...]}``
envelope instead of crashing inside FastMCP's pydantic input validation.

Tests use FastMCP's in-memory ``FastMCPTransport`` so the full middleware
stack runs in-process — direct function calls would bypass middleware and
prove nothing about the wired-in path.

The bug-report repro: ``create_plotly_chart(data=[...], height=80)`` —
``height`` is not in the tool's signature; pydantic raised
``ValidationError`` and the chatbox-core engine saw an MCP-protocol error.
"""

from __future__ import annotations

import json
import logging
import uuid

import pytest

from fastmcp import Client
from fastmcp.client.transports.memory import FastMCPTransport

from tethysapp.tethysdash.mcp.tethysdash_mcp_server import mcp


pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Test fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> Client:
    """In-memory FastMCP client wired through the live server's middleware."""
    return Client(transport=FastMCPTransport(mcp))


# A real UUID v4 — the per-source-type layer tools (T3) validate map_uuid
# format, so any test that hits a layer tool needs a parseable UUID.
MAP_UUID = "11111111-1111-4111-8111-111111111111"


def _structured(result) -> dict:
    """Pull the structured envelope out of a CallToolResult.

    FastMCP returns ``ToolResult.structured_content`` for any tool whose
    return value has dict-like shape; the in-memory client surfaces it
    on ``result.structured_content``.
    """
    if result.structured_content is not None:
        return result.structured_content
    # Fallback: parse JSON text content.
    text = "".join(
        block.text for block in result.content if hasattr(block, "text")
    )
    return json.loads(text)


# ---------------------------------------------------------------------------
# Happy path — middleware is invisible on valid calls
# ---------------------------------------------------------------------------


async def test_valid_call_passes_through_unchanged(client):
    """create_plotly_chart with valid kwargs returns the normal viz envelope."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {"data": [{"x": [1, 2], "y": [3, 4], "type": "scatter"}]},
        )

    payload = _structured(result)
    assert "visualization" in payload, payload
    assert payload["visualization"]["vizType"] == "plotly"
    assert "error" not in payload
    assert "unexpected_kwargs" not in payload


async def test_canonical_short_kwarg_h_is_not_misclassified(client):
    """`h=40` is a real kwarg on create_plotly_chart and must succeed.

    Guards against fuzzy-matching regressions where the middleware might
    mistake `h` for a typo of `height`.
    """
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {"data": [{"x": [1], "y": [1]}], "h": 40},
        )

    payload = _structured(result)
    assert "visualization" in payload, payload
    assert payload["visualization"]["h"] == 40


# ---------------------------------------------------------------------------
# Error path — single + multi unexpected kwarg → structured envelope
# ---------------------------------------------------------------------------


async def test_bug_report_repro_unexpected_height_kwarg(client):
    """The exact 2026-05-08 bug-report call shape — must not crash."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {"data": [{"x": [1], "y": [1]}], "height": 80},
        )

    payload = _structured(result)
    assert payload["error"] == "invalid_args: unexpected keyword arguments"
    assert payload["unexpected_kwargs"] == ["height"]
    # Tool name must NOT be in the LLM-facing envelope (K5).
    assert "tool" not in payload


async def test_multiple_unexpected_kwargs_aggregate_in_one_envelope(client):
    """All unexpected kwargs surface in one response, not one-at-a-time."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1], "y": [1]}],
                "height": 80,
                "width": 200,
                "scale": 1.5,
            },
        )

    payload = _structured(result)
    assert payload["error"] == "invalid_args: unexpected keyword arguments"
    assert set(payload["unexpected_kwargs"]) == {"height", "width", "scale"}


# ---------------------------------------------------------------------------
# Uniformity — every always-visible tool inherits the envelope
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "tool_name, valid_args",
    [
        ("create_plotly_chart", {"data": [{"x": [1], "y": [1]}]}),
        ("create_data_table", {"data": [{"col": 1}]}),
        (
            "create_variable_input",
            {"variable_name": "v", "input_type": "text"},
        ),
        ("create_map_visualization", {"name": "m"}),
        ("list_available_visualizations", {}),
        ("list_intake_plugins", {}),
    ],
)
async def test_unexpected_kwarg_envelope_uniform_across_always_visible(
    client, tool_name, valid_args
):
    """Adding a hallucinated kwarg to any always-visible tool gives an envelope."""
    async with client:
        result = await client.call_tool(
            tool_name,
            {**valid_args, "totally_made_up_kwarg": 42},
        )

    payload = _structured(result)
    assert payload["error"] == "invalid_args: unexpected keyword arguments"
    assert "totally_made_up_kwarg" in payload["unexpected_kwargs"]


async def test_envelope_inherits_to_bm25_searchable_layer_tools(client):
    """T3 per-source-type layer tools (BM25-searchable) inherit the envelope."""
    async with client:
        result = await client.call_tool(
            "add_wms_layer",
            {
                "map_uuid": MAP_UUID,
                "name": "wms-layer",
                "url": "https://example.com/wms",
                "wms_layers": "L1",
                "totally_made_up_kwarg": 42,
            },
        )

    payload = _structured(result)
    assert payload["error"] == "invalid_args: unexpected keyword arguments"
    assert payload["unexpected_kwargs"] == ["totally_made_up_kwarg"]


# ---------------------------------------------------------------------------
# Integration — middleware fires upstream of in-body try/except
# ---------------------------------------------------------------------------


async def test_envelope_fires_upstream_of_in_body_try_except(client):
    """`add_dynamic_map_layer` has its own in-body JSONDecodeError envelope.

    With an unexpected kwarg, the middleware's envelope must fire before the
    function body runs at all — the in-body handler never sees the call.
    """
    async with client:
        result = await client.call_tool(
            "add_dynamic_map_layer",
            {
                "map_uuid": MAP_UUID,
                "source": "ExamplePlugin",
                "name": "x",
                "totally_made_up_kwarg": 42,
            },
        )

    payload = _structured(result)
    # Middleware envelope shape (not the in-body "args is not valid JSON" shape).
    assert payload["error"] == "invalid_args: unexpected keyword arguments"
    assert payload["unexpected_kwargs"] == ["totally_made_up_kwarg"]


# ---------------------------------------------------------------------------
# Other ValidationError classes — wrong type for expected kwarg
# ---------------------------------------------------------------------------


async def test_wrong_type_for_expected_arg_returns_envelope(client):
    """`data=42` is wrong type; envelope shape distinguishes from unexpected-kwarg."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {"data": 42},
        )

    payload = _structured(result)
    # Different error class, different message — but still an envelope, not a crash.
    assert payload["error"].startswith("invalid_args:")
    # Wrong-type errors do NOT populate unexpected_kwargs.
    assert "unexpected_kwargs" not in payload
    # `details` carries the value-free summary.
    assert "details" in payload
    # No raw value content leaked into the envelope.
    serialized = json.dumps(payload)
    assert "42" not in serialized or '"42"' in serialized  # no bare int from input


# ---------------------------------------------------------------------------
# Server-side logging — names only, no values
# ---------------------------------------------------------------------------


async def test_log_line_includes_tool_name_and_kwarg_names_only(
    client, caplog
):
    """The server log line names the tool and kwargs; never logs values."""
    caplog.set_level(logging.WARNING, logger="tethysdash.mcp")

    secret_value = "super-secret-token-do-not-leak"
    async with client:
        await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1], "y": [1]}],
                "auth_token": secret_value,
            },
        )

    log_text = "\n".join(rec.message for rec in caplog.records)
    assert "create_plotly_chart" in log_text
    assert "auth_token" in log_text
    assert secret_value not in log_text, (
        "value content must never appear in the log line"
    )
