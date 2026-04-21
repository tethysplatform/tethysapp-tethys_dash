# R15 Pre-Ship Validation Report — TEMPLATE

The harness at `tethysapp/tethysdash/tests/validation/run_validation.py`
emits reports matching this structure. Do not commit this template as a
real report — the harness generates `R15-<YYYY-MM-DD>-<git-sha>.md`
alongside it.

---

# R15 Pre-Ship Validation Report — YYYY-MM-DD HH:MM UTC

**Commit:** `<git-sha>`
**Suite:** `tethysapp/tethysdash/tests/validation/prompts.yaml`

## Tier: `frontier` (model: `claude-3-5-sonnet-latest`)

- Total prompts: **18**
- Correct: **16**
- Recoverable: **1** (5.6%)
- Unrecoverable: **0**
- Silent-semantic-wrong: **0**
- Aggregate success: **94.4%**

**Gate:** ✅ PASS

| ID | Outcome | Rule | Notes |
|---|---|---|---|
| `sc-01-show-legend` | correct |  |  |
| `sc-02-rename-plot` | correct |  |  |
| `sc-03-replace-plot-data` | correct |  |  |
| `sc-04-remove-third-layer` | correct |  |  |
| `sc-05-rename-table` | correct |  |  |
| `sc-06-add-2-points` | correct |  |  |
| `sc-07-create-plot-regression` | correct |  |  |
| `sc-08-add-wms-regression` | correct |  |  |
| `adv-01-wrong-title-similar-plots` | correct |  |  |
| `adv-02-invalid-path` | recoverable |  | whitelist_rejected then correct retry |
| `adv-03-test-guard-multi-op` | correct |  |  |
| `cov-card-update-metric` | correct |  |  |
| `cov-varinput-change-default` | correct |  |  |
| `cov-varinput-slider-range` | correct |  |  |
| `cov-table-append-row` | correct |  |  |
| `cov-map-change-basemap` | correct |  |  |
| `cov-map-reject-add-layer-via-patch` | correct |  | used add_map_service_layer directly |
| `cov-map-remove-layer` | correct |  |  |

## Tier: `ollama` (model: `qwen2.5:7b`)

- Total prompts: **18**
- Correct: **14**
- Recoverable: **3** (16.7%)
- Unrecoverable: **0**
- Silent-semantic-wrong: **0**
- Aggregate success: **94.4%**

**Gate:** ✅ PASS

| ID | Outcome | Rule | Notes |
|---|---|---|---|
| ... | ... | ... | ... |

### Rule-violation distribution

- `whitelist_rejected`: 3 (all recovered on retry)

---

## Overall: ✅ SHIP

Both tiers clear all per-class thresholds. Ready to merge the feature branch.

---

## Notes

Future iterations may expand this suite to N ≥ 150 prompts for real
statistical confidence intervals on the silent-semantic-wrong rate. The
current canary-size run is a necessary-but-not-sufficient gate.

If a future run shows the Ollama tier regressing (e.g., 5% silent-
semantic-wrong on this suite), the team re-enters brainstorming per the
fallback options documented in the plan's Key Decisions section.
