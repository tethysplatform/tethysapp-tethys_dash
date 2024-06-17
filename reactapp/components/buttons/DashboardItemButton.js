import styled from 'styled-components';
import Button from 'react-bootstrap/Button';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import PropTypes from 'prop-types';
import Tooltip from 'react-bootstrap/Tooltip';
import { BsTrash, BsPencilSquare  } from "react-icons/bs";


const StyledButton = styled(Button) `
  float: left;
  margin-left: 10px;
`;


const DashboardItemButton = ({tooltipText, onClick, type, hidden}) => {
  let icon
  let variant
  let styledButton
  if (type==="delete") {
    icon = <BsTrash size="1rem"/>
    variant = "danger"
  } else if (type==="edit") {
    icon = <BsPencilSquare size="1rem"/>
    variant = "warning"
  }

  styledButton = <StyledButton variant={variant} onClick={onClick} size="sm" hidden={hidden}>{icon}</StyledButton>

  const styledButtonWithTooltip = (
    <OverlayTrigger
      key={"bottom"}
      placement={"bottom"}
      overlay={
        <Tooltip id={"tooltip-bottom"}>
          {tooltipText}
        </Tooltip>
      }
    >
      {styledButton}
    </OverlayTrigger>
  );
  return styledButtonWithTooltip;
}

DashboardItemButton.propTypes = {
  children: PropTypes.element,
  tooltipPlacement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
};

export default DashboardItemButton