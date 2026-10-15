import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import styled from "styled-components";
import { Map } from "ol";
import Collection from "ol/Collection.js";
import Overlay from "ol/Overlay.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import Draw from "ol/interaction/Draw.js";
import Modify from "ol/interaction/Modify.js";
import Select from "ol/interaction/Select.js";
import Translate from "ol/interaction/Translate.js";
import DoubleClickZoom from "ol/interaction/DoubleClickZoom.js";
import MultiPoint from "ol/geom/MultiPoint.js";
import { Circle, Fill, Stroke, Style } from "ol/style.js";
import { unByKey } from "ol/Observable.js";
import { useMapContext } from "components/contexts/MapContext";
import {
  ANNOTATION_ID_KEY,
  ANNOTATION_KIND_KEY,
  ANNOTATION_STYLE_KEY,
  ANNOTATION_TEXT_KEY,
  featuresToItems,
  itemsToFeatures,
  newAnnotationItem,
  reprojectAnnotationFeatures,
} from "components/map/annotations";
import { createAnnotationStyleFunction } from "components/map/annotationStyle";

// The on-map half of annotation editing. It mounts only while the DataViewer's
// MapContext holds a session -- started from the layer editor's Annotations
// tab -- so a map on the dashboard itself never gets these interactions.
//
// The working copy lives on an unmanaged layer (`setMap`), outside the map's
// layer collection: reconciliation never removes it and the layer switcher
// never lists it. The real layer is hidden for the session so annotations do
// not draw twice.

const Wrapper = styled.div`
  position: absolute;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: calc(100% - 2rem);
  background: rgba(255, 255, 255, 0.97);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const Title = styled.span`
  font-weight: 600;
  font-size: 0.9rem;
  margin-right: 0.5rem;
`;

const ToolButton = styled.button`
  border: 1px solid ${({ $active }) => ($active ? "#1f6feb" : "#ced4da")};
  background: ${({ $active }) => ($active ? "#e7f0ff" : "#fff")};
  border-radius: 4px;
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
  cursor: pointer;
  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`;

const DoneButton = styled(ToolButton)`
  background: #28a745;
  border-color: #28a745;
  color: #fff;
`;

const DeleteButton = styled(ToolButton)`
  background: #dc3545;
  border-color: #dc3545;
  color: #fff;
`;

const Instructions = styled.div`
  font-size: 0.8rem;
  color: #495057;
`;

const TextBox = styled.textarea`
  min-width: 10rem;
  font: 13px sans-serif;
  padding: 0.25rem;
  border: 1px solid #1f6feb;
  border-radius: 3px;
  resize: both;
