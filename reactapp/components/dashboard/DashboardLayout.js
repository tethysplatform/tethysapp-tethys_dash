import {
  useCallback,
  useEffect,
  useRef,
  useContext,
  memo,
  useMemo,
  useState,
} from "react";
import RGL, { Responsive, WidthProvider } from "react-grid-layout";
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
  TabContext,
  GridItemContext,
} from "components/contexts/Contexts";
import DashboardItem from "components/dashboard/DashboardItem";
import PropTypes from "prop-types";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { valuesEqual } from "components/modals/utilities";
import { v4 as uuidv4 } from "uuid";
import { computePanelLayout } from "components/dashboard/panelLayoutUtils";
import { applyPatch } from "rfc6902";

const StaticGridLayout = WidthProvider(RGL);
const ResponsiveGridLayout = WidthProvider(Responsive);

const colCount = 100;
const defaultRowHeight = window.innerWidth / colCount;

const responsiveBreakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
const responsiveCols = { lg: 100, md: 100, sm: 12, xs: 4, xxs: 1 };

function buildResponsiveLayouts(lgLayout) {
  const lgCols = responsiveCols.lg;
  const result = { lg: lgLayout };
  for (const bp of ["md", "sm", "xs", "xxs"]) {
    const targetCols = responsiveCols[bp];
    if (targetCols === lgCols) {
      result[bp] = lgLayout;
    } else {
      const ratio = targetCols / lgCols;
      result[bp] = lgLayout.map((item) => ({
        ...item,
        x: Math.min(
          Math.max(0, targetCols - 1),
          Math.max(0, Math.round(item.x * ratio)),
        ),
        w: Math.max(1, Math.min(targetCols, Math.round(item.w * ratio))),
      }));
    }
  }
  return result;
}

