import Button from "react-bootstrap/Button";
import ButtonGroup from "react-bootstrap/ButtonGroup";
import ButtonToolbar from "react-bootstrap/ButtonToolbar";
import styled from "styled-components";
import PropTypes from "prop-types";
import {
  CgBorderLeft,
  CgBorderTop,
  CgBorderRight,
  CgBorderBottom,
  CgBorderAll,
} from "react-icons/cg";
import Overlay from "react-bootstrap/Overlay";
import Popover from "react-bootstrap/Popover";
import ColorPicker from "components/inputs/ColorPicker";
import DataSelect from "components/inputs/DataSelect";
import NormalInput from "components/inputs/NormalInput";
import { useState, useRef } from "react";

const StyledDiv = styled.div`
  margin-bottom: 1rem;
  justify-content: center;
  display: flex;
`;

const StyledPopoverBody = styled(Popover.Body)`
  max-height: 70vh;
  overflow-y: auto;
`;

const StyledLabel = styled.label`
  width: 100%;
  padding: 0.5rem;
`;

const FlexDiv = styled.div`
  display: flex;
  width: 100%;
`;

const Flex1Label = styled.label`
  flex: 1;
  margin-right: 1rem;
`;

const WidthLabel = styled.label`
  width: 30%;
`;

const BackgroundColorButton = styled(Button)`
  background-color: ${(props) =>
    props.$Style?.value && props.$Style.value !== "none"
      ? "rgb(206 206 206)"
      : "transparent"};
`;

const borderStyles = [
  { value: "none", label: "none" },
  { value: "dotted", label: "dotted" },
  { value: "dashed", label: "dashed" },
  { value: "solid", label: "solid" },
  { value: "double", label: "double" },
  { value: "groove", label: "groove" },
  { value: "ridge", label: "ridge" },
  { value: "inset", label: "inset" },
  { value: "outset", label: "outset" },
];

const BorderOverlay = ({
  target,
  show,
  setShow,
  side,
  borderData,
  onStyleChange,
  onStyleWidth,
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
          <FlexDiv>
            <Flex1Label>
              <b>Style</b>:{" "}
              <DataSelect
                selectedOption={borderData.style}
                onChange={(changedStyle) => onStyleChange(changedStyle, side)}
                options={borderStyles}
              />
            </Flex1Label>
            <WidthLabel>
              <b>Width</b>:{" "}
              <NormalInput
                onChange={(e) => onStyleWidth(e.target.value, side)}
                value={borderData.width}
                type="number"
                ariaLabel="Width Input"
              />
            </WidthLabel>
          </FlexDiv>
          <StyledLabel>
            <b>Color</b>:{" "}
            <ColorPicker
              hideInput={["rgb", "hsv"]}
              color={borderData.color}
              onChange={(changedColor) => onColorChange(changedColor, side)}
            />
          </StyledLabel>
        </StyledPopoverBody>
      </Popover>
    </Overlay>
  );
};

