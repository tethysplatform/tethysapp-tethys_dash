import PropTypes from "prop-types";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import { memo, useState } from "react";
import { useEditingContext } from "components/contexts/EditingContext";
import DataViewerModal from "components/modals/DataViewer";
import DashboardItemDropdown from "components/buttons/DashboardItemDropdown";
import BaseVisualization from "components/visualizations/BaseVisualization";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { confirm } from "components/dashboard/DeleteConfirmation";
import CustomAlert from "components/dashboard/CustomAlert";

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

const DashboardItem = ({ grid_item, grid_item_index }) => {
  const [isEditing, setIsEditing] = useEditingContext();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [gridItemMessage, setGridItemMessage] = useState("");
  const [showGridItemMessage, setShowGridItemMessage] = useState(false);
  const gridItems = useLayoutGridItemsContext()[0];
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];

  async function deleteGridItem(e) {
    if (await confirm("Are your sure you want to delete the item?")) {
      const updated_grid_items = [...gridItems];
      updated_grid_items.splice(grid_item_index, 1);

      const layout = getLayoutContext();
      layout["gridItems"] = updated_grid_items;
      setLayoutContext(layout);
      setIsEditing(true);
    }
  }

  function onFullscreen() {
    if (grid_item.source) {
      setShowFullscreen(true);
    }
  }

  function hideFullscreen() {
    setShowFullscreen(false);
  }

  function editGridItem() {
    setShowDataViewerModal(true);
    setIsEditing(true);
  }

  function copyGridItem() {
    const layout = getLayoutContext();
    let maxGridItemI = layout["gridItems"].reduce((acc, value) => {
      return (acc = acc > value.i ? acc : value.i);
    }, 0);
    const newGridItem = { ...grid_item };
    newGridItem.i = `${parseInt(maxGridItemI) + 1}`;
    layout["gridItems"] = [...layout["gridItems"], newGridItem];
    setLayoutContext(layout);
    setIsEditing(true);
  }

  function editSize() {
    setIsEditing(true);
  }

  function hideDataViewerModal() {
    setShowDataViewerModal(false);
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
            showFullscreen={grid_item.source ? onFullscreen : null}
            deleteGridItem={deleteGridItem}
            editGridItem={editGridItem}
            editSize={isEditing ? null : editSize}
            copyGridItem={copyGridItem}
          />
        </StyledButtonDiv>
        <BaseVisualization
          source={grid_item.source}
          argsString={grid_item.args_string}
          showFullscreen={showFullscreen}
          hideFullscreen={hideFullscreen}
        />
      </StyledContainer>
      {showDataViewerModal && (
        <DataViewerModal
          grid_item_index={grid_item_index}
          source={grid_item.source}
          args_string={grid_item.args_string}
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
  grid_item: PropTypes.object,
  grid_item_index: PropTypes.number,
};

export default memo(DashboardItem);
