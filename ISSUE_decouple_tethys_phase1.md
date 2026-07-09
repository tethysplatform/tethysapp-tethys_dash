# refactor: Decouple TethysDash from Tethys Platform (Phase 1)

## Context

TethysDash is a `TethysAppBase` app, so standing up any instance requires the full Tethys Portal + conda + persistent-store stack — the primary deployment-complexity pain. The app is already ~90% standard Django (DRF, Channels, SQLAlchemy, a React SPA); Tethys mainly supplies the DB connection, routing decorators, auth/permissions, settings, and a deploy CLI.

This is **Phase 1 of a four-phase decouple**. Phase 1 removes the Tethys dependency and runs the app as a plain Django (ASGI) container with **no behavior change**. Later phases (out-of-process execution, production hardening, plugin v2) are out of scope here.

- Plan: [`docs/plans/2026-07-09-001-refactor-decouple-tethys-phase1-plan.md`](docs/plans/2026-07-09-001-refactor-decouple-tethys-phase1-plan.md)
- Requirements (brainstorm): [`docs/brainstorms/2026-07-09-tethysdash-standalone-architecture-requirements.md`](docs/brainstorms/2026-07-09-tethysdash-standalone-architecture-requirements.md)

## Goal

Run TethysDash standalone: a Django project with its own settings, a single `DATABASE_URL` Postgres (Django auth + SQLAlchemy app tables in one DB), native DRF + Channels routing, standalone auth/permissions, a storage seam, standalone SPA serving, and a `docker compose up` local profile.

## Scope

**In scope:** standalone Django project + settings; single-DB connection provider; DRF + Channels routing replacing `@controller`/`@consumer`; standalone `contrib.auth` + the three-layer permission model; storage seam (local filesystem backend); standalone SPA serving; frontend de-Tethysing; migration/bootstrap on one Postgres; `docker compose up`; test suite on standalone settings; the applicable security carry-forwards (CSRF flow, fail-closed endpoint auth, session-timeout + rate limiting).

**Out of scope (later phases):** out-of-process execution / worker pool / broker (Phase 2); object storage, Redis channel layer, autoscaling, signed-URL gating (Phase 3); plugin v2 / dropping Intake (Phase 4); multi-tenant SaaS.

## Work items

- [ ] **U1** — Standalone Django project + settings module (unblocks the test suite; `DEBUG=False` default, security middleware, compat shim)
- [ ] **U2** — Single SQLAlchemy connection provider from `DATABASE_URL` (with test-isolation seam)
- [ ] **U3** — Auth & permissions re-homing (drop Tethys namespace; fix codename format; `has_perm` gates; session-timeout + rate limiting)
- [ ] **U4** — HTTP routing → Django URLconf + DRF (preserve JSON envelope; enumerate public endpoints; CSRF header contract; fail-closed default)
- [ ] **U5** — WebSocket routing → Channels ASGI (explicit consumer policy; per-dashboard group scoping)
- [ ] **U6** — Storage seam, local filesystem backend (traversal-bounded; includes dashboard add/copy/delete thumbnail writes)
- [ ] **U7** — Standalone SPA serving (plain Django view + WhiteNoise; retire `App.render`/Tethys template)
- [ ] **U8** — Frontend API client de-Tethysing (drop `/apps/tethysdash/` prefix + Portal endpoints)
- [ ] **U9** — Migrations & single-DB bootstrap (Django `migrate` + Alembic `upgrade`; existing-deployment user import)
- [ ] **U10** — Packaging & local deployment (deps swap, Dockerfile + docker-compose, entrypoint)
- [ ] **U11** — Test suite green on standalone settings (single-DB isolation; Intake-discovery smoke check)

## Acceptance

- `docker compose up` on a fresh checkout starts web + Postgres only, plugins run in-process, no Redis/broker/object store required.
- Existing dashboards and grid items load without transformation; permission rows resolve once users are migrated into the standalone auth tables.
- No `tethys_platform` / `tethys_sdk` import remains; the full backend + frontend test suites pass on standalone settings.

## Key risks

- Endpoint auth regressions during the `@controller` → DRF sweep (mitigated by fail-closed default + guard test + explicit public-endpoint enumeration).
- CSRF response-shape contract (`X-CSRFToken` header, empty body) — a JSON body silently 403s all mutations.
- `manage_visualizations` permission-string format flip (colon → dot) breaking the frontend check.
- Test-suite blast radius: every test currently imports `tethys_portal.settings`.
- Existing deployments have two physical DBs today; the single-DB target requires a one-time user import.

## Open question (non-blocking for Phase 1)

- What "open-source" commits to (license, governance, contribution model) — resolve before later phases.
