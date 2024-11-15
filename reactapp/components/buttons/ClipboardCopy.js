import Button from "react-bootstrap/Button";
import PropTypes from "prop-types";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { BsClipboard } from "react-icons/bs";
import styled from "styled-components";

const StyledTooltip = styled(Tooltip)`
  position: fixed;
`;

const StyledButton = styled(Button)`
  margin-bottom: 5px;
`;

const ClipboardCopyButton = ({ success, ...props }) => {
  const styledButton = (
    <OverlayTrigger
      placement={"right"}
      overlay={
        success === null ? (
          <StyledTooltip id={`tooltip-refresh`}>
            Copy to clipboard
          </StyledTooltip>
        ) : success ? (
          <StyledTooltip id={`tooltip-refresh`}>Copied</StyledTooltip>
        ) : (
          <StyledTooltip id={`tooltip-refresh`}>Failed to Copy</StyledTooltip>
        )
      }
    >
      <StyledButton variant="warning" {...props}>
        <BsClipboard />
      </StyledButton>
    </OverlayTrigger>
  );
  return styledButton;
};

ClipboardCopyButton.propTypes = {
  success: PropTypes.bool,
  tooltipPlacement: PropTypes.oneOf(["top", "bottom", "left", "right"]),
  tooltipText: PropTypes.string,
  href: PropTypes.string,
};

export default ClipboardCopyButton;
