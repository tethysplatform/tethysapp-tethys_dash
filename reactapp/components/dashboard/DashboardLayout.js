import { useCallback, useRef, useContext, memo, useMemo } from "react";
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

const ReactGridLayout = WidthProvider(RGL);

const colCount = 100;
const rowHeight = window.innerWidth / colCount - 10;

const DashboardLayout = ({ tabId, gridItems, shouldLoad }) => {
  const { unrestrictedPlacement } = useContext(LayoutContext);
  const { updateTab } = useContext(TabContext);
  const { isEditing } = useContext(EditingContext);
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
  );

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
        isDraggable: isEditing && !disabledEditingMovement,
        isResizable: isEditing && !disabledEditingMovement,
      })),
    [gridItems, isEditing, disabledEditingMovement],
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
    const updatedGridItems = [];
    for (let lay of newLayout) {
      var result = gridItems.find((obj) => {
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
      var result = gridItemsUpdated.current.find((obj) => {
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
      onDragStop={(newLayout) => updateLayout(newLayout)}
      onResizeStop={(newLayout) => updateLayout(newLayout)}
      isDraggable={false}
      isResizable={false}
      draggableCancel=".dropdown-toggle,.modal-dialog,.alert,.dropdown-item,.modebar-btn.modal-footer,.color-picker-popover"
      onResize={handleResize}
      allowOverlap={unrestrictedPlacement}
      useCSSTransforms={false}
    >
      {parsedGridItems.map((item, index) => (
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
