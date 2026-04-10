import {
  useCallback,
  useEffect,
  useRef,
  useContext,
  memo,
  useMemo,
} from "react";
import RGL, { WidthProvider } from "react-grid-layout";
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

const ReactGridLayout = WidthProvider(RGL);

const colCount = 100;
const rowHeight = window.innerWidth / colCount - 10;

const DashboardLayout = ({ tabId, gridItems, shouldLoad }) => {
  const { unrestrictedPlacement, saveLayoutContext } = useContext(LayoutContext);
  const { updateTab, tabs } = useContext(TabContext);
  const { isEditing } = useContext(EditingContext);
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
  );

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

    function handleAddVisualization(e) {
      const detail = e.detail || {};
      const current = gridItemsUpdated.current;

      // Determine panels to add
      let panelEntries;
      if (detail.batch && Array.isArray(detail.panels)) {
        // Batch event: array of { args, w?, h? }
        panelEntries = detail.panels.map((p) => ({
          source: detail.source || "Client Custom",
          args: p.args ?? {},
          w: p.w,
          h: p.h,
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
        const pos = positions[idx] || { x: 0, y: Infinity, w: 50, h: 20 };
        return {
          x: pos.x,
          y: pos.y,
          w: pos.w,
          h: pos.h,
          source: panel.source,
          args_string: JSON.stringify(panel.args),
          metadata_string: JSON.stringify({ refreshRate: 0 }),
          uuid: uuidv4(),
          id: null,
          i: `${++maxI}`,
        };
      });

      const updatedGridItems = [...current, ...newGridItems];
      updateTab(tabId, { gridItems: updatedGridItems });

      // Auto-save: persist dynamically created panels to the backend
      if (saveLayoutContext) {
        const updatedTabs = tabs.map((tab) =>
          tab.id === tabId ? { ...tab, gridItems: updatedGridItems } : tab,
        );
        saveLayoutContext({ tabs: updatedTabs }).catch(() => {
          // Save failed silently — user can manually save later
        });
      }
    }

    window.addEventListener("tethysdash:add-visualization", handleAddVisualization);
    return () =>
      window.removeEventListener("tethysdash:add-visualization", handleAddVisualization);
  }, [tabId, updateTab, tabs, saveLayoutContext]);

  // Memoize layout from gridItems
  const layout = useMemo(
    () =>
      gridItems.map((griditem) => ({
        h: griditem.h,
        i: griditem.i,
        w: griditem.w,
        x: griditem.x,
        y: griditem.y,
        isDraggable: isEditing && !disabledEditingMovement,
        isResizable: isEditing && !disabledEditingMovement,
      })),
    [gridItems, isEditing, disabledEditingMovement],
  );

  function updateLayout(newLayout) {
    const updatedGridItems = [];
    for (let lay of newLayout) {
      const result = gridItems.find((obj) => {
        return obj.i === lay.i;
      });

      updatedGridItems.push({
        args_string: result.args_string,
        h: lay.h,
        i: result.i,
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
        return obj.i === layoutItem.i;
      });
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

  return (
    <ReactGridLayout
      key={`layout-${unrestrictedPlacement}`}
      className="complex-interface-layout"
      layout={layout}
      rowHeight={rowHeight}
      cols={colCount}
      onDragStop={
        // istanbul ignore next
        (newLayout) => updateLayout(newLayout)
      }
      onResizeStop={(newLayout) => updateLayout(newLayout)}
      isDraggable={false}
      isResizable={false}
      draggableCancel=".dropdown-toggle,.modal-dialog,.alert,.dropdown-item,.modebar-btn.modal-footer,.color-picker-popover"
      onResize={handleResize}
      allowOverlap={unrestrictedPlacement}
      useCSSTransforms={false}
    >
      {gridItems.map((item, index) => (
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
      ))}
    </ReactGridLayout>
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
  shouldLoad: PropTypes.bool.isRequired,
};

export default memo(DashboardLayout, valuesEqual);
