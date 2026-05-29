---
name: test-all
description: Run the full TethysDash test sweep in a self-contained `.venv-test/` — the full Python suite (includes MCP contracts) plus Jest. Rebuilds the React bundle first. Writes a pass/fail report. First run with a cold venv takes 2-5 minutes; subsequent runs are faster.
argument-hint: (none)
---

Run the full TethysDash test sweep. Write results to `test-results/reports/<ISO-timestamp>-test-all.md`.

On preflight, bootstrap, or bundle-build failure, STOP and tell the user exactly what to fix. On per-suite failure, continue to the next suite and aggregate results.

1. **System preflight**. Verify these are on PATH: `python3`, `node`, `npm`. If any is missing, stop with remediation text naming the missing binary.

2. **Venv bootstrap**. From the repo root:
   - Compute `sha256sum pyproject.toml | awk '{print $1}'`.
   - If `.venv-test/.pyproject-hash` matches, reuse. Otherwise recreate: `python3 -m venv .venv-test`, `.venv-test/bin/pip install --upgrade pip --quiet`, `.venv-test/bin/pip install -e ".[test]" --quiet` (the `[test]` extras pull in `fastmcp` so the MCP server imports cleanly), then write the new hash.
   - On `pip install -e ".[test]"` failure: stop, surface stderr, exit non-zero.

3. **Node deps**. From the repo root, if `package-lock.json` exists use `npm ci`; otherwise `npm install`.

4. **Build the bundle**. `npm run build`. Failure here is fatal — stop.

5. **Start report file** at `test-results/reports/<ISO-timestamp>-test-all.md`:
   ```
   # test-all run — <ISO-timestamp>

   **Commit:** <git rev-parse HEAD>
   **Python:** <.venv-test/bin/python --version> (.venv-test)
   **Node:** <node --version>

   ```

6. **Full Python suite**. `.venv-test/bin/pytest --reuse-db --no-cov -q tethysapp/tethysdash/tests/`. Capture exit code and duration. This sweep covers MCP contracts, integrated tests, and unit tests.

7. **Jest**. From the repo root: `npm test`. Capture exit code and duration.

8. **Finalize report**. Append a summary table and, for any failing suite, the last ~50 lines of its output:
   ```
   | Suite        | Result | Duration | Count                 |
   |--------------|--------|----------|-----------------------|
   | python-suite | <pass|FAIL> | <d> | <N passed / M failed> |
   | jest         | <pass|FAIL> | <d> | <N passed / M failed> |

   **Result:** <PASS | FAIL (N of 2 suites failed)>
   ```
   Note: MCP contracts are implicit in `python-suite`; they are not surfaced as a separate row because the sweep runs them via the single pytest invocation.

9. **Tell the user**: one-sentence summary plus report file path.

10. **Exit**. Non-zero if any suite failed; zero otherwise.

## Notes for maintainers

- First run on a cold venv is 2–5 minutes; subsequent runs on a warm venv are roughly `pytest time + npm run build + npm test` (~1.5–3 min).
- For day-to-day iteration on Python-only changes, prefer `test-backend` (fastest). For React-only iteration, run `npm test` directly — there's no dedicated front-end skill (Jest needs neither a venv nor a running Tethys server).
- The Playwright E2E suite was archived in May 2026; see `CLAUDE.md` → "Playwright suite — archived" for the rationale and the `aquaveo` archive branch. If Playwright is reintroduced, this skill grows back a Playwright step gated by the charter at `docs/brainstorms/2026-05-11-tethysdash-playwright-smoke-charter-requirements.md` (firoh workspace).
