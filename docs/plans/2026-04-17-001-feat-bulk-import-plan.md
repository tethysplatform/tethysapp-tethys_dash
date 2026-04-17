---
title: "feat: Bulk import for dashboard items and tabs"
type: feat
status: active
date: 2026-04-17
origin: docs/brainstorms/2026-04-17-bulk-import-requirements.md
---

# feat: Bulk import for dashboard items and tabs

## Overview

Extend the dashboard import modal (used while editing a dashboard) to support importing multiple grid items at once, a full tab, or selected tabs from a dashboard export. The modal auto-detects the JSON format, shows a preview/summary, and for dashboard exports displays tab checkboxes for selective import.

## Problem Frame

Users can only import a single grid item at a time when editing a dashboard. Migrating multi-item layouts or tabs between dashboards requires tedious one-by-one imports. (see origin: `docs/brainstorms/2026-04-17-bulk-import-requirements.md`)

## Requirements Trace

- R1. Auto-detect JSON format: single item, array of items, single tab, or full dashboard
- R2. Single grid item import works exactly as today
- R3. Array of grid items: all added to active tab
- R4. Single tab: added as a new tab with its name and grid items
- R5. Full dashboard export: checkboxes to select which tabs to import as new tabs
- R6. Preview summary shown after file upload, before import
- R7. Import button disabled until valid file loaded and preview shown
- R8. Each grid item validated with same required keys as existing import
- R9. All-or-nothing batch validation — if any item fails, none are imported
- R10. Map items with GeoJSON layers processed through existing `saveLayerJSON` flow
- R11. Landing page "Import Dashboard" flow unchanged

## Scope Boundaries

- No cherry-pick of individual grid items within a tab
- No drag-and-drop file upload
- No changes to export format or export flow
- No changes to landing page dashboard import behavior

## Context & Research

### Relevant Code and Patterns

- `reactapp/components/dashboard/DashboardItem.js` — `handleGridItemImport` (line 139), `handleGridItemExport` (line 113), `requiredGridItemKeys` (line 102)
- `reactapp/components/modals/DashboardImport.js` — Current single-file import modal
- `reactapp/components/layout/Header.js` — `onImportGridItem` (line 395), `onAddGridItem` (line 361) with `i` re-indexing logic
- `reactapp/components/loader/DashboardLoader.js` — `addTab` (line 200), `updateTab` (line 159), tab structure: `{id, name, order, gridItems}`
- `reactapp/components/loader/AppLoader.js` — `importDashboard` (line 338) iterates tabs and grid items through `handleGridItemImport`

### Test Patterns

- `reactapp/__tests__/components/modals/DashboardImport.test.js` — 9 tests, uses `createLoadedComponent`, mocks `handleGridItemImport`, context providers
- `reactapp/__tests__/components/dashboard/DashboardItem.test.js` — 17+ import/export tests, calls functions directly, mocks `saveLayerJSON`

## Key Technical Decisions

- **Auto-detect format from JSON shape**: Array → array of items; has `tabs` array → dashboard; has `name` + `gridItems` → tab; has required grid item keys → single item. No user selection needed.
- **Two-pass batch processing**: First pass validates required keys on all items (no side effects). Second pass runs `handleGridItemImport` on each (including GeoJSON uploads). The first pass catches structural problems (missing keys) before any side effects. The second pass may still produce orphaned GeoJSON files if an upload fails mid-batch — this is an accepted edge case (same risk exists in `importDashboard`), not a violation of R9. R9's "all-or-nothing" applies to the key validation gate.
- **Tab creation via direct state manipulation**: `addTab()` takes no arguments and auto-names tabs. For imported tabs, construct tab objects directly and append to `tabs` state via `setTabs`. Important: the existing `addTab` uses the tab name as the `id` field (`id: tabName`), so imported tabs must generate unique IDs (e.g., `uuidv4()` or `imported-${Date.now()}-${index}`) to avoid ID collisions with existing tabs or with each other. Tab display names can duplicate — only IDs must be unique.
- **Allow duplicate tab display names**: Tab names are display-only labels. Duplicate names are fine since tab identity is tracked by `id`, not `name`.
- **Modal owns all `handleGridItemImport` calls**: The modal is responsible for running `validateGridItemBatch` and then `handleGridItemImport` on each item (it already has `csrf` and `layoutContext.uuid` in scope). The modal passes fully-processed results to the Header callback. The Header only handles state updates (adding items to tabs, creating new tabs) — no import processing.
- **Grid item `i` re-indexing**: Compute `maxGridItemI` from existing items in the target tab, then assign incrementing `i` values to each imported item — same pattern as existing `onAddGridItem`.

## Open Questions

### Resolved During Planning

