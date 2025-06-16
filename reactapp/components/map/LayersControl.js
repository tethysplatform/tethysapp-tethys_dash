import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaLayerGroup, FaTimes } from "react-icons/fa"; // Import icons

const ControlWrapper = styled.div`
  position: absolute;
  bottom: 1rem;
  right: 1rem;
`;

const LayerControlContainer = styled.div`
  background-color: white;
  padding: ${(props) => (props.$isexpanded ? "10px" : "5px")};
  z-index: 1000;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: ${(props) => (props.$isexpanded ? "13vw" : "40px")};
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

const LayersControl = ({ updater, visualizationRef }) => {
  const [layers, setLayers] = useState([]); // [<openlayer layers>], controls what is shown in the layer controls
  const [isexpanded, setisexpanded] = useState(false); // bool, controls layer conrol menu expansion
  const [layerVisibility, setLayerVisibility] = useState({}); // {layerName: layerVisibility, ...}, controls checkbox checked value based on layer visibility

  useEffect(() => {
    if (visualizationRef.current) {
      // Get layers from the map and set them in local state
      const mapLayers = visualizationRef.current.getLayers().getArray();
      setLayers(mapLayers);

      // Update state tracking the checkbox
      setLayerVisibility(formatVisibility(mapLayers));
    }
    // eslint-disable-next-line
  }, [isexpanded, updater]);

  function formatVisibility(mapLayers) {
    // loop through mapLayers array and create an object of layername keys and visibility values
    return mapLayers.reduce((obj, layer, index) => {
      const layerName = layer.get("name") ?? `Layer ${index + 1}`;
      const layerVisible =
        layerVisibility[layerName] ?? layer.getVisible() ?? true;

      if (
        layerVisibility[layerName] !== undefined &&
        layerVisibility[layerName] !== layer.getVisible()
      ) {
        layer.setVisible(layerVisibility[layerName]);
      }

      obj[layerName] = layerVisible;
      return obj;
    }, {});
  }

  function updateVisibility(layer, layerName, checked) {
    // update openlayers layer visibility
    layer.setVisible(checked);

    // update layerVisibility state for checkbox
    const updatedLayerVisibility = JSON.parse(JSON.stringify(layerVisibility));
    updatedLayerVisibility[layerName] = checked;
    setLayerVisibility(updatedLayerVisibility);
  }

  return (
    <ControlWrapper>
      <LayerControlContainer $isexpanded={isexpanded}>
        {isexpanded ? (
          <>
            <b>Map Layers</b>
            <CloseButton
              aria-label="Close Layers Control"
              onClick={() => setisexpanded(false)}
            >
              <FaTimes />
            </CloseButton>
            <div
              aria-label="Map Layers"
              style={{ marginTop: "20px", width: "100%" }}
            >
              {layers.map((layer, index) => {
                const layerName = layer.get("name") ?? `Layer ${index + 1}`;
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
                        checked={layerVisibility[layerName]}
                        onChange={(e) =>
                          updateVisibility(layer, layerName, e.target.checked)
                        }
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
  updater: PropTypes.bool, // a boolean that switches when layers are updated
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default LayersControl;
