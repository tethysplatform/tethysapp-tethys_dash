import PropTypes from "prop-types";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import { memo, useState, useContext } from "react";
import {
  LayoutContext,
  EditingContext,
  VariableInputsContext,
  DataViewerModeContext,
  AppContext,
} from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import BaseVisualization from "components/visualizations/Base";
import { confirm } from "components/inputs/DeleteConfirmation";
import { getGridItem } from "components/visualizations/utilities";
import CustomAlert from "components/dashboard/CustomAlert";
import { loadLayerJSONs, saveLayerJSON } from "components/map/utilities";

const StyledContainer = styled(Container)`
  position: relative;
  padding: 0;
`;

const StyledButtonDiv = styled.div`
  position: absolute;
  margin: 0.5rem;
  right: 0;
  z-index: 1;
`;

const minMapLayerStructure = `Map layers must have at minimum, the following structure:
{
    configuration: {
        type: <Some Value>,
        props: {
            source: {
                type: <Some Value>
            }
        }
    }
}`;

export const handleGridItemExport = async (gridItem) => {
  const { id, ...exportedGridItem } = gridItem;
  exportedGridItem.metadata_string = JSON.parse(
    exportedGridItem.metadata_string
  );
  const gridItemArgs = JSON.parse(exportedGridItem.args_string);
  exportedGridItem.args_string = gridItemArgs;

  if (exportedGridItem.source === "Map") {
    if (
      "additional_layers" in gridItemArgs &&
      gridItemArgs["additional_layers"].length > 0
    ) {
      for (const mapLayer of gridItemArgs["additional_layers"]) {
        const apiResponse = await loadLayerJSONs(mapLayer);
        if (!apiResponse.success) {
          return apiResponse;
        }
      }
    }
  }

  return exportedGridItem;
};

const DashboardItem = ({
  gridItemSource,
  gridItemI,
  gridItemArgsString,
  gridItemMetadataString,
  gridItemIndex,
}) => {
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [gridItemMessage, setGridItemMessage] = useState("");
  const [showGridItemMessage, setShowGridItemMessage] = useState(false);
  const { updateGridItems, getDashboardMetadata } = useContext(LayoutContext);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext
  );
  const { setInDataViewerMode } = useContext(DataViewerModeContext);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  async function deleteGridItem(e) {
    const { gridItems } = getDashboardMetadata();
    if (await confirm("Are you sure you want to delete the item?")) {
      const updated_grid_items = JSON.parse(JSON.stringify(gridItems));
      updated_grid_items.splice(gridItemIndex, 1);

      updateGridItems(updated_grid_items);
      setIsEditing(true);
    }
  }

  function onFullscreen() {
    setShowFullscreen(true);
  }

  function hideFullscreen() {
    setShowFullscreen(false);
  }

  function editGridItem() {
    setShowDataViewerModal(true);
    setIsEditing(true);
    setInDataViewerMode(true);
    if (activeAppTour) {
      setAppTourStep(32);
    }
  }

  async function exportGridItem() {
    const { gridItems } = getDashboardMetadata();
    const gridItem = JSON.parse(JSON.stringify(gridItems[gridItemIndex]));

    const exportedGridItem = await handleGridItemExport(gridItem);

    try {
      // Convert to JSON string
      const jsonString = JSON.stringify(exportedGridItem, null, 2); // Pretty format

      // Create a Blob and a download link
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `TethysDashGridItem.json`; // File name
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revoke the URL to free memory
      URL.revokeObjectURL(url);
    } catch (err) {
      return { success: false, message: "Failed to export griditem" };
    }
  }

  function copyGridItem() {
    const { gridItems } = getDashboardMetadata();
    let maxGridItemI = gridItems.reduce((acc, value) => {
      return (acc = acc > parseInt(value.i) ? acc : parseInt(value.i));
    }, 0);
    const copiedGridItem = getGridItem(gridItems, gridItemI);
    const newGridItem = { ...copiedGridItem };
    newGridItem.i = `${parseInt(maxGridItemI) + 1}`;
    if (newGridItem.source === "Variable Input") {
      const newGridItemArgs = JSON.parse(newGridItem.args_string);
      let copiedVariableName = newGridItemArgs.variable_name;
      let finding_valid_name = true;
      let i = 2;
      let newVariableName = newGridItemArgs.variable_name + "_1";
      do {
        if (!Object.keys(variableInputValues).includes(newVariableName)) {
          finding_valid_name = false;
        } else {
          newVariableName = newGridItemArgs.variable_name + "_" + i;
        }
        i++;
      } while (finding_valid_name);
      newGridItemArgs.variable_name = newVariableName;
      newGridItem.args_string = JSON.stringify(newGridItemArgs);
      variableInputValues[newVariableName] =
        variableInputValues[copiedVariableName];
      setVariableInputValues(variableInputValues);
    }
    const updatedGridItems = JSON.parse(JSON.stringify(gridItems));
    updateGridItems([...updatedGridItems, newGridItem]);
    setIsEditing(true);
  }

  function editSize() {
    setIsEditing(true);
  }

  function hideDataViewerModal() {
    setShowDataViewerModal(false);
    setInDataViewerMode(false);
  }

  return (
    <>
      <StyledContainer
        fluid
        className="h-100 gridVisualization"
        aria-label="gridItem"
      >
        <CustomAlert
          alertType={"success"}
          showAlert={showGridItemMessage}
          setShowAlert={setShowGridItemMessage}
          alertMessage={gridItemMessage}
        />
        <StyledButtonDiv>
          <DashboardItemDropdown
            showFullscreen={gridItemSource ? onFullscreen : null}
            deleteGridItem={deleteGridItem}
            editGridItem={editGridItem}
            exportGridItem={exportGridItem}
            editSize={isEditing ? null : editSize}
            copyGridItem={copyGridItem}
          />
        </StyledButtonDiv>
        <BaseVisualization
          key={gridItemI}
          source={gridItemSource}
          argsString={gridItemArgsString}
          metadataString={gridItemMetadataString}
          showFullscreen={showFullscreen}
          hideFullscreen={hideFullscreen}
        />
      </StyledContainer>
      {showDataViewerModal && (
        <DataViewerModal
          gridItemIndex={gridItemIndex}
          source={gridItemSource}
          argsString={gridItemArgsString}
          metadataString={gridItemMetadataString}
          showModal={showDataViewerModal}
          handleModalClose={hideDataViewerModal}
          setGridItemMessage={setGridItemMessage}
          setShowGridItemMessage={setShowGridItemMessage}
        />
      )}
    </>
  );
};

DashboardItem.propTypes = {
  gridItemSource: PropTypes.string,
  gridItemI: PropTypes.string,
  gridItemArgsString: PropTypes.string,
  gridItemMetadataString: PropTypes.string,
  gridItemIndex: PropTypes.number,
};

export default memo(DashboardItem);
