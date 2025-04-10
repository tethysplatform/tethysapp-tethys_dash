import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical, BsFillCaretRightFill } from "react-icons/bs";
import { useContext, useState, useRef, useEffect } from "react";
import { LayoutContext } from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import "components/dashboard/itemDropdown.css";

const StyledDropdownToggle = styled(Dropdown.Toggle)`
  background: transparent !important;
  border: transparent !important;
  color: black !important;
  box-shadow: none !important;
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

const DashboardItemDropdown = ({
  deleteGridItem,
  editGridItem,
  exportGridItem,
  copyGridItem,
}) => {
  const { editable, unrestrictedMovement } = useContext(LayoutContext);
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

  const onMenuMouseLeave = () => {
    console.log("onBringtoFront");
    setShowMenu(false);
  };

  const onSubMenuMouseEnter = () => {
    setSubmenuVisible(true);
  };

  const onSubMenuMouseLeave = () => {
    setSubmenuVisible(false);
  };

  const onBringtoFront = () => {
    console.log("onBringtoFront");
  };

  return (
    <Dropdown
      autoClose={!activeAppTour}
      onToggle={onToggle}
      onMouseLeave={onMenuMouseLeave}
    >
      <StyledDropdownToggle
        id="dropdown-basic"
        className="dashboard-item-dropdown-toggle"
        aria-label="dashboard-item-dropdown-toggle"
      >
        <BsThreeDotsVertical />
      </StyledDropdownToggle>

      <Dropdown.Menu align="end" show={showMenu} container="body">
        {editable && (
          <>
            <Dropdown.Item
              onClick={editGridItem}
              className="dashboard-item-dropdown-edit-visualization"
            >
              Edit
            </Dropdown.Item>
            <Dropdown.Item
              onClick={copyGridItem}
              className="dashboard-item-dropdown-create-copy"
            >
              Copy
            </Dropdown.Item>
            {unrestrictedMovement && (
              <SubmenuWrapper>
                <Dropdown.Item
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                  className="card-share-option"
                  onMouseEnter={onSubMenuMouseEnter}
                  onMouseLeave={onSubMenuMouseLeave}
                >
                  Order <BsFillCaretRightFill style={{ marginLeft: "auto" }} />
                </Dropdown.Item>
                <Submenu
                  className="submenu"
                  aria-label="Context Menu Submenu"
                  position={submenuPosition}
                  isVisible={submenuVisible}
                  ref={submenuRef}
                  onMouseEnter={onSubMenuMouseEnter}
                  onMouseLeave={onSubMenuMouseLeave}
                >
                  <Dropdown.Item onClick={onBringtoFront}>
                    Bring to Front
                  </Dropdown.Item>
                </Submenu>
              </SubmenuWrapper>
            )}
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
  exportGridItem: PropTypes.func,
};

export default DashboardItemDropdown;
