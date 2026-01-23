import { useRef, useState } from "react";
import PropTypes from "prop-types";
import ColorPicker from "components/inputs/ColorPicker";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import styled from "styled-components";

const ColorSwatch = styled.div`
  width: 24px;
  height: 24px;
  border: 1px solid #aaa;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 2px;
  background: ${(props) => props.$color};
`;

const StyledPopoverBody = styled(Popover.Body)`
  max-height: 70vh;
  overflow-y: auto;
`;

const ColorPickerPopover = ({ label, color, onChange, containerRef }) => {
  const divTarget = useRef(null);
  const [showColorPopover, setShowColorPopover] = useState(false);

  return (
    <>
      <span style={{ fontWeight: 500 }}>
        <b>{label}</b>:
      </span>
      <ColorSwatch
        ref={divTarget}
        aria-label={`${label} color popover square`}
        onClick={() => setShowColorPopover(!showColorPopover)}
        $color={color || "#cccccc"}
        title={`Click to change ${label.toLowerCase()} color`}
      />
      <Overlay
        container={containerRef}
        target={divTarget.current}
        show={showColorPopover}
        placement="right"
        rootClose
        onHide={() => setShowColorPopover(false)}
      >
        <Popover className="color-picker-popover">
          <StyledPopoverBody>
            <ColorPicker
              hideInput={["rgb", "hsv"]}
              color={color || "#cccccc"}
              onChange={onChange}
            />
          </StyledPopoverBody>
        </Popover>
      </Overlay>
    </>
  );
};

ColorPickerPopover.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  containerRef: PropTypes.object.isRequired,
};

export default ColorPickerPopover;
