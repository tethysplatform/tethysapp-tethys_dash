import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical, BsFillCaretRightFill } from "react-icons/bs";
import { useAppTourContext } from "components/contexts/AppTourContext";
import { AppContext } from "components/contexts/Contexts";
import { useState, useRef, useEffect, useContext } from "react";
import "components/dashboard/itemDropdown.css";

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

const SubmenuWrapper = styled.div`
  position: relative;
`;

const Submenu = styled.div`
  display: ${({ isVisible }) => (isVisible ? "block" : "none")};
  position: absolute;
  top: 0;
  ${({ position }) => (position === "left" ? "right: 100%;" : "left: 100%;")}
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
  onExport,
  viewDashboard,
  onShare,
  onCopyPublicLink,
  shared,
  setShowThumbnailModal,
}) => {
  const { user } = useContext(AppContext);
  const [showMenu, setShowMenu] = useState(false);
  const submenuRef = useRef(null);
  const [submenuPosition, setSubmenuPosition] = useState("right");
  const [submenuVisible, setSubmenuVisible] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();

  useEffect(() => {
    if (submenuRef.current) {
      const rect = submenuRef.current.getBoundingClientRect();
      const isOverflowing = rect.right > window.innerWidth;
      setSubmenuPosition(isOverflowing ? "left" : "right");
    }
  }, [submenuVisible]);

  const onToggle = ({ nextShow }) => {
    setShowMenu(nextShow);
    if (activeAppTour) {
      setAppTourStep((previousStep) => previousStep + 1);
    }
  };

  const onMouseEnter = () => {
    setSubmenuVisible(true);
  };

  const onMouseLeave = () => {
    setSubmenuVisible(false);
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

      <Dropdown.Menu align="start" show={showMenu} container="body">
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
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            Share <BsFillCaretRightFill style={{ marginLeft: "auto" }} />
          </Dropdown.Item>
          <Submenu
            className="submenu"
            aria-label="Context Menu Submenu"
            position={submenuPosition}
            isVisible={submenuVisible}
            ref={submenuRef}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
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
        {user?.username && (
          <Dropdown.Item onClick={onCopy} className="card-copy-option">
            Copy
          </Dropdown.Item>
        )}
        <Dropdown.Item onClick={onExport} className="card-export-option">
          Export
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
  viewDashboard: PropTypes.func,
  setIsEditingTitle: PropTypes.func,
  setIsEditingDescription: PropTypes.func,
  setShowThumbnailModal: PropTypes.func,
  onDelete: PropTypes.func,
  onCopy: PropTypes.func,
  onExport: PropTypes.func,
  onShare: PropTypes.func,
  onCopyPublicLink: PropTypes.func,
  shared: PropTypes.bool,
  editable: PropTypes.bool,
};

export default ContextMenu;
