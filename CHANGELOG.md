# Changelog

## Unreleased

### Added

- **New endpoint `/apps/tethysdash/runtime-plugins/list/`** — GET-only, `login_required=False`, returns the runtime plugin registry as a JSON array. Sibling of the existing gated `runtime-plugins/sync/` endpoint (which keeps its `login_required=True` posture for the browser-side write flow). Lets the standalone `Aquaveo/tethysdash_mcps` MCP server read the registry over HTTP via `TETHYSDASH_BASE_URL` instead of needing a shared filesystem path. Three new integration tests in `tests/integrated_tests/test_controllers.py`. Plan: `docs/plans/2026-05-11-006-feat-runtime-plugin-registry-http-endpoint-plan.md` (Unit 1).

### Breaking changes

- **MCP server default transport: `/sse` → `/mcp`.** The TethysDash in-app
  MCP server (`tethysapp.tethysdash.mcp.tethysdash_mcp_server`) now defaults
  to **Streamable HTTP at `http://localhost:9001/mcp`** instead of the
  legacy SSE transport at `/sse`. This matches the modern MCP-client default
  (MCP Playground, `@aquaveo/chatbox-core`) and brings TethysDash in line
  with the sibling `nrds-mcps` server, which migrated on 2026-05-02.

  **Action required for users with existing `/sse`-suffixed chatbox MCP
  server URLs in localStorage:**

  - **Recommended:** update the saved URL from `http://localhost:9001/sse`
    to `http://localhost:9001/mcp` in the chatbox settings panel.
  - **Temporary fallback:** set `MCP_TRANSPORT=sse` in the environment
    where you launch the MCP server. The legacy SSE endpoint will remain
    available behind this opt-in for the migration window. The fallback
    will be removed in a future release.

- **MCP server default host binding: `0.0.0.0` → `127.0.0.1` (loopback
  only).** Aligns with the long-standing `CLAUDE.md` guidance that the
  server "must run localhost-bound or behind an authenticated reverse
  proxy." Set `MCP_HOST=0.0.0.0` (or a specific bind address) for
  deployments that wrap the MCP server behind such a proxy.

### Security

- **Reflected-origin CORS bug in the SSE compat path is fixed.** The
  legacy `_patch_sse_transport_for_cors` previously emitted
  `access-control-allow-origin: <reflected origin>` AND
  `access-control-allow-credentials: true` for ANY OPTIONS preflight,
  regardless of `ALLOWED_ORIGINS`. The corrected version (mirroring
  `mcp/nrds_mcps/nextgen_mcp/mcp_server.py`) now reflects an origin only
  when it is in `ALLOWED_ORIGINS`, and gates the credentials header on a
  successful match. Users on the streamable-http default path are
  unaffected (the patch is invoked only when `MCP_TRANSPORT=sse`).

### Added

- **`ALLOWED_ORIGINS` and `ALLOW_CREDENTIALS` are now env-driven.**
  `ALLOWED_ORIGINS` parses a comma-separated list (default `*`);
  `ALLOW_CREDENTIALS` is auto-derived from it (`False` when origins is
  `["*"]`, `True` otherwise) so a misconfigured deploy cannot produce the
  CORS-spec-forbidden combination of wildcard origin + credentialed
  responses. Empty / malformed input falls back to `["*"]`, never silent
  lockdown.
- **`InputValidationEnvelopeMiddleware`** (shipped 2026-05-08, PR #110):
  pydantic `ValidationError` on tool input now produces a structured
  `{"error": "invalid_args: ...", "unexpected_kwargs": [...]}` envelope
  instead of crashing inside `Tool._run` and propagating as an MCP-protocol
  error. The chatbox-core engine forwards the envelope to the LLM as
  recoverable tool input.

## References

- Plan: `docs/plans/2026-05-08-001-fix-mcp-validation-and-streamable-http-migration-plan.md`
- Sibling-server precedent: `docs/solutions/best-practices/mcp-streamable-http-transport-and-cors-env-vars-2026-05-02.md`
- Client-side counterpart: `docs/solutions/best-practices/mcp-transport-selection-and-fallback-2026-04-23.md`
