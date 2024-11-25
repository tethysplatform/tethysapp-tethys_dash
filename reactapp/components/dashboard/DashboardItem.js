import PropTypes from "prop-types";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import { memo, useState } from "react";
import { useEditingContext } from "components/contexts/EditingContext";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import DashboardItemDropdown from "components/buttons/DashboardItemDropdown";
import BaseVisualization from "components/visualizations/Base";
import {
  useLayoutGridItemsContext,
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import { confirm } from "components/dashboard/DeleteConfirmation";
import { useVariableInputValuesContext } from "components/contexts/VariableInputsContext";
import { getGridItem } from "components/visualizations/utilities";
import CustomAlert from "components/dashboard/CustomAlert";
import { useDataViewerModeContext } from "components/contexts/DataViewerModeContext";

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

const DashboardItem = ({
  gridItemSource,
  gridItemI,
  gridItemArgsString,
  gridItemMetadataString,
  gridItemIndex,
}) => {
  const { isEditing, setIsEditing } = useEditingContext();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [gridItemMessage, setGridItemMessage] = useState("");
  const [showGridItemMessage, setShowGridItemMessage] = useState(false);
  const { gridItems } = useLayoutGridItemsContext();
  const { setLayoutContext, getLayoutContext } = useLayoutContext();
  const { variableInputValues, setVariableInputValues } =
    useVariableInputValuesContext();
  const { setInDataViewerMode } = useSetDataViewerModeContext();

  async function deleteGridItem(e) {
    if (await confirm("Are you sure you want to delete the item?")) {
      const updated_grid_items = [...gridItems];
      updated_grid_items.splice(gridItemIndex, 1);

      const layout = getLayoutContext();
      layout["gridItems"] = updated_grid_items;
      setLayoutContext(layout);
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
  }

  function copyGridItem() {
    const layout = getLayoutContext();
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
    layout["gridItems"] = [...layout["gridItems"], newGridItem];
    setLayoutContext(layout);
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
      <StyledContainer fluid className="h-100 gridVisualization">
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
