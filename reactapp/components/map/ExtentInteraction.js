import { useEffect, useRef, useState, memo } from "react";
import { Map } from "ol";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Static from "ol/source/ImageStatic.js";
import { fromExtent } from "ol/geom/Polygon";
import MultiPoint from "ol/geom/MultiPoint";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { getRenderPixel } from "ol/render";
import { apply as applyTransform } from "ol/transform";
import { getIntersection, isEmpty } from "ol/extent";
import { transformExtent } from "ol/proj";
import { unByKey } from "ol/Observable";
import { useMapContext } from "components/contexts/MapContext";
import ImageExtentInteraction from "components/map/imageExtentInteraction";
import { drawBorder, normalizeBorder } from "components/map/imageBorder";
import { ensureProjectionAsync } from "components/map/projections";
import styled from "styled-components";
import PropTypes from "prop-types";

const PREVIEW_OPACITY = 0.7;

const OverlayWrapper = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: calc(100% - 2rem);
  background: rgba(255, 255, 255, 0.95);
  padding: 0.5rem 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
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

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #333;
  margin: 0;
`;

const HelperText = styled.span`
  font-size: 0.8rem;
  color: #6c757d;
`;

const NoteText = styled.span`
  font-size: 0.8rem;
  color: #856404;
`;

const boxStyles = [
  new Style({
    stroke: new Stroke({ color: "rgba(0, 120, 255, 0.8)", width: 2 }),
    fill: new Fill({ color: "rgba(0, 120, 255, 0.1)" }),
  }),
  new Style({
    image: new Circle({
      radius: 6,
      fill: new Fill({ color: "rgba(0, 120, 255, 0.8)" }),
      stroke: new Stroke({ color: "white", width: 2 }),
    }),
    geometry: (feature) =>
      new MultiPoint(feature.getGeometry().getCoordinates()[0].slice(0, 4)),
  }),
];

/**
 * Bring a saved extent into the view projection. The saved code is resolved
 * through the projection registry first, because OpenLayers looks projections
 * up by exact string and a code spelled differently from how it was
 * registered would otherwise transform as nothing. The result is clamped to
 * the view projection's valid extent, which keeps an extent touching the poles
 * finite on Web Mercator.
 *
 * Resolves to `{extent}` or `{error}`; never rejects.
 */
export async function reprojectSavedExtent(extent, code, viewProjection) {
  let resolved;
  try {
    resolved = await ensureProjectionAsync(code);
  } catch {
    resolved = {
      error: { detail: `The definition for "${code}" could not be loaded.` },
    };
  }
  if (resolved.error) {
    return { error: resolved.error.detail };
  }

  let transformed = transformExtent(
    extent,
    resolved.projection,
    viewProjection,
  );
  const validExtent = viewProjection.getExtent();
  if (validExtent) {
    transformed = getIntersection(transformed, validExtent);
  }
  if (!transformed.every(Number.isFinite) || isEmpty(transformed)) {
    return {
      error: `The saved extent does not fall within the map's ${viewProjection.getCode()} bounds.`,
    };
  }
  return { extent: transformed };
}

function toRenderPixel(event, coordinate) {
  return getRenderPixel(
    event,
    applyTransform(event.frameState.coordinateToPixelTransform, [
      ...coordinate,
    ]),
  );
}

// Draw the preview image stretched across the box, then its border. The box
// is always in the view projection, so this matches an ImageStatic placed with
// the same extent there. Drawing through the box's own corners keeps the
// preview correct on a rotated view.
function drawPreview(event, image, extent, border) {
  const context = event.context;
  if (!context || !extent) return;
  const [minX, minY, maxX, maxY] = extent;
  const topLeft = toRenderPixel(event, [minX, maxY]);
  const topRight = toRenderPixel(event, [maxX, maxY]);
  const bottomRight = toRenderPixel(event, [maxX, minY]);
  const bottomLeft = toRenderPixel(event, [minX, minY]);

  if (image) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    context.save();
    context.globalAlpha = PREVIEW_OPACITY;
    context.transform(
      (topRight[0] - topLeft[0]) / width,
      (topRight[1] - topLeft[1]) / width,
      (bottomLeft[0] - topLeft[0]) / height,
      (bottomLeft[1] - topLeft[1]) / height,
      topLeft[0],
      topLeft[1],
    );
    context.drawImage(image, 0, 0);
    context.restore();
  }

  drawBorder(context, [bottomLeft, bottomRight, topRight, topLeft], border, {
    opacity: PREVIEW_OPACITY,
    pixelRatio: event.frameState.pixelRatio,
  });
}

