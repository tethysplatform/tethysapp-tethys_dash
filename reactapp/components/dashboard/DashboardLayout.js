import { useState, useEffect, useContext } from "react";
import RGL, { WidthProvider } from "react-grid-layout";
import styled from "styled-components";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import {
  useLayoutSuccessAlertContext,
  useLayoutErrorAlertContext,
} from "components/contexts/LayoutAlertContext";
import { useEditingContext } from "components/contexts/EditingContext";
import Form from "react-bootstrap/Form";
import appAPI from "services/api/app";
import { AppContext } from "components/contexts/AppContext";
import DashboardItem from "components/dashboard/DashboardItem";
import PropTypes from "prop-types";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "components/dashboard/DashboardLayout.css";

const ReactGridLayout = WidthProvider(RGL);

const StyledDiv = styled.div`
  border: #dcdcdc solid 1px;
  background: whitesmoke;
`;

const GridLayout = ({ layout, updateLayout, items }) => (
  <ReactGridLayout
    className="complex-interface-layout"
    layout={layout}
    rowHeight={10}
    cols={50}
    onLayoutChange={(newLayout) => updateLayout(newLayout)}
    isDraggable={false}
    isResizable={false}
    draggableCancel=".dropdown-toggle,.modal-dialog,.alert,.dropdown-item,.modebar-btn.modal-footer"
  >
    {items}
  </ReactGridLayout>
);

function DashboardLayout() {
  const setSuccessMessage = useLayoutSuccessAlertContext()[1];
  const setShowSuccessMessage = useLayoutSuccessAlertContext()[3];
  const setErrorMessage = useLayoutErrorAlertContext()[1];
  const setShowErrorMessage = useLayoutErrorAlertContext()[3];
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];
  const gridItems = useLayoutGridItemsContext()[0];
  const [isEditing, setIsEditing] = useEditingContext();
  const { csrf } = useContext(AppContext);
  const [layout, setLayout] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => {
    updateGridLayout();
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
          {
            <DashboardItem
              gridItemSource={item.source}
              gridItemI={item.i}
              gridItemArgsString={item.args_string}
              gridItemRefreshRate={item.refresh_rate}
              grid_item_index={index}
            />
          }
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
        refresh_rate: griditem.refresh_rate,
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
        refresh_rate: result.refresh_rate,
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
      const updatedLayoutContext = getLayoutContext();
      appAPI.updateDashboard(updatedLayoutContext, csrf).then((response) => {
        if (response["success"]) {
          const name = response["updated_dashboard"]["name"];
          let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
          OGLayouts[name] = response["updated_dashboard"];
          setDashboardLayoutConfigs(OGLayouts);
          setLayoutContext(response["updated_dashboard"]);
          setSuccessMessage("Change have been saved.");
          setShowSuccessMessage(true);
        } else {
          setErrorMessage(
            "Failed to save changes. Check server logs for more information."
          );
          setShowErrorMessage(true);
        }
      });
      setIsEditing(false);
    }
  }

  return (
    <Form id="gridUpdate" onSubmit={handleSubmit}>
      <GridLayout layout={layout} updateLayout={updateLayout} items={items} />
    </Form>
  );
}

GridLayout.propTypes = {
  isEditing: PropTypes.bool,
  layout: PropTypes.array,
  updateLayout: PropTypes.func,
  items: PropTypes.array,
};

export default DashboardLayout;