- **Tab name conflicts**: Allow duplicate display names. However, tab `id` must be unique — the existing `addTab` uses name as id, so imported tabs must generate unique IDs (not reuse the imported name as id).
- **`i` re-indexing**: Apply existing `maxGridItemI + 1` pattern, incrementing for each item in the batch.
- **Validation vs side effects**: Two-pass approach — validate all keys first (catches structural errors with no side effects), then process through `handleGridItemImport`. GeoJSON upload failures mid-batch are an accepted edge case (orphaned files are small, same risk exists in current `importDashboard` flow). R9 "all-or-nothing" applies to the key validation gate.
- **Preview info**: Show item count, source names, and tab names from raw JSON — all available without full processing.

### Deferred to Implementation

- **Tab state update mechanism**: Whether to expose `setTabs` from TabContext, add an `addTabs(tabDataArray)` batch method, or extend `addTab` to accept optional parameters depends on how cleanly it fits the existing callback structure.

## Implementation Units

- [ ] **Unit 1: Format detection and batch validation utilities**

**Goal:** Add pure utility functions to detect JSON import format and validate a batch of grid items without side effects.

**Requirements:** R1, R8, R9

**Dependencies:** None

**Files:**
- Modify: `reactapp/components/dashboard/DashboardItem.js`
- Test: `reactapp/__tests__/components/dashboard/DashboardItem.test.js`

**Approach:**
- Add `detectImportFormat(json)` that inspects JSON shape and returns `{type: 'single'|'array'|'tab'|'dashboard', gridItems: [], tabs: [], summary: string}`. Detection order: Array.isArray → 'array'; has `tabs` array → 'dashboard'; has `name` and `gridItems` → 'tab'; has required keys → 'single'.
- Add `validateGridItemBatch(items)` that checks `requiredGridItemKeys` on every item and returns `{valid: boolean, errors: string[]}`. This is the first pass of the two-pass approach — no network calls.
- Both functions are exported alongside the existing `handleGridItemImport`/`handleGridItemExport`.

**Patterns to follow:**
- Existing `requiredGridItemKeys` check pattern in `handleGridItemImport` (lines 145-154)
- Pure function style matching `handleGridItemExport`

**Test scenarios:**
- Happy path: single grid item object detected as 'single' with correct summary
- Happy path: array of 3 grid items detected as 'array', summary shows count
- Happy path: object with `name` and `gridItems` detected as 'tab', summary shows tab name and item count
- Happy path: object with `tabs` array detected as 'dashboard', summary shows tab names and per-tab item counts
- Edge case: empty array detected as 'array' with 0 items
- Edge case: dashboard with empty tabs array
- Edge case: ambiguous object (has both `tabs` and grid item keys) — `tabs` takes priority
- Happy path: `validateGridItemBatch` passes for valid items
- Error path: `validateGridItemBatch` fails when one item missing required key, error identifies which item
- Error path: `validateGridItemBatch` with all items invalid returns all errors

**Verification:**
- All detection paths return correct type and summary
- Batch validation catches missing keys without any network calls

---

- [ ] **Unit 2: Update DashboardImport modal with preview and multi-format support**

**Goal:** Extend the modal to show a preview after file upload, display tab checkboxes for dashboard exports, and pass the detected format info to the import handler.

**Requirements:** R1, R2, R3, R4, R5, R6, R7, R9

**Dependencies:** Unit 1

**Files:**
- Modify: `reactapp/components/modals/DashboardImport.js`
- Test: `reactapp/__tests__/components/modals/DashboardImport.test.js`

**Approach:**
- After `JSON.parse` in `handleFileChange`, call `detectImportFormat()` and store the result in state (replacing the raw `jsonContent` state or alongside it).
- Render a preview section in the modal body showing the detected summary text.
- For 'dashboard' type, render checkboxes for each tab (checked by default). Store selected tab indices in state. The Import button uses the selected tabs.
- The Import button remains disabled until format detection succeeds (R7).
- For the landing page path (no `onImportGridItem` prop), behavior is unchanged — still calls `importDashboard` with the raw JSON (R11).
- For the dashboard editing path, `onImport` owns all processing: first runs `validateGridItemBatch` on all grid items across all detected items/tabs. If validation fails, shows errors and stops (R9). If valid, runs `handleGridItemImport` on each item (for GeoJSON processing per R10), then passes fully-processed results to the Header callback as `{type, gridItems, tabs}`. The Header only does state updates.
- For 'single' type, existing flow is preserved exactly (R2).

**Patterns to follow:**
- Existing modal structure and `StyledAlert` for errors
- React Bootstrap `Form.Check` for checkboxes (already used elsewhere in the app)
- Existing `handleFileChange` and `onImport` flow

