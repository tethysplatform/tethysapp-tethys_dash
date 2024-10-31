import Button from "react-bootstrap/Button";
import PropTypes from "prop-types";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { BsArrowClockwise } from "react-icons/bs";
import styled from "styled-components";

const StyledTooltip = styled(Tooltip)`
  position: fixed;
`;

const StyledButton = styled(Button)`
  margin-bottom: 5px;
`;

const VariableInputRefreshButton = ({ children, ...props }) => {
  const styledButton = (
    <OverlayTrigger
      placement={"bottom"}
      overlay={
        <StyledTooltip id={`tooltip-refresh`}>
          Refresh variable input
        </StyledTooltip>
      }
    >
      <StyledButton variant="warning" {...props}>
        <BsArrowClockwise />
      </StyledButton>
    </OverlayTrigger>
  );
  return styledButton;
};

VariableInputRefreshButton.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.element,
  ]),
  tooltipPlacement: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
};

export default VariableInputRefreshButton;
