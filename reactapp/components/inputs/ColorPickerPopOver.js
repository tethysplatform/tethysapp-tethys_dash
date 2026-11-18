import { useRef, useState } from "react";
import PropTypes from "prop-types";
import ColorPicker from "components/inputs/ColorPicker";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import styled from "styled-components";

const FlexDiv = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

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

const ColorPickerPopover = ({
  label,
  color,
  pickerColor,
  onChange,
  containerRef,
  divProps,
  hideLabel = false,
  onClose,
  flip = false,
}) => {
  const divTarget = useRef(null);
  const [showColorPopover, setShowColorPopover] = useState(false);
  // Read by `close`: one click on the swatch can close the picker twice --
  // the swatch's own handler, then the overlay's root close for a click
  // outside it -- and `onClose` must fire once.
  const openRef = useRef(false);
  openRef.current = showColorPopover;
  const close = () => {
    if (!openRef.current) return;
    openRef.current = false;
    setShowColorPopover(false);
    onClose?.();
  };

  return (
    <FlexDiv {...divProps}>
      {/* `label` still names the control for assistive tech and the tooltip
          even when it is not drawn — useful in a table that already has a
          column header saying what the swatch is. */}
      {!hideLabel && (
        <span style={{ fontWeight: 500 }}>
          <b>{label}</b>:
        </span>
      )}
      <ColorSwatch
        ref={divTarget}
        aria-label={`${label} color popover square`}
        onClick={() => (showColorPopover ? close() : setShowColorPopover(true))}
        $color={color || "#cccccc"}
        title={`Click to change ${label.toLowerCase()} color`}
      />
      <Overlay
        container={containerRef}
        target={divTarget.current}
        show={showColorPopover}
        placement="right"
        flip={flip}
        rootClose
        onHide={close}
      >
        <Popover className="color-picker-popover">
          <StyledPopoverBody>
            <ColorPicker
              hideInput={["rgb", "hsv"]}
              color={pickerColor || color || "#cccccc"}
              onChange={onChange}
            />
          </StyledPopoverBody>
        </Popover>
      </Overlay>
    </FlexDiv>
  );
};

ColorPickerPopover.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  // Where the picker opens, when that should differ from what the swatch
  // shows -- e.g. a transparent "none" swatch whose picker starts opaque, since
  // the picker keeps the current alpha as the author moves through hues.
  pickerColor: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  containerRef: PropTypes.object.isRequired,
  divProps: PropTypes.object,
  // Hide the visible label text; the accessible name is unaffected.
  hideLabel: PropTypes.bool,
  // Called when the picker closes, for a caller that keeps one change per
  // pick rather than one per step of a drag through the colors.
  onClose: PropTypes.func,
  // Open on the left instead when the right has no room for the picker.
  // Off by default: placement is otherwise always to the right.
  flip: PropTypes.bool,
};

export default ColorPickerPopover;
