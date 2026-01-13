import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import { FaLayerGroup, FaTimes } from "react-icons/fa"; // Import icons
import Icon from "ol/style/Icon";
import Style from "ol/style/Style";

// Helper to extract icon URL from a layer's style
function getLayerIconUrl(layer) {
  // Try to get the style (could be a function or a Style object)
  const style = layer.getStyle && layer.getStyle();

  if (!style) return null;

  // If it's a function, try calling with a dummy feature
  if (typeof style === "function") {
    // Try to get a sample feature from the layer's source
    let feature = null;
    if (layer.getSource && layer.getSource()) {
      const features =
        layer.getSource().getFeatures && layer.getSource().getFeatures();
      if (features && features.length > 0) {
        feature = features[0];
      }
    }
    // If no real feature, create a dummy one
    if (!feature && window.ol && window.ol.Feature) {
      feature = new window.ol.Feature();
    }
    let styleObj = null;
    try {
      styleObj = style(feature);
      if (Array.isArray(styleObj)) {
        styleObj = styleObj[0]; // this happens with ol-mapbox-style sometimes
      }
    } catch (e) {
      // ignore errors from dummy feature
    }
    if (styleObj instanceof Style) {
      const image = styleObj.getImage && styleObj.getImage();
      if (image instanceof Icon) {
        return image.getSrc();
      } else {
        // If getImage() returns a canvas, crop and scale it to a 20x20 preview
        try {
          const origCanvas = image.getImage();
          if (origCanvas instanceof HTMLCanvasElement) {
            // Find the bounding box of non-transparent pixels
            const ctx = origCanvas.getContext("2d");
            const w = origCanvas.width;
            const h = origCanvas.height;
            const imgData = ctx.getImageData(0, 0, w, h);
            let minX = w,
              minY = h,
              maxX = 0,
              maxY = 0,
              found = false;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const alpha = imgData.data[(y * w + x) * 4 + 3];
                if (alpha > 0) {
                  found = true;
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (!found) return null;

            const pad = 5;
            const cropW = maxX - minX + 1 + pad * 2;
            const cropH = maxY - minY + 1 + pad * 2;
            const cropCanvas = document.createElement("canvas");
            cropCanvas.width = 20;
            cropCanvas.height = 20;
            const cropCtx = cropCanvas.getContext("2d");
            // Center and scale the symbol
            const scale = Math.min(18 / cropW, 18 / cropH, 1);
            const dx = (20 - cropW * scale) / 2;
            const dy = (20 - cropH * scale) / 2;
            cropCtx.save();
            cropCtx.translate(dx, dy);
            cropCtx.scale(scale, scale);
            cropCtx.drawImage(
              origCanvas,
              minX - pad,
              minY - pad,
              cropW,
              cropH,
              0,
              0,
              cropW,
              cropH
            );
            cropCtx.restore();
            return cropCanvas.toDataURL();
          } else {
            return origCanvas && origCanvas.toDataURL
              ? origCanvas.toDataURL()
              : null;
          }
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  }
  // If it's a Style object
  if (style instanceof Style) {
    const image = style.getImage && style.getImage();
    if (image instanceof Icon) {
      return image.getSrc();
    }
  }
  return null;
}

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
  max-height: 35vh;
  height: ${(props) => (props.$isexpanded ? "auto" : "40px")};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  position: relative;
  overflow: ${(props) => props.$isexpanded && "auto"};
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

const IconImage = styled.img`
  width: 20px !important;
  height: 20px !important;
  margin-right: 6px;
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
                // Try to get icon URL for this layer
                const iconUrl = getLayerIconUrl(layer);
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
                      {iconUrl && (
                        <IconImage
                          className="layer-control-symbol"
                          src={iconUrl}
                          alt="layer symbol"
                        />
                      )}
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
