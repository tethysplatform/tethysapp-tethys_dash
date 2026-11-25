import { useEffect, useState, useRef, memo, useContext } from "react";
import { Vector as VectorLayer } from "ol/layer";
import VectorSource from "ol/source/Vector";
import Draw, { createBox } from "ol/interaction/Draw";
import { TbPointFilled } from "react-icons/tb";
import { MdHorizontalRule } from "react-icons/md";
import { FaDrawPolygon } from "react-icons/fa6";
import { BiRectangle } from "react-icons/bi";
import { BsSignStopFill, BsEraser } from "react-icons/bs";
import { mapDrawingPropType } from "components/map/utilities";
import { VariableInputsContext } from "components/contexts/Contexts";
import { isEditableTarget } from "components/modals/PopupModal/PopupModal";
import GeoJSON from "ol/format/GeoJSON";
import styled from "styled-components";
import PropTypes from "prop-types";

const InteractionsWrapper = styled.div`
  position: absolute;
  top: 1rem;
  left: 1rem;
`;

const InteractionsContainer = styled.div`
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  gap: 0.5rem;
`;

const DrawButton = styled.button`
  border: 2px solid ${({ active }) => (active ? "green" : "transparent")};
  background-color: ${({ active }) => (active ? "#e0ffe0" : "#fff")};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgb(167, 167, 167);
  }
`;

const StopEraseButton = styled.button`
  border: 2px solid transparent;
  cursor: pointer;
  background-color: rgb(255 255 255);
  transition: background-color 0.2s ease;

  &:hover {
    background-color: #ffcccc;
  }
`;

export const drawTypes = {
  Point: <TbPointFilled />,
  LineString: <MdHorizontalRule />,
  Polygon: <FaDrawPolygon />,
  Rectangle: <BiRectangle />,
};

// Inputs nobody types into. Escape from one, such as a layer's checkbox in
// the map's own layer control, still stops drawing; were it left alone, the
// tile editor would close on it instead and lose its unsaved changes.
const NON_TYPING_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

const isTyping = (element) =>
  isEditableTarget(element) &&
  !(element.tagName === "INPUT" && NON_TYPING_INPUT_TYPES.has(element.type));

