import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import Button from "react-bootstrap/Button";
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
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import { Circle, Fill, Stroke, Style } from "ol/style.js";
import { unByKey } from "ol/Observable.js";
import { useMapContext } from "components/contexts/MapContext";
import {
  ARROWHEAD_OPTIONS,
  ANNOTATION_ID_KEY,
  ANNOTATION_KIND_KEY,
  ANNOTATION_STYLE_KEY,
  ANNOTATION_TEXT_KEY,
  featuresToItems,
  itemsToFeatures,
  annotationLabel,
  newAnnotationItem,
  reprojectAnnotationFeatures,
  resolveAnnotationStyle,
} from "components/map/annotations";
import { createAnnotationStyleFunction } from "components/map/annotationStyle";
import TextRotateInteraction, {
  rotateHandleCoordinate,
} from "components/map/textRotateInteraction";
import AnnotationStyleControl, {
  FIELDS_BY_KIND,
  FIELD_LABELS,
} from "components/inputs/AnnotationStyleControl";

// The on-map half of annotation editing. It mounts only while the DataViewer's
// MapContext holds a session -- started from the layer editor's Annotations
// tab -- so a map on the dashboard itself never gets these interactions.
//
// The working copy lives on an unmanaged layer (`setMap`), outside the map's
// layer collection: reconciliation never removes it and the layer switcher
// never lists it. The real layer is hidden for the session so annotations do
// not draw twice.

// Covers the map without taking its pointer events, and stacks the toolbar
// over the side panel -- so the panel always starts below the toolbar however
// far it wraps, and scrolls in whatever height is left.
const Layout = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
`;

const Card = styled.div`
  background: rgba(255, 255, 255, 0.97);
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  max-width: 100%;
`;

const Wrapper = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
`;

const Panel = styled(Card)`
  align-self: flex-end;
  width: 17rem;
  min-height: 0;
  overflow-y: auto;
  padding: 0.6rem 0.75rem;
`;

const PanelTitle = styled.h6`
  font-weight: 600;
  margin-bottom: 0.6rem;
  overflow-wrap: anywhere;
`;

const PanelField = styled.div`
  margin-bottom: 0.6rem;
`;

const PanelLabelRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
`;

const PanelLabel = styled.span`
  font-weight: 600;
  font-size: 0.85rem;
`;

const ResetButton = styled(Button)`
  font-size: 0.8rem;
  padding: 0;
`;

const DefaultNote = styled.span`
  color: #6c757d;
  font-size: 0.8rem;
`;

const PanelText = styled.textarea`
  width: 100%;
  font-size: 0.9rem;
  padding: 0.25rem;
  border: 1px solid #ced4da;
  border-radius: 4px;
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
    "Click an annotation to select it, then drag it to move it or drag a point to reshape it. Alt+click a point to remove it. Double-click text to edit it, or drag its round handle to rotate it (Shift snaps to 15°). The side panel changes the selection's text and style; Delete removes it.",
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

