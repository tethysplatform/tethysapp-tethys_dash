---
name: test-backend
description: Run the full TethysDash Python pytest suite (MCP contracts + integrated + unit) in a self-contained `.venv-test/`. Python-only — no Node, no bundle, no server. Fastest skill. Writes a pass/fail report.
argument-hint: (none)
---

Run the full Python test suite. Write results to `test-results/reports/<ISO-timestamp>-test-backend.md`.

On preflight or bootstrap failure, STOP and tell the user exactly what to fix. On per-suite failure, continue to report finalization and exit non-zero.

1. **System preflight**. Verify `python3` is on PATH (`command -v python3`). If missing, stop with: "ERROR: python3 not found on PATH. Install Python 3.10+ and retry." Do NOT check node/npm/tethys — this skill is Python-only.

2. **Venv bootstrap**. From the repo root:
   - Compute the target hash: `sha256sum pyproject.toml | awk '{print $1}'`.
   - If `.venv-test/.pyproject-hash` exists and matches, reuse the venv (fast path).
   - Otherwise: remove `.venv-test/` if present, create fresh with `python3 -m venv .venv-test`, then `.venv-test/bin/pip install --upgrade pip --quiet` and `.venv-test/bin/pip install -e ".[test]" --quiet`. The `[test]` extras pull in `fastmcp` (declared in `pyproject.toml` under `[project.optional-dependencies].test`) so the MCP contract tests can import. Write the new hash to `.venv-test/.pyproject-hash`.
   - If `pip install -e ".[test]"` fails, stop and surface stderr to the user. Do not attempt any test run.

3. **Start report file**. Create `test-results/reports/` if it does not exist. Write the report file with this header:
   ```
   # test-backend run — <ISO-timestamp>

   **Commit:** <git rev-parse HEAD>
   **Python:** <.venv-test/bin/python --version> (.venv-test)

   ```

4. **Python suite**. Run `.venv-test/bin/pytest --reuse-db --no-cov -q tethysapp/tethysdash/tests/` from the repo root. Capture exit code, wall-clock duration, and the full output.

5. **Finalize report**. Append a summary table and, if the suite failed, the last ~50 lines of output:
   ```
   | Suite        | Result | Duration | Count            |
   |--------------|--------|----------|------------------|
   | python-suite | <pass|FAIL> | <duration> | <N passed / M failed> |

   **Result:** <PASS | FAIL>
   ```
   Parse the pass/fail count from pytest's final summary line (`=== N passed, M failed in Xs ===`). If the suite failed, append a `## Failure details` section with the last 50 lines of output.

6. **Tell the user**: one sentence summary plus the report file path.

7. **Exit**. Non-zero if the suite failed; zero otherwise.

## Notes for maintainers

- The venv is cached. If someone edits `pyproject.toml` (adds/removes a dep), the next run will automatically recreate `.venv-test/`.
- To force a rebuild without touching `pyproject.toml`, delete `.venv-test/` and re-run.
- This skill covers `tests/mcp/` (contracts), `tests/integrated_tests/`, and `tests/unit_tests/` — everything under `tethysapp/tethysdash/tests/`.
- On a warm venv, a full green run today is ~25–60 seconds. Cold first-run with `pip install -e .` is 60–120 seconds plus suite time.
