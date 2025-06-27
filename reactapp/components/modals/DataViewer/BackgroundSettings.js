import styled from "styled-components";
import PropTypes from "prop-types";
import { BsFillSquareFill } from "react-icons/bs";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import ColorPicker from "components/inputs/ColorPicker";
import { useState, useRef } from "react";

const StyledPopoverBody = styled(Popover.Body)`
  max-height: 70vh;
  overflow-y: auto;
`;

const StyledLabel = styled.label`
  width: 100%;
  padding: 0.5rem;
`;

const BorderedDiv = styled.div`
  margin-left: 0.5rem;
`;

const FlexLabel = styled.label`
  display: flex;
  alignitems: center;
  margin-bottom: 0.5rem;
`;

const BackgroundOverlay = ({
  target,
  show,
  setShow,
  backgroundColor,
  onColorChange,
}) => {
  return (
    <Overlay
      target={target}
      show={show}
      placement="right"
      rootClose={true}
      onHide={() => setShow(false)}
      container={target}
    >
      <Popover className="color-picker-popover">
        <StyledPopoverBody>
          <StyledLabel>
            <b>Color</b>:{" "}
            <ColorPicker
              hideInput={["rgb", "hsv"]}
              color={backgroundColor}
              onChange={onColorChange}
            />
          </StyledLabel>
        </StyledPopoverBody>
      </Popover>
    </Overlay>
  );
};

const ButtonWithOverlay = ({ backgroundColor, onColorChange }) => {
  const [showPopover, setShowPopover] = useState(false);
  const colorTarget = useRef(null);

  return (
    <>
      <BorderedDiv
        ref={colorTarget}
        onClick={() => setShowPopover(!showPopover)}
        aria-label="Background Color Selector"
      >
        <BsFillSquareFill
          color={backgroundColor}
          size={"1rem"}
          style={{ stroke: "black", strokeWidth: "2px" }}
        />
      </BorderedDiv>
      <BackgroundOverlay
        target={colorTarget.current}
        show={showPopover}
        setShow={setShowPopover}
        backgroundColor={backgroundColor}
        onColorChange={onColorChange}
      />
    </>
  );
};

const BackgroundSettings = ({ backgroundColor, setBackgroundColor }) => {
  return (
    <FlexLabel className="no-caret">
      <b>Background Color</b>:
      <ButtonWithOverlay
        backgroundColor={backgroundColor}
        onColorChange={(changedColor) => setBackgroundColor(changedColor)}
      />
    </FlexLabel>
  );
};

BackgroundOverlay.propTypes = {
  target: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.arrayOf(PropTypes.object),
    PropTypes.node,
    PropTypes.object,
    PropTypes.instanceOf(Element),
  ]),
  show: PropTypes.bool,
  setShow: PropTypes.func,
  backgroundColor: PropTypes.string,
  onColorChange: PropTypes.func,
};

ButtonWithOverlay.propTypes = {
  backgroundColor: PropTypes.string,
  onColorChange: PropTypes.func,
};

BackgroundSettings.propTypes = {
  backgroundColor: PropTypes.string,
  setBackgroundColor: PropTypes.func,
};

export default BackgroundSettings;
