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


# ---------------------------------------------------------------------------
# Envelope-quality improvements (debug session 2026-05-09)
#
# When a single call has BOTH unexpected AND missing args, the LLM should
# learn about both in one envelope so it can fix everything in a single
# retry. Pre-fix, the middleware short-circuited on `unexpected_kwargs`
# and the missing-arg info was logged but never surfaced. The LLM then
# had to retry to discover the missing args — multiplying retry latency.
#
# Additionally, the envelope now exposes `expected_kwargs` (the schema's
# property names) and a `fix_hint` so the LLM has the correct answer in
# the same response, instead of needing to re-fetch the tool's schema.
# ---------------------------------------------------------------------------


async def test_envelope_reports_both_unexpected_and_missing_simultaneously(client):
    """Mixed-class case: a call with BOTH unexpected kwargs AND missing
    required args produces ONE envelope listing both classes.

    Repro: emit `patch_visualization(uuid=..., ops=[...])`. The schema
    expects `uuid` (post-rename) but the LLM might still try the old
    qualifier-style names. To force the mixed-class case, send a typo'd
    kwarg PLUS an unexpected kwarg.
    """
    async with client:
        result = await client.call_tool(
            "patch_visualization",
            {
                # `uuid_typo` is unexpected (not in schema). `source` and
                # `ops` are missing (required). Both classes fire.
                "uuid_typo": "11111111-1111-4111-8111-111111111111",
                "bogus_kwarg": "anything",
            },
        )

    payload = _structured(result)
    assert payload["error"].startswith("invalid_args:")
    # Both buckets present.
    assert "unexpected_kwargs" in payload, (
        f"expected mixed-class envelope to include unexpected_kwargs; got {payload!r}"
    )
    assert "missing_kwargs" in payload, (
        f"expected mixed-class envelope to include missing_kwargs; got {payload!r}"
    )
    assert set(payload["unexpected_kwargs"]) == {"uuid_typo", "bogus_kwarg"}
    # Missing should include the actually-required schema args.
    assert "uuid" in payload["missing_kwargs"]
    assert "source" in payload["missing_kwargs"]
    assert "ops" in payload["missing_kwargs"]


async def test_envelope_includes_expected_kwargs_from_schema(client):
    """Every validation envelope includes `expected_kwargs` listing the
    tool's schema property names. The LLM uses this to self-correct
    without re-fetching tools/list.
    """
    async with client:
        result = await client.call_tool(
            "patch_visualization",
            {"uuid_typo": "x"},  # triggers unexpected + missing
        )

    payload = _structured(result)
    assert "expected_kwargs" in payload, (
        f"envelope must list expected_kwargs; got {payload!r}"
    )
    expected = set(payload["expected_kwargs"])
    # Post-rename schema: uuid + source + ops (+ optional description).
    assert {"uuid", "source", "ops"}.issubset(expected), (
        f"expected_kwargs missing required schema args; got {expected!r}"
    )


async def test_envelope_includes_fix_hint(client):
    """A natural-language `fix_hint` accompanies every error envelope."""
    async with client:
        result = await client.call_tool(
            "patch_visualization",
            {"uuid_typo": "x"},
        )

    payload = _structured(result)
    assert "fix_hint" in payload, (
        f"envelope must include fix_hint; got {payload!r}"
    )
    assert isinstance(payload["fix_hint"], str)
    assert len(payload["fix_hint"]) > 0


async def test_missing_only_envelope_uses_missing_kwargs(client):
    """When a call has only missing args (no unexpected, no type errors),
    the envelope reports `missing_kwargs` rather than the generic
    `details` bucket. This makes recovery actionable for the LLM.
    """
    async with client:
        result = await client.call_tool(
            "patch_visualization",
            # Empty args → all 3 required kwargs are missing.
            {},
        )

    payload = _structured(result)
    assert payload["error"].startswith("invalid_args:")
    assert "missing_kwargs" in payload, (
        f"missing-only envelope must include missing_kwargs; got {payload!r}"
    )
    assert {"uuid", "source", "ops"}.issubset(set(payload["missing_kwargs"]))
    # No spurious unexpected entries.
    assert payload.get("unexpected_kwargs", []) == [] or \
        "unexpected_kwargs" not in payload


# ---------------------------------------------------------------------------
# Observability — single structured log line per tool call (debug 2026-05-09)
# ---------------------------------------------------------------------------


async def test_observability_emits_one_summary_line_per_call(client, caplog):
    """Every tool call produces a single `tool-call` summary line on the
    `tethysdash.mcp` logger naming the tool, arg keys (no values), status,
    and duration. One line per call — entry + exit collapsed.
    """
    caplog.set_level(logging.INFO, logger="tethysdash.mcp")

    async with client:
        await client.call_tool(
            "create_plotly_chart",
            {"data": [{"x": [1], "y": [1]}]},
        )

    summary_lines = [
        rec.message for rec in caplog.records
        if "tool-call" in rec.message and "create_plotly_chart" in rec.message
    ]
    assert len(summary_lines) >= 1, (
        f"expected at least one tool-call summary line; got {summary_lines!r}"
    )
    line = summary_lines[0]
    assert "tool=create_plotly_chart" in line
    assert "arg_keys=" in line
    assert "data" in line  # arg key, not value
    assert "status=" in line
    assert "duration_ms=" in line