const ExtentInteraction = ({ visualizationRef }) => {
  const { extentDrawMode, setExtentDrawMode, setDrawnExtent } = useMapContext();
  const interactionRef = useRef(null);
  const [hasExtent, setHasExtent] = useState(false);
  const [projectionNote, setProjectionNote] = useState(null);
  // "loading" | "ready" | "error"
  const [imageStatus, setImageStatus] = useState("loading");
  const [imageRatio, setImageRatio] = useState(null);
  const [keepAspectRatio, setKeepAspectRatio] = useState(false);

  useEffect(() => {
    if (!extentDrawMode || !visualizationRef.current) return;

    const map = visualizationRef.current;
    let cancelled = false;
    setHasExtent(false);
    setProjectionNote(null);
    setImageStatus("loading");
    setImageRatio(null);
    setKeepAspectRatio(false);

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

    const border = normalizeBorder(
      extentDrawMode.borderColor,
      extentDrawMode.borderWidth,
    );

    // The box and preview live on one unmanaged layer: outside the map's
    // layer collection, so layer reconciliation never removes it and the
    // layer switcher never lists it.
    const boxFeature = new Feature();
    const boxLayer = new VectorLayer({
      className: "ol-layer image-extent-editor",
      source: new VectorSource({ features: [boxFeature] }),
      style: (feature) => (feature.getGeometry() ? boxStyles : null),
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });

    let image = null;
    const prerenderKey = boxLayer.on("prerender", (event) =>
      drawPreview(event, image, interactionRef.current?.getExtent(), border),
    );

    const showExtent = (extent) => {
      boxFeature.setGeometry(extent ? fromExtent(extent) : undefined);
      setHasExtent(!!extent);
    };

    const interaction = new ImageExtentInteraction({ onChange: showExtent });
    interactionRef.current = interaction;
    map.addInteraction(interaction);
    boxLayer.setMap(map);

    if (extentDrawMode.imageUrl) {
      const loader = new Image();
      loader.onload = () => {
        if (cancelled) return;
        if (loader.naturalWidth > 0 && loader.naturalHeight > 0) {
          image = loader;
          setImageRatio(loader.naturalWidth / loader.naturalHeight);
          setImageStatus("ready");
          boxLayer.changed();
        } else {
          setImageStatus("error");
        }
      };
      loader.onerror = () => {
        if (!cancelled) setImageStatus("error");
      };
      loader.src = extentDrawMode.imageUrl;
    } else {
      setImageStatus("error");
    }

    const initialExtent = extentDrawMode.initialExtent;
    const viewProjection = map.getView().getProjection();
    const savedCode = extentDrawMode.projection;
    if (initialExtent) {
      if (!savedCode || savedCode === viewProjection.getCode()) {
        interaction.setExtent(initialExtent);
      } else {
        reprojectSavedExtent(initialExtent, savedCode, viewProjection).then(
          (result) => {
            // The editor closed, or the author drew a box while the
            // projection resolved -- either way the saved extent is moot.
            if (cancelled || interaction.hasExtent()) return;
            if (result.error) {
              setProjectionNote(
                `Couldn't place the saved extent: ${result.error} Drag on the map to draw a new box.`,
              );
            } else {
              interaction.setExtent(result.extent);
            }
          },
        );
      }
    }

    // The box is in the view's coordinates; a new view (a raster taking over
    // the projection) would strand it, so treat that as Cancel.
    const viewKey = map.on("change:view", () => setExtentDrawMode(null));

    return () => {
      cancelled = true;
      unByKey(viewKey);
      unByKey(prerenderKey);
      map.removeInteraction(interaction);
      boxLayer.setMap(null);
      interactionRef.current = null;
      // Restore visibility of hidden layers
      hiddenLayers.forEach((layer) => layer.setVisible(true));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extentDrawMode]);

  const handleKeepAspectRatio = (event) => {
    const checked = event.target.checked;
    setKeepAspectRatio(checked);
    interactionRef.current?.setAspectRatio(checked ? imageRatio : null);
  };

  const handleConfirm = () => {
    const interaction = interactionRef.current;
    if (!interaction) return;

    // An untouched box writes nothing, so the saved extent and projection
    // keep their exact values; MapLayer reopens as it does on Cancel.
    const extent = interaction.getExtent();
    if (interaction.isModified() && extent?.every((v) => isFinite(v))) {
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
      <Row>
        <InstructionText>
          {hasExtent
            ? "Drag the box to move it, its edges to resize it, or the map to pan. Shift+drag to start a new box."
            : "Drag on the map to draw a box for the image."}
        </InstructionText>
      </Row>
      <Row>
        <CheckboxLabel>
          <input
            type="checkbox"
            checked={keepAspectRatio}
            disabled={imageStatus !== "ready"}
            onChange={handleKeepAspectRatio}
            aria-label="Keep aspect ratio"
          />
          Keep aspect ratio
        </CheckboxLabel>
        {imageStatus === "loading" && <HelperText>Loading image…</HelperText>}
        {imageStatus === "error" && (
          <HelperText>
            Image could not be loaded; aspect ratio unavailable
          </HelperText>
        )}
        <ConfirmButton onClick={handleConfirm} disabled={!hasExtent}>
          Confirm
        </ConfirmButton>
        <CancelButton onClick={handleCancel}>Cancel</CancelButton>
      </Row>
      {projectionNote && (
        <Row>
          <NoteText role="status">{projectionNote}</NoteText>
        </Row>
      )}
    </OverlayWrapper>
  );
};

ExtentInteraction.propTypes = {
  visualizationRef: PropTypes.shape({ current: PropTypes.instanceOf(Map) }),
};

export default memo(ExtentInteraction);
