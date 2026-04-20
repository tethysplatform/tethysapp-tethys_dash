---
name: test-all
description: Run the full TethysDash test sweep in a self-contained `.venv-test/` — fresh-state E2E setup, full Python suite (includes MCP contracts), and Playwright integration project. Rebuilds the React bundle first. Writes a pass/fail report. First run with a cold venv takes 2-5 minutes; subsequent runs are faster.
argument-hint: (none)
---

Run the full TethysDash test sweep. Write results to `test-results/reports/<ISO-timestamp>-test-all.md`.

On preflight, bootstrap, or bundle-build failure, STOP and tell the user exactly what to fix. On per-suite failure, continue to the next suite and aggregate results. The background Tethys server (started in step 9) must be killed even when step 10 fails — proceed to step 11 regardless.

1. **System preflight**. Verify these are on PATH: `python3`, `node`, `npm`. If any is missing, stop with remediation text naming the missing binary.

2. **Venv bootstrap**. From the repo root:
   - Compute `sha256sum pyproject.toml | awk '{print $1}'`.
   - If `.venv-test/.pyproject-hash` matches, reuse. Otherwise recreate: `python3 -m venv .venv-test`, `.venv-test/bin/pip install --upgrade pip --quiet`, `.venv-test/bin/pip install -e ".[test]" --quiet` (the `[test]` extras pull in `fastmcp` so the MCP server imports cleanly), then write the new hash.
   - On `pip install -e ".[test]"` failure: stop, surface stderr, exit non-zero.

3. **Node deps**. From the repo root, if `package-lock.json` exists use `npm ci`; otherwise `npm install`.

4. **better-sqlite3 ABI check**. Run:
   ```
   node -e "require('better-sqlite3')(require('os').tmpdir() + '/preflight.db').close()"
   ```
   If it errors, run `npm rebuild better-sqlite3` and retry. If the retry fails, stop with remediation text.

5. **Build the bundle**. `npm run build`. Failure here is fatal — stop.

6. **Start report file** at `test-results/reports/<ISO-timestamp>-test-all.md`:
   ```
   # test-all run — <ISO-timestamp>

   **Commit:** <git rev-parse HEAD>
   **Python:** <.venv-test/bin/python --version> (.venv-test)
   **Node:** <node --version>

   ```

7. **Fresh-state E2E setup**. From the repo root:
   - `rm -f ~/.tethys/e2e-test/tethysdash_primary_db.sqlite` (idempotent; missing file is fine).
   - Run the setup script using the venv's Python so the Tethys binary it resolves via `shutil.which("tethys")` matches the venv:
     ```
     DJANGO_SETTINGS_MODULE=tethys_portal.settings PATH=".venv-test/bin:$PATH" .venv-test/bin/python reactapp/__tests__/e2e/setup-test-db.py
     ```
   - Capture exit code and duration.

8. **Full Python suite**. `.venv-test/bin/pytest --reuse-db --no-cov -q tethysapp/tethysdash/tests/`. Capture. This sweep covers MCP contracts, integrated tests, and unit tests.

9. **Start Tethys on port 8765 in the background**.
   - Run `PATH=".venv-test/bin:$PATH" .venv-test/bin/tethys manage start -p 8765` in the background (Bash with `run_in_background: true`). Capture the background shell id.
   - Poll `http://localhost:8765/` every 1 second up to 60 seconds. If the server never becomes ready, record that in the report, skip step 10, and proceed to cleanup.

10. **Playwright integration**. Once the server is ready:
    ```
    E2E_REUSE_SERVER=1 npx playwright test --project=integration --config=reactapp/playwright.config.js
    ```
    Capture exit code and duration.

11. **Cleanup** (ALWAYS run this, even when step 10 failed). Kill the background Tethys shell id from step 9. Verify `lsof -i :8765` is clean; log any orphan process to the report.

12. **Finalize report**. Append a summary table and, for any failing suite, the last ~50 lines of its output:
    ```
    | Suite                  | Result | Duration | Count                 |
    |------------------------|--------|----------|-----------------------|
    | fresh-e2e-setup        | <pass|FAIL> | <d> | —                |
    | python-suite           | <pass|FAIL> | <d> | <N passed / M failed> |
    | playwright-integration | <pass|FAIL> | <d> | <N passed / M failed> |

    **Result:** <PASS | FAIL (N of 3 suites failed)>
    ```
    Note: MCP contracts are implicit in `python-suite`; they are not surfaced as a separate row because the sweep runs them via the single pytest invocation.

13. **Tell the user**: one-sentence summary plus report file path.

14. **Exit**. Non-zero if any suite failed; zero otherwise.

## Notes for maintainers

- This skill is the heaviest of the three. First run on a cold venv is 2–5 minutes; subsequent runs on a warm venv are roughly `pytest time + npm run build + playwright time` (~1.5–3 min).
- For day-to-day iteration on Python-only changes, prefer `test-backend` (fastest). Use `test-frontend` when touching React code only. Use `test-all` before pushing a branch or when integration coverage matters.
- The fresh-state E2E setup deliberately wipes `~/.tethys/e2e-test/tethysdash_primary_db.sqlite` every run so the SingletonHarvester + first-time-init path are exercised. This is the guard against the class of bugs documented in `docs/plans/2026-04-18-001-fix-cleanup-old-jsons-first-time-and-e2e-setup-plan.md` (firoh workspace).
- See `docs/solutions/best-practices/playwright-e2e-tethys-dash-setup-2026-04-18.md` (firoh workspace) for the full list of E2E gotchas this skill's preflight defends against.
