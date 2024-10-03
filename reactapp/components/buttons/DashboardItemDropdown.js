import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useLayoutEditableContext } from "components/contexts/SelectedDashboardContext";
import "components/buttons/itemDropdown.css";

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
  editSize,
  copyGridItem,
}) => {
  const editableDashboard = useLayoutEditableContext();
  return (
    <Dropdown>
      <StyledDropdownToggle id="dropdown-basic">
        <BsThreeDotsVertical />
      </StyledDropdownToggle>

      <Dropdown.Menu align="end">
        {showFullscreen && (
          <Dropdown.Item onClick={showFullscreen}>Fullscreen</Dropdown.Item>
        )}
        {editableDashboard && (
          <>
            <Dropdown.Item onClick={editGridItem}>
              Edit Visualization
            </Dropdown.Item>
            {editSize && (
              <Dropdown.Item onClick={editSize}>
                Edit Size/Location
              </Dropdown.Item>
            )}
            <Dropdown.Item onClick={copyGridItem}>Create Copy</Dropdown.Item>
            <Dropdown.Item onClick={deleteGridItem}>Delete</Dropdown.Item>
          </>
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
