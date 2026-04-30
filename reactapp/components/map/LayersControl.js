import { useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import {
  FaLayerGroup,
  FaTimes,
  FaExclamationTriangle,
  FaRedo,
} from "react-icons/fa";
import { WebsocketContext } from "components/contexts/WebSocketContext";

const ControlWrapper = styled.div`
  position: absolute;
  bottom: 1rem;
  right: 1rem;
`;

const ProgressBar = styled.div`
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  margin-top: 3px;
  width: 100%;
`;

const ProgressFill = styled.div`
  height: 100%;
  background: #3498db;
  transition: width 200ms ease-out;
  width: ${(props) => `${props.$pct}%`};
`;

const ErrorBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8a1f1f;
  background: #fdecea;
  padding: 2px 6px;
  margin-top: 3px;
  border-radius: 3px;
  font-size: 11px;
`;

const RetryBtn = styled.button`
  background: none;
  border: 1px solid #8a1f1f;
  color: #8a1f1f;
  cursor: pointer;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  &:hover {
    background: #f8d7d3;
  }
`;

// Parse a WebSocket message's percentageComplete. Messages are JSON strings
// keyed by requestId. Returns null when no parseable progress is present.
export function parseProgress(rawMessage) {
  if (!rawMessage) return null;
  try {
    const parsed = JSON.parse(rawMessage);
    if (typeof parsed.percentageComplete === "number") {
      return parsed.percentageComplete;
    }
  } catch {
    // fall through
  }
  return null;
}

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

const LayersControl = ({ updater, visualizationRef, runtimeLayerState }) => {
  const [layers, setLayers] = useState([]); // [<openlayer layers>], controls what is shown in the layer controls
  const [isexpanded, setisexpanded] = useState(false); // bool, controls layer conrol menu expansion
  const [layerVisibility, setLayerVisibility] = useState({}); // {layerName: layerVisibility, ...}, controls checkbox checked value based on layer visibility
  const websocketContext = useContext(WebsocketContext) ?? {};
  const { getMessageForRequest } = websocketContext;
  const errorsByLayerId = runtimeLayerState?.errorsByLayerId ?? {};
  const retryRuntimeLayer = runtimeLayerState?.retry;
  const sessionNonce = runtimeLayerState?.sessionNonce;
  const gridItemUuid = runtimeLayerState?.gridItemUuid;

  useEffect(() => {
    if (visualizationRef.current) {
      // Get layers from the map and set them in local state
      const mapLayers = visualizationRef.current.getLayers().getArray();
      setLayers(mapLayers);

      // Update state tracking the checkbox
      setLayerVisibility(formatVisibility(mapLayers));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                const layerId = layer.get("layerId");
                // Runtime dynamic_map_layer progress + error state is scoped
                // to layers tagged with a layerId by Unit 4. Static layers
                // render only the visibility checkbox, as before.
                const isRuntime = !!layerId;
                const compositeRequestId =
                  isRuntime && sessionNonce && gridItemUuid
                    ? `${sessionNonce}:${gridItemUuid}:${layerId}`
                    : null;
                const progressMessage =
                  compositeRequestId && getMessageForRequest
                    ? getMessageForRequest(compositeRequestId)
                    : null;
                const progressPct = parseProgress(progressMessage);
                const error = isRuntime ? errorsByLayerId[layerId] : undefined;
                // Hide progress bar once an error is set (error supersedes
                // any stale in-progress message) or when it has completed.
                const showProgress =
                  !error &&
                  typeof progressPct === "number" &&
                  progressPct > 0 &&
                  progressPct < 100;

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
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
                    {showProgress && (
                      <div
                        role="status"
                        aria-live="polite"
                        aria-label={`${layerName} loading ${Math.round(progressPct)}%`}
                      >
                        <ProgressBar>
                          <ProgressFill
                            $pct={Math.max(0, Math.min(100, progressPct))}
                          />
                        </ProgressBar>
                      </div>
                    )}
                    {error && (
                      <ErrorBadge role="alert">
                        <FaExclamationTriangle aria-hidden="true" />
                        <span style={{ flex: 1 }}>{error.message}</span>
                        {error.kind !== "unavailable" && retryRuntimeLayer && (
                          <RetryBtn
                            type="button"
                            onClick={() => retryRuntimeLayer(layerId)}
                            aria-label={`Retry ${layerName}`}
                          >
                            <FaRedo aria-hidden="true" /> Retry
                          </RetryBtn>
                        )}
                      </ErrorBadge>
                    )}
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
  // Runtime dynamic_map_layer state bundle passed down from MapComponent
  // (wired by MapVisualization from Unit 5's useRuntimeLayerFetcher).
  // Undefined for dataviewer / legacy maps.
  runtimeLayerState: PropTypes.shape({
    errorsByLayerId: PropTypes.object,
    retry: PropTypes.func,
    sessionNonce: PropTypes.string,
    gridItemUuid: PropTypes.string,
  }),
};

export default LayersControl;
