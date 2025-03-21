import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useContext, useState } from "react";
import { LayoutContext } from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import "components/dashboard/itemDropdown.css";

const StyledDropdownToggle = styled(Dropdown.Toggle)`
  background: transparent !important;
  border: transparent !important;
  color: black !important;
  box-shadow: none !important;
`;

const DashboardItemDropdown = ({
  showFullscreen,
  deleteGridItem,
  editGridItem,
  exportGridItem,
  editSize,
  copyGridItem,
}) => {
  const { getDashboardMetadata } = useContext(LayoutContext);
  const { editable } = getDashboardMetadata();
  const [showMenu, setShowMenu] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  const onToggle = ({ nextShow }) => {
    setShowMenu(nextShow);
    if (activeAppTour) {
      setAppTourStep((previousStep) => previousStep + 1);
    }
  };

  return (
    <Dropdown autoClose={!activeAppTour} onToggle={onToggle}>
      <StyledDropdownToggle
        id="dropdown-basic"
        className="dashboard-item-dropdown-toggle"
        aria-label="dashboard-item-dropdown-toggle"
      >
        <BsThreeDotsVertical />
      </StyledDropdownToggle>

      <Dropdown.Menu align="end" show={showMenu} container="body">
        {showFullscreen && (
          <Dropdown.Item onClick={showFullscreen}>Fullscreen</Dropdown.Item>
        )}
        {editable && (
          <>
            <Dropdown.Item
              onClick={editGridItem}
              className="dashboard-item-dropdown-edit-visualization"
            >
              Edit Visualization
            </Dropdown.Item>
            {editSize && (
              <Dropdown.Item onClick={editSize}>
                Edit Size/Location
              </Dropdown.Item>
            )}
            <Dropdown.Item
              onClick={copyGridItem}
              className="dashboard-item-dropdown-create-copy"
            >
              Create Copy
            </Dropdown.Item>
          </>
        )}
        <Dropdown.Item
          onClick={exportGridItem}
          className="dashboard-item-dropdown-export"
        >
          Export
        </Dropdown.Item>
        {editable && (
          <Dropdown.Item
            onClick={deleteGridItem}
            className="dashboard-item-dropdown-delete"
          >
            Delete
          </Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

DashboardItemDropdown.propTypes = {
  showFullscreen: PropTypes.func,
  deleteGridItem: PropTypes.func,
  editGridItem: PropTypes.func,
  editSize: PropTypes.func,
  copyGridItem: PropTypes.func,
};

export default DashboardItemDropdown;
