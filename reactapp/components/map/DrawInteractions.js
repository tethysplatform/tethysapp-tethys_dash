import { useEffect, useState, useRef } from "react";
import { Vector as VectorLayer } from "ol/layer";
import VectorSource from "ol/source/Vector";
import { Draw } from "ol/interaction";
import { TbPointFilled } from "react-icons/tb";
import { MdHorizontalRule } from "react-icons/md";
import { FaDrawPolygon, FaRegCircle } from "react-icons/fa6";
import { BsSignStopFill, BsEraser } from "react-icons/bs";
import styled from "styled-components";

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

const drawTypes = {
  Point: <TbPointFilled />,
  LineString: <MdHorizontalRule />,
  Polygon: <FaDrawPolygon />,
  Circle: <FaRegCircle />,
};

const DrawInteractions = ({ mapDrawing, visualizationRef, drawing }) => {
  const [drawType, setDrawType] = useState(null);
  const drawInteractionRef = useRef(null);
  const vectorSourceRef = useRef();

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
    if (!mapDrawing || !visualizationRef.current) return;

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
      });
      visualizationRef.current.addLayer(interactionLayer);

      vectorSourceRef.current = interactionSource;
    }

    // Remove previous draw interaction
    if (drawInteractionRef.current) {
      visualizationRef.current.removeInteraction(drawInteractionRef.current);
      drawInteractionRef.current = null;
    }

    if (!drawType) return;

    const drawInteraction = new Draw({
      source: vectorSourceRef.current,
      type: drawType,
    });

    let drawEndHandler;

    if (mapDrawing.limit) {
      drawEndHandler = (event) => {
        const source = vectorSourceRef.current;
        if (!source) return;

        const features = source.getFeatures();

        if (features.length >= mapDrawing.limit) {
          // Remove the oldest feature (first in the array)
          source.removeFeature(features[0]);
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
      visualizationRef.current?.removeInteraction(drawInteraction);
    };
  }, [mapDrawing, drawType]);

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

  const clearAll = () => {
    vectorSourceRef.current?.clear();
  };

  if (!mapDrawing.options) return;

  return (
    <>
      {mapDrawing.options && mapDrawing.options?.length === 0 ? null : (
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
            <StopEraseButton onClick={stopDrawing} title="Stop Drawing">
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

export default DrawInteractions;