**Test scenarios:**
- Happy path: upload single item JSON → preview shows "1 grid item", import works as before
- Happy path: upload array JSON → preview shows "N grid items to add to current tab"
- Happy path: upload tab JSON → preview shows "Tab: [name] with N items"
- Happy path: upload dashboard JSON → preview shows tab checkboxes, all checked by default
- Happy path: uncheck a tab checkbox → only checked tabs included in import
- Edge case: upload invalid JSON → error message shown, no preview
- Edge case: upload JSON with no recognizable format → error message
- Error path: batch with invalid grid item → error shown, import does not proceed
- Happy path: Import button disabled when no file selected, enabled after valid file loaded
- Happy path: landing page mode (no `onImportGridItem`) still calls `importDashboard` unchanged

**Verification:**
- Preview appears for all four format types with correct summary
- Tab checkboxes render and control which tabs are imported
- Import button enable/disable behavior matches R7
- Landing page import path is untouched

---

- [ ] **Unit 3: Update Header.js to handle bulk imports and new tabs**

**Goal:** Extend `onImportGridItem` and `onAddGridItem` in the dashboard header to handle arrays of grid items and new tab creation.

**Requirements:** R3, R4, R5, R10

**Dependencies:** Unit 2

**Files:**
- Modify: `reactapp/components/layout/Header.js`
- Modify: `reactapp/components/loader/DashboardLoader.js` (if `addTab` needs to accept parameters)
- Test: `reactapp/__tests__/components/layout/Header.test.js` (or the relevant test file)

**Approach:**
- `onImportGridItem` currently receives a single `importedGridItem`. Change it to receive a result object from the modal: `{type, gridItems, tabs}`. Grid items arrive already processed by `handleGridItemImport` (the modal owns that step).
- For 'single' and 'array' types: iterate `gridItems`, assign each a new `uuid`, null `id`, and incrementing `i` (using existing `maxGridItemI` pattern), then call `updateTab` once to append all items to the active tab in a single state update.
- For 'tab' and 'dashboard' types: for each tab, construct a new tab object with a unique generated `id` (e.g., `uuidv4()`), the imported `name`, computed `order`, and the processed grid items. Use `setTabs` directly (via a new TabContext method or by exposing it) to append all new tabs in a single state update — calling `updateTab` per-tab would trigger unnecessary intermediate re-renders and variable input recalculations.

**Patterns to follow:**
- Existing `onAddGridItem` (line 361) for `i` re-indexing and `uuid` assignment
- Existing `addTab` (DashboardLoader.js line 200) for tab object structure
- Existing `importDashboard` (AppLoader.js line 338) for iterating tabs and calling `handleGridItemImport`

**Test scenarios:**
- Happy path: import single grid item → added to active tab with new uuid and i (existing behavior preserved)
- Happy path: import array of 3 grid items → all 3 added to active tab with sequential i values
- Happy path: import a tab → new tab created with imported name and grid items
- Happy path: import dashboard with 2 selected tabs → 2 new tabs created with correct names and items
- Edge case: import items into tab that already has items → i values continue from existing max
- Edge case: import tab with same name as existing tab → both tabs exist with different IDs (duplicate display names allowed, IDs unique)
- Integration: imported Map grid item with GeoJSON → `handleGridItemImport` processes layers before item is added

**Verification:**
- Bulk items appear in active tab with correct i sequencing
- New tabs appear with imported names and all grid items
- Existing single-item import still works identically

## System-Wide Impact

- **Interaction graph:** The modal → header callback contract changes from passing a single `importedGridItem` to a richer result object. This is the only cross-component API change.
- **Error propagation:** Validation errors surface in the modal via `StyledAlert`. GeoJSON upload failures during `handleGridItemImport` propagate as they do today.
- **State lifecycle risks:** Adding multiple items to a tab or multiple tabs in rapid succession should be batched into single state updates to avoid intermediate re-renders. Use a single `updateTab` call with the full items array rather than calling it per-item.
- **API surface parity:** The landing page import modal is unchanged (R11). Only the dashboard editing import path is extended.
- **Unchanged invariants:** Export format, backend API endpoints, and `handleGridItemImport`/`handleGridItemExport` function signatures remain unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| GeoJSON upload failure mid-batch leaves orphaned files | Accepted — same risk exists in current `importDashboard` flow. Files are small workspace artifacts. |
| Large import (many items with GeoJSON) could be slow | Sequential processing matches existing pattern. No timeout risk for reasonable batch sizes. |
| Changing `onImportGridItem` callback signature | Single call site in Header.js — low blast radius. |

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-17-bulk-import-requirements.md](docs/brainstorms/2026-04-17-bulk-import-requirements.md)
- Related code: `reactapp/components/dashboard/DashboardItem.js` (import/export utilities)
- Related code: `reactapp/components/loader/AppLoader.js` (importDashboard flow for pattern reference)
