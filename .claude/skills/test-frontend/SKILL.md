---
name: test-frontend
description: Run the TethysDash frontend test layers — Jest component tests and mocked Playwright — in a self-contained `.venv-test/` (needed because mocked Playwright launches a real Tethys server). Rebuilds the React bundle first. Writes a pass/fail report.
argument-hint: (none)
---

Run Jest + mocked Playwright against a freshly built bundle. Write results to `test-results/reports/<ISO-timestamp>-test-frontend.md`.

On preflight, bootstrap, or bundle-build failure, STOP and tell the user exactly what to fix. On per-suite failure, continue to report finalization and exit non-zero. The background Tethys server must be killed even when step 8 fails — proceed to step 9 regardless.

1. **System preflight**. Verify these are on PATH: `python3`, `node`, `npm`. If any is missing, stop with remediation text naming the missing binary.

2. **Venv bootstrap** (mocked Playwright needs a running Tethys server, which needs the venv). From the repo root:
   - Compute `sha256sum pyproject.toml | awk '{print $1}'`.
   - If `.venv-test/.pyproject-hash` matches, reuse. Otherwise recreate: `python3 -m venv .venv-test`, `.venv-test/bin/pip install --upgrade pip --quiet`, `.venv-test/bin/pip install -e . --quiet`, then write the new hash.
   - On `pip install -e .` failure: stop, surface stderr, exit non-zero.

3. **Node deps**. From the repo root, if `package-lock.json` exists use `npm ci`; otherwise `npm install`. Silence normal npm chatter; surface errors.

4. **better-sqlite3 ABI check**. Run:
   ```
   node -e "require('better-sqlite3')(require('os').tmpdir() + '/preflight.db').close()"
   ```
   If it errors with a NODE_MODULE_VERSION mismatch or a self-registration failure, run `npm rebuild better-sqlite3` and retry the check. If the retry fails, stop with: "ERROR: better-sqlite3 native addon cannot load. Try `npm rebuild better-sqlite3` or reinstall node_modules."

5. **Build the bundle**. `npm run build`. Failure here is fatal — stop.

6. **Start report file** at `test-results/reports/<ISO-timestamp>-test-frontend.md`:
   ```
   # test-frontend run — <ISO-timestamp>

   **Commit:** <git rev-parse HEAD>
   **Python:** <.venv-test/bin/python --version> (.venv-test)
   **Node:** <node --version>

   ```

7. **Jest**. Run `npm run test -- --ci` from the repo root. Capture exit code, duration, and the full output.

8. **Mocked Playwright**.
   - Start the Tethys test server in the background on port 8765: `.venv-test/bin/tethys manage start -p 8765` using Bash with `run_in_background: true`. Capture the background shell id so you can kill it later.
   - Poll `http://localhost:8765/` every 1 second until it returns a 2xx/3xx response, with a 60-second timeout. If the timeout expires, record the failure in the report (mark Playwright row as FAIL with reason "Tethys server did not become ready") and skip to step 9.
   - Once ready, run `E2E_REUSE_SERVER=1 npx playwright test --project=mocked --config=reactapp/playwright.config.js` from the repo root. Capture exit code, duration, and full output.

9. **Cleanup** (ALWAYS run this, even if step 8 failed). Kill the background Tethys shell id from step 8. Verify port 8765 is free via `lsof -i :8765` — if anything still holds it, log that fact to the report.

10. **Finalize report**. Append a summary table:
    ```
    | Suite              | Result | Duration | Count |
    |--------------------|--------|----------|-------|
    | jest               | <pass|FAIL> | <d> | <N passed / M failed> |
    | playwright-mocked  | <pass|FAIL> | <d> | <N passed / M failed> |

    **Result:** <PASS | FAIL (N of 2 suites failed)>
    ```
    For any failing suite, add a `## Failure details` section with the last ~50 lines of that suite's output.

11. **Tell the user**: one-sentence summary plus report file path.

12. **Exit**. Non-zero if any suite failed; zero otherwise.

## Notes for maintainers

- The venv is needed here because mocked Playwright tests hit a real running Tethys server for non-tile requests. The browser mocks handle tiles, WMS, and auth endpoints, but the server still has to be up.
- `npm ci` is preferred over `npm install` because it respects `package-lock.json` strictly and fails fast on drift.
- If the bundle is stale, Playwright will silently assert against the old code — always rebuild (step 5).
- See `docs/solutions/best-practices/playwright-e2e-tethys-dash-setup-2026-04-18.md` (in the firoh workspace) for the full list of E2E gotchas this skill's preflight defends against.
