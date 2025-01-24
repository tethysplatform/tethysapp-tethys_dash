import React, { useState } from "react";
import styled from "styled-components";
import {
  BsFillTriangleFill,
  BsFillSquareFill,
  BsFillCircleFill,
} from "react-icons/bs";
import { RiRectangleFill } from "react-icons/ri";
import { IoAnalyticsOutline } from "react-icons/io5";
import { FaTimes, FaListUl } from "react-icons/fa"; // Import icons

const LegendWrapper = styled.div`
  position: absolute;
  bottom: 10px;
  left: 10px;
`;

const LegendControlContainer = styled.div`
  background-color: white;
  padding: ${(props) => (props.$isexpanded ? "10px" : "5px")};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: ${(props) => (props.$isexpanded ? "200px" : "40px")};
  height: ${(props) => (props.$isexpanded ? "200px" : "40px")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
  ::-webkit-scrollbar {
    display: none;
  }
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
  square: <BsFillSquareFill />,
  circle: <BsFillCircleFill />,
  upTriangle: <BsFillTriangleFill />,
  rightTriangle: <RightTriangle />,
  downTriangle: <DownTriangle />,
  leftTriangle: <LeftTriangle />,
  rectangle: <RiRectangleFill />,
  line: <IoAnalyticsOutline />,
};

export const getLegendSymbol = (symbol, color) => {
  if (symbol === "square") {
    return <BsFillSquareFill color={color} />;
  } else if (symbol === "circle") {
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
  }
};

const LegendControl = ({ items }) => {
  const [isexpanded, setisexpanded] = useState(false);
  if (!items.length) return;

  return (
    <LegendWrapper>
      <LegendControlContainer $isexpanded={isexpanded}>
        {isexpanded ? (
          <>
            <CloseButton onClick={() => setisexpanded(false)}>
              <FaTimes />
            </CloseButton>
            <div
              style={{
                marginTop: "20px",
                width: "100%",
                height: "200px",
                overflowY: "scroll",
              }}
            >
              {items.map((legendGroup, groupIndex) => (
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
          <ControlButton onClick={() => setisexpanded(true)}>
            <FaListUl />
          </ControlButton>
        )}
      </LegendControlContainer>
    </LegendWrapper>
  );
};

export default LegendControl;
