import { useState, useEffect, useCallback, useRef, useContext } from "react";
import RGL, { WidthProvider } from "react-grid-layout";
import styled from "styled-components";
import {
  LayoutContext,
  EditingContext,
  DisabledEditingMovementContext,
} from "components/contexts/Contexts";
import DashboardItem from "components/dashboard/DashboardItem";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "components/dashboard/DashboardLayout.css";

const ReactGridLayout = WidthProvider(RGL);

const StyledDiv = styled.div`
  border: #dcdcdc solid 1px;
  background: whitesmoke;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
`;

const colCount = 100;
const rowHeight = window.innerWidth / colCount - 10;

const DashboardLayout = () => {
  const { updateGridItems, getDashboardMetadata } = useContext(LayoutContext);
  const { gridItems } = getDashboardMetadata();
  const { isEditing } = useContext(EditingContext);
  const { disabledEditingMovement } = useContext(
    DisabledEditingMovementContext
  );
  const [layout, setLayout] = useState([]);
  const [items, setItems] = useState([]);
  const gridItemsUpdated = useRef();

  useEffect(() => {
    updateGridLayout();
    gridItemsUpdated.current = gridItems;
    // eslint-disable-next-line
  }, [gridItems]);

  useEffect(() => {
    updateGridEditing(gridItems);
    // eslint-disable-next-line
  }, [isEditing, disabledEditingMovement]);

  function updateGridLayout() {
    setItems(
      gridItems.map((item, index) => (
        <StyledDiv key={item.i}>
          <DashboardItem
            gridItemSource={item.source}
            gridItemI={item.i}
            gridItemArgsString={item.args_string}
            gridItemMetadataString={item.metadata_string}
            gridItemIndex={index}
          />
        </StyledDiv>
      ))
    );
    updateGridEditing(gridItems);
  }

  function updateGridEditing(griditems) {
    const updatedGridItems = [];
    for (let griditem of griditems) {
      updatedGridItems.push({
        args_string: griditem.args_string,
        h: griditem.h,
        i: griditem.i,
        source: griditem.source,
        metadata_string: griditem.metadata_string,
        w: griditem.w,
        x: griditem.x,
        y: griditem.y,
        isDraggable: isEditing && !disabledEditingMovement,
        isResizable: isEditing && !disabledEditingMovement,
      });
    }
    setLayout(updatedGridItems);
  }

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
      });
    }

    updateGridItems(updatedGridItems);
    updateGridEditing(updatedGridItems);
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
    []
  );

  return (
    <ReactGridLayout
      className="complex-interface-layout"
      layout={layout}
      rowHeight={rowHeight}
      cols={colCount}
      onLayoutChange={(newLayout) => updateLayout(newLayout)}
      isDraggable={false}
      isResizable={false}
      draggableCancel=".dropdown-toggle,.modal-dialog,.alert,.dropdown-item,.modebar-btn.modal-footer,.color-picker-popover"
      onResize={handleResize}
    >
      {items}
    </ReactGridLayout>
  );
};

export default DashboardLayout;