const ButtonWithOverlay = ({
  children,
  side,
  borderData,
  onStyleChange,
  onStyleWidth,
  onColorChange,
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const borderRef = useRef(null);

  return (
    <>
      <BackgroundColorButton
        variant="outline-secondary"
        ref={borderRef}
        onClick={() => setShowPopover(!showPopover)}
        $Style={side !== "all" && borderData.style}
        aria-label={`${side} Border Button`}
      >
        {children}
      </BackgroundColorButton>
      <BorderOverlay
        target={borderRef.current}
        show={showPopover}
        setShow={setShowPopover}
        side={side}
        borderData={borderData}
        onStyleChange={onStyleChange}
        onStyleWidth={onStyleWidth}
        onColorChange={onColorChange}
      />
    </>
  );
};

const BorderSettings = ({ border, setBorder }) => {
  const onColorChange = (changedColor, side) => {
    if (side === "all") {
      setBorder((prevBorder) => {
        const updatedBorder = {};
        for (const borderSide of ["left", "right", "top", "bottom", "all"]) {
          updatedBorder[borderSide] = {
            ...prevBorder[borderSide],
            color: changedColor,
          };
        }
        return updatedBorder;
      });
    } else {
      setBorder((prevBorder) => ({
        ...prevBorder,
        [side]: {
          ...prevBorder[side],
          color: changedColor,
        },
      }));
    }
  };

  const onStyleChange = (changedStyle, side) => {
    if (side === "all") {
      setBorder((prevBorder) => {
        const updatedBorder = {};
        for (const borderSide of ["left", "right", "top", "bottom", "all"]) {
          updatedBorder[borderSide] = {
            ...prevBorder[borderSide],
            style: changedStyle,
          };
        }
        return updatedBorder;
      });
    } else {
      setBorder((prevBorder) => ({
        ...prevBorder,
        [side]: {
          ...prevBorder[side],
          style: changedStyle,
        },
      }));
    }
  };

  const onStyleWidth = (changedWidth, side) => {
    if (side === "all") {
      setBorder((prevBorder) => {
        const updatedBorder = {};
        for (const borderSide of ["left", "right", "top", "bottom", "all"]) {
          updatedBorder[borderSide] = {
            ...prevBorder[borderSide],
            width: changedWidth,
          };
        }
        return updatedBorder;
      });
    } else {
      setBorder((prevBorder) => ({
        ...prevBorder,
        [side]: {
          ...prevBorder[side],
          width: changedWidth,
        },
      }));
    }
  };

  const removeBoundaries = () => {
    setBorder((prevBorder) => {
      const updatedBorder = {};
      for (const side in prevBorder) {
        updatedBorder[side] = {
          ...prevBorder[side],
          style: { value: "none", label: "none" },
        };
      }
      return updatedBorder;
    });
  };

  return (
    <>
      <label className="no-caret">
        <b>Border</b>:
      </label>
      <StyledDiv>
        <ButtonToolbar>
          <ButtonGroup className="me-2" aria-label="None or All Borders">
            <Button
              variant="outline-secondary"
              aria-label="Remove Borders"
              onClick={removeBoundaries}
            >
              <CgBorderAll size="1.5rem" color="#d6d6d6" />
            </Button>
            <ButtonWithOverlay
              borderData={border.all}
              onStyleChange={onStyleChange}
              onStyleWidth={onStyleWidth}
              onColorChange={onColorChange}
              side="all"
            >
              <CgBorderAll size="1.5rem" />
            </ButtonWithOverlay>
          </ButtonGroup>
          <ButtonGroup aria-label="Individual Borders">
            <ButtonWithOverlay
              borderData={border.left}
              onStyleChange={onStyleChange}
              onStyleWidth={onStyleWidth}
              onColorChange={onColorChange}
              side="left"
            >
              <CgBorderLeft
                size="1.5rem"
                color={
                  border.left.style.value !== "none"
                    ? border.left.color
                    : undefined
                }
              />
            </ButtonWithOverlay>
            <ButtonWithOverlay
              borderData={border.top}
              onStyleChange={onStyleChange}
              onStyleWidth={onStyleWidth}
              onColorChange={onColorChange}
              side="top"
            >
              <CgBorderTop
                size="1.5rem"
                color={
                  border.top.style.value !== "none"
                    ? border.top?.color
                    : undefined
                }
              />
            </ButtonWithOverlay>
            <ButtonWithOverlay
              borderData={border.right}
              onStyleChange={onStyleChange}
              onStyleWidth={onStyleWidth}
              onColorChange={onColorChange}
              side="right"
            >
              <CgBorderRight
                size="1.5rem"
                color={
                  border.right.style.value !== "none"
                    ? border.right?.color
                    : undefined
                }
              />
            </ButtonWithOverlay>
            <ButtonWithOverlay
              borderData={border.bottom}
              onStyleChange={onStyleChange}
              onStyleWidth={onStyleWidth}
              onColorChange={onColorChange}
              side="bottom"
            >
              <CgBorderBottom
                size="1.5rem"
                color={
                  border.bottom.style.value !== "none"
                    ? border.bottom?.color
                    : undefined
                }
              />
            </ButtonWithOverlay>
          </ButtonGroup>
        </ButtonToolbar>
      </StyledDiv>
    </>
  );
};

const sideProps = PropTypes.shape({
  color: PropTypes.string,
  width: PropTypes.number,
  style: PropTypes.shape({
    value: PropTypes.string,
    label: PropTypes.string,
  }),
});

BorderOverlay.propTypes = {
  target: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.arrayOf(PropTypes.object),
    PropTypes.node,
    PropTypes.object,
    PropTypes.instanceOf(Element),
  ]),
  show: PropTypes.bool,
  setShow: PropTypes.func,
  side: PropTypes.string,
  borderData: sideProps,
  onStyleChange: PropTypes.func,
  onStyleWidth: PropTypes.func,
  onColorChange: PropTypes.func,
};

ButtonWithOverlay.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.arrayOf(PropTypes.object),
    PropTypes.node,
    PropTypes.object,
    PropTypes.instanceOf(Element),
  ]),
  side: PropTypes.string,
  borderData: sideProps,
  onStyleChange: PropTypes.func,
  onStyleWidth: PropTypes.func,
  onColorChange: PropTypes.func,
};

BorderSettings.propTypes = {
  border: PropTypes.shape({
    all: sideProps,
    top: sideProps,
    bottom: sideProps,
    left: sideProps,
    right: sideProps,
  }),
  setBorder: PropTypes.func,
};

export default BorderSettings;
