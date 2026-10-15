import {
  useCallback,
  useRef,
  useContext,
  useEffect,
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

const StaticGridLayout = WidthProvider(RGL);
const ResponsiveGridLayout = WidthProvider(Responsive);

export const MENU_OPEN_Z_INDEX = 2;
const colCount = 100;
// Rows span the content area like columns span its width, so item height stays
// a fraction of that area across screens. 100:56 is ~square on 16:9. Tunable.
const rowCount = 56;

// Content area height = viewport minus the fixed header and, when shown, the
// tab bar. Matches DashboardItem's fill-viewport offset.
function readCssPx(varName, fallback) {
  const parsed = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue(varName),
    10,
  );
  return Number.isFinite(parsed) ? parsed : fallback;
}
function contentAreaHeight(hasTabBar) {
  const header = readCssPx("--ts-header-height", 56);
  const tabBar = hasTabBar ? readCssPx("--ts-tab-bar-height", 44) : 0;
  return Math.max(1, window.innerHeight - header - tabBar);
}

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
  rowHeight: rowHeightProp,
  responsive = false,
  allowOverlap: allowOverlapProp,
}) => {
  const { unrestrictedPlacement } = useContext(LayoutContext);
  const allowOverlap =
    allowOverlapProp !== undefined ? allowOverlapProp : unrestrictedPlacement;
  const { updateTab, tabs } = useContext(TabContext);
  const { isEditing } = useContext(EditingContext);

  // The main dashboard omits rowHeight and sizes rows to the content area;
  // popup/editor surfaces pass an explicit rowHeight and opt out.
  const sizeRowsToContentArea =
    rowHeightProp === undefined && tabId !== "popup";
  const hasTabBar = tabs.length > 1;
  const [contentHeight, setContentHeight] = useState(() =>
    sizeRowsToContentArea ? contentAreaHeight(hasTabBar) : 0,
  );
  useEffect(() => {
    if (!sizeRowsToContentArea) return undefined;
    const update = () => setContentHeight(contentAreaHeight(hasTabBar));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sizeRowsToContentArea, hasTabBar]);
  const rowHeight = rowHeightProp ?? contentHeight / rowCount;
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
  );

  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  // The item whose menu is open, lifted above the rest while it stays open.
  const [menuOpenKey, setMenuOpenKey] = useState(null);
  const isWideBreakpoint =
    !responsive || currentBreakpoint === "lg" || currentBreakpoint === "md";

  const gridItemsUpdated = useRef();
  gridItemsUpdated.current = gridItems;

  /* Index of the item filling the content area, if any - the first with the
     setting, matching DashboardItem. Fill-viewport does not apply on the popup
     surface, where this layout is reused. */
  const firstFillIndex = useMemo(
    () =>
      tabId === "popup"
        ? -1
        : gridItems.findIndex((item) => {
            try {
              return JSON.parse(item.metadata_string)?.fillViewport;
            } catch {
              return false;
            }
          }),
    [gridItems, tabId],
  );

  // Memoize layout from gridItems
  const layout = useMemo(
    () =>
      gridItems.map((griditem, index) => {
        /* The filling item takes its position and size from the viewport rather
           than the grid, so dragging and resizing it do nothing visible. Both
           are turned off, which is also what hides the resize handle:
           react-grid-layout marks a non-resizable item react-resizable-hide,
           and its stylesheet hides the handle inside it. Leaving the handle
           would have stranded it at the item's old grid position anyway, since
           it is a sibling of the item's content and does not follow it once the
           item goes position:fixed.

           Derived from the item's metadata every render, so clearing the
           setting restores dragging and the handle immediately. */
        const isFillItem = index === firstFillIndex;
        const movable =
          isWideBreakpoint &&
          isEditing &&
          !disabledEditingMovement &&
          !isFillItem;
        return {
          h: griditem.h,
          i: griditem.uuid ?? griditem.i,
          w: griditem.w,
          x: griditem.x,
          y: griditem.y,
          isDraggable: movable,
          isResizable: movable,
        };
      }),
    [
      gridItems,
      isEditing,
      disabledEditingMovement,
      isWideBreakpoint,
      firstFillIndex,
    ],
  );

  // Responsive layouts (only computed when responsive=true).
  const responsiveLayouts = useMemo(
    () => (responsive ? buildResponsiveLayouts(layout) : null),
    [responsive, layout],
  );

  // Memoize parsed grid items array at the top level
  const parsedGridItems = useMemo(
    () =>
      gridItems.map((item) => ({
        ...item,
      })),
    [gridItems],
  );

  function updateLayout(newLayout) {
    // Defense-in-depth: per-item isDraggable/isResizable already gates editing
    // by breakpoint; this short-circuits in case a drag still fires.
    if (!isWideBreakpoint) return;

    const updatedGridItems = [];
    for (let lay of newLayout) {
      const result = gridItems.find((obj) => {
        return (obj.uuid ?? obj.i) === lay.i;
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

  const currentCols = responsive ? responsiveCols[currentBreakpoint] : colCount;

  const handleResize = useCallback(
    (l, oldLayoutItem, layoutItem, placeholder, e, node) => {
      const result = gridItemsUpdated.current.find((obj) => {
        return (obj.uuid ?? obj.i) === layoutItem.i;
      });
      const metadata = JSON.parse(result.metadata_string);
      const enforceAspectRatio = metadata.enforceAspectRatio;
      if (enforceAspectRatio) {
        const aspectRatio = metadata.aspectRatio;
        if (aspectRatio) {
          // aspectRatio is in pixels, but w and h are in grid units, and a
          // column is no longer as wide as a row is tall. Convert the ratio to
          // grid units, treating cells as square when the grid can't be measured.
          const gridWidth = node?.closest?.(".react-grid-layout")?.clientWidth;
          const colWidth = gridWidth ? gridWidth / currentCols : 0;
          const gridRatio =
            colWidth > 0 && rowHeight > 0
              ? (aspectRatio * rowHeight) / colWidth
              : aspectRatio;
          const heightDiff = layoutItem.h - oldLayoutItem.h;
          const widthDiff = layoutItem.w - oldLayoutItem.w;
          // Rounded because grid items are saved as whole grid units.
          if (Math.abs(heightDiff) < Math.abs(widthDiff)) {
            layoutItem.h = Math.max(1, Math.round(layoutItem.w / gridRatio));
            placeholder.h = layoutItem.h;
          } else {
            layoutItem.w = Math.max(1, Math.round(layoutItem.h * gridRatio));
            placeholder.w = layoutItem.w;
          }
        }
      }
    },
    [currentCols, rowHeight],
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

  /* Items after the fill item get lifted above it. Paint order among the grid's
     tiles is otherwise decided by tree order alone, which is enough on screen
     but is not reproduced when a DOM-to-image library captures the dashboard: a
     fill item is position:fixed, meaningless in the detached clone the library
     renders from, so it gets repositioned and can paint over tiles that belong
     above it.

     The lift goes on the grid item itself rather than anything inside it, so
     that react-grid-layout's own resize handles - siblings of this component's
     output within the item - are carried above the fill item as well.

     An item whose menu is open is lifted one step further, above every other
     tile, and drops back to its place when the menu closes. The menu itself is
     rendered at the page root, so it shows either way; the lift brings forward
     the tile the menu acts on. */
  const itemStyle = (key, index) => {
    if (key === menuOpenKey) return { zIndex: MENU_OPEN_Z_INDEX };
    return firstFillIndex >= 0 && index > firstFillIndex
      ? { zIndex: 1 }
      : undefined;
  };
  const children = parsedGridItems.map((item, index) => (
    <div
      key={item.uuid ?? item.i}
      style={itemStyle(item.uuid ?? item.i, index)}
    >
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
          // Called by the item's menu as it opens and closes.
          setItemMenuOpen: (open) =>
            setMenuOpenKey((current) => {
              const key = item.uuid ?? item.i;
              if (open) return key;
              return current === key ? null : current;
            }),
          // Fill-viewport only applies on the main dashboard surface, not when
          // this layout is reused inside the popup modal / popup editor.
          enableFillViewport: tabId !== "popup",
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
