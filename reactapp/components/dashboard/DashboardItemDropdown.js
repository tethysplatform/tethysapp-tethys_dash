import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical, BsFillCaretRightFill } from "react-icons/bs";
import { useContext, useState, useRef, useEffect } from "react";
import { LayoutContext, TabContext } from "components/contexts/Contexts";
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
  display: ${({ $isVisible }) => ($isVisible ? "block" : "none")};
  position: absolute;
  top: 0;
  ${({ $position }) => ($position === "left" ? "right: 100%;" : "left: 100%;")}
  background: white;
  border: 1px solid #ddd;
  box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
  min-width: 150px;
  padding: 5px 0;
`;

// Plan 2026-05-28-002 Unit 7 — when isStreaming is true, edit/delete/order
// menu items render in a disabled state with a consistent tooltip. Copy /
// Export are NOT gated — they don't mutate tile config so they can't race
// the LLM's patch_visualization. Handlers are also gated upstream in
// DashboardItem (defense in depth: visual + behavior).
const STREAMING_DISABLED_TITLE = "Editing disabled while dashboard is updating";

const DashboardItemDropdown = ({
  gridItemIndex,
  deleteGridItem,
  editGridItem,
  exportGridItem,
  copyGridItem,
  bringGridItemtoFront,
  bringGridItemForward,
  sendGridItemtoBack,
  sendGridItembackward,
  isStreaming = false,
}) => {
  const { unrestrictedPlacement } = useContext(LayoutContext);
  const { getActiveTab } = useContext(TabContext);
  const [showMenu, setShowMenu] = useState(false);
  const submenuRef = useRef(null);
  const [submenuPosition, setSubmenuPosition] = useState("right");
  const [submenuVisible, setSubmenuVisible] = useState(false);
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const { gridItems } = getActiveTab();

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

  const onSubMenuMouseEnter = () => {
    setSubmenuVisible(true);
  };

  const onSubMenuMouseLeave = () => {
    setSubmenuVisible(false);
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

      <Dropdown.Menu
        align="end"
        show={showMenu}
        container="body"
        rootCloseEvent={"mousedown"}
      >
        <Dropdown.Item
          onClick={editGridItem}
          className="dashboard-item-dropdown-edit-visualization"
          disabled={isStreaming}
          title={isStreaming ? STREAMING_DISABLED_TITLE : undefined}
        >
          Edit
        </Dropdown.Item>
        <Dropdown.Item
          onClick={copyGridItem}
          className="dashboard-item-dropdown-create-copy"
        >
          Copy
        </Dropdown.Item>
        {unrestrictedPlacement && (
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
              $position={submenuPosition}
              $isVisible={submenuVisible}
              ref={submenuRef}
              onMouseEnter={onSubMenuMouseEnter}
              onMouseLeave={onSubMenuMouseLeave}
            >
              <Dropdown.Item
                onClick={bringGridItemtoFront}
                disabled={isStreaming || gridItemIndex === gridItems.length - 1}
                title={isStreaming ? STREAMING_DISABLED_TITLE : undefined}
              >
                Bring to Front
              </Dropdown.Item>
              <Dropdown.Item
                onClick={bringGridItemForward}
                disabled={isStreaming || gridItemIndex === gridItems.length - 1}
                title={isStreaming ? STREAMING_DISABLED_TITLE : undefined}
              >
                Bring Forward
              </Dropdown.Item>
              <Dropdown.Item
                onClick={sendGridItembackward}
                disabled={isStreaming || gridItemIndex === 0}
                title={isStreaming ? STREAMING_DISABLED_TITLE : undefined}
              >
                Send Backward
              </Dropdown.Item>
              <Dropdown.Item
                onClick={sendGridItemtoBack}
                disabled={isStreaming || gridItemIndex === 0}
                title={isStreaming ? STREAMING_DISABLED_TITLE : undefined}
              >
                Send to Back
              </Dropdown.Item>
            </Submenu>
          </SubmenuWrapper>
        )}
        <Dropdown.Item
          onClick={exportGridItem}
          className="dashboard-item-dropdown-export"
        >
          Export
        </Dropdown.Item>
        <Dropdown.Item
          onClick={deleteGridItem}
          className="dashboard-item-dropdown-delete"
          disabled={isStreaming}
          title={isStreaming ? STREAMING_DISABLED_TITLE : undefined}
        >
          Delete
        </Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  );
};

DashboardItemDropdown.propTypes = {
  gridItemIndex: PropTypes.number,
  deleteGridItem: PropTypes.func,
  editGridItem: PropTypes.func,
  editSize: PropTypes.func,
  copyGridItem: PropTypes.func,
  exportGridItem: PropTypes.func,
  bringGridItemtoFront: PropTypes.func,
  bringGridItemForward: PropTypes.func,
  sendGridItemtoBack: PropTypes.func,
  sendGridItembackward: PropTypes.func,
  isStreaming: PropTypes.bool,
};

export default DashboardItemDropdown;
