"""Contract tests for the env-driven transport + CORS configuration.

Plan: ``docs/plans/2026-05-08-001-fix-mcp-validation-and-streamable-http-migration-plan.md``
Unit 2 (R5-R7, R12, R13).

Verifies:

- ``_parse_allowed_origins`` parses ``ALLOWED_ORIGINS`` env-var correctly,
  falls back to ``["*"]`` on empty / malformed input (no silent lockdown)
- ``ALLOW_CREDENTIALS`` is auto-derived from ``ALLOWED_ORIGINS``
  (``False`` when origins is wildcard, ``True`` otherwise)
- Streamable-HTTP CORS preflight returns the right headers under each
  origins-config regime (wildcard, allowlist with matching origin,
  allowlist with non-matching origin)
- Streamable-HTTP responds at ``/mcp`` (FastMCP's default
  ``streamable_http_path``)

Live SSE-transport tests (compat path + R12 reflected-origin fix) are
exercised by the manual smoke; this file covers what's testable in
process via Starlette's TestClient.
"""

from __future__ import annotations

import importlib

import pytest
from starlette.testclient import TestClient


# ---------------------------------------------------------------------------
# `_parse_allowed_origins` — pure-function unit tests
# ---------------------------------------------------------------------------


@pytest.fixture
def reload_server_module(monkeypatch):
    """Reload the server module so its module-level constants pick up env vars.

    `_parse_allowed_origins`, `ALLOWED_ORIGINS`, and `ALLOW_CREDENTIALS` are
    resolved at import time. Tests that vary `ALLOWED_ORIGINS` need to
    monkeypatch the env BEFORE the (re-)import.
    """

    def _reload():
        import tethysapp.tethysdash.mcp.tethysdash_mcp_server as mod

        return importlib.reload(mod)

    return _reload


@pytest.mark.parametrize(
    "env_value, expected",
    [
        (None, ["*"]),
        ("*", ["*"]),
        ("", ["*"]),
        ("  ", ["*"]),
        (", ,", ["*"]),  # malformed → wildcard, NOT silent lockdown
        ("https://example.com", ["https://example.com"]),
        (
            "https://a.example,https://b.example",
            ["https://a.example", "https://b.example"],
        ),
        (
            "  https://a.example  ,  https://b.example  ",
            ["https://a.example", "https://b.example"],
        ),
    ],
)
def test_parse_allowed_origins(monkeypatch, env_value, expected):
    if env_value is None:
        monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("ALLOWED_ORIGINS", env_value)

    from tethysapp.tethysdash.mcp.tethysdash_mcp_server import _parse_allowed_origins

    assert _parse_allowed_origins() == expected


def test_allow_credentials_auto_derived_from_origins(
    monkeypatch, reload_server_module
):
    """ALLOW_CREDENTIALS is False on wildcard, True otherwise."""
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    mod = reload_server_module()
    assert mod.ALLOWED_ORIGINS == ["*"]
    assert mod.ALLOW_CREDENTIALS is False

    monkeypatch.setenv("ALLOWED_ORIGINS", "https://example.com")
    mod = reload_server_module()
    assert mod.ALLOWED_ORIGINS == ["https://example.com"]
    assert mod.ALLOW_CREDENTIALS is True


def test_malformed_origins_fall_back_to_wildcard_not_lockdown(
    monkeypatch, reload_server_module
):
    """Per the nrds-mcps doc's load-bearing detail: malformed env → wildcard.

    A typo'd ``ALLOWED_ORIGINS=", ,"`` must NOT collapse to ``[]`` (which
    would silently reject every origin with no warning). It must fall back
    to ``["*"]``.
    """
    monkeypatch.setenv("ALLOWED_ORIGINS", ", ,")
    mod = reload_server_module()
    assert mod.ALLOWED_ORIGINS == ["*"]
    assert mod.ALLOW_CREDENTIALS is False


# ---------------------------------------------------------------------------
# Streamable-HTTP CORS preflight via Starlette TestClient
# ---------------------------------------------------------------------------


