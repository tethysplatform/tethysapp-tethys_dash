import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical, BsFillCaretRightFill } from "react-icons/bs";
import { useAppTourContext } from "components/contexts/AppTourContext";
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

const StyledDropdownMenu = styled(Dropdown.Menu)`
  position: absolute;
  z-index: 1000;
`;

const SubmenuWrapper = styled.div`
  position: relative;

  &:hover .submenu {
    display: block;
  }
`;

const Submenu = styled.div`
  display: none;
  position: absolute;
  top: 0;
  left: 100%;
  background: white;
  border: 1px solid #ddd;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
  min-width: 150px;
  padding: 5px 0;
`;

const ContextMenu = ({
  editable,
  setIsEditingTitle,
  setIsEditingDescription,
  onDelete,
  onCopy,
  viewDashboard,
  onShare,
  onCopyPublicLink,
  shared,
  setShowThumbnailModal,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const { appTourStep, setAppTourStep, activeAppTour, setActiveAppTour } =
    useAppTourContext();

  const onToggle = ({ nextShow }) => {
    setShowMenu(nextShow);
    if (activeAppTour) {
      setAppTourStep((previousStep) => previousStep + 1);
    }
  };

  return (
    <Dropdown
      autoClose={!activeAppTour}
      onToggle={onToggle}
      className="card-header-menu"
    >
      <StyledDropdownToggle
        id="dropdown-basic"
        className="dashboard-item-dropdown-toggle"
        aria-label="dashboard-item-dropdown-toggle"
      >
        <BsThreeDotsVertical />
      </StyledDropdownToggle>

      <Dropdown.Menu align="start" show={showMenu}>
        <Dropdown.Item onClick={viewDashboard} className="card-open-option">
          Open
        </Dropdown.Item>
        {editable && (
          <>
            <Dropdown.Item
              onClick={() => setIsEditingTitle(true)}
              className="card-rename-option"
            >
              Rename
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setIsEditingDescription(true)}
              className="card-update-description-option"
            >
              Update Description
            </Dropdown.Item>
            <Dropdown.Item
              onClick={() => setShowThumbnailModal(true)}
              className="card-update-thumbnail-option"
            >
              Update Thumbnail
            </Dropdown.Item>
          </>
        )}
        <SubmenuWrapper>
          <Dropdown.Item
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
            className="card-share-option"
          >
            Share <BsFillCaretRightFill style={{ marginLeft: "auto" }} />
          </Dropdown.Item>
          <Submenu className="submenu">
            {editable && (
              <Dropdown.Item onClick={onShare}>
                {shared ? "Make Private" : "Make Public"}
              </Dropdown.Item>
            )}
            {shared && (
              <Dropdown.Item onClick={onCopyPublicLink}>
                Copy Public URL
              </Dropdown.Item>
            )}
          </Submenu>
        </SubmenuWrapper>
        <Dropdown.Item onClick={onCopy} className="card-copy-option">
          Copy
        </Dropdown.Item>
        {editable && (
          <>
            <Dropdown.Item onClick={onDelete} className="card-delete-option">
              Delete
            </Dropdown.Item>
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
