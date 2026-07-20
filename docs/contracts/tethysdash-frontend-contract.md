# TethysDash Frontend ↔ Backend Contract

Version: **1.0**

The one backend-blind frontend build targets this contract. Any backend that
serves the frontend (the Tethys app today, a standalone Django backend later)
must satisfy it identically. The frontend takes no per-backend branch; it
discovers its deployment via `config.json` (below) and calls the endpoints here.

The frontend declares the contract version it targets (`contractVersion` in its
build); a backend advertises its version in `config.json`. A mismatch is a
detectable break, not a silent one (see Invariants).

## config.json

A static JSON document served at the **frontend bundle base** — the same
directory as `main.<hash>.js`. The frontend derives its URL from
`document.currentScript.src` at boot, so it resolves from any client-side route
(a relative fetch would break on deep-linked routes under a catch-all server).

Fields (keys are consumed verbatim by the frontend config singleton):

| Field | Type | Meaning |
|---|---|---|
| `portalHost` | string | API origin. `""` → derive from `window.location.origin`. |
| `prefixUrl` | string | URL prefix segment shared by API base and app root. |
| `appRootUrl` | string | App root path all app REST paths are built under. |
| `websocketUrl` | string | Progress-notification WebSocket URL. `""` → WS disabled. |
| `appId` | string | App id passed to the app-data endpoint. |
| `loaderDelay` | number | Error-display delay (ms). |
| `sessionPingFrequency` | number | Activity ping throttle (ms). |
| `supportEmail` | string | Support contact email. |
| `supportGithub` | string | Support GitHub URL. |
| `debug` | boolean | Show React error stack traces. |
| `contractVersion` | string | Contract version this backend satisfies. |

## REST endpoints

Auth / identity surface (host-relative):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/session/` | Session probe; 401 → public-user path. |
| GET | `/api/csrf/` | CSRF token (see Invariants). |
| GET | `/api/whoami/` | Current user data. |
| GET | `/api/apps/<app>/` | App metadata. |

App endpoints (built under `appRootUrl`):

| Method | Path | Purpose |
|---|---|---|
| GET | `app/permissions/` | User's app permissions. |
| GET | `ping/` | Activity ping. |
| GET | `visualizations/get/` | Visualization data / features. |
| GET | `visualizations/list/` | Available visualizations. |
| GET | `visualizations/permissions/list/` | Visualization permissions. |
| POST | `visualizations/permissions/update/` | Update visualization permissions. |
| GET | `dashboards/get/` | Single dashboard. |
| GET | `dashboards/list/` | Dashboard list. |
| POST | `dashboards/add/` `copy/` `delete/` `update/` | Dashboard CRUD. |
| POST | `permission_groups/update/` `delete/` | Permission-group CRUD. |
| POST | `json/upload/` | Upload dashboard JSON. |
| GET | `json/download/` | Download dashboard JSON. |

All POSTs carry the CSRF token as the `x-csrftoken` request header.

## WebSocket channel

Progress notifications stream over the WebSocket at `websocketUrl` (Tethys
default path `tethysdash/visualizations/notifications/`). Messages are JSON
carrying at least `percentage_complete` for a `requestId`, plus error messages
keyed by `requestId`. The path and message shape are part of the contract — the
frontend carries no Tethys-specific WebSocket assumption beyond this.

## Invariants

These are load-bearing; violating any silently breaks the frontend.

- **CSRF token in the `X-CSRFToken` response header with an empty body.** The
  frontend reads `response.headers["x-csrftoken"]`; a token returned in a JSON
  body resolves to `undefined` and every POST 403s.
- **`{success, data, ...}` response envelope.** The frontend's response
  interceptor returns `response.data` when present; a different envelope
  (e.g. DRF `{detail}`) silently breaks JSON download and visualization parsing.
- **Permission codenames.** The frontend checks membership by codename (e.g.
  `manage_visualizations`); a backend using a different codename shape
  (colon- vs dot-delimited app label) must expose the bare codename the
  frontend matches on.
- **`config.json` served with `Cache-Control: no-store`.** The filename carries
  no content hash, so a cached stale copy would defeat the version check and
  raise a false mismatch on a correctly-deployed app.
- **`config.json` field allowlist.** The document is served unauthenticated;
  never include secret settings, credentials, or tokens — only the fields above.

## Milestone status

- Tethys backend: conforms (auth surface already matches; `config.json`
  generated at the static base).
- Standalone Django backend: deferred — implements this same contract natively.