`;

export const TOOLS = [
  { id: "select", label: "Select" },
  { id: "line", label: "Line" },
  { id: "arrow", label: "Arrow" },
  { id: "text", label: "Text" },
];

export const TOOL_INSTRUCTIONS = {
  select:
    "Click an annotation to select it, then drag it to move it or drag a point to reshape it. Alt+click a point to remove it. Double-click text to edit it. Delete removes the selection.",
  line: "Click to add points. Double-click or press Enter to finish; Escape abandons the line.",
  arrow:
    "Click to add points; the arrowhead goes on the last one. Double-click or press Enter to finish; Escape abandons the arrow.",
  text: "Click the map to place text, or click existing text to edit it. Enter saves, Shift+Enter starts a new line, Escape reverts.",
};

// A click and the blur it causes arrive as two events; a click this soon after
// a text box closed is the one that closed it, not a request for new text.
const BLUR_CLICK_WINDOW_MS = 600;

const handleStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: "#ffffff" }),
    stroke: new Stroke({ color: "#1f6feb", width: 2 }),
  }),
  geometry: (feature) => {
    const geometry = feature.getGeometry();
    const coordinates =
      geometry.getType() === "Point"
        ? [geometry.getCoordinates()]
        : geometry.getCoordinates();
    return new MultiPoint(coordinates);
  },
});

const isTyping = () => {
  const active = document.activeElement;
  return (
    active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable)
  );
};

const AnnotationEditor = ({ visualizationRef }) => {
  const {
    annotationEditSession: session,
    setAnnotationEditSession,
    setEditedAnnotations,
  } = useMapContext();
  const [tool, setTool] = useState(() =>
    session?.items?.length ? "select" : "arrow",
  );
  const [selectedId, setSelectedId] = useState(null);
  const [textEdit, setTextEdit] = useState(null);

  // Long-lived handles, set up once per session and read by every handler.
  const sourceRef = useRef(null);
  const layerRef = useRef(null);
  const projectionRef = useRef(null);
  const selectRef = useRef(null);
  const drawRef = useRef(null);
  const selectedIdRef = useRef(null);
  const textEditRef = useRef(null);
  // The text box's container: handed to an ol/Overlay, which positions it on
  // the map, and rendered into through a portal.
  const [textElement] = useState(() => document.createElement("div"));
  const overlayRef = useRef(null);
  const lastBlurAtRef = useRef(0);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  textEditRef.current = textEdit;
  selectedIdRef.current = selectedId;

  const findFeature = (id) =>
    sourceRef.current
      ?.getFeatures()
      .find((f) => f.get(ANNOTATION_ID_KEY) === id);

  // --- The session: working layer, hidden real layer, view swaps ----------
  useEffect(() => {
    const map = visualizationRef.current;
    if (!session || !map) return undefined;

    const code = map.getView().getProjection().getCode();
    projectionRef.current = code;
    // Collection-backed: a spatially indexed source returns features in index
    // order, and Done would hand the items back reordered.
    const source = new VectorSource({
      features: new Collection(itemsToFeatures(session.items, code)),
    });
    sourceRef.current = source;
    const annotationStyle = createAnnotationStyleFunction(session.defaults);
    const layer = new VectorLayer({
      className: "ol-layer annotation-editor",
      source,
      style: (feature) => {
        const styles = annotationStyle(feature);
        return feature.get(ANNOTATION_ID_KEY) === selectedIdRef.current
          ? [...styles, handleStyle]
          : styles;
      },
      updateWhileAnimating: true,
      updateWhileInteracting: true,
    });
    layerRef.current = layer;
    layer.setMap(map);

    // Hide the saved layer -- and any rebuild of it the map adds while the
    // session is open -- so its annotations do not draw under the working copy.
    const hidden = [];
    const visibleKeys = [];
    const hide = (candidate) => {
      if (
        !session.layerName ||
        candidate.get("name") !== session.layerName ||
        !candidate.getVisible()
      ) {
        return;
      }
      candidate.setVisible(false);
      hidden.push(candidate);
      // The layer control re-applies its own stored visibility when it opens
      // or re-syncs; the saved copy stays hidden for the session regardless.
      visibleKeys.push(
        candidate.on("change:visible", () => {
          if (candidate.getVisible()) candidate.setVisible(false);
        }),
      );
    };
    map.getLayers().forEach(hide);
    const addKey = map.getLayers().on("add", (event) => hide(event.element));

    // The working features are in view coordinates; a new view (a raster
    // adopting a projection) moves them with it instead of ending the session.
    const viewKey = map.on("change:view", () => {
      const next = map.getView().getProjection().getCode();
      if (next !== projectionRef.current) {
        reprojectAnnotationFeatures(
          source.getFeatures(),
          projectionRef.current,
          next,
        );
        projectionRef.current = next;
      }
    });

    const overlay = new Overlay({
      element: textElement,
      positioning: "bottom-left",
      stopEvent: true,
    });
    overlayRef.current = overlay;
    map.addOverlay(overlay);

    return () => {
      unByKey(addKey);
      unByKey(viewKey);
      map.removeOverlay(overlay);
      layer.setMap(null);
      unByKey(visibleKeys);
      hidden.forEach((candidate) => candidate.setVisible(true));
      sourceRef.current = null;
      layerRef.current = null;
      overlayRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const repaint = () => layerRef.current?.changed();

  // --- Text editing -----------------------------------------------------
  const openTextEdit = useCallback((feature, isNew) => {
    const geometry = feature.getGeometry();
    overlayRef.current?.setPosition(geometry.getCoordinates());
    const text =
      feature.get(ANNOTATION_TEXT_KEY) ??
      // istanbul ignore next -- every text feature carries a string:
      // itemsToFeatures and the Text tool both set one.
      "";
    setTextEdit({
      id: feature.get(ANNOTATION_ID_KEY),
      value: text,
      original: text,
      isNew,
    });
  }, []);

  const closeTextEdit = useCallback((commit) => {
    const edit = textEditRef.current;
    if (!edit) return;
    const feature = findFeature(edit.id);
    if (feature) {
      const value = commit ? edit.value : edit.original;
      if (String(value).trim() === "") {
        sourceRef.current.removeFeature(feature);
        if (selectedIdRef.current === edit.id) setSelectedId(null);
      } else {
        feature.set(ANNOTATION_TEXT_KEY, value);
        feature.changed();
      }
    }
    overlayRef.current?.setPosition(undefined);
    textEditRef.current = null;
    setTextEdit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Tools ------------------------------------------------------------
  useEffect(() => {
    const map = visualizationRef.current;
    const source = sourceRef.current;
    if (!session || !map || !source) return undefined;

    const cleanups = [];
    const add = (interaction) => {
      map.addInteraction(interaction);
      cleanups.push(() => map.removeInteraction(interaction));
      return interaction;
    };

    if (tool === "select") {
      const layers = [layerRef.current];
      // Selected features keep their own style; the layer adds the handles.
      const select = add(new Select({ layers, style: null, hitTolerance: 6 }));
      selectRef.current = select;
      const restore = findFeature(selectedIdRef.current);
      if (restore) select.getFeatures().push(restore);
      select.on("select", () => {
        const [feature] = select.getFeatures().getArray();
        setSelectedId(feature ? feature.get(ANNOTATION_ID_KEY) : null);
        repaint();
      });
      // Translate first, Modify last: the last interaction added sees a
      // pointerdown first, so a drag near a point reshapes rather than moves.
      add(new Translate({ features: select.getFeatures(), hitTolerance: 6 }));
      add(new Modify({ features: select.getFeatures() }));

      const dblKey = map.on("dblclick", (event) => {
        const feature = map.forEachFeatureAtPixel(event.pixel, (f) => f, {
          layerFilter: (candidate) => candidate === layerRef.current,
          hitTolerance: 6,
        });
        if (feature?.get(ANNOTATION_KIND_KEY) !== "text") return undefined;
        openTextEdit(feature, false);
        // Handled: stop the double-click from also zooming.
        event.preventDefault();
        return false;
      });
      cleanups.push(() => unByKey(dblKey));
      cleanups.push(() => {
        selectRef.current = null;
      });
    }

    if (tool === "line" || tool === "arrow") {
      if (selectedIdRef.current) {
        setSelectedId(null);
        repaint();
      }
      // A double-click finishes the line; it must not also zoom the map.
      const zooms = map
        .getInteractions()
        .getArray()
        .filter((i) => i instanceof DoubleClickZoom && i.getActive());
      zooms.forEach((i) => i.setActive(false));
      cleanups.push(() => zooms.forEach((i) => i.setActive(true)));

      const draw = add(new Draw({ source, type: "LineString" }));
      drawRef.current = draw;
      draw.on("drawend", (event) => {
        const { feature } = event;
        const existing = featuresToItems(
          source.getFeatures(),
          projectionRef.current,
        );
        const item = newAnnotationItem(tool, [], existing);
        feature.setId(item.id);
        feature.set(ANNOTATION_ID_KEY, item.id);
        feature.set(ANNOTATION_KIND_KEY, "line");
        feature.set(ANNOTATION_STYLE_KEY, item.style ?? null);
        // A single click then Enter leaves a one-point "line": drop it once
        // the Draw interaction has added it to the source.
        if (feature.getGeometry().getCoordinates().length < 2) {
          // removeFeature does nothing for a feature that is not there.
          setTimeout(() => source.removeFeature(feature), 0);
        }
      });
      cleanups.push(() => {
        drawRef.current = null;
      });
    }

    if (tool === "text") {
      if (selectedIdRef.current) {
        setSelectedId(null);
        repaint();
      }
      const clickKey = map.on("singleclick", (event) => {
        if (Date.now() - lastBlurAtRef.current < BLUR_CLICK_WINDOW_MS) return;
        if (textEditRef.current) {
          closeTextEdit(true);
          return;
        }
        const hit = map.forEachFeatureAtPixel(event.pixel, (f) => f, {
          layerFilter: (candidate) => candidate === layerRef.current,
          hitTolerance: 6,
        });
        if (hit?.get(ANNOTATION_KIND_KEY) === "text") {
          openTextEdit(hit, false);
          return;
        }
        const existing = featuresToItems(
          source.getFeatures(),
          projectionRef.current,
        );
        const item = newAnnotationItem("text", [0, 0], existing, "");
        const [feature] = itemsToFeatures([item], projectionRef.current);
        feature.getGeometry().setCoordinates(event.coordinate);
        source.addFeature(feature);
        openTextEdit(feature, true);
      });
      cleanups.push(() => unByKey(clickKey));
    }

    return () => cleanups.forEach((cleanup) => cleanup());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, session]);

  const deleteSelected = useCallback(() => {
    const feature = findFeature(selectedIdRef.current);
    if (feature) sourceRef.current.removeFeature(feature);
    selectRef.current?.getFeatures().clear();
    setSelectedId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Keyboard: finish/abandon a line, clear or delete the selection -----
  useEffect(() => {
    if (!session) return undefined;
    const onKeyDown = (event) => {
      if (isTyping()) return;
      const current = toolRef.current;
      if (current === "line" || current === "arrow") {
        if (event.key === "Enter") drawRef.current?.finishDrawing();
        if (event.key === "Escape") drawRef.current?.abortDrawing();
        return;
      }
      if (current === "select") {
        if (event.key === "Escape") {
          selectRef.current?.getFeatures().clear();
          setSelectedId(null);
          repaint();
        }
        if (
          (event.key === "Delete" || event.key === "Backspace") &&
          selectedIdRef.current
        ) {
          event.preventDefault();
          deleteSelected();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // --- Done and Cancel ---------------------------------------------------
  const handleDone = () => {
    drawRef.current?.finishDrawing();
    closeTextEdit(true);
    // With no working copy (the map was not there when the session opened)
    // nothing was edited: hand the items back as they came, not as an empty
    // list that would wipe the layer's annotations.
    const items = sourceRef.current
      ? featuresToItems(sourceRef.current.getFeatures(), projectionRef.current)
      : session.items;
    setEditedAnnotations(items);
    setAnnotationEditSession(null);
  };

  const handleCancel = () => {
    setAnnotationEditSession(null);
  };

  if (!session) return null;

  return (
    <>
      <Wrapper role="toolbar" aria-label="Annotation editor">
        <Row>
          <Title>
            Editing annotations
            {session.layerName ? `: ${session.layerName}` : ""}
          </Title>
          {TOOLS.map(({ id, label }) => (
            <ToolButton
              key={id}
              type="button"
              $active={tool === id}
              aria-pressed={tool === id}
              onClick={() => {
                closeTextEdit(true);
                setTool(id);
              }}
            >
              {label}
            </ToolButton>
          ))}
          <DeleteButton
            type="button"
            onClick={deleteSelected}
            disabled={tool !== "select" || !selectedId}
            aria-label="Delete selected annotation"
          >
            Delete
          </DeleteButton>
          <DoneButton type="button" onClick={handleDone}>
            Done
          </DoneButton>
          <ToolButton type="button" onClick={handleCancel}>
            Cancel
          </ToolButton>
        </Row>
        <Instructions role="status">{TOOL_INSTRUCTIONS[tool]}</Instructions>
      </Wrapper>
      {createPortal(
        textEdit ? (
          <TextBox
            aria-label="Annotation text"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            rows={2}
            value={textEdit.value}
            onChange={(event) =>
              setTextEdit((edit) => ({ ...edit, value: event.target.value }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                closeTextEdit(true);
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeTextEdit(false);
              }
            }}
            onBlur={() => {
              lastBlurAtRef.current = Date.now();
              closeTextEdit(true);
            }}
          />
        ) : null,
        textElement,
      )}
    </>
  );
};

AnnotationEditor.propTypes = {
  visualizationRef: PropTypes.shape({ current: PropTypes.instanceOf(Map) }),
};

export default memo(AnnotationEditor);