async def test_observability_logs_status_invalid_args_on_validation_error(
    client, caplog
):
    """Tool calls that get rejected by the validation middleware get
    `status=invalid_args` in the summary line. The error class hint
    (unexpected | missing | other) is also included for triage."""
    caplog.set_level(logging.INFO, logger="tethysdash.mcp")

    async with client:
        await client.call_tool(
            "patch_visualization",
            {"uuid_typo": "x"},  # unexpected + missing
        )

    summary_lines = [
        rec.message for rec in caplog.records
        if "tool-call" in rec.message and "patch_visualization" in rec.message
    ]
    assert summary_lines, "expected at least one summary line"
    assert any("status=invalid_args" in line for line in summary_lines), (
        f"expected status=invalid_args on validation reject; got {summary_lines!r}"
    )


async def test_observability_does_not_log_arg_values(client, caplog):
    """Arg values must never appear in the summary line — only arg keys.
    Mirrors the existing _input_validation_middleware logging contract.
    """
    caplog.set_level(logging.INFO, logger="tethysdash.mcp")

    secret = "super-secret-do-not-leak-9842"
    async with client:
        await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1], "y": [1]}],
                "auth_token": secret,
            },
        )

    summary_lines = [
        rec.message for rec in caplog.records
        if "tool-call" in rec.message
    ]
    # auth_token (the arg key) IS in the line; the secret value is NOT.
    assert any("auth_token" in line for line in summary_lines)
    assert all(secret not in line for line in summary_lines), (
        "arg value leaked into observability summary line"
    )


# ---------------------------------------------------------------------------
# Empty-data + tiny-dimensions guards (debug 2026-05-09 — the empty grid
# tile bug)
#
# Symptom: when the LLM's data fetch failed or returned no rows, gpt-oss:20b
# would proceed to call create_plotly_chart with `data=[]` anyway, producing
# an empty tile alongside (or instead of) the real chart. Same model also
# passed tiny `h` values like 10 because the field description was unclear.
# Server-side validation now rejects both.
# ---------------------------------------------------------------------------


async def test_create_plotly_chart_rejects_empty_data_list(client):
    """`data=[]` produces an empty tile if the server doesn't reject it.
    The validation envelope must surface the error so the LLM can recover
    by re-issuing the data fetch."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {"data": []},
        )
    payload = _structured(result)
    assert payload.get("error", "").startswith("invalid_args:"), (
        f"empty data list must be rejected; got {payload!r}"
    )
    # The visualization envelope must NOT be present — empty data must
    # not produce a tile.
    assert "visualization" not in payload


async def test_create_plotly_chart_rejects_empty_data_json_string(client):
    """`data='[]'` (JSON string of an empty array) must also be rejected.
    Pydantic min_length on Union[List, str] enforces the str-length rule,
    not the post-json.loads list-length rule. Server-side defense fills
    the gap.
    """
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {"data": "[]"},
        )
    payload = _structured(result)
    assert payload.get("error", "").startswith("invalid_args:"), (
        f"`data='[]'` must be rejected after json.loads; got {payload!r}"
    )


async def test_create_data_table_rejects_empty_data(client):
    """`create_data_table(data=[])` must also be rejected — same class
    of LLM bug (call create_* without successful data fetch first).
    """
    async with client:
        result = await client.call_tool(
            "create_data_table",
            {"data": []},
        )
    payload = _structured(result)
    assert payload.get("error", "").startswith("invalid_args:"), (
        f"empty data list must be rejected on create_data_table; got {payload!r}"
    )


async def test_create_plotly_chart_rejects_tiny_h(client):
    """`h=5` is below the practical minimum (~10 grid units ≈ 50-100px
    tall, already squished). Pydantic ge=10 enforces the floor."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1], "y": [1]}],
                "h": 5,
            },
        )
    payload = _structured(result)
    assert payload.get("error", "").startswith("invalid_args:"), (
        f"tiny h must be rejected; got {payload!r}"
    )


async def test_create_plotly_chart_rejects_h_above_100(client):
    """`h=200` is way above any reasonable tile height (would push it
    off-screen). Pydantic le=100 enforces the ceiling."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1], "y": [1]}],
                "h": 200,
            },
        )
    payload = _structured(result)
    assert payload.get("error", "").startswith("invalid_args:"), (
        f"h>100 must be rejected; got {payload!r}"
    )


async def test_create_plotly_chart_rejects_w_zero(client):
    """`w=0` would produce a zero-width tile. Pydantic ge=1 enforces
    the floor."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1], "y": [1]}],
                "w": 0,
            },
        )
    payload = _structured(result)
    assert payload.get("error", "").startswith("invalid_args:"), (
        f"w=0 must be rejected; got {payload!r}"
    )


async def test_create_plotly_chart_accepts_valid_dimensions(client):
    """Sanity: valid w/h still produce a viz spec. Defaults (w=50, h=40)
    must not get rejected by the new constraints."""
    async with client:
        result = await client.call_tool(
            "create_plotly_chart",
            {
                "data": [{"x": [1, 2], "y": [1, 2]}],
                "w": 50,
                "h": 40,
            },
        )
    payload = _structured(result)
    assert "visualization" in payload, (
        f"valid call must produce a viz spec; got {payload!r}"
    )
    assert payload.get("error") is None
