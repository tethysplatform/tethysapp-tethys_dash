import { useState } from "react";
import styled from "styled-components";
import {
  BsFillTriangleFill,
  BsFillSquareFill,
  BsFillCircleFill,
} from "react-icons/bs";
import { RiRectangleFill } from "react-icons/ri";
import { IoAnalyticsOutline } from "react-icons/io5";
import { FaTimes, FaListUl } from "react-icons/fa";
import PropTypes from "prop-types";

const LegendWrapper = styled.div`
  position: absolute;
  bottom: 1rem;
  left: 1rem;
`;

const LegendControlContainer = styled.div`
  background-color: white;
  padding: ${(props) => (props.$isexpanded ? "10px" : "5px")};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: ${(props) => (props.$isexpanded ? "13vw" : "40px")};
  max-width: "20vw";
  height: ${(props) => (props.$isexpanded ? "auto" : "40px")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
`;

const ControlButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  position: absolute;
  top: 5px;
  right: 5px;
`;

const RightTriangle = styled(BsFillTriangleFill)`
  transform: rotate(90deg);
`;

const DownTriangle = styled(BsFillTriangleFill)`
  transform: rotate(180deg);
`;

const LeftTriangle = styled(BsFillTriangleFill)`
  transform: rotate(270deg);
`;

export const legendSymbols = {
  square: () => <BsFillSquareFill />,
  circle: () => <BsFillCircleFill />,
  upTriangle: () => <BsFillTriangleFill />,
  rightTriangle: () => <RightTriangle />,
  downTriangle: () => <DownTriangle />,
  leftTriangle: () => <LeftTriangle />,
  rectangle: () => <RiRectangleFill />,
  line: () => <IoAnalyticsOutline />,
};

export const getLegendSymbol = (symbol, color) => {
  if (symbol === "circle") {
    return <BsFillCircleFill color={color} />;
  } else if (symbol === "upTriangle") {
    return <BsFillTriangleFill color={color} />;
  } else if (symbol === "rightTriangle") {
    return <RightTriangle color={color} />;
  } else if (symbol === "downTriangle") {
    return <DownTriangle color={color} />;
  } else if (symbol === "leftTriangle") {
    return <LeftTriangle color={color} />;
  } else if (symbol === "rectangle") {
    return <RiRectangleFill color={color} />;
  } else if (symbol === "line") {
    return <IoAnalyticsOutline color={color} />;
  } else {
    return <BsFillSquareFill color={color} />;
  }
};

const LegendControl = ({ legendItems }) => {
  const [isexpanded, setisexpanded] = useState(false);

  return (
    <div aria-label="Map Legend">
      {legendItems.length > 0 && (
        <LegendWrapper>
          <LegendControlContainer $isexpanded={isexpanded}>
            {isexpanded ? (
              <>
                <b>Legend</b>
                <CloseButton
                  aria-label="Close Legend Control"
                  onClick={() => setisexpanded(false)}
                >
                  <FaTimes />
                </CloseButton>
                <div
                  style={{
                    marginTop: "20px",
                    width: "100%",
                  }}
                >
                  {legendItems.map((legendGroup, groupIndex) => (
                    <div key={groupIndex} style={{ marginBottom: "10px" }}>
                      <p style={{ fontWeight: "bold", marginBottom: "5px" }}>
                        {legendGroup.title}
                      </p>
                      {legendGroup.items.map((subItem, subIndex) => (
                        <div
                          key={subIndex}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginBottom: "5px",
                          }}
                        >
                          <div
                            style={{
                              marginRight: "10px",
                            }}
                          >
                            {getLegendSymbol(subItem.symbol, subItem.color)}
                          </div>
                          <div>{subItem.label}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              // Collapsed control - show the layers icon button
              <ControlButton
                aria-label="Show Legend Control"
                onClick={() => setisexpanded(true)}
              >
                <FaListUl />
              </ControlButton>
            )}
          </LegendControlContainer>
        </LegendWrapper>
      )}
    </div>
  );
};

LegendControl.propTypes = {
  legendItems: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired, // Title for layer legend
      items: PropTypes.arrayOf(
        PropTypes.shape({
          label: PropTypes.string.isRequired, // Label for legend item
          color: PropTypes.string.isRequired, // Color for legend item
          symbol: PropTypes.string.isRequired, // Symbol for legend item
        })
      ),
    })
  ),
};

export default LegendControl;
