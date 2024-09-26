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
`;

const DashboardItem = ({ grid_item_id, source, args_string }) => {
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
      const grid_item_index = updated_grid_items.findIndex(
        (gridItem) => gridItem.i === grid_item_id
      );
      updated_grid_items.splice(grid_item_index, 1);

      const layout = getLayoutContext();
      layout["gridItems"] = updated_grid_items;
      setLayoutContext(layout);
      setIsEditing(true);
    }
  }

  function onFullscreen() {
    const grid_item_index = gridItems.findIndex(
      (gridItem) => gridItem.i === grid_item_id
    );
    if (gridItems[grid_item_index].source) {
      setShowFullscreen(true);
    }
  }

  function checkGridItemSource() {
    const grid_item_index = gridItems.findIndex(
      (gridItem) => gridItem.i === grid_item_id
    );
    if (grid_item_index === -1) {
      return false;
    } else if (gridItems[grid_item_index].source || null) {
      return true;
    } else {
      return false;
    }
  }

  function hideFullscreen() {
    setShowFullscreen(false);
  }

  function editGridItem() {
    setShowDataViewerModal(true);
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
            showFullscreen={checkGridItemSource() ? onFullscreen : null}
            deleteGridItem={deleteGridItem}
            editGridItem={editGridItem}
            editSize={isEditing ? null : editSize}
          />
        </StyledButtonDiv>
        <BaseVisualization
          source={source}
          argsString={args_string}
          showFullscreen={showFullscreen}
          hideFullscreen={hideFullscreen}
        />
      </StyledContainer>
      {showDataViewerModal && (
        <DataViewerModal
          grid_item_id={grid_item_id}
          source={source}
          args_string={args_string}
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
  grid_item_id: PropTypes.string,
  source: PropTypes.string,
  args_string: PropTypes.string,
};

export default memo(DashboardItem);
