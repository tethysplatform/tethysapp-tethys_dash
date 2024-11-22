import { useState, useEffect, useCallback, useRef } from "react";
import RGL, { WidthProvider } from "react-grid-layout";
import styled from "styled-components";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
} from "components/contexts/LayoutAlertContext";
import { useEditingContext } from "components/contexts/EditingContext";
import Form from "react-bootstrap/Form";
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

function DashboardLayout() {
  const setSuccessMessage = useLayoutSuccessAlertContext()[1];
  const setShowSuccessMessage = useLayoutSuccessAlertContext()[3];
  const setErrorMessage = useLayoutErrorAlertContext()[1];
  const setShowErrorMessage = useLayoutErrorAlertContext()[3];
  const { updateDashboard } = useAvailableDashboardsContext();
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const gridItems = useLayoutGridItemsContext()[0];
  const { isEditing, setIsEditing } = useEditingContext();
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
  }, [isEditing]);

  function updateGridLayout() {
    setItems(
      gridItems.map((item, index) => (
        <StyledDiv key={item.i}>
          <DashboardItem
            gridItemSource={item.source}
            gridItemI={item.i}
            gridItemArgsString={item.args_string}
            gridItemMetadataString={item.metadata_string}
            grid_item_index={index}
          />
        </StyledDiv>
      ))
    );
    setLayout(gridItems);
    updateGridEditing(gridItems);
  }

  function updateGridEditing(griditems) {
    const updatedLayout = [];
    for (let griditem of griditems) {
      updatedLayout.push({
        args_string: griditem.args_string,
        h: griditem.h,
        i: griditem.i,
        source: griditem.source,
        metadata_string: griditem.metadata_string,
        w: griditem.w,
        x: griditem.x,
        y: griditem.y,
        isDraggable: isEditing,
        isResizable: isEditing,
      });
    }
    setLayout(updatedLayout);
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
    const layout = getLayoutContext();
    layout["gridItems"] = updatedGridItems;
    setLayoutContext(layout);
    updateGridEditing(updatedGridItems);
  }

  function handleSubmit(event) {
    event.preventDefault();
    setShowSuccessMessage(false);
    setShowErrorMessage(false);

    if (isEditing) {
      updateDashboard({}).then((response) => {
        if (response["success"]) {
          setSuccessMessage("Change have been saved.");
          setShowSuccessMessage(true);
          setIsEditing(false);
        } else {
          setErrorMessage(
            "Failed to save changes. Check server logs for more information."
          );
          setShowErrorMessage(true);
        }
      });
    }
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
    <Form id="gridUpdate" onSubmit={handleSubmit}>
      <ReactGridLayout
        className="complex-interface-layout"
        layout={layout}
        rowHeight={rowHeight}
        cols={colCount}
        onLayoutChange={(newLayout) => updateLayout(newLayout)}
        isDraggable={false}
        isResizable={false}
        draggableCancel=".dropdown-toggle,.modal-dialog,.alert,.dropdown-item,.modebar-btn.modal-footer"
        onResize={handleResize}
      >
        {items}
      </ReactGridLayout>
    </Form>
  );
}

export default DashboardLayout;
