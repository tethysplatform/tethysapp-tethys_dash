import styled from 'styled-components';
import Button from 'react-bootstrap/Button';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import PropTypes from 'prop-types';
import Tooltip from 'react-bootstrap/Tooltip';
import { BsPlus } from "react-icons/bs";


const StyledButton = styled(Button)`
    top: 50%;
    position: absolute;
    transform: translateY(-50%);
`;


const DashboardButton = ({tooltipPlacement, tooltipText, onClick}) => {
  const styledButton = (
    <StyledButton variant="info" onClick={onClick}><BsPlus size="1.5rem"/></StyledButton>
  );
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

DashboardButton.propTypes = {
  children: PropTypes.element,
  tooltipPlacement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
};

export default DashboardButton