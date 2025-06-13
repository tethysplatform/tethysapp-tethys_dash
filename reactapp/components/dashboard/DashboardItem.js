import PropTypes from "prop-types";
import styled, { css } from "styled-components";
import Container from "react-bootstrap/Container";
import { memo, useState, useContext, useEffect } from "react";
import {
  LayoutContext,
  EditingContext,
  VariableInputsContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import BaseVisualization from "components/visualizations/Base";
import { confirm } from "components/inputs/DeleteConfirmation";
import {
  getGridItem,
  downloadJSONFile,
} from "components/visualizations/utilities";
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
  top: 0;
`;

const StyledDiv = styled.div`
  height: 100%;
  width: 100%;
  ${(props) =>
    props.$borderProps
      ? css(props.$borderProps)
      : props.$isEditing && "border: 1px solid #dcdcdc"};
  background-color: ${(props) =>
    props.$backgroundColorProps
      ? props.$backgroundColorProps
      : props.$isEditing
        ? "whitesmoke"
        : "transparent"};
  box-shadow: ${(props) =>
    props.$boxShadowProps
      ? props.$boxShadowProps
      : props.$isEditing
        ? "0 4px 8px rgba(0, 0, 0, 0.1)"
        : "none"};
`;

export const minMapLayerStructure = `Map layers must have at minimum, the following structure:
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

export const requiredGridItemKeys = [
  "i",
  "x",
  "y",
  "w",
  "h",
  "source",
  "args_string",
  "metadata_string",
];

export const handleGridItemExport = async (gridItem) => {
  const { id, ...exportedGridItem } = gridItem;
  exportedGridItem.metadata_string = JSON.parse(
    exportedGridItem.metadata_string
  );
  const gridItemArgs = JSON.parse(exportedGridItem.args_string);
  exportedGridItem.args_string = gridItemArgs;

  if (exportedGridItem.source === "Map") {
    if ("layers" in gridItemArgs && gridItemArgs["layers"].length > 0) {
      for (const mapLayer of gridItemArgs["layers"]) {
        const apiResponse = await loadLayerJSONs(mapLayer);
        if (!apiResponse.success) {
          return apiResponse;
        }
      }
    }
  }

  return exportedGridItem;
};

export const handleGridItemImport = async (gridItem, csrf) => {
  const importedGridItem = JSON.parse(JSON.stringify(gridItem));
  if (
    !requiredGridItemKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(importedGridItem, key)
    )
  ) {
    return {
      success: false,
      message: `Grid Items must include ${requiredGridItemKeys.join(", ")} keys`,
    };
  }

  if (importedGridItem.source === "Map") {
    if (
      "layers" in importedGridItem.args_string &&
      importedGridItem.args_string["layers"].length > 0
    ) {
      for (const mapLayer of importedGridItem.args_string["layers"]) {
        if (
          !mapLayer?.configuration?.props?.source?.type ||
          !mapLayer?.configuration?.type
        ) {
          return {
            success: false,
            message: minMapLayerStructure,
          };
        }

        if (
          mapLayer.configuration.props.source.type === "GeoJSON" &&
          mapLayer.configuration.props.source.geojson
        ) {
          const apiResponse = await saveLayerJSON({
            stringJSON: JSON.stringify(
              mapLayer.configuration.props.source.geojson
            ),
            csrf,
            check_crs: true,
          });

          if (apiResponse.success) {
            mapLayer.configuration.props.source.geojson = apiResponse.filename;
          } else {
            return apiResponse;
          }
        }

        if (mapLayer.configuration.style) {
          const apiResponse = await saveLayerJSON({
            stringJSON: JSON.stringify(mapLayer.configuration.style),
            csrf,
          });

          if (apiResponse.success) {
            mapLayer.configuration.style = apiResponse.filename;
          } else {
            return apiResponse;
          }
        }
      }
    }
  }
  importedGridItem.args_string = JSON.stringify(importedGridItem.args_string);
  importedGridItem.metadata_string = JSON.stringify(
    importedGridItem.metadata_string
  );

  return {
    success: true,
    importedGridItem,
  };
};

