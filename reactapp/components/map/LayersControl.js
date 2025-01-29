import { useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaLayerGroup, FaTimes } from "react-icons/fa"; // Import icons

const ControlWrapper = styled.div`
  position: absolute;
  bottom: 10px;
  right: 10px;
`;

const LayerControlContainer = styled.div`
  background-color: white;
  padding: ${(props) => (props.$isexpanded ? "10px" : "5px")};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: ${(props) => (props.$isexpanded ? "200px" : "40px")};
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

const LayersControl = ({ layers }) => {
  const [isexpanded, setisexpanded] = useState(false);

  return (
    <ControlWrapper>
      <LayerControlContainer $isexpanded={isexpanded}>
        {isexpanded ? (
          // Expanded layer control without title and list
          <>
            <CloseButton
              aria-label="Close Layers Control"
              onClick={() => setisexpanded(false)}
            >
              <FaTimes />
            </CloseButton>
            <div style={{ marginTop: "20px", width: "100%" }}>
              {layers.map((layer, index) => {
                const layerName = layer.get("name") ?? `Layer ${index + 1}`;
                const visible = layer.getVisible() ?? true;
                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: "5px",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={() => {
                          layer.setVisible(!visible);
                        }}
                        style={{ marginRight: "8px" }}
                        aria-label={layerName + " Set Visible"}
                      />
                      <span>{layerName}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // Collapsed control - show the layers icon button
          <ControlButton
            aria-label="Show Layers Control"
            onClick={() => setisexpanded(true)}
          >
            <FaLayerGroup />
          </ControlButton>
        )}
      </LayerControlContainer>
    </ControlWrapper>
  );
};

LayersControl.propTypes = {
  layers: PropTypes.array,
};

export default LayersControl;