const DashboardLayout = ({
  tabId,
  gridItems,
  shouldLoad,
  rowHeight = defaultRowHeight,
  responsive = false,
  allowOverlap: allowOverlapProp,
}) => {
  const { unrestrictedPlacement, saveLayoutContext } = useContext(LayoutContext);
  const allowOverlap =
    allowOverlapProp !== undefined ? allowOverlapProp : unrestrictedPlacement;
  const { updateTab, tabs } = useContext(TabContext);
  const { isEditing } = useContext(EditingContext);
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
  );

  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const isWideBreakpoint =
    !responsive || currentBreakpoint === "lg" || currentBreakpoint === "md";

  const gridItemsUpdated = useRef();
  gridItemsUpdated.current = gridItems;

  // Listen for dynamic panel creation events from embedded plugins.
  // Supports both batch events (multiple panels at once with layout)
  // and single events (backward compat).
  useEffect(() => {
    function moduleExistsOnDashboard(module, items) {
      return items.some((item) => {
        try {
          return JSON.parse(item.args_string).module === module;
        } catch {
          return false;
        }
      });
    }

    // Persist the given tab's updated grid items. Silently swallows save
    // errors so a transient network blip doesn't interrupt the user —
    // manual save still works. Callers must update `gridItemsUpdated.current`
    // synchronously BEFORE calling this so subsequent event handlers see
    // the new state (per the stale-ref solution doc).
    function persistTabGridItems(updatedGridItems) {
      if (!saveLayoutContext) return;
      const updatedTabs = tabs.map((tab) =>
        tab.id === tabId ? { ...tab, gridItems: updatedGridItems } : tab,
      );
      saveLayoutContext({ tabs: updatedTabs }).catch(() => {
        // Save failed silently — user can manually save later.
      });
    }

    function handleAddVisualization(e) {
      const detail = e.detail || {};
      const current = gridItemsUpdated.current;

      // Determine panels to add
      let panelEntries;
      if (detail.batch && Array.isArray(detail.panels)) {
        // Batch event: array of { source?, args, w?, h? }
        // Per-panel source falls back to outer detail.source for backward compat
        panelEntries = detail.panels.map((p) => ({
          source: p.source || detail.source || "Client Custom",
          args: p.args ?? {},
          w: p.w,
          h: p.h,
          uuid: p.uuid,
        }));
      } else if (detail.source) {
        // Single event (backward compat)
        panelEntries = [
          {
            source: detail.source,
            args: detail.args ?? {},
            w: detail.position?.w,
            h: detail.position?.h,
          },
        ];
      } else {
        return;
      }

      // Filter out duplicates by module
      const newPanels = panelEntries.filter(
        (p) => !p.args.module || !moduleExistsOnDashboard(p.args.module, current),
      );
      if (newPanels.length === 0) return;

      // Compute layout positions
      const positions = computePanelLayout(newPanels, current);

      // Build grid items in a single batch
      let maxI = current.reduce(
        (max, item) => Math.max(max, parseInt(item.i) || 0),
        0,
      );
      const newGridItems = newPanels.map((panel, idx) => {
        const pos = positions[idx] || { x: 0, y: 0, w: 50, h: 20 };
        return {
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          source: panel.source,
          args_string: JSON.stringify(panel.args),
          metadata_string: JSON.stringify({ refreshRate: 0 }),
          uuid: panel.uuid || uuidv4(),
          id: null,
          i: `${++maxI}`,
        };
      });

      const updatedGridItems = [...current, ...newGridItems];
      // Update ref immediately so subsequent event handlers (e.g.,
      // handleUpdateVisualization via requestAnimationFrame) see the new
      // grid items without waiting for React to re-render.
      gridItemsUpdated.current = updatedGridItems;
      updateTab(tabId, { gridItems: updatedGridItems });
      persistTabGridItems(updatedGridItems);
    }

    // Apply an RFC 6902 patch envelope to a single grid item. Returns the
    // updated item or null if the patch failed (caller skips that UUID).
    // Partial-batch tolerance: one failed UUID does NOT invalidate sibling
    // patches in the same batch event.
    //
    // Path-prefix contract: the server whitelist (editableSchemas.json) roots
    // every allowed path at `/args/...`, so the LLM emits e.g.
    // `/args/inlineData/layout/title`. But `args_string` in the grid item
    // persists just the *contents* of args — no outer `args` key. To keep
    // both sides speaking the same JSON Pointer language, we wrap the parsed
    // args in `{args: ...}` before rfc6902 apply, then unwrap on save. This
    // way the path the LLM emits, the path the server whitelist validates,
    // and the path rfc6902 resolves against are all identical.
    // Surface a patch-failure to anyone listening (chat sidebar banner etc.).
    // detail carries enough to identify the failed entry without leaking
    // persisted values. Caps the number of dispatched ops to keep the
    // payload small even when an envelope contained many ops.
    function emitPatchRejected(uuid, errorClass, path, opIndex) {
      try {
        window.dispatchEvent(
          new CustomEvent("tethysdash:patch-rejected", {
            detail: { uuid, errorClass, path, opIndex },
          }),
        );
      } catch {
        // Best-effort: never let a failed event dispatch crash the reducer.
      }
    }

    function applyPatchToGridItem(target, ops, uuid) {
      let args;
      try {
        args = JSON.parse(target.args_string);
      } catch {
        console.warn(
          "[DashboardLayout] apply_patch: failed to parse args_string for uuid",
          uuid,
        );
        emitPatchRejected(uuid, "ParseError", null, null);
        return null;
      }
      // JSON deep-clone + atomic apply: all ops succeed or we discard the
      // draft. rfc6902 mutates in-place and returns Array<Error|null>.
      // JSON round-trip suffices because args_string is always JSON-serializable;
      // avoids jsdom-environment quirks with structuredClone.
      const draft = { args: JSON.parse(JSON.stringify(args)) };
      const errors = applyPatch(draft, ops);
      if (errors.some((err) => err !== null)) {
        console.warn(
          "[DashboardLayout] apply_patch: rfc6902 errors for uuid",
          uuid,
          errors,
        );
        // Surface the FIRST error per UUID — covers the common case (single
        // failing op) without spamming the chat with one banner per op.
        const firstIdx = errors.findIndex((err) => err !== null);
        const firstErr = errors[firstIdx];
        emitPatchRejected(
          uuid,
          firstErr?.name || "ApplyError",
          ops[firstIdx]?.path ?? null,
          firstIdx,
        );
        return null;
      }
      // Defense-in-depth: an op like {op:"remove", path:"/args"} would leave
      // draft.args === undefined. JSON.stringify(undefined) returns the JS
      // undefined value, which assigned to args_string would poison later
      // JSON.parse. The whitelist currently blocks such paths but a future
      // broader entry would silently corrupt state. Skip the patch instead.
      if (draft.args === undefined || draft.args === null) {
        console.warn(
          "[DashboardLayout] apply_patch: ops removed the `args` root for uuid",
          uuid,
          "— refusing to persist `undefined`",
        );
        emitPatchRejected(uuid, "ArgsRootRemoved", "/args", null);
        return null;
      }
      return { ...target, args_string: JSON.stringify(draft.args) };
    }

    function handleUpdateVisualization(e) {
      const detail = e.detail || {};
      const operation = detail.operation;
      const current = gridItemsUpdated.current;

      // ---------------------------------------------------------------
      // Branch 1: append_layers (existing — preserved unchanged)
      // ---------------------------------------------------------------
      if (operation === "append_layers") {
        const { uuid, layers } = detail;
        if (!uuid || !Array.isArray(layers) || layers.length === 0) return;

        const targetIndex = current.findIndex((item) => item.uuid === uuid);
        if (targetIndex === -1) {
          console.warn(
            "[DashboardLayout] update-visualization: no grid item with uuid",
            uuid,
          );
          return;
        }

        const target = current[targetIndex];
        let args;
        try {
          args = JSON.parse(target.args_string);
        } catch {
          console.warn(
            "[DashboardLayout] update-visualization: failed to parse args_string for uuid",
            uuid,
          );
          return;
        }

        if (!Array.isArray(args.layers)) {
          args.layers = [];
        }
        args.layers.push(...layers);

        const updatedItem = { ...target, args_string: JSON.stringify(args) };
        const updatedGridItems = [
          ...current.slice(0, targetIndex),
          updatedItem,
          ...current.slice(targetIndex + 1),
        ];
        gridItemsUpdated.current = updatedGridItems;
        updateTab(tabId, { gridItems: updatedGridItems });
        persistTabGridItems(updatedGridItems);
        return;
      }

      // ---------------------------------------------------------------
      // Branch 2: apply_patch (new — generic update protocol)
      // ---------------------------------------------------------------
      //
      // Payload shape: { batch: true, operation: "apply_patch",
      //                  patches: [{ uuid, source, ops }, ...] }
      //
      // Partial-batch tolerance: a failed UUID (not found, bad
      // args_string, or rfc6902 apply error) logs + skips; sibling
      // patches in the same batch still land. One updateTab call and
      // one saveLayoutContext call per dispatch event — non-negotiable
      // batch discipline per the stale-ref solution doc.
      if (operation === "apply_patch") {
        const patches = Array.isArray(detail.patches) ? detail.patches : [];
        if (patches.length === 0) return;

        let updated = current;
        let anyChange = false;
        for (const entry of patches) {
          const uuid = entry?.uuid;
          const ops = Array.isArray(entry?.ops) ? entry.ops : null;
          if (!uuid || !ops || ops.length === 0) continue;

          const targetIndex = updated.findIndex((item) => item.uuid === uuid);
          if (targetIndex === -1) {
            console.warn(
              "[DashboardLayout] apply_patch: no grid item with uuid",
              uuid,
            );
            continue;
          }

          const newItem = applyPatchToGridItem(updated[targetIndex], ops, uuid);
          if (!newItem) continue; // partial-batch tolerance

          updated = [
            ...updated.slice(0, targetIndex),
            newItem,
            ...updated.slice(targetIndex + 1),
          ];
          anyChange = true;
        }

        if (!anyChange) return;

        // Synchronous ref update before updateTab (defense-in-depth per
        // docs/solutions/logic-errors/raf-timing-race-layer-dispatch-*).
        gridItemsUpdated.current = updated;
        updateTab(tabId, { gridItems: updated });
        persistTabGridItems(updated);
        return;
      }

      // Unknown operation — fail-closed (no-op with warning so we don't
      // corrupt state on unexpected event shapes).
      if (operation !== undefined) {
        console.warn(
          "[DashboardLayout] update-visualization: unknown operation",
          operation,
        );
      }
    }

    window.addEventListener("tethysdash:add-visualization", handleAddVisualization);
    window.addEventListener("tethysdash:update-visualization", handleUpdateVisualization);
    return () => {
      window.removeEventListener("tethysdash:add-visualization", handleAddVisualization);
      window.removeEventListener("tethysdash:update-visualization", handleUpdateVisualization);
    };
  }, [tabId, updateTab, tabs, saveLayoutContext]);

  // Deduplicate and validate gridItems before computing layout.
  // Filters out items with null keys or duplicate keys, and coerces
  // all values to proper types so react-grid-layout's internal
  // compact/bottom functions never encounter undefined elements.
  const validGridItems = useMemo(() => {
    const seen = new Set();
    return gridItems.filter((griditem) => {
      if (griditem.i == null) return false;
      const key = String(griditem.i);
      if (seen.has(key)) {
        console.warn(
          "[DashboardLayout] Duplicate grid item key detected:",
          key,
        );
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [gridItems]);

  const layout = useMemo(
    () =>
      validGridItems.map((griditem) => ({
        h: Number(griditem.h) || 10,
        i: String(griditem.i),
        w: Number(griditem.w) || 50,
        x: Number(griditem.x) || 0,
        y: Number(griditem.y) || 0,
        minH: 3,
        minW: 5,
        isDraggable: isWideBreakpoint && isEditing && !disabledEditingMovement,
        isResizable: isWideBreakpoint && isEditing && !disabledEditingMovement,
      })),
    [validGridItems, isEditing, disabledEditingMovement, isWideBreakpoint],
  );

  // Responsive layouts (only computed when responsive=true).
  const responsiveLayouts = useMemo(
    () => (responsive ? buildResponsiveLayouts(layout) : null),
    [responsive, layout],
  );

  function updateLayout(newLayout) {
    // Per-item isDraggable/isResizable already gates editing by breakpoint;
    // this short-circuits in case a drag still fires.
    if (!isWideBreakpoint) return;

    // Use the ref for the freshest gridItems — avoids stale closure
    // when React batches state updates during resize/drag.
    const currentGridItems = gridItemsUpdated.current;
    const updatedGridItems = [];
    for (let lay of newLayout) {
      const result = currentGridItems.find((obj) => {
        return String(obj.i) === String(lay.i);
      });
      if (!result) {
        console.warn(
          "[DashboardLayout] Layout item not found in gridItems:",
          lay.i,
          "gridItems keys:",
          currentGridItems.map((g) => g.i),
        );
        continue;
      }

      updatedGridItems.push({
        args_string: result.args_string,
        h: lay.h,
        i: String(result.i),
        source: result.source,
        metadata_string: result.metadata_string,
        w: lay.w,
        x: lay.x,
        y: lay.y,
        id: result.id,
        uuid: result.uuid,
      });
    }

    updateTab(tabId, { gridItems: updatedGridItems });
  }

  const handleResize = useCallback(
    (l, oldLayoutItem, layoutItem, placeholder) => {
      const result = gridItemsUpdated.current.find((obj) => {
        return String(obj.i) === String(layoutItem.i);
      });
      if (!result) return;
      const metadata = JSON.parse(result.metadata_string);
      const enforceAspectRatio = metadata.enforceAspectRatio;
      if (enforceAspectRatio) {
        const aspectRatio = metadata.aspectRatio;
        if (aspectRatio) {
          const heightDiff = layoutItem.h - oldLayoutItem.h;
          const widthDiff = layoutItem.w - oldLayoutItem.w;
          if (Math.abs(heightDiff) < Math.abs(widthDiff)) {
            layoutItem.h = layoutItem.w / aspectRatio;
            placeholder.h = layoutItem.w / aspectRatio;
          } else {
            layoutItem.w = layoutItem.h * aspectRatio;
            placeholder.w = layoutItem.h * aspectRatio;
          }
        }
      }
    },
    [],
  );

  const sharedGridProps = {
    key: `layout-${allowOverlap}`,
    className: "complex-interface-layout",
    rowHeight: rowHeight,
    // Zero RGL spacing — items sit flush against each other AND reach
    // the container's edges. RGL's defaults of margin:[10,10] +
    // containerPadding:[10,10] add a 10px outline around every tile
    // and an extra 10px ring around the whole grid, which kept the
    // dashboard from extending to the screen edge.
    margin: [0, 0],
    containerPadding: [0, 0],
    onDragStop:
      // istanbul ignore next
      (newLayout) => updateLayout(newLayout),
    onResizeStop: (newLayout) => updateLayout(newLayout),
    isDraggable: false,
    isResizable: false,
    draggableCancel:
      ".dropdown-toggle,.modal-dialog,.alert,.dropdown-item,.modebar-btn.modal-footer,.color-picker-popover",
    onResize: handleResize,
    allowOverlap,
    useCSSTransforms: false,
  };

  const children = validGridItems.map((item, index) => (
    <div key={item.i}>
      <GridItemContext.Provider
        value={{
          gridItemId: item.id,
          gridItemSource: item.source,
          gridItemI: item.i,
          gridItemArgsString: item.args_string,
          gridItemMetadataString: item.metadata_string,
          gridItemIndex: index,
          gridItemUUID: item.uuid,
          shouldLoad: shouldLoad,
        }}
      >
        <DashboardItem />
      </GridItemContext.Provider>
    </div>
  ));

  if (responsive) {
    return (
      <ResponsiveGridLayout
        {...sharedGridProps}
        layouts={responsiveLayouts}
        breakpoints={responsiveBreakpoints}
        cols={responsiveCols}
        onBreakpointChange={(newBreakpoint) =>
          setCurrentBreakpoint(newBreakpoint)
        }
      >
        {children}
      </ResponsiveGridLayout>
    );
  }

  return (
    <StaticGridLayout {...sharedGridProps} layout={layout} cols={colCount}>
      {children}
    </StaticGridLayout>
  );
};
DashboardLayout.propTypes = {
  tabId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  gridItems: PropTypes.arrayOf(
    PropTypes.shape({
      i: PropTypes.string.isRequired,
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
      w: PropTypes.number.isRequired,
      h: PropTypes.number.isRequired,
      source: PropTypes.string.isRequired,
      args_string: PropTypes.string.isRequired,
      metadata_string: PropTypes.string.isRequired,
    }),
  ).isRequired,
  shouldLoad: PropTypes.bool,
  rowHeight: PropTypes.number,
  responsive: PropTypes.bool,
  allowOverlap: PropTypes.bool,
};

export default memo(DashboardLayout, valuesEqual);