def _build_http_app(origins: list[str]):
    """Construct a Starlette app for a fresh server module with the given origins."""
    from starlette.middleware import Middleware
    from starlette.middleware.cors import CORSMiddleware

    cors = [
        Middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=origins != ["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
    ]
    from tethysapp.tethysdash.mcp.tethysdash_mcp_server import mcp

    return mcp.http_app(transport="streamable-http", middleware=cors)


def test_streamable_http_cors_preflight_with_wildcard_origins():
    """ALLOWED_ORIGINS=["*"] → preflight succeeds, no credentials reflected."""
    app = _build_http_app(["*"])
    with TestClient(app) as client:
        response = client.options(
            "/mcp",
            headers={
                "origin": "https://anywhere.example",
                "access-control-request-method": "POST",
            },
        )

    assert response.status_code in (200, 204)
    assert response.headers.get("access-control-allow-origin") == "*"
    # CORS spec: credentials cannot be combined with wildcard origin.
    assert response.headers.get("access-control-allow-credentials") != "true"


def test_streamable_http_cors_preflight_with_matching_specific_origin():
    """An origin in ALLOWED_ORIGINS gets credentials: true."""
    app = _build_http_app(["https://approved.example"])
    with TestClient(app) as client:
        response = client.options(
            "/mcp",
            headers={
                "origin": "https://approved.example",
                "access-control-request-method": "POST",
            },
        )

    assert response.status_code in (200, 204)
    assert (
        response.headers.get("access-control-allow-origin")
        == "https://approved.example"
    )
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_streamable_http_cors_preflight_with_non_matching_origin_denied():
    """An origin not in ALLOWED_ORIGINS does not receive CORS approval.

    The load-bearing security check is that ``access-control-allow-origin``
    is NOT reflected back to the attacker. (Starlette's CORSMiddleware emits
    ``allow-credentials: true`` globally even on rejected preflights, but
    that is harmless without a matching ``allow-origin`` — browsers won't
    honor credentialed requests without both headers.)
    """
    app = _build_http_app(["https://approved.example"])
    with TestClient(app) as client:
        response = client.options(
            "/mcp",
            headers={
                "origin": "https://attacker.example",
                "access-control-request-method": "POST",
            },
        )

    # CORSMiddleware rejects with 400 for non-allowed origins.
    assert response.status_code == 400
    # Critical: no origin reflection.
    assert response.headers.get("access-control-allow-origin") not in (
        "https://attacker.example",
        "*",
    )


# ---------------------------------------------------------------------------
# Streamable-HTTP path resolution — trailing-slash regression guard
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# SSE compat-path security: R12 reflected-origin CORS regression
# ---------------------------------------------------------------------------


async def _invoke_sse_patched_handler(scope: dict) -> tuple[int, dict[str, str]]:
    """Helper: invoke the patched SseServerTransport.handle_post_message.

    Captures the ASGI response status + headers without spinning up a
    real HTTP server.
    """
    from mcp.server.sse import SseServerTransport

    captured: dict = {}

    async def send(message):
        if message["type"] == "http.response.start":
            captured["status"] = message["status"]
            captured["headers"] = {
                k.decode().lower(): v.decode()
                for k, v in message.get("headers", [])
            }

    async def receive():
        return {"type": "http.disconnect"}

    transport_instance = SseServerTransport.__new__(SseServerTransport)
    await SseServerTransport.handle_post_message(
        transport_instance, scope, receive, send
    )
    return captured.get("status"), captured.get("headers", {})


def _options_scope(origin: str) -> dict:
    return {
        "type": "http",
        "method": "OPTIONS",
        "headers": [(b"origin", origin.encode())],
        "path": "/messages/",
        "query_string": b"",
    }


@pytest.mark.asyncio
async def test_sse_patch_does_not_reflect_attacker_origin_with_allowlist(
    monkeypatch, reload_server_module
):
    """R12 — pre-fix bug: patch reflected ANY origin and emitted credentials.

    With ALLOWED_ORIGINS set to a specific allowlist, an OPTIONS preflight
    from an off-list origin must NOT receive `access-control-allow-origin:
    <attacker>` and must NOT receive `access-control-allow-credentials: true`.
    """
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://approved.example")
    mod = reload_server_module()
    mod._patch_sse_transport_for_cors()

    status, headers = await _invoke_sse_patched_handler(
        _options_scope("https://attacker.example")
    )

    assert status == 200
    assert headers.get("access-control-allow-origin", "") != "https://attacker.example"
    assert headers.get("access-control-allow-origin", "") != "*"
    assert headers.get("access-control-allow-credentials") != "true"


@pytest.mark.asyncio
async def test_sse_patch_reflects_matching_origin_and_emits_credentials(
    monkeypatch, reload_server_module
):
    """An origin in ALLOWED_ORIGINS gets the reflection + credentials."""
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://approved.example")
    mod = reload_server_module()
    mod._patch_sse_transport_for_cors()

    status, headers = await _invoke_sse_patched_handler(
        _options_scope("https://approved.example")
    )

    assert status == 200
    assert headers.get("access-control-allow-origin") == "https://approved.example"
    assert headers.get("access-control-allow-credentials") == "true"


@pytest.mark.asyncio
async def test_sse_patch_with_wildcard_origins_no_credentials(
    monkeypatch, reload_server_module
):
    """Wildcard origins → reflect `*`, but NEVER emit credentials (CORS spec)."""
    monkeypatch.setenv("ALLOWED_ORIGINS", "*")
    mod = reload_server_module()
    mod._patch_sse_transport_for_cors()

    status, headers = await _invoke_sse_patched_handler(
        _options_scope("https://anywhere.example")
    )

    assert status == 200
    assert headers.get("access-control-allow-origin") == "*"
    assert headers.get("access-control-allow-credentials") != "true"


# ---------------------------------------------------------------------------
# Streamable-HTTP path resolution — trailing-slash regression guard
# ---------------------------------------------------------------------------


def test_streamable_http_responds_at_mcp_path():
    """FastMCP's default streamable_http_path is /mcp; verify the route exists.

    A POST without a session is expected to 4xx (auth/protocol error), but the
    point is that the route is REACHABLE — neither 404 nor 307 to a different
    path. Catches a regression where the path arg drifted.
    """
    app = _build_http_app(["*"])
    with TestClient(app) as client:
        response = client.post(
            "/mcp",
            headers={"content-type": "application/json"},
            content="{}",
        )

    # Any non-404/non-redirect status proves the route is mounted.
    assert response.status_code != 404
    assert response.status_code not in (301, 302, 307, 308)
