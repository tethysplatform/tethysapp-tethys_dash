import PropTypes from "prop-types";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { BsInfoCircle } from "react-icons/bs";
import styled from "styled-components";

const Icon = styled(BsInfoCircle)`
  cursor: help;
  color: #6c757d;
  flex: 0 0 auto;
`;

/**
 * An info-circle icon that shows a setting's explanation on hover or keyboard
 * focus, placed to the left of the setting's label instead of a paragraph
 * under the field.
 */
const InfoTip = ({ label, children }) => (
  <OverlayTrigger
    placement="bottom"
    trigger={["hover", "focus"]}
    overlay={<Tooltip id={`${label} help tooltip`}>{children}</Tooltip>}
  >
    <span tabIndex={0} role="button" aria-label={`${label} help`}>
      <Icon size="0.95rem" />
    </span>
  </OverlayTrigger>
);

InfoTip.propTypes = {
  // The setting it explains; names the icon for assistive tech.
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default InfoTip;