const DrawInteractions = ({ mapDrawing, visualizationRef, drawing }) => {
  const [drawType, setDrawType] = useState(null);
  const drawInteractionRef = useRef(null);
  const vectorSourceRef = useRef();
  const { setVariableInputValues } = useContext(VariableInputsContext);

  const toggleDrawing = (type) => {
    setDrawType((prev) => {
      if (prev === type) {
        drawing.current = false;
        return null;
      } else {
        drawing.current = true;
        return type;
      }
    });
  };

  const stopDrawing = () => {
    setDrawType(null);
    drawing.current = false;
  };

  useEffect(() => {
    if (!mapDrawing || !visualizationRef.current || !drawType) return;

    if (!vectorSourceRef.current) {
      const interactionSource = new VectorSource();
      const interactionLayer = new VectorLayer({
        source: interactionSource,
        style: {
          "fill-color": "rgba(255, 255, 255, 0.2)",
          "stroke-color": "#ffcc33",
          "stroke-width": 2,
          "circle-radius": 7,
          "circle-fill-color": "#ffcc33",
        },
        zIndex: 9999,
      });
      visualizationRef.current.addLayer(interactionLayer);

      vectorSourceRef.current = interactionSource;
    }

    // Remove previous draw interaction
    if (drawInteractionRef.current) {
      visualizationRef.current.removeInteraction(drawInteractionRef.current);
    }

    const drawInteraction = new Draw({
      source: vectorSourceRef.current,
      type: drawType === "Rectangle" ? "Circle" : drawType,
      geometryFunction: drawType === "Rectangle" && createBox(),
    });

    let drawEndHandler;

    if (mapDrawing.limit || mapDrawing.variable) {
      drawEndHandler = ({ feature, target }) => {
        const source = vectorSourceRef.current;

        // OpenLayers adds the drawn feature to the source only after drawend,
        // so here it is one more than the source holds.
        if (mapDrawing.limit) {
          const features = source.getFeatures();
          if (features.length >= mapDrawing.limit) {
            // Remove the oldest feature (first in the array)
            source.removeFeature(features[0]);
          }
        }

        // The variable holds every shape on the map once this one is added.
        if (mapDrawing.variable) {
          const format = new GeoJSON();
          const geometries = [...source.getFeatures(), feature].map((drawn) =>
            JSON.parse(format.writeGeometry(drawn.getGeometry())),
          );
          setVariableInputValues((previousVariableInputValues) => ({
            ...previousVariableInputValues,
            [mapDrawing.variable]: {
              projection: target.getMap().getView().getProjection().getCode(),
              geometries,
            },
          }));
        }
      };

      drawInteraction.on("drawend", drawEndHandler);
    }

    visualizationRef.current.addInteraction(drawInteraction);
    drawInteractionRef.current = drawInteraction;

    return () => {
      if (drawInteraction && drawEndHandler) {
        drawInteraction.un("drawend", drawEndHandler);
      }
      // eslint-disable-next-line
      visualizationRef.current?.removeInteraction(drawInteraction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapDrawing, drawType]);

  // While a tool is on, Escape abandons the shape being drawn and leaves
  // drawing mode, as Stop Drawing does. It is heard in the capture phase on
  // the document, ahead of the tile editor's modal and a map popup, which
  // would close on the same key, and it goes no further. Only a key from the
  // map's own area counts: the map, inside it, or what encloses it (the page,
  // the editor or popup it sits in). A key typed into a field, or meant for
  // another dialog opened over the map, is left alone.
  useEffect(() => {
    if (!drawType) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape" || isTyping(event.target)) return;
      const mapElement = visualizationRef.current?.getTargetElement?.();
      const fromMapArea =
        !mapElement ||
        mapElement.contains(event.target) ||
        event.target.contains?.(mapElement);
      if (!fromMapArea) return;
      drawInteractionRef.current?.abortDrawing();
      stopDrawing();
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawType]);

  useEffect(() => {
    const source = vectorSourceRef.current;

    if (mapDrawing.limit >= 0 && source) {
      let features = source.getFeatures();

      while (features.length > mapDrawing.limit) {
        source.removeFeature(features[0]); // Remove oldest
        features = source.getFeatures(); // Refresh the list
      }
    }
  }, [mapDrawing.limit]);

  // Clearing the map empties its variable: with no shapes there is no value,
  // which every tile bound to it reads as it did before anything was drawn.
  const clearAll = () => {
    vectorSourceRef.current?.clear();
    if (!mapDrawing.variable) return;
    setVariableInputValues((previousVariableInputValues) => {
      if (!(mapDrawing.variable in previousVariableInputValues)) {
        return previousVariableInputValues;
      }
      const nextVariableInputValues = { ...previousVariableInputValues };
      delete nextVariableInputValues[mapDrawing.variable];
      return nextVariableInputValues;
    });
  };

  if (!mapDrawing.options) return;

  return (
    <>
      {mapDrawing.options.length === 0 ? null : (
        <InteractionsWrapper>
          <InteractionsContainer>
            {mapDrawing.options.map((mapDrawingType) => (
              <DrawButton
                key={mapDrawingType}
                onClick={() => toggleDrawing(mapDrawingType)}
                active={drawType === mapDrawingType}
                title={`Draw ${mapDrawingType}`}
              >
                {drawTypes[mapDrawingType]}
              </DrawButton>
            ))}
            <StopEraseButton onClick={stopDrawing} title="Stop Drawing (Esc)">
              <BsSignStopFill />
            </StopEraseButton>
            <StopEraseButton onClick={clearAll} title="Clear All Features">
              <BsEraser />
            </StopEraseButton>
          </InteractionsContainer>
        </InteractionsWrapper>
      )}
    </>
  );
};

DrawInteractions.propTypes = {
  mapDrawing: mapDrawingPropType,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  drawing: PropTypes.shape({ current: PropTypes.bool }),
};

export default memo(DrawInteractions);
