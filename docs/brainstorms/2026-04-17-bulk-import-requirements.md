---
date: 2026-04-17
topic: bulk-import
---

# Bulk Import for Dashboard Items and Tabs

## Problem Frame

When editing a dashboard, users can only import a single grid item at a time via the import modal. Recreating a multi-item layout or migrating tabs between dashboards requires tedious one-by-one imports. Users need to import multiple grid items, entire tabs, or all tabs from a dashboard export in a single operation.

## User Flow

```
Upload JSON file
       |
  Auto-detect format
       |
  +---------+-----------+-----------+
  |         |           |           |
Single   Array of    Single tab   Full dashboard
item     items       (name +      (multiple tabs)
         |           items)       |
         v           |            v
"1 item" |           v         "3 tabs:
         "3 items    "Tab:       Show checkboxes:
          to active   MyTab      [ ] Tab A (4 items)
          tab"        (5 items)" [ ] Tab B (2 items)
         |           |           [ ] Tab C (6 items)
         |           |            |
         +-----+-----+-----+-----+
               |
         User clicks Import
               |
         Items added to active tab
         or selected tab(s) created
```

## Requirements

**Format Detection and Handling**
- R1. Auto-detect the JSON format after file selection: single grid item (object with grid item keys), array of grid items, single tab (object with `name` and `gridItems`), or full dashboard (object with `tabs` array).
- R2. Single grid item import continues to work exactly as today — added to the active tab.
- R3. Array of grid items: all items are added to the current active tab.
- R4. Single tab: added as a new tab on the current dashboard with its name and all grid items.
- R5. Full dashboard export: display a list of tabs with checkboxes so the user can select which tabs to import. Selected tabs are added as new tabs on the current dashboard.

**Preview and Confirmation**
- R6. After file upload, display a summary of what was detected (e.g., "3 grid items to add to current tab" or "Tab: MyTab with 5 items") before the user clicks Import.
- R7. The Import button remains disabled until a valid file is loaded and the preview is shown.

**Validation and Error Handling**
- R8. Each grid item must pass the same validation used by the existing single-item import in `handleGridItemImport` (required keys: i, x, y, w, h, source, args_string, metadata_string). This is not new validation — it matches current behavior.
- R9. If any item fails validation, show an error message identifying which item(s) failed. Do not import any items from the batch.
- R10. Map items with GeoJSON layers must still have their layer data uploaded via the existing `saveLayerJSON` flow during import processing.

**Landing Page Import (Unchanged)**
- R11. The landing page "Import Dashboard" flow (which creates a new dashboard) remains unchanged.

## Success Criteria

- A user can export a tab from one dashboard and import it into another dashboard as a new tab in a single operation.
- A user can import multiple grid items at once into the active tab from a JSON array.
- A user can import all tabs from a full dashboard export into the current dashboard.
- The existing single-item import still works without changes to the user experience.

## Scope Boundaries

- No cherry-pick UI for selecting individual grid items from within a tab — tab selection is the finest granularity for dashboard exports.
- No drag-and-drop file upload — keep the existing file input.
- No changes to the export format or export flow.
- No changes to the landing page dashboard import modal behavior.

## Key Decisions

- **Auto-detect over explicit mode selection**: The import modal auto-detects the JSON format rather than requiring the user to choose what they're importing. This keeps the UX simple and the modal familiar.
- **Tab selection for dashboard exports**: When importing a full dashboard export, show checkboxes so users can pick which tabs to import rather than forcing all-or-nothing.
- **Preview before import**: Show a summary of detected content so users can verify before committing.

## Dependencies / Assumptions

- The existing `handleGridItemImport` validation and GeoJSON upload logic is reusable for bulk items.
- The `TabContext.addTab` function can be called multiple times to add imported tabs.
- Imported tab names may need deduplication if they conflict with existing tab names (deferred to planning).

## Outstanding Questions

### Deferred to Planning
- [Affects R4, R5][Technical] How should tab name conflicts be handled — auto-suffix (e.g., "MyTab (2)"), or just allow duplicate names?
- [Affects R3][Technical] Should imported grid item `i` values be re-indexed to avoid conflicts with existing items, or does the existing `onAddGridItem` logic already handle this?
- [Affects R6][Needs research] What preview information is available from the JSON without fully processing all items — can we show source names or just counts?
- [Affects R9, R10][Technical] `handleGridItemImport` performs GeoJSON uploads as a side effect during processing. For all-or-nothing batch validation, planning should determine whether to split validation from side effects (validate all first, then upload) to avoid orphaned server-side files on partial failure.

## Next Steps

-> `/ce:plan` for structured implementation planning
