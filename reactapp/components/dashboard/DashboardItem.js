import PropTypes from "prop-types";
import styled from "styled-components";
import Container from "react-bootstrap/Container";
import { memo, useState, useEffect } from "react";
import { useEditingContext } from "components/contexts/EditingContext";
import DataViewerModal from "components/modals/DataViewer";
import DashboardItemDropdown from "components/buttons/DashboardItemDropdown";
import BaseVisualization from "components/visualizations/BaseVisualization";
import Alert from "react-bootstrap/Alert";
import { useLayoutGridItemsContext } from "components/contexts/SelectedDashboardContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { confirm } from "components/dashboard/DeleteConfirmation";

const StyledAlert = styled(Alert)`
  position: absolute;
  z-index: 1081;
`;

const StyledContainer = styled(Container)`
  position: relative;
  padding: 0;
  overflow: hidden;
`;

const StyledButtonDiv = styled.div`
  position: absolute;
  z-index: 1;
  margin: 0.5rem;
  right: 0;
`;

function UpdateMessage({ showUpdateMessage, updateMessage }) {
  if (showUpdateMessage) {
    return (
      <StyledAlert key="success" variant="success" dismissible={true}>
        {updateMessage}
      </StyledAlert>
    );
  } else {
    return null;
  }
}

const DashboardItem = ({ grid_item_id, source, args_string }) => {
  const [isEditing, setIsEditing] = useEditingContext();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [updateMessage, setUpdateCellMessage] = useState(false);
  const [showUpdateMessage, setShowUpdateCellMessage] = useState(false);
  const gridItems = useLayoutGridItemsContext()[0];
  const setLayoutContext = useLayoutContext()[0];
  const getLayoutContext = useLayoutContext()[2];

  useEffect(() => {
    if (showUpdateMessage === true) {
      window.setTimeout(() => {
        setShowUpdateCellMessage(false);
      }, 5000);
    }
  }, [showUpdateMessage]);

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
        <UpdateMessage
          showUpdateMessage={showUpdateMessage}
          updateMessage={updateMessage}
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
          showModal={showDataViewerModal}
          handleModalClose={hideDataViewerModal}
          setUpdateCellMessage={setUpdateCellMessage}
          setShowUpdateCellMessage={setShowUpdateCellMessage}
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

UpdateMessage.propTypes = {
  showUpdateMessage: PropTypes.bool,
  updateMessage: PropTypes.bool,
};

export default memo(DashboardItem);
