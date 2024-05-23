import styled from 'styled-components';
import Button from 'react-bootstrap/Button';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import PropTypes from 'prop-types';
import Tooltip from 'react-bootstrap/Tooltip';
import { BsTrash, BsPencilSquare  } from "react-icons/bs";


const StyledRightButton = styled(Button)`
  float: right
`;

const StyledLeftButton = styled(Button)`
  float: left
`;


const DashboardMetadataButton = ({buttonLocation, tooltipPlacement, tooltipText, onClick, type}) => {
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

  if (buttonLocation==="left") {
    styledButton = <StyledLeftButton variant={variant} onClick={onClick} size="sm">{icon}</StyledLeftButton>
  } else if (buttonLocation==="right") {
    styledButton = <StyledRightButton variant={variant} onClick={onClick} size="sm">{icon}</StyledRightButton>
  }

  const styledButtonWithTooltip = (
    <OverlayTrigger
      key={tooltipPlacement}
      placement={tooltipPlacement}
      overlay={
        <Tooltip id={`tooltip-${tooltipPlacement}`}>
          {tooltipText}
        </Tooltip>
      }
    >
      {styledButton}
    </OverlayTrigger>
  );
  return styledButtonWithTooltip;
}

DashboardMetadataButton.propTypes = {
  children: PropTypes.element,
  tooltipPlacement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
};

export default DashboardMetadataButton