const DashboardItem = ({
  gridItemSource,
  gridItemI,
  gridItemArgsString,
  gridItemMetadataString,
  gridItemIndex,
}) => {
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [gridItemMessage, setGridItemMessage] = useState("");
  const [showGridItemMessage, setShowGridItemMessage] = useState(false);
  const [gridItemWarning, setGridItemWarning] = useState("");
  const [showGridItemWarning, setShowGridItemWarning] = useState(false);
  const [gridItemStyling, setGridItemStyling] = useState(
    JSON.parse(gridItemMetadataString)
  );
  const { updateGridItems, gridItems } = useContext(LayoutContext);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext
  );
  const { setInDataViewerMode } = useContext(DataViewerModeContext);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  useEffect(() => {
    setGridItemStyling(JSON.parse(gridItemMetadataString));
    // eslint-disable-next-line
  }, [gridItemMetadataString]);

  async function deleteGridItem(e) {
    if (await confirm("Are you sure you want to delete the item?")) {
      const updated_grid_items = JSON.parse(JSON.stringify(gridItems));
      updated_grid_items.splice(gridItemIndex, 1);

      updateGridItems(updated_grid_items);
      setIsEditing(true);
    }
  }

  function editGridItem() {
    setShowDataViewerModal(true);
    setIsEditing(true);
    setInDataViewerMode(true);
    if (activeAppTour) {
      setAppTourStep(34);
    }
  }

  function updateGridItemOrder(newIndex) {
    const updatedGridItems = [...gridItems];
    const [movingGridItem] = updatedGridItems.splice(gridItemIndex, 1);
    updatedGridItems.splice(newIndex, 0, movingGridItem);
    updateGridItems(updatedGridItems);
  }

  function bringGridItemtoFront() {
    const newIndex = gridItems.length - 1;
    updateGridItemOrder(newIndex);
  }

  function bringGridItemForward() {
    const newIndex = gridItemIndex + 1;
    updateGridItemOrder(newIndex);
  }

  function sendGridItemtoBack() {
    const newIndex = 0;
    updateGridItemOrder(newIndex);
  }

  function sendGridItembackward() {
    const newIndex = gridItemIndex - 1;
    updateGridItemOrder(newIndex);
  }

  async function exportGridItem() {
    const gridItem = JSON.parse(JSON.stringify(gridItems[gridItemIndex]));

    const exportedGridItem = await handleGridItemExport(gridItem);

    try {
      downloadJSONFile(exportedGridItem, "TethysDashGridItem.json");
    } catch (err) {
      setShowGridItemWarning(true);
      setGridItemWarning("Failed to export grid item.");
    }
  }

  function copyGridItem() {
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

  function hideDataViewerModal() {
    setShowDataViewerModal(false);
    setInDataViewerMode(false);
  }

  return (
    <>
      <StyledDiv
        $isEditing={isEditing}
        $borderProps={gridItemStyling?.border}
        $backgroundColorProps={gridItemStyling?.backgroundColor}
        $boxShadowProps={gridItemStyling?.boxShadow}
        aria-label="gridItemDiv"
        className="no-caret"
      >
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
          <CustomAlert
            alertType={"warning"}
            showAlert={showGridItemWarning}
            setShowAlert={setGridItemWarning}
            alertMessage={gridItemWarning}
          />
          <BaseVisualization
            key={gridItemI}
            source={gridItemSource}
            argsString={gridItemArgsString}
            metadataString={gridItemMetadataString}
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
      </StyledDiv>
      {isEditing && (
        <StyledButtonDiv>
          <DashboardItemDropdown
            gridItemIndex={gridItemIndex}
            deleteGridItem={deleteGridItem}
            editGridItem={editGridItem}
            exportGridItem={exportGridItem}
            copyGridItem={copyGridItem}
            bringGridItemtoFront={bringGridItemtoFront}
            bringGridItemForward={bringGridItemForward}
            sendGridItemtoBack={sendGridItemtoBack}
            sendGridItembackward={sendGridItembackward}
          />
        </StyledButtonDiv>
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
