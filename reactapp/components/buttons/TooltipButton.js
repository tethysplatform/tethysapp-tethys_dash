import styled from "styled-components";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import PropTypes from "prop-types";
import Tooltip from "react-bootstrap/Tooltip";

const StyledTooltip = styled(Tooltip)`
  position: fixed;
`;

const TooltipButton = ({
  children,
  tooltipPlacement,
  tooltipText,
  href,
  ...props
}) => {
  const styledButton = (
    <Button
      {...props}
      href={href}
      variant={props.variant ? props.variant : "info"}
      size="sm"
      className={`me-2 ${props.className}`}
    >
      {children}
    </Button>
  );
  const styledButtonWithTooltip = (
    <OverlayTrigger
      key={tooltipPlacement}
      placement={tooltipPlacement}
      trigger={["hover", "click"]}
      overlay={
        <StyledTooltip id={`tooltip-${tooltipPlacement}`}>
          {tooltipText}
        </StyledTooltip>
      }
    >
      {styledButton}
    </OverlayTrigger>
  );
  return tooltipText ? styledButtonWithTooltip : styledButton;
};

TooltipButton.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.element,
    PropTypes.object,
  ]),
  tooltipPlacement: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
  variant: PropTypes.string,
  className: PropTypes.string,
};

export default TooltipButton;
