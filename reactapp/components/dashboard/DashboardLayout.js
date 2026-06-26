import {
  useCallback,
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
  const { unrestrictedPlacement } = useContext(LayoutContext);
  const allowOverlap =
    allowOverlapProp !== undefined ? allowOverlapProp : unrestrictedPlacement;
  const { updateTab } = useContext(TabContext);
  const { isEditing } = useContext(EditingContext);
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
  );

  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const isWideBreakpoint =
    !responsive || currentBreakpoint === "lg" || currentBreakpoint === "md";

  const gridItemsUpdated = useRef();
  gridItemsUpdated.current = gridItems;

  // Memoize layout from gridItems
  const layout = useMemo(
    () =>
      gridItems.map((griditem) => ({
        h: griditem.h,
        i: griditem.i,
        w: griditem.w,
        x: griditem.x,
        y: griditem.y,
        isDraggable: isWideBreakpoint && isEditing && !disabledEditingMovement,
        isResizable: isWideBreakpoint && isEditing && !disabledEditingMovement,
      })),
    [gridItems, isEditing, disabledEditingMovement, isWideBreakpoint],
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

  const children = parsedGridItems.map((item, index) => (
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
