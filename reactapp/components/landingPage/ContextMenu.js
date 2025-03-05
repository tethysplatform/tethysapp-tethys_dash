import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical } from "react-icons/bs";
import { useState } from "react";
import "components/buttons/itemDropdown.css";

const StyledDropdownToggle = styled(Dropdown.Toggle)`
  background: transparent !important;
  border: transparent !important;
  color: black !important;
  box-shadow: none !important;
  width: 1rem;
  height: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
`;

const ContextMenu = ({
  editable,
  setIsEditingTitle,
  setIsEditingDescription,
  onDelete,
  onCopy,
  viewDashboard,
  onShare,
  shared,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const onToggle = ({ nextShow }) => {
    setShowMenu(nextShow);
  };

  return (
    <Dropdown onToggle={onToggle}>
      <StyledDropdownToggle
        id="dropdown-basic"
        className="dashboard-item-dropdown-toggle"
        aria-label="dashboard-item-dropdown-toggle"
      >
        <BsThreeDotsVertical />
      </StyledDropdownToggle>

      <Dropdown.Menu align="start" show={showMenu}>
        <Dropdown.Item onClick={viewDashboard}>Open</Dropdown.Item>
        {editable && (
          <>
            <Dropdown.Item onClick={() => setIsEditingTitle(true)}>
              Rename
            </Dropdown.Item>
            <Dropdown.Item onClick={() => setIsEditingDescription(true)}>
              Update Description
            </Dropdown.Item>
            <Dropdown.Item>Update Thumbnail</Dropdown.Item>
            <Dropdown.Item onClick={onShare}>
              {shared ? "Make Private" : "Make Public"}
            </Dropdown.Item>
          </>
        )}
        <Dropdown.Item onClick={onCopy}>Copy</Dropdown.Item>
        {editable && (
          <>
            <Dropdown.Item onClick={onDelete}>Delete</Dropdown.Item>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

ContextMenu.propTypes = {
  showFullscreen: PropTypes.func,
  deleteGridItem: PropTypes.func,
  editGridItem: PropTypes.func,
  editSize: PropTypes.func,
  copyGridItem: PropTypes.func,
};

export default ContextMenu;