// The rotate handle of selected text, and a thin line back to the text so it
// reads as attached. Built per frame: its position depends on the resolution.
const rotateHandleStyles = (feature, rotation, resolution) => {
  const point = feature.getGeometry().getCoordinates();
  const handle = rotateHandleCoordinate(point, rotation, resolution);
  return [
    new Style({
      geometry: new LineString([point, handle]),
      stroke: new Stroke({ color: "#1f6feb", width: 1 }),
    }),
    new Style({
      geometry: new Point(handle),
      image: new Circle({
        radius: 6,
        fill: new Fill({ color: "#1f6feb" }),
        stroke: new Stroke({ color: "#ffffff", width: 2 }),
      }),
    }),
  ];
};

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

  // The rotation a text feature draws with: its override, else the default.
  const rotationOf = (feature) =>
    resolveAnnotationStyle(session?.defaults, feature.get(ANNOTATION_STYLE_KEY))
      .textRotation;

  const findFeature = (id) =>
    sourceRef.current
      ?.getFeatures()
      .find((f) => f.get(ANNOTATION_ID_KEY) === id);

  // The side panel reads the selected feature itself, which OpenLayers owns:
  // any change to it -- a drag, a rotation, a text edit -- re-renders it.
  const [, setRevision] = useState(0);
  const layoutRef = useRef(null);
  // What the panel's text field held when it took focus, restored if it is
  // left blank: emptying the field is not how text is deleted.
  const panelTextOriginalRef = useRef("");
  useEffect(() => {
    const feature = findFeature(selectedId);
    if (!feature) return undefined;
    const key = feature.on("change", () => setRevision((r) => r + 1));
    return () => unByKey(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, session]);

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
      style: (feature, resolution) => {
        const styles = annotationStyle(feature);
        if (feature.get(ANNOTATION_ID_KEY) !== selectedIdRef.current) {
          return styles;
        }
        if (feature.get(ANNOTATION_KIND_KEY) === "text") {
          return [
            ...styles,
            handleStyle,
            ...rotateHandleStyles(feature, rotationOf(feature), resolution),
          ];
        }
        return [...styles, handleStyle];
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
      // Added last, so a grab on the handle rotates rather than moves.
      add(
        new TextRotateInteraction({
          getSelectedText: () => {
            const feature = findFeature(selectedIdRef.current);
            return feature?.get(ANNOTATION_KIND_KEY) === "text"
              ? feature
              : null;
          },
          getRotation: rotationOf,
          onRotate: (feature, degrees) => {
            feature.set(ANNOTATION_STYLE_KEY, {
              ...(feature.get(ANNOTATION_STYLE_KEY) ?? {}),
              textRotation: degrees,
            });
            feature.changed();
          },
        }),
      );

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

  // Write one style property onto a feature, or clear it back to the layer
  // default; a feature left with no overrides carries none.
  const setOverride = (feature, field, value) => {
    const style = { ...(feature.get(ANNOTATION_STYLE_KEY) ?? {}) };
    if (value === undefined) {
      delete style[field];
    } else {
      style[field] = value;
    }
    feature.set(ANNOTATION_STYLE_KEY, Object.keys(style).length ? style : null);
    feature.changed();
  };

  const setText = (feature, value) => {
    feature.set(ANNOTATION_TEXT_KEY, value);
    feature.changed();
  };

  const renderPanel = (feature) => {
    const kind = feature.get(ANNOTATION_KIND_KEY);
    const overrides = feature.get(ANNOTATION_STYLE_KEY) ?? {};
    const resolved = resolveAnnotationStyle(session.defaults, overrides);
    const items = sourceRef.current.getFeatures().map((f) => ({
      id: f.get(ANNOTATION_ID_KEY),
      kind: f.get(ANNOTATION_KIND_KEY),
      text: f.get(ANNOTATION_TEXT_KEY),
      style: f.get(ANNOTATION_STYLE_KEY),
    }));
    const item = items.find((candidate) => candidate.id === selectedId);
    return (
      <Panel role="region" aria-label="Selected annotation">
        <PanelTitle>
          {annotationLabel(item, items, session.defaults)}
        </PanelTitle>
        {kind === "text" && (
          <PanelField>
            <PanelLabelRow>
              <PanelLabel>Text</PanelLabel>
            </PanelLabelRow>
            <PanelText
              aria-label="Selected annotation text"
              rows={2}
              value={feature.get(ANNOTATION_TEXT_KEY)}
              onFocus={() => {
                panelTextOriginalRef.current = feature.get(ANNOTATION_TEXT_KEY);
              }}
              onChange={(event) => setText(feature, event.target.value)}
              onBlur={() => {
                if (String(feature.get(ANNOTATION_TEXT_KEY)).trim() === "") {
                  setText(feature, panelTextOriginalRef.current);
                }
              }}
            />
          </PanelField>
        )}
        {FIELDS_BY_KIND[kind].map((field) => {
          const label = FIELD_LABELS[field];
          return (
            <PanelField key={field}>
              <PanelLabelRow>
                <PanelLabel>{label}</PanelLabel>
                {overrides[field] !== undefined ? (
                  <ResetButton
                    variant="link"
                    aria-label={`Reset ${label}`}
                    onClick={() => setOverride(feature, field, undefined)}
                  >
                    Reset to default
                  </ResetButton>
                ) : (
                  <DefaultNote>Layer default</DefaultNote>
                )}
              </PanelLabelRow>
              <AnnotationStyleControl
                field={field}
                value={resolved[field]}
                storedValue={overrides[field]}
                onChange={(value) => setOverride(feature, field, value)}
                containerRef={layoutRef}
                arrowheadOptions={ARROWHEAD_OPTIONS}
                compactAnchor
              />
            </PanelField>
          );
        })}
      </Panel>
    );
  };

  if (!session) return null;

  const selectedFeature =
    tool === "select" ? findFeature(selectedId) : undefined;

  return (
    <>
      <Layout ref={layoutRef}>
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
        {selectedFeature && renderPanel(selectedFeature)}
      </Layout>
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
