import styled from 'styled-components';
import Button from 'react-bootstrap/Button';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import PropTypes from 'prop-types';
import Tooltip from 'react-bootstrap/Tooltip';
import { BsTrash, BsPencilSquare, BsSave, BsFileText, BsPlusLg, BsXLg } from "react-icons/bs";


const StyledButton = styled(Button)`
  margin: 0 .5rem !important;
`;


const DashboardMetadataButton = ({tooltipPlacement, tooltipText, onClick, type, form}) => {
  let icon;
  let variant;
  let styledButton;
  if (type==="delete") {
    icon = <BsTrash size="1rem"/>
    variant = "danger"
  } else if (type==="edit") {
    icon = <BsPencilSquare size="1rem"/>
    variant = "warning"
  } else if (type==="save") {
    icon = <BsSave size="1rem"/>
    variant = "success"
  } else if (type==="notes") {
    icon = <BsFileText size="1rem"/>
    variant = "info"
  } else if (type==="add") {
    icon = <BsPlusLg size="1rem"/>
    variant = "info"
  } else if (type==="cancel") {
    icon = <BsXLg size="1rem"/>
    variant = "warning"
  }

  {type==="save" ? 
    styledButton = <StyledButton variant={variant} onClick={onClick} size="sm" type="submit" form={form}>{icon}</StyledButton> :
    styledButton = <StyledButton variant={variant} onClick={onClick} size="sm">{icon}</StyledButton>
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