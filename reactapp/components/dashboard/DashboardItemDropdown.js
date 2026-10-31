import styled from "styled-components";
import PropTypes from "prop-types";
import Dropdown from "react-bootstrap/Dropdown";
import { BsThreeDotsVertical, BsFillCaretRightFill } from "react-icons/bs";
import {
  useContext,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import {
  GridItemContext,
  LayoutContext,
  TabContext,
} from "components/contexts/Contexts";
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
}) => {
  const { unrestrictedPlacement } = useContext(LayoutContext);
  const { getActiveTab } = useContext(TabContext);
  const [showMenu, setShowMenu] = useState(false);
  const { setItemMenuOpen } = useContext(GridItemContext) ?? {};

  // A tile removed or re-rendered away while its menu is open must not stay
  // lifted above the others.
  const showMenuRef = useRef(showMenu);
  showMenuRef.current = showMenu;
  useEffect(
    () => () => {
      if (showMenuRef.current) setItemMenuOpen?.(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  // The menu is rendered at the page root, or in the modal the tile sits in
  // (the popup layout editor): a menu at the page root would sit under the
  // modal and never be seen.
  const toggleRef = useRef(null);
  const [menuContainer, setMenuContainer] = useState(null);
  useLayoutEffect(() => {
    setMenuContainer(toggleRef.current?.closest(".modal") ?? document.body);
  }, []);

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

  // react-bootstrap calls this as onToggle(nextShow, meta) -- a boolean, not an
  // object to destructure.
  const onToggle = (nextShow) => {
    setShowMenu(nextShow);
    setItemMenuOpen?.(nextShow);
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
        ref={toggleRef}
        id="dropdown-basic"
        className="dashboard-item-dropdown-toggle"
        aria-label="dashboard-item-dropdown-toggle"
      >
        <BsThreeDotsVertical />
      </StyledDropdownToggle>

      {menuContainer &&
        createPortal(
          <Dropdown.Menu
            align="end"
            show={showMenu}
            rootCloseEvent={"mousedown"}
            // Positioned against the viewport: the menu lives at the page root,
            // so it must not depend on any tile's offset parent.
            popperConfig={{ strategy: "fixed" }}
          >
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
                    disabled={gridItemIndex === gridItems.length - 1}
                  >
                    Bring to Front
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={bringGridItemForward}
                    disabled={gridItemIndex === gridItems.length - 1}
                  >
                    Bring Forward
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={sendGridItembackward}
                    disabled={gridItemIndex === 0}
                  >
                    Send Backward
                  </Dropdown.Item>
                  <Dropdown.Item
                    onClick={sendGridItemtoBack}
                    disabled={gridItemIndex === 0}
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
            >
              Delete
            </Dropdown.Item>
          </Dropdown.Menu>,
          // Rendered outside the tile: a menu inside the tile shares its
          // stacking order and is hidden behind any tile painted over it, and
          // clipped by the tab area's overflow.
          menuContainer,
        )}
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
};

export default DashboardItemDropdown;
