import { useEffect, useRef, useCallback, useState, memo } from "react";
import { default as ExtentInteractionOL } from "ol/interaction/Extent";
import ImageLayer from "ol/layer/Image.js";
import { Map } from "ol";
import Static from "ol/source/ImageStatic.js";
import { useMapContext } from "components/contexts/MapContext";
import styled from "styled-components";
import PropTypes from "prop-types";

const OverlayWrapper = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const ActionButton = styled.button`
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background-color 0.2s ease;
`;

const ConfirmButton = styled(ActionButton)`
  background-color: #28a745;
  color: white;
  &:hover {
    background-color: #218838;
  }
`;

const CancelButton = styled(ActionButton)`
  background-color: #dc3545;
  color: white;
  &:hover {
    background-color: #c82333;
  }
`;

const InstructionText = styled.span`
  font-size: 0.85rem;
  color: #333;
`;

const ExtentInteraction = ({ visualizationRef }) => {
  const { extentDrawMode, setExtentDrawMode, setDrawnExtent } = useMapContext();
  const interactionRef = useRef(null);
  const previewLayerRef = useRef(null);
  const debounceRef = useRef(null);
  const [hasExtent, setHasExtent] = useState(!!extentDrawMode?.initialExtent);

  const cleanupPreviewLayer = useCallback(() => {
    if (previewLayerRef.current && visualizationRef.current) {
      visualizationRef.current.removeLayer(previewLayerRef.current);
      previewLayerRef.current = null;
    }
  }, [visualizationRef]);

  const updatePreviewLayer = useCallback(
    (extent) => {
      if (!extentDrawMode?.imageUrl || !extent || !visualizationRef.current)
        return;

      cleanupPreviewLayer();

      const projection =
        extentDrawMode.projection ||
        visualizationRef.current.getView().getProjection().getCode();

      const layer = new ImageLayer({
        source: new Static({
          url: extentDrawMode.imageUrl,
          imageExtent: extent,
          projection: projection,
        }),
        opacity: 0.7,
        zIndex: 9998,
      });

      visualizationRef.current.addLayer(layer);
      previewLayerRef.current = layer;
    },
    [extentDrawMode, visualizationRef, cleanupPreviewLayer],
  );

  useEffect(() => {
    if (!extentDrawMode || !visualizationRef.current) return;

    const map = visualizationRef.current;

    if (extentDrawMode.initialExtent) {
      setHasExtent(true);
    }

    // Hide existing layers that match the image URL to avoid confusion
    const hiddenLayers = [];
    if (extentDrawMode.imageUrl) {
      map.getLayers().forEach((layer) => {
        const source = layer.getSource?.();
        if (
          source instanceof Static &&
          source.getUrl?.() === extentDrawMode.imageUrl &&
          layer.getVisible()
        ) {
          layer.setVisible(false);
          hiddenLayers.push(layer);
        }
      });
    }

    const interaction = new ExtentInteractionOL({
      extent: extentDrawMode.initialExtent || undefined,
      boxStyle: {
        "stroke-color": "rgba(0, 120, 255, 0.8)",
        "stroke-width": 2,
        "fill-color": "rgba(0, 120, 255, 0.1)",
      },
      pointerStyle: {
        "circle-radius": 6,
        "circle-fill-color": "rgba(0, 120, 255, 0.8)",
        "circle-stroke-color": "white",
        "circle-stroke-width": 2,
      },
    });

    // Show initial preview if we have an initial extent and image URL
    if (extentDrawMode.initialExtent && extentDrawMode.imageUrl) {
      updatePreviewLayer(extentDrawMode.initialExtent);
    }

    interaction.on("extentchanged", (event) => {
      const extent = event.extent;
      if (!extent || extent.some((v) => !isFinite(v))) return;

      setHasExtent(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updatePreviewLayer(extent);
      }, 150);
    });

    map.addInteraction(interaction);
    interactionRef.current = interaction;

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      cleanupPreviewLayer();
      map.removeInteraction(interaction);
      interactionRef.current = null;
      // Restore visibility of hidden layers
      hiddenLayers.forEach((layer) => layer.setVisible(true));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extentDrawMode]);

  const handleConfirm = () => {
    if (!interactionRef.current) return;

    const extent = interactionRef.current.getExtent();
    if (extent && extent.every((v) => isFinite(v))) {
      setDrawnExtent(extent);
    }
    setExtentDrawMode(null);
  };

  const handleCancel = () => {
    setExtentDrawMode(null);
  };

  if (!extentDrawMode) return null;

  return (
    <OverlayWrapper>
      <InstructionText>
        Draw or adjust a rectangle to place the image
      </InstructionText>
      <ConfirmButton onClick={handleConfirm} disabled={!hasExtent}>
        Confirm
      </ConfirmButton>
      <CancelButton onClick={handleCancel}>Cancel</CancelButton>
    </OverlayWrapper>
  );
};

ExtentInteraction.propTypes = {
  visualizationRef: PropTypes.shape({ current: PropTypes.instanceOf(Map) }),
};

export default memo(ExtentInteraction);
