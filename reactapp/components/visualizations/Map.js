import {
  memo,
  useRef,
  useEffect,
  useState,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { isDecorationLayerEntry } from "components/map/decorationLayers";
import MapComponent from "components/map/Map";
import AttributeValue from "components/map/AttributeValue";
import HoverTooltip, {
  hoverTooltipPlacement,
} from "components/map/HoverTooltip";
import {
  queryLayerFeatures,
  createHighlightLayer,
  addHighlightFeatures,
  getGeometryAnchor,
  isTableEligible,
  hasModalPopup,
  createMarkerLayer,
  createClickToleranceFeatures,
  clickQueryTolerance,
  zoomsInsteadOfQuerying,
  configurationPropType,
  mapDrawingPropType,
  mapSelectionPropType,
  resolveMapSelection,
  mapSelectionLegendEntries,
  loadLayerJSONs,
  hasLegend,
  resolveTablePopupType,
  isClickEnabled,
  isHoverEnabled,
  isFieldMap,
  hoverAttributeRows,
  buildAttributeRows,
  collectLayerAttributeMaps,
  attributeOrderPropType,
  CLIENT_VECTOR_SOURCE_TYPES,
} from "components/map/utilities";
import { rankQueriedFeatures } from "components/map/ranking";
import { defaultStroke } from "components/inputs/RuleEditor";
import {
  buildSnapFeatureResult,
  shouldSnapSelect,
  findBestSnap,
  findSnapFeatures,
} from "components/map/snapping";
import useSnapping, {
  SNAP_PIXELS,
  GATHER_PIXELS,
} from "components/visualizations/useSnapping";
import PropTypes from "prop-types";
import { COLOR_RAMPS, resolveRamp } from "components/map/colorRamps";
import {
  classLegendItems,
  isClassStyleMode,
  rasterStyleSettings,
} from "components/map/geoTIFFStyle";
import { applyAutoRamp } from "components/map/ModuleLoader";
import { getBaseMapLayer } from "components/visualizations/utilities";
import { LAYER_STATE, parseProgress } from "components/map/layerStatus";
import { WebsocketContext } from "components/contexts/WebSocketContext";
import useRuntimeLayerFetcher from "components/visualizations/runtimeLayerFetcher";
import { isRuntimeRasterConfig } from "components/map/runtimeRaster";
import {
  AppContext,
  DataViewerModeContext,
  VariableInputsContext,
  LayoutContext,
  GridItemContext,
  TabContext,
} from "components/contexts/Contexts";
import { useMapContext } from "components/contexts/MapContext";
import { useViewGroupContext } from "components/contexts/ViewGroupContext";
import {
  isViewGroupMember,
  readViewGroupSettings,
  stripLabelsInPopup,
} from "components/map/viewGroup";
import PopupModal from "components/modals/PopupModal/PopupModal";
import PopupModalChrome from "components/modals/PopupModal/PopupModalChrome";
import PopupModalCarousel from "components/modals/PopupModal/PopupModalCarousel";
import { substituteTemplateString } from "components/modals/PopupModal/substituteTemplateString";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import { valuesEqual } from "components/modals/utilities";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import { Pagination, Navigation } from "swiper/modules";
import Overlay from "ol/Overlay";
import { FaTimes } from "react-icons/fa";

const FixedTable = styled(Table)`
  table-layout: fixed;
  font-size: small;
`;

const OverflowTD = styled.td`
  overflow-x: auto;
`;

const PopupDiv = styled.div`
  max-height: 40vh;
  overflow-y: auto;
  margin-bottom: 30px;
`;

const CenteredP = styled.p`
  text-align: center;
  margin: auto;
`;

const SwiperControls = styled.div`
  display: flex;
  justify-content: center; /* Center the controls */
  align-items: center; /* Vertically align the controls */
  position: absolute;
  bottom: 10px; /* Adjust as needed */
  width: 100%; /* Full width for proper alignment */
  z-index: 10;
  height: 2rem;
`;

const SwiperArrows = styled.div`
  font-size: 24px;
  color: #333;
  cursor: pointer;
  margin: 0 10px; /* Space between the arrows and pagination */
  padding: 5px;
  border-radius: 50%;
`;

const SwiperPagination = styled.div`
  font-size: 16px;
  color: #333;
  margin: 0 10px; /* Space between pagination and arrows */
  text-align: center;
`;

const MarginSwiperSlide = styled(SwiperSlide)`
  margin-bottom: 1rem;
`;

const StyledSwiper = styled(Swiper)`
  width: 20vw;
`;

const OverlayContentWrapper = styled.div`
  position: relative;
  background-color: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2);
`;

const StyledCloser = styled.a`
  position: absolute;
  top: 8px;
  right: 8px;
  cursor: pointer;
`;

const StyledContent = styled.div`
  margin-top: 1rem;
`;

// Legend swatch symbol for a styleless client vector. Its features render in
// OpenLayers' single default style, so the swatch should match the geometry:
// a circle for points (the default point shape), a line for lines, a square for
// polygons. Geometry is only known when the GeoJSON is inline -- a URL source is
// handed to OL as a URL and not fetched here -- so default to a circle, which
// matches the default point style and the most common case.
function defaultVectorSwatchSymbol(source) {
  const geojson = source?.geojson;
  const type =
    geojson && typeof geojson === "object" && Array.isArray(geojson.features)
      ? geojson.features.find((f) => f?.geometry?.type)?.geometry?.type
      : undefined;
  if (typeof type !== "string") return "circle";
  if (type.includes("Point")) return "circle";
  if (type.includes("LineString")) return "linestring";
  if (type.includes("Polygon")) return "polygon";
  return "circle";
}

// The colorbar legend entry for a continuous ramp, or null when the ramp name
// is not one the app knows. Shared by the saved-config legend and the runtime
// raster legend so both resolve colors (and reversal) the same way.
function buildRampColorbar({ rampName, rampReverse, rampMin, rampMax, title }) {
  if (typeof rampName !== "string" || !COLOR_RAMPS[rampName]) return null;
  return {
    rampColors: resolveRamp(rampName, rampReverse === true),
    rampMin,
    rampMax,
    title,
  };
}

// Marks the legend position a runtime GeoTIFF's colorbar fills. Its ramp is
// whatever the last successful fetch drew, which only the runtime fetcher
// knows, so the legend built from the saved configs holds a slot in layer order
// and the colorbar is dropped into it at render time.
const RUNTIME_RASTER_LEGEND_SLOT = Symbol("runtimeRasterLegendSlot");

export const Popup = ({
  layerAttributes,
  onSwipe,
  onSwiper,
  omittedPopupAttributes,
  aliases,
  order = {},
}) => {
  const filteredLayerAttributes = layerAttributes.map((feature) => {
    const omittedFields = omittedPopupAttributes[feature.layerName] || [];
    const rows = buildAttributeRows(feature.attributes, {
      isVisible: (key) => !omittedFields.includes(key),
      aliases: aliases[feature.layerName] || {},
      order: order[feature.layerName],
    });
    return { ...feature, rows };
  });

  return (
    <StyledSwiper
      modules={[Pagination, Navigation]}
      navigation={{ nextEl: ".custom-next", prevEl: ".custom-prev" }}
      pagination={{ el: ".custom-pagination", type: "fraction" }}
      className="mySwiper"
      simulateTouch={false}
      // Wrap at both ends: past the last feature comes the first, and back
      // from the first comes the last. `rewind` rather than `loop` because
      // loop mode clones slides and shifts `activeIndex` off the real index,
      // which is what the popup modal sync maps against. The popup modal's
      // carousel wraps the same way via `wrapIndex` in PopupModalCarousel —
      // keep the two in step.
      rewind
      onSlideChange={onSwipe}
      onSwiper={onSwiper}
    >
      {filteredLayerAttributes.map((selectedFeature, index) => (
        <MarginSwiperSlide key={index}>
          <PopupDiv>
            <div>
              <p>
                <b>{selectedFeature.layerName}</b>:
              </p>
              <FixedTable striped bordered hover size="sm">
                <thead>
                  <tr>
                    <th className="text-center" style={{ width: "33%" }}>
                      Field
                    </th>
                    <th className="text-center" style={{ width: "33%" }}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedFeature.rows.map(({ key, label, value }) => (
                    <tr key={key}>
                      <OverflowTD>{label}</OverflowTD>
                      <OverflowTD>
                        <AttributeValue value={value} />
                      </OverflowTD>
                    </tr>
                  ))}
                </tbody>
              </FixedTable>
            </div>
          </PopupDiv>
        </MarginSwiperSlide>
      ))}
      <SwiperControls>
        <SwiperArrows className="custom-prev" aria-label="Previous Swiper">
          ❮
        </SwiperArrows>
        <SwiperPagination className="custom-pagination"></SwiperPagination>
        <SwiperArrows className="custom-next" aria-label="Next Swiper">
          ❯
        </SwiperArrows>
      </SwiperControls>
    </StyledSwiper>
  );
};

// Stable overlay id so the linked-cursor marker can be addressed on a map
// without walking its overlay collection.
export const LINKED_CURSOR_OVERLAY_ID = "linked-cursor";

// Stable overlay id for the hover tooltip, for the same reason.
export const HOVER_TOOLTIP_OVERLAY_ID = "hover-tooltip";

// How long the cursor has to rest before a hover query goes out. The tooltip
// comes down on every move and is only queried for again once the cursor
// stops, which keeps ESRI/WMS `identify` endpoints to one request per pause.
const HOVER_DEBOUNCE_MS = 250;

// The mark a receiving map shows at a peer's cursor position. A crosshair
// rather than a dot: it reads as "the same place over there" without covering
// the feature underneath it.
const createLinkedCursorElement = () => {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.className = "linked-cursor-marker";
  // Decoration only -- it must never swallow the receiving map's own pointer
  // events. OpenLayers sets `pointer-events: auto` on its own overlay wrapper,
  // which is cleared alongside this when the overlay is built.
  element.style.pointerEvents = "none";
  element.style.width = "22px";
  element.style.height = "22px";
  element.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 22 22" focusable="false">' +
    '<g fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.85">' +
    '<circle cx="11" cy="11" r="4.5" /><path d="M11 0.5v3M11 18.5v3M0.5 11h3M18.5 11h3" />' +
    "</g>" +
    '<g fill="none" stroke="#1b6ec2" stroke-width="1.75" stroke-linecap="round">' +
    '<circle cx="11" cy="11" r="4.5" /><path d="M11 0.5v3M11 18.5v3M0.5 11h3M18.5 11h3" />' +
    "</g></svg>";
  return element;
};

const MapVisualization = ({
  mapConfig,
  mapExtent,
  mapDrawing,
  mapSelection,
  layers,
  visualizationRef,
  baseMap,
  layerControl,
  dataviewerViz,
  refreshCount,
}) => {
  const [mapLegend, setMapLegend] = useState();
  const [mapLayers, setMapLayers] = useState();
  // Which layers are still being prepared (style fetch, raster header read).
  // This phase runs before any OL layer exists, so the map's own per-layer
  // status map cannot see it and it is passed down instead.
  const [layerPrepStatus, setLayerPrepStatus] = useState({});
  // One list for both popups -- see the union built in onMapClick. Only a
  // click writes it: hover shows its own tooltip and never touches it.
  const [popupContent, setPopupContent] = useState(null);
  // Set when the user closes the modal, cleared by the next map click. The
  // modal's open state is derived from the active feature, so without this a
  // dismissal would be undone by the very next carousel step.
  const [modalDismissed, setModalDismissed] = useState(false);
  // The table's counterpart, set when the user closes the table while the
  // modal is showing and cleared by the next map click. The list is the
  // modal's too, so closing the table records a dismissal instead of clearing
  // it, and the modal stays on its feature.
  const [tableDismissed, setTableDismissed] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const markerLayer = useRef();
  const highlightLayer = useRef();
  // Whether a click draws the pin and the outline, and whether the legend
  // lists them. onMapClick reads the setting through the ref: MapComponent
  // binds the click handler only when the layers change, so an edit that
  // changes only this setting would otherwise leave the bound handler reading
  // the value from before it.
  const resolvedMapSelection = useMemo(
    () => resolveMapSelection(mapSelection),
    [mapSelection],
  );
  const mapSelectionRef = useRef(resolvedMapSelection);
  mapSelectionRef.current = resolvedMapSelection;
  const currentLayers = useRef([]);
  const currentBaseMap = useRef();
  const currentRefreshCount = useRef(refreshCount);
  // Whether the configs on the map are the ones the latest layer pass
  // prepared: false from the moment a pass starts until it publishes them, and
  // false again if an older pass publishes after it.
  const layerPass = useRef(0);
  const layersPublished = useRef(false);
  const mapAttributeVariablesRef = useRef({});
  const mapOmittedPopupAttributesRef = useRef({});
  const mapAttributeAliasesRef = useRef({});
  const mapAttributeOrderRef = useRef({});
  const mapContainerRef = useRef(null);
  // The pending hover query's timer. Every move restarts it, so a query only
  // goes out once the cursor settles (see HOVER_DEBOUNCE_MS).
  const hoverDebounceRef = useRef(null);
  // Moves on with every pointer move, hide, click, pan or zoom, and data swap.
  // A hover query records it before it awaits anything and drops its result
  // if it has moved on since: the debounce limits how many queries go out,
  // but not the order their responses come back in, so without this a late
  // response could put a tooltip up after a click or after the cursor left.
  const hoverGenerationRef = useRef(0);
  // The hover tooltip's overlay, and the React root that renders its rows.
  const hoverTooltipOverlayRef = useRef(null);
  const hoverTooltipRootRef = useRef(null);
  // Whether an extent is being drawn or annotations edited, for the hover
  // handlers. MapComponent binds those when the layers change, so state read
  // directly would be the value from that render.
  const hoverBlockedRef = useRef(false);
  // The table overlay's Swiper instance, so the popup modal's carousel can
  // drive it (see the modal -> table sync effect below).
  const swiperRef = useRef(null);
  // `onSwipe` is captured by the popup's separate React root, whose render
  // effect only re-runs on `popupContent`. It reads the list back through this
  // ref so a later change can't leave it acting on a stale one.
  const popupContentRef = useRef(null);
  // Whether the modal is showing and whether the table was closed, read back by
  // the table's close button and `closeModal`. The button is captured by the
  // same render effect as `onSwipe`, and `closeModal` is created once. Paging
  // and closing the modal re-run neither, so values read directly would be the
  // ones from when the list arrived.
  const showModalRef = useRef(false);
  const tableDismissedRef = useRef(false);
  // Coordinate of the gesture that opened the current popup; the fallback
  // anchor for a feature that carries no usable geometry.
  const popupAnchorRef = useRef(undefined);
  const {
    variableInputValues,
    variableInputDateFormats,
    setVariableInputValues,
  } = useContext(VariableInputsContext);
  // The setter as of this render, for the hover handler: MapComponent binds
  // that only when the layers change, so the setter it closed over can be
  // renders old. At the dashboard root it never changes, but inside a popup
  // layout FeatureScopedVariableInputs makes a new one whenever its values
  // change, and an old one diffs a write against the values it closed over --
  // skipping one that matches them though the current value differs.
  const setVariableInputValuesRef = useRef(setVariableInputValues);
  setVariableInputValuesRef.current = setVariableInputValues;
  const { inDataViewerMode } = useContext(DataViewerModeContext);
  const { uuid } = useContext(LayoutContext);
  const { sessionNonce } = useContext(AppContext);
  const { gridItemUUID } = useContext(GridItemContext) ?? {};
  const mapContextValue = useMapContext();
  const extentDrawMode = mapContextValue?.extentDrawMode ?? null;
  const annotationEditSession = mapContextValue?.annotationEditSession ?? null;

  const safeActiveFeatureIndex =
    popupContent && popupContent.length > 0
      ? Math.min(activeFeatureIndex, popupContent.length - 1)
      : 0;
  const activeFeature = popupContent?.[safeActiveFeatureIndex] ?? null;

  // The modal is a view of the selected feature, not a separate list: it opens
  // only while that feature's layer configures one, so stepping onto a
  // table-only feature closes it and stepping back reopens it. Click-only --
  // only a click writes the list -- and suppressed while an extent or
  // annotations are being drawn, or after the user dismissed it.
  const showModal =
    !modalDismissed &&
    !extentDrawMode &&
    !annotationEditSession &&
    hasModalPopup(activeFeature);
  const activeModalFeature = showModal ? activeFeature : null;

  useEffect(() => {
    showModalRef.current = showModal;
    tableDismissedRef.current = tableDismissed;
  }, [showModal, tableDismissed]);

  const closeModal = useCallback(() => {
    // The modal's open state is derived from the active feature, so closing it
    // is recorded as a dismissal rather than by clearing a list. It stays shut
    // for the rest of this gesture -- including across carousel steps -- and
    // the next map click clears the flag. An open table is left alone; with
    // the table already closed nothing shows the selection any more, so it is
    // cleared, as the table's own close button does.
    setModalDismissed(true);
    if (tableDismissedRef.current) {
      setPopupContent(null);
    }
    const container = mapContainerRef.current;
    if (container && typeof container.focus === "function") {
      container.focus();
    }
  }, []);

  // Takes the hover tooltip down and abandons any hover query still to come:
  // the pending one is cancelled, and the generation moves on so one already
  // in flight is dropped when it resolves. Every path that hides the tooltip
  // goes through here, so none can leave a query behind to put it back up.
  // Reads only refs, so a handler bound renders ago still acts on the live
  // overlay and timer.
  const cancelHover = useCallback(() => {
    hoverGenerationRef.current += 1;
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current);
      hoverDebounceRef.current = null;
    }
    // Guarded on the overlay carrying a position, so the many moves that find
    // nothing showing write nothing.
    const overlay = hoverTooltipOverlayRef.current;
    if (overlay && overlay.getPosition() !== undefined) {
      overlay.setPosition(undefined);
    }
  }, []);

  const dismissPopupBeforeSwap = useCallback(() => {
    // istanbul ignore next
    if (popupOverlayRef.current) {
      popupOverlayRef.current.setPosition(undefined);
    }
    // The tooltip describes the data being swapped out, too.
    cancelHover();
    setPopupContent(null);
    // Nothing is showing once the list is gone, so neither dismissal still
    // applies; the next click opens both popups as usual.
    setModalDismissed(false);
    setTableDismissed(false);
    if (highlightLayer.current?.getSource) {
      highlightLayer.current.getSource().clear();
    }
  }, [cancelHover]);

  // No tooltip while an extent is being drawn or annotations edited: the
  // pointer is doing something else. One already up comes down as the mode
  // starts, rather than waiting for the next move.
  useEffect(() => {
    hoverBlockedRef.current = Boolean(extentDrawMode || annotationEditSession);
    if (hoverBlockedRef.current) cancelHover();
  }, [extentDrawMode, annotationEditSession, cancelHover]);

  const { getMessageForRequest } = useContext(WebsocketContext) ?? {};
  const { errorsByLayerId, loadingByLayerId, rasterLegendByLayerId } =
    useRuntimeLayerFetcher({
      layers,
      gridItemUUID,
      sessionNonce,
      mapRef: visualizationRef,
      variableInputValues,
      variableInputDateFormats,
      onBeforeSwap: dismissPopupBeforeSwap,
      refreshTick: refreshCount,
    });

  const runtimeLayerState = { errorsByLayerId };

  // Name-keyed status for the layers whose plugin fetch is outstanding, so the
  // map's loading banner can name them alongside layers loading for any other
  // reason. Built by walking the live configs and reading the fetcher's entry
  // by id, never the other way round: the fetcher's entries are state cleared
  // inside an effect while this runs during render, so an entry-first walk can
  // resolve a name of `undefined` for a frame and put "Loading undefined" on
  // screen. A config with no name is skipped for the same reason.
  const runtimeLayerFetchStatus = useMemo(() => {
    const status = {};
    // istanbul ignore next -- unreachable: a missing `layers` prop throws in
    // this component's own effect and in useSnapping long before the fallback
    // could matter. Kept so this memo, which runs during render, is not the
    // thing that crashes first.
    (layers ?? []).forEach((layer) => {
      const layerProps = layer?.configuration?.props;
      const name = layerProps?.name;
      const layerId = layerProps?.layerId;
      if (!name || !layerId) return;
      // A failed fetch is reported on the same surface as a slow one. Without
      // this the banner simply dropped the layer's name when it failed, so a
      // broken layer and a finished one looked identical -- the other half of
      // the problem a loading report exists to solve.
      const failure = errorsByLayerId?.[layerId];
      if (failure) {
        status[name] = {
          state: LAYER_STATE.ERROR,
          message: failure.message,
          kind: failure.kind,
          percent: null,
        };
        return;
      }
      if (!loadingByLayerId?.[layerId]) return;
      const requestId =
        sessionNonce && gridItemUUID
          ? `${sessionNonce}:${gridItemUUID}:${layerId}`
          : null;
      // Percentages are optional: only a plugin that reports progress has one,
      // and only while the fetch it belongs to is still outstanding. Reading it
      // here rather than in the layers control keeps the banner the single
      // place loading is reported.
      const percent =
        requestId && getMessageForRequest
          ? parseProgress(getMessageForRequest(requestId))
          : null;
      status[name] = {
        state: LAYER_STATE.LOADING,
        message: null,
        kind: null,
        percent,
      };
    });
    return status;
  }, [
    layers,
    loadingByLayerId,
    errorsByLayerId,
    sessionNonce,
    gridItemUUID,
    getMessageForRequest,
  ]);

  // --- Linked cursor (U5) -------------------------------------------------
  // The marker lives here, not in MapComponent, because this is where the
  // map's overlays are built. An overlay is also the cheapest way to move a
  // mark: `Overlay#setPosition` writes one CSS transform and triggers no map
  // render, and it keeps the marker out of the layer collection, where layer
  // reconciliation would eventually sweep it away.
  const viewGroupContext = useViewGroupContext();
  const { activeTabId } = useContext(TabContext) ?? {};
  // A map nested in a popup modal draws no labels -- see stripLabelsInPopup
  // for why a per-feature label cannot mean anything in that scope. Dropped at
  // render rather than on save, so a label saved before the layer was reused in
  // a popup, or one a plugin supplied, is covered too.
  const layersForMap = useMemo(
    () => stripLabelsInPopup(mapLayers, activeTabId),
    [mapLayers, activeTabId],
  );

  const viewGroupName = readViewGroupSettings(mapExtent).viewGroup;
  // The same membership rules MapComponent applies to the view half of a
  // group, so the two halves are never enabled independently of each other.
  const cursorGroupEnabled = isViewGroupMember({
    viewGroupName,
    hasViewGroupContext: Boolean(viewGroupContext),
    dataviewerViz,
    activeTabId,
    gridItemUUID,
  });
  // MapComponent already registers `gridItemUUID` for the view half, and the
  // registry keys members by id -- registering again under the same id would
  // replace that record and silently break view syncing. The cursor half joins
  // under its own derived id instead, which also excludes the publisher from
  // its own fan-out for free.
  const cursorMemberId = gridItemUUID ? `${gridItemUUID}::cursor` : null;
  const cursorOverlayRef = useRef(null);
  // The group this map's cursor half is registered under. Read from listeners
  // and registry callbacks, both of which outlive the render that bound them.
  const activeCursorGroupRef = useRef(null);
  // The coordinate waiting on the next animation frame, and that frame's
  // handle. A pointer move fires far more often than the screen refreshes, so
  // only the last position of each frame is ever published.
  const cursorPendingRef = useRef(null);
  const cursorFrameRef = useRef(null);
  // What this map last told the group. A pointer parked on the popup, or held
  // down mid-draw, then publishes one clear rather than one per move.
  const cursorPublishedRef = useRef(null);
  const cursorApplyRef = useRef(null);
  const cursorClearRef = useRef(null);
  const cursorHideRef = useRef(null);
  const cursorMoveRef = useRef(null);

  const spinnerOverlayRef = useRef(null);
  // Create a spinner element for the overlay
  const spinnerElement = document.createElement("div");
  // Named so a dashboard image export can leave it out.
  spinnerElement.className = "map-query-spinner";
  spinnerElement.style.display = "flex";
  spinnerElement.style.justifyContent = "center";
  spinnerElement.style.alignItems = "center";
  spinnerElement.style.width = "48px";
  spinnerElement.style.height = "48px";
  spinnerElement.innerHTML = `<div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 32px; height: 32px; animation: spin 1s linear infinite;"></div><style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>`;
  const popupOverlayRef = useRef(null);
  const popupContainerRef = useRef(document.createElement("div"));
  const popupRootRef = useRef(null);

  const drawing = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mount the React popup inside the container div
  useEffect(() => {
    popupRootRef.current = createRoot(popupContainerRef.current);
    const popupOverlay = new Overlay({
      element: popupContainerRef.current,
      autoPan: true,
      autoPanAnimation: { duration: 250 },
    });

    spinnerOverlayRef.current = new Overlay({
      element: spinnerElement,
      positioning: "center-center",
    });

    const cursorOverlay = new Overlay({
      id: LINKED_CURSOR_OVERLAY_ID,
      element: createLinkedCursorElement(),
      // Critical: `autoPan` would drag the receiving map around under the
      // viewer on every pointer move of the source.
      autoPan: false,
      // Not in the stop-event container, so the marker never intercepts the
      // receiving map's clicks, hovers or drags -- and so the popup, which is
      // in that container, always draws above it.
      stopEvent: false,
      positioning: "center-center",
    });
    // OpenLayers gives its own overlay wrapper `pointer-events: auto`, which
    // would put the wrapper back in the way of the element it wraps.
    // istanbul ignore else
    if (cursorOverlay.element) {
      cursorOverlay.element.style.pointerEvents = "none";
    }
    cursorOverlayRef.current = cursorOverlay;

    // The hover tooltip, set up like the cursor marker and for the same
    // reasons: it follows the pointer, so panning the map to fit it would move
    // the map under the cursor, and it must never take the hover, click or
    // drag it describes. It also sits outside the stop-event container, so an
    // open click table draws above it. Named so a dashboard image export can
    // leave it out.
    const tooltipElement = document.createElement("div");
    tooltipElement.className = "map-hover-tooltip";
    tooltipElement.style.pointerEvents = "none";
    hoverTooltipRootRef.current = createRoot(tooltipElement);
    const tooltipOverlay = new Overlay({
      id: HOVER_TOOLTIP_OVERLAY_ID,
      element: tooltipElement,
      autoPan: false,
      stopEvent: false,
    });
    // istanbul ignore else
    if (tooltipOverlay.element) {
      tooltipOverlay.element.style.pointerEvents = "none";
    }
    hoverTooltipOverlayRef.current = tooltipOverlay;

    // istanbul ignore next
    if (visualizationRef?.current) {
      // known non-coverage for tests
      visualizationRef.current.addOverlay(spinnerOverlayRef.current);
      visualizationRef.current.addOverlay(cursorOverlay);
      visualizationRef.current.addOverlay(tooltipOverlay);
      visualizationRef.current.addOverlay(popupOverlay);
      popupOverlayRef.current = popupOverlay;
    }

    return () => {
      // istanbul ignore next
      if (visualizationRef?.current) {
        // known non-coverage for tests
        if (spinnerOverlayRef.current) {
          visualizationRef.current.removeOverlay(spinnerOverlayRef.current);
        }
        if (cursorOverlayRef.current) {
          visualizationRef.current.removeOverlay(cursorOverlayRef.current);
        }
        if (hoverTooltipOverlayRef.current) {
          visualizationRef.current.removeOverlay(
            hoverTooltipOverlayRef.current,
          );
        }
        if (popupOverlayRef.current) {
          // eslint-disable-next-line
          visualizationRef.current.removeOverlay(popupOverlayRef.current);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualizationRef]);

  useEffect(() => {
    // istanbul ignore next
    if (popupRootRef.current) {
      popupRootRef.current.render(
        <OverlayContentWrapper aria-label="Map Popup" id="map-popup">
          <StyledCloser
            href="#"
            id="popup-closer"
            className="ol-popup-closer"
            aria-label="Popup Closer"
            onClick={(e) => {
              e.preventDefault();
              popupOverlayRef.current.setPosition(undefined);
              // While the modal is showing, closing the table only hides it:
              // clearing the list would close the modal with it. The modal
              // keeps its feature until it is closed or the next click.
              if (showModalRef.current) {
                setTableDismissed(true);
              } else {
                setPopupContent(null);
              }
            }}
          >
            <FaTimes />
          </StyledCloser>
          <StyledContent aria-label="Map Popup Content" id="popup-content">
            {popupContent ? (
              <Popup
                layerAttributes={popupContent}
                onSwipe={onSwipe}
                onSwiper={(swiper) => {
                  swiperRef.current = swiper;
                }}
                omittedPopupAttributes={mapOmittedPopupAttributesRef.current}
                aliases={mapAttributeAliasesRef.current}
                order={mapAttributeOrderRef.current}
              />
            ) : (
              <CenteredP>No Attributes Found</CenteredP>
            )}
          </StyledContent>
        </OverlayContentWrapper>,
      );

      // The highlight and the variable-input update used to be driven from
      // here, off popupContent[0]. Both now live in the active-feature effect
      // below, which covers the first feature and every step after it.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popupContent]);

  // Does the table popup have anything to render for this feature? Mirrors the
  // check the click handler used to run over the whole result set, applied per
  // feature now that navigation can land on any of them.
  const hasVisiblePopupAttributes = (feature) => {
    if (!feature.attributes || Object.keys(feature.attributes).length === 0) {
      return false;
    }
    const omittedFields =
      mapOmittedPopupAttributesRef.current[feature.layerName] || [];
    return Object.keys(feature.attributes).some(
      (key) => !omittedFields.includes(key),
    );
  };

  // Does this feature's layer publish any of its attributes to a variable
  // input? Keyed on layer name and entirely independent of the omitted-attribute
  // config, so a layer can hide every attribute from the table and still drive a
  // chart. That combination is a normal "hide the ugly table, just drive the
  // chart below" setup, which is why such a feature must survive the
  // nothing-to-render filter below even though it renders nothing itself.
  const publishesVariableInputs = (feature) =>
    Boolean(
      feature?.layerName &&
      mapAttributeVariablesRef.current?.[feature.layerName],
    );

  // Keep the active feature current for `onSwipe`, which is captured by the
  // popup's separate React root (its render effect only re-runs on
  // `popupContent`) and would otherwise read a stale list.
  useEffect(() => {
    popupContentRef.current = popupContent;
  }, [popupContent]);

  // What follows the selected feature itself: the highlight and the variable
  // inputs. With one list for both popups these can no longer disagree about
  // which feature is selected. The table overlay follows it in the next effect,
  // kept separate so that closing the table -- which only hides the overlay --
  // does not write the variable inputs again over anything changed since.
  useEffect(() => {
    if (!activeFeature) return;

    if (highlightLayer.current) {
      highlightLayer.current.getSource().clear();
      if (activeFeature.geometry) {
        addHighlightFeatures(highlightLayer.current, activeFeature.geometry);
      }
    }
    // The selection's variable inputs, from the attribute maps the click
    // merged across its layers. Hover writes a hover-only layer's inputs
    // itself (see runHoverQuery), from that layer's own maps.
    updateVariableInputsForFeature(activeFeature, {
      variables: mapAttributeVariablesRef.current,
      aliases: mapAttributeAliasesRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeature]);

  // The table popup's slide and the overlay's position. The overlay is
  // anchored to the active feature's geometry rather than to the click point,
  // and hides entirely when that feature isn't table-eligible (a modal-only
  // layer) -- otherwise it would sit there showing a different feature than
  // the modal -- or while the user has the table closed.
  useEffect(() => {
    if (!activeFeature) return;

    const tableCanShow =
      isTableEligible(activeFeature) &&
      hasVisiblePopupAttributes(activeFeature);

    if (tableDismissed) {
      // Paging the modal onto a feature that has no modal closes it, as
      // always. If the table can show that feature, reopen the table so the
      // selection stays on screen rather than leaving neither popup open.
      if (tableCanShow && !hasModalPopup(activeFeature)) {
        setTableDismissed(false);
      }
      popupOverlayRef.current?.setPosition(undefined);
      return;
    }

    // Hide the overlay rather than anchor it when the table has nothing to
    // show for this feature: either its layer isn't click-driven for the table
    // (a modal-only layer), or every one of its attributes is omitted.
    if (!tableCanShow) {
      popupOverlayRef.current?.setPosition(undefined);
      return;
    }

    const swiper = swiperRef.current;
    // Guard the no-op case: `slideTo` with the current index would still be a
    // wasted call, and skipping it keeps the slideChange -> onSwipe ->
    // setActiveFeatureIndex round trip from firing at all.
    if (
      swiper &&
      !swiper.destroyed &&
      swiper.activeIndex !== safeActiveFeatureIndex
    ) {
      swiper.slideTo(safeActiveFeatureIndex);
    }
    // Anchor on the feature, falling back to the gesture's own coordinate for
    // a feature with no usable geometry (e.g. a non-spatial result from a
    // custom feature source) so the popup still appears where the user acted.
    const anchor =
      getGeometryAnchor(activeFeature.geometry) ?? popupAnchorRef.current;
    // istanbul ignore else -- defensive: `onMapClick` always records
    // `popupAnchorRef` before setting the content, so the fallback is never
    // empty here. Guarded so a future path that skips it can't call
    // setPosition(undefined) and silently hide the popup.
    if (anchor) {
      popupOverlayRef.current?.setPosition(anchor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeature, safeActiveFeatureIndex, tableDismissed]);

  useEffect(() => {
    const updateLayers = async () => {
      const layersChanged =
        layers && !valuesEqual(layers, currentLayers.current);
      const baseMapChanged = !valuesEqual(baseMap, currentBaseMap.current);
      // A refresh prepares every layer again from its saved config: saved
      // style and GeoJSON files are downloaded again, and the map rebuilds the
      // vector layers, so one drawn from a URL or a feature service fetches its
      // features again. Plugin layers refetch on their own, in the fetcher.
      const refreshed = refreshCount !== currentRefreshCount.current;
      if (layersChanged || baseMapChanged || refreshed) {
        const previousBaseMap = currentBaseMap.current;
        currentBaseMap.current = baseMap;
        currentRefreshCount.current = refreshCount;
        currentLayers.current = JSON.parse(JSON.stringify(layers));
        const newMapLegend = [];

        const baseMapLayer = baseMap ? getBaseMapLayer(baseMap) : null;
        if (baseMap && !baseMapLayer) {
          console.error(`${baseMap} is not a valid basemap`);
        }
        if (baseMapLayer) {
          baseMapLayer.props.zIndex = 0;
        }
        // Swap only the base map entry; everything else that was already
        // published stays.
        //
        // Publishing the base map alone used to hand the map a layer list
        // with no runtime layers in it. The reconciliation found no id to
        // preserve and tore every runtime layer off, and because that run is
        // superseded by the full publish below, it never records what it
        // rendered -- so the winning run compares against the pre-change list,
        // identity-matches the layer it believes is still mounted, and skips
        // constructing it. The layer ends up removed with nothing rebuilt,
        // which is why changing the base map made plugin layers disappear.
        //
        // Keeping the already-prepared entries means the reconciliation
        // matches them by identity and leaves their OpenLayers layers, and
        // their features, untouched. Their zIndex values were assigned on the
        // publish that placed them and still order them behind index 0.
        const previousBaseMapName = previousBaseMap
          ? getBaseMapLayer(previousBaseMap)?.props?.name
          : null;
        const swapBaseMap = () =>
          setMapLayers((previous) => {
            const published = previous ?? [];
            const kept = previousBaseMapName
              ? published.filter(
                  (config) => config?.props?.name !== previousBaseMapName,
                )
              : published;
            return baseMapLayer ? [baseMapLayer, ...kept] : kept;
          });

        // Only the base map changed, so the swap is all there is to do. The
        // layers on the map were prepared from this same saved config, and
        // preparing them again downloaded the same style and GeoJSON files and
        // handed the map new config objects -- which it reads as new layers,
        // rebuilding every vector layer and refetching its features. The swap
        // gives it back the very objects it built them from, which is how it
        // knows to leave them alone.
        //
        // Not while a pass is still preparing: its publish lands after this
        // swap, carrying the base map it started with, so the new base map
        // goes through a full pass of its own instead.
        if (!layersChanged && !refreshed && layersPublished.current) {
          swapBaseMap();
          return;
        }
        layerPass.current += 1;
        const pass = layerPass.current;
        layersPublished.current = false;

        // The basemap depends on nothing asynchronous, so it goes to the map
        // before the layers are prepared rather than after. Preparing a layer
        // costs a style fetch from the backend and, for a raster, a header read
        // plus a possible sidecar read -- and until now none of it was published
        // until all of it had finished, so a dashboard with a couple of layers
        // showed an empty white map for as long as that took.
        if (baseMapLayer) {
          swapBaseMap();
        }

        // Prepared in parallel. These are independent per layer -- each awaits
        // its own network reads and mutates only its own config -- so the wall
        // clock was the sum of every layer's latency for no reason. Order is
        // preserved by assembling the legend from the original array afterwards.
        setLayerPrepStatus(
          Object.fromEntries(
            layers
              .map((layer) => layer.configuration?.props?.name)
              .filter(Boolean)
              .map((name) => [name, { state: "loading" }]),
          ),
        );
        const clearPrepStatus = (name) =>
          setLayerPrepStatus((previous) => {
            if (!(name in previous)) return previous;
            const { [name]: _removed, ...rest } = previous;
            return rest;
          });
        await Promise.all(
          layers.map(async (layer) => {
            try {
              await loadLayerJSONs(layer, uuid);
            } finally {
              clearPrepStatus(layer.configuration?.props?.name);
            }
          }),
        );

        // Published as soon as the saved references are resolved, and before
        // any raster has been read. From here the map builds each layer
        // independently and mounts it the moment it is ready, so a fast
        // shapefile is on screen while a slow raster is still reading its
        // header. Waiting for every layer first made the map only as quick as
        // its slowest layer, which is what this barrier used to be.
        const newMapLayers = layers.map((layer) => layer.configuration);
        if (baseMapLayer) {
          newMapLayers.unshift(baseMapLayer);
        }
        newMapLayers.forEach((layer, index) => {
          layer.props.zIndex = index;
        });
        setMapLayers(newMapLayers);
        layersPublished.current = pass === layerPass.current;

        // Nothing waits on this. A ramp-styled raster's range comes from its
        // header, and the colorbar cannot be labelled until that is read -- but
        // the layer itself does not need the legend, and the map resolves the
        // same ramp for its own construction. So the legend arrives when the
        // stats do (the two reads share one fetch; see applyAutoRamp).
        //
        // A runtime raster is skipped: it has no file until its plugin runs,
        // and its range is resolved per fetch by the runtime fetcher instead.
        await Promise.all(
          layers.map((layer) =>
            isRuntimeRasterConfig(layer.configuration)
              ? undefined
              : applyAutoRamp(layer.configuration),
          ),
        );

        for (const layer of layers) {
          if (hasLegend(layer.legend)) {
            if (
              layer.legend === "default" &&
              isRuntimeRasterConfig(layer.configuration)
            ) {
              newMapLegend.push({
                [RUNTIME_RASTER_LEGEND_SLOT]: layer.configuration.props.layerId,
                title: layer.configuration.props.name,
              });
              continue;
            }
            if (layer.legend === "default") {
              const rampSource = layer.configuration?.props?.source;
              const isRaster =
                rampSource?.type === "GeoTIFF" || rampSource?.type === "Zarr";
              // A raster's ramp settings are its saved style. What was
              // resolved about its file -- the range, whether it stayed
              // normalized -- is on its source.
              const rampStyle = isRaster
                ? rasterStyleSettings(layer.configuration.style)
                : {};
              // A class-table raster (Categorical or Ranges) gets one swatch
              // per class rather than a colorbar — a gradient would imply a
              // continuum the classes do not have. Ranges lists them in
              // ascending bound order, the order it colors them in.
              if (
                isClassStyleMode(rampStyle.styleMode) &&
                rampStyle.classes?.length
              ) {
                newMapLegend.push({
                  title: layer.configuration?.props?.name,
                  items: classLegendItems(rampStyle),
                });
                continue;
              }
              // Zarr renders through a GeoTIFF source, so it gets the same
              // colorbar. In auto mode the range comes from the resolved
              // stats rather than author-entered values.
              const rampMin = rampStyle.rampMin ?? rampSource?.resolvedRampMin;
              const rampMax = rampStyle.rampMax ?? rampSource?.resolvedRampMax;
              // When no range can be resolved (a file with no embedded
              // statistics), applyAutoRamp leaves the raster rendering on a
              // normalized 0..1 scale. Label the colorbar 0..1 in that case
              // rather than dropping the legend entirely; without this a
              // ramp-styled raster shows no legend at all. `normalize` is an OL
              // GeoTIFF source prop, which applyAutoRamp sets under
              // `source.props` when the layer loads.
              const normalized = rampSource?.props?.normalize === true;
              const effRampMin = rampMin ?? (normalized ? 0 : undefined);
              const effRampMax = rampMax ?? (normalized ? 1 : undefined);
              const colorbar =
                isRaster && effRampMin !== undefined && effRampMax !== undefined
                  ? buildRampColorbar({
                      rampName: rampStyle.rampName,
                      rampReverse: rampStyle.rampReverse,
                      rampMin: effRampMin,
                      rampMax: effRampMax,
                      title: layer.configuration?.props?.name,
                    })
                  : null;
              if (colorbar) {
                newMapLegend.push(colorbar);
                continue;
              }
              // If the layer has a style JSON, pass it as legend metadata
              if (layer.configuration.style) {
                let styleJSON = layer.configuration.style;
                if (typeof layer.configuration.style === "string") {
                  try {
                    styleJSON = JSON.parse(layer.configuration.style);
                  } catch {
                    newMapLegend.push(null);
                  }
                }

                if (styleJSON && (styleJSON.rules || styleJSON.default)) {
                  newMapLegend.push({
                    styleJSON,
                    title: layer.configuration?.props?.name,
                  });
                } else {
                  newMapLegend.push(null);
                }
              } else {
                const noStyleSourceType = layer.configuration.props.source.type;
                // A client-drawn vector with no configured style renders in
                // OpenLayers' single default symbol, so a "default" legend has
                // no symbology to describe and used to come out empty. Show one
                // swatch in the default color instead. ESRI Feature Service is
                // excluded: it has a real service legend that LegendRenderer
                // fetches from the {sourceType, url} shape below.
                if (
                  CLIENT_VECTOR_SOURCE_TYPES.includes(noStyleSourceType) &&
                  noStyleSourceType !== "ESRI Feature Service"
                ) {
                  newMapLegend.push({
                    title: layer.configuration?.props?.name,
                    items: [
                      {
                        color: defaultStroke,
                        label: layer.configuration?.props?.name,
                        symbol: defaultVectorSwatchSymbol(
                          layer.configuration.props.source,
                        ),
                      },
                    ],
                  });
                } else {
                  newMapLegend.push({
                    sourceType: noStyleSourceType,
                    url: layer.configuration.props.source.props.url,
                    layers:
                      layer.configuration.props.source.props?.params?.LAYERS,
                  });
                }
              }
            } else {
              newMapLegend.push(layer.legend);
            }
          }
        }

        setMapLegend(newMapLegend);
      }
    };

    updateLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, baseMap, refreshCount]);

  // The layers' part of the legend the map shows: the one built from the saved
  // configs, with each runtime raster's slot filled from the ramp its last
  // successful fetch drew.
  // A slot with no fetch yet (or a fetch that drew no colorbar) is dropped, so
  // the raster shows nothing rather than its saved scaffold ramp, which may not
  // be what is on screen. Only "default" legends hold a slot; an author's own
  // legend went through untouched above.
  const layersLegend = useMemo(() => {
    if (!mapLegend?.some((entry) => entry?.[RUNTIME_RASTER_LEGEND_SLOT])) {
      return mapLegend;
    }
    return mapLegend.flatMap((entry) => {
      const layerId = entry?.[RUNTIME_RASTER_LEGEND_SLOT];
      if (!layerId) return [entry];
      const ramp = rasterLegendByLayerId?.[layerId];
      // A class-table style publishes its swatches rather than a ramp.
      if (ramp?.items) {
        return ramp.items.length > 0
          ? [{ title: entry.title, items: ramp.items }]
          : [];
      }
      const colorbar =
        ramp && buildRampColorbar({ ...ramp, title: entry.title });
      return colorbar ? [colorbar] : [];
    });
  }, [mapLegend, rasterLegendByLayerId]);

  // Then the Map Selection entries the author asked for, after every layer's.
  // They describe what a click draws, so they are listed before anything has
  // been clicked, and on a map whose layers have no legend at all.
  const displayedMapLegend = useMemo(() => {
    const selectionEntries = mapSelectionLegendEntries(resolvedMapSelection);
    if (selectionEntries.length === 0) return layersLegend;
    return [...(layersLegend ?? []), ...selectionEntries];
  }, [layersLegend, resolvedMapSelection]);

  // Swiping the table popup just moves the shared index; the active-feature
  // effects do the rest (highlight, anchor, variable inputs, and opening or
  // closing the modal). One list means the Swiper's index IS the shared index,
  // so there is no mapping to do.
  const onSwipe = (swiper) => {
    const features = popupContentRef.current;
    // istanbul ignore next — defensive guard against a popupContent / Swiper
    // desync. Unreachable in practice: when popupContent goes to null the
    // Popup unmounts (taking Swiper with it), and Swiper keeps activeIndex in
    // bounds of the rendered slides.
    if (!features || !features[swiper.activeIndex]) return;
    setActiveFeatureIndex(swiper.activeIndex);
  };

  const setAttributeMapRefs = ({ aliases, variables, omitted, order }) => {
    mapAttributeAliasesRef.current = aliases;
    mapAttributeVariablesRef.current = variables;
    mapOmittedPopupAttributesRef.current = omitted;
    mapAttributeOrderRef.current = order;
  };

  // Writes the feature's linked fields to their variable inputs. `variables`
  // and `aliases` are the attribute maps to read them through, keyed by
  // sublayer: a click passes the maps it merged across its layers, and hover
  // passes the hovered feature's own layer's, since hover keeps no merged set.
  const updateVariableInputsForFeature = (
    selectedFeature,
    { variables, aliases },
  ) => {
    const layerName = selectedFeature.layerName;
    const attributes = selectedFeature.attributes ?? {};
    const mapAttributeVariables = variables ?? {};

    // for mapped variable inputs, get the selected feature values and set the variable inputs accordingly
    if (layerName && mapAttributeVariables[layerName]) {
      let updatedVariableInputs = {};
      for (const layerAttributeOrAlias in mapAttributeVariables[layerName]) {
        // Try to derive both the alias and the original field name from attributeAliases
        let layerAttribute = layerAttributeOrAlias;
        let layerAttributeAlias = layerAttributeOrAlias;
        const aliasMap = aliases?.[layerName] || {};
        // If the aliasMap has a mapping for this key, set alias and try to find the original
        if (aliasMap[layerAttributeOrAlias]) {
          layerAttributeAlias = aliasMap[layerAttributeOrAlias];
        } else {
          // Try to find if this is an alias value (reverse lookup)
          const originalKey = Object.keys(aliasMap).find(
            (k) => aliasMap[k] === layerAttributeOrAlias,
          );
          if (originalKey) {
            layerAttribute = originalKey;
            layerAttributeAlias = layerAttributeOrAlias;
          }
        }

        const variableInputName =
          mapAttributeVariables[layerName][layerAttributeOrAlias];

        // Prefer the field, fall back to the alias only when the field is
        // genuinely absent. A `||` here would also discard a real 0, "" or
        // false.
        const fromField = attributes[layerAttribute];
        const featureValue =
          fromField === undefined || fromField === null
            ? attributes[layerAttributeAlias]
            : fromField;

        // Absent means cleared, not left alone. Skipping the write leaves the
        // variable holding the previously clicked feature's value, so every
        // dependent visualization keeps showing the wrong feature's data with no
        // indication anything is stale -- the only path here that propagates a
        // wrong value off the map. Presence is tested rather than truthiness, so
        // a real 0, "" or false is carried through instead of being dropped.
        const isAbsent =
          featureValue === undefined ||
          featureValue === null ||
          featureValue === "Null";
        updatedVariableInputs[variableInputName] = isAbsent ? "" : featureValue;
      }
      if (Object.keys(updatedVariableInputs).length > 0) {
        // Hover re-queries on every pause, often over the feature it already
        // wrote; handing back the same object then lets React skip a
        // re-render of everything that reads the variable inputs. The setter
        // is read through its ref, as hover calls this from a handler bound
        // renders ago.
        setVariableInputValuesRef.current((previousVariableInputValues) =>
          Object.entries(updatedVariableInputs).every(([name, value]) =>
            Object.is(previousVariableInputValues[name], value),
          )
            ? previousVariableInputValues
            : { ...previousVariableInputValues, ...updatedVariableInputs },
        );
      }
    }
  };

  // --- Feature snapping (Approach A) -------------------------------------
  // Snap orchestration (hidden vector caches, hover preview, live-visibility
  // filtering, generation-tokened moveend refresh) lives in the useSnapping
  // hook; the click/hover handlers below wire its returned callbacks in.
  const { refreshSnapCaches, updateSnap, visibleSnapCaches, clearSnapPreview } =
    useSnapping({ layers });

  const onMapClick = async (map, evt) => {
    // A click takes the hover tooltip down, whatever it goes on to do, and
    // drops any hover result still on its way.
    cancelHover();

    // istanbul ignore next
    if (drawing.current || isProcessing) return;

    // Compute the queryable layer set FIRST, before any side effects. If
    // nothing is click-eligible (e.g., the map has only hover-tagged
    // layers), bail entirely — no marker, no spinner, no popup state
    // change: a click there has no meaning, and should not clear a
    // selection made earlier.
    //
    // Skip layers the user has hidden via the layer control. The OL layer
    // is the source of truth for visibility because LayersControl mutates
    // `olLayer.setVisible(...)` directly; the config-side `layers` array
    // is not re-synced on toggle. If a config layer has no matching OL
    // layer (e.g., not yet mounted) keep it queryable as a safe default.
    const olLayerVisibility = new Map();
    map
      .getLayers()
      .getArray()
      .forEach((olLayer) => {
        const name = olLayer.get("name");
        if (name) olLayerVisibility.set(name, olLayer.getVisible());
      });
    // Include a layer for click queries when its modal popup is configured
    // (the modal is always click-driven) OR it shows the click table. A
    // hover-only layer is queried only by onMapHover, and a layer with neither
    // popup and no modal is off entirely.
    const queryableLayers = layers.filter((item) => {
      // Keyed on the source type rather than the popup settings, so a
      // decoration saved without `tablePopupType` cannot default into queries.
      if (isDecorationLayerEntry(item)) return false;
      const modalEnabled = item.popupConfig?.mode === "modal";
      if (!modalEnabled && !isClickEnabled(item)) return false;
      const name = item.configuration?.props?.name;
      if (!name || !olLayerVisibility.has(name)) return true;
      return olLayerVisibility.get(name) === true;
    });
    if (queryableLayers.length === 0) return;

    setIsProcessing(true);

    // Recompute the snap from the ACTUAL click coordinate rather than trusting
    // the pointermove-maintained hover state: OL fires `singleclick` ~250ms
    // after the click, and a stray pointermove in that window (e.g. the user
    // moving off right after clicking) would otherwise clear the snap and force
    // a slow, sometimes-empty /identify. Recomputing here is race-free.
    const snapCaches = visibleSnapCaches(map);
    const clickSnap = snapCaches.length
      ? findBestSnap(snapCaches, evt.coordinate, map, SNAP_PIXELS)
      : null;
    // When a snap is active, gather the connected reaches within the wider
    // radius (nearest-first) so a confluence click yields multiple popup
    // entries the user can page between — restoring the pre-snap behavior.
    const snapSiblings = clickSnap
      ? findSnapFeatures(snapCaches, evt.coordinate, map, GATHER_PIXELS)
      : [];
    const coordinate = clickSnap?.coordinate ?? evt.coordinate;
    const pixel = evt.pixel;
    // The click owns the selection highlight from here; drop the hover preview.
    clearSnapPreview();

    // istanbul ignore next
    if (spinnerOverlayRef.current) {
      spinnerOverlayRef.current.setPosition(coordinate);
    }

    // Outline each requesting layer's click tolerance around the true click
    // every layer is queried at. A layer selected from a snap shows the radius
    // it snapped within (its siblings are gathered from a wider one), and so
    // does a snap layer when the click snapped nowhere, since nothing lay
    // within that radius on it. A layer that lost the snap to another keeps
    // the tolerance its own query found its results within. None when a layer
    // zooms in to its minZoomQuery instead: that click shows no results, and a
    // ring sized for this resolution would balloon with the zoom.
    const zoomsInstead = queryableLayers.some(
      (layer) =>
        !shouldSnapSelect(layer, clickSnap) &&
        zoomsInsteadOfQuerying(layer, map),
    );
    const toleranceRadii = zoomsInstead
      ? []
      : queryableLayers
          .filter((layer) => layer.configuration?.props?.showClickTolerance)
          .map((layer) => {
            if (shouldSnapSelect(layer, clickSnap)) return clickSnap.snapPx;
            const missedSnap = clickSnap
              ? undefined
              : snapCaches.find(
                  (cache) => cache.layerName === layer.configuration.props.name,
                );
            return clickQueryTolerance(layer, missedSnap?.snapPx);
          });
    const toleranceRings = createClickToleranceFeatures(
      evt.coordinate,
      toleranceRadii,
      map.getView().getResolution(),
    );
    // The Map Selection setting as it is now, not as it was when MapComponent
    // bound this handler (see mapSelectionRef). A change applies from the next
    // click; what an earlier click drew stays until then.
    const { clickedLocation, selectedFeature } = mapSelectionRef.current;
    if (markerLayer.current) {
      map.removeLayer(markerLayer.current);
      markerLayer.current = null;
    }
    if (!selectedFeature.map) {
      // A hidden outline is never created. One left from a click made before
      // it was hidden comes down now: the active-feature effect outlines each
      // new selection in whatever highlight layer exists.
      if (highlightLayer.current) {
        map.removeLayer(highlightLayer.current);
        highlightLayer.current = null;
      }
    } else if (highlightLayer.current) {
      highlightLayer.current.getSource().clear();
    } else {
      highlightLayer.current = createHighlightLayer();
      map.addLayer(highlightLayer.current);
    }
    // With the pin hidden the marker layer carries only the tolerance rings,
    // which still show how far the click searched; with no rings either there
    // is nothing to draw, so no layer is added.
    if (clickedLocation.map || toleranceRings.length > 0) {
      markerLayer.current = createMarkerLayer(coordinate, toleranceRings, {
        pin: clickedLocation.map,
      });
      map.addLayer(markerLayer.current);
    }

    // merge every queryable layer's attribute maps into one per kind, keyed by
    // layer name, for the popup and the variable write-back to read
    setAttributeMapRefs(collectLayerAttributeMaps(queryableLayers));

    // query the layers
    //
    // Each feature returned by queryLayerFeatures carries the SOURCE
    // sub-layer name in `feature.layerName` (e.g., for ESRI Image/Map
    // Services that's the rendered sub-layer like "Max Status - Forecast
    // Trend", NOT the wrapper layer the user named "a"). The wrapper is
    // where popupConfig lives, so we tag each feature with its parent
    // wrapper at query time. Downstream popup-resolution code reads
    // `feature.__wrapperLayer` directly instead of trying to back into
    // the wrapper from a sub-layer name string — that lookup is fragile
    // because it only works when the user has also configured aliases /
    // variables / omitted-attrs on that sub-layer.
    const queryCalls = queryableLayers.map(async (layer) => {
      try {
        // For a snap-enabled layer with an active snap, select the river from
        // the already-loaded vector feature instead of an ESRI /identify. This
        // is instant and reliable — /identify is slow on a cache miss and
        // sometimes returns empty even for an exactly-on-geometry point.
        // Other layers query at the TRUE click coordinate (evt.coordinate), not
        // the snapped point, so the snap can't shift their identify results.
        const features = shouldSnapSelect(layer, clickSnap)
          ? snapSiblings
              .filter((g) => g.layerName === layer.configuration.props.name)
              .map((g) => {
                const result = buildSnapFeatureResult(g.feature, layer);
                // Tag ONLY the feature the click actually clipped to, so
                // ranking can pin it ahead of everything else. Its siblings
                // were merely gathered within GATHER_PIXELS (35) rather than
                // snapped within SNAP_PIXELS (15); pinning them too would let a
                // confluence click push a dead-on gauge behind several reaches,
                // losing the very ordering fix on snap-enabled maps.
                return g.feature === clickSnap.feature
                  ? { ...result, __snapped: true }
                  : result;
              })
          : await queryLayerFeatures(layer, map, evt.coordinate, pixel);
        if (!Array.isArray(features)) return features;
        return features.map((feature) =>
          feature && typeof feature === "object"
            ? { ...feature, __wrapperLayer: layer }
            : feature,
        );
      } catch (error) {
        // Optionally log error: console.error(error);
        return [];
      }
    });
    const queryLayerFeaturesResults = await Promise.all(queryCalls);

    // Remove spinner overlay once queries are done
    // istanbul ignore next
    if (spinnerOverlayRef.current) {
      spinnerOverlayRef.current.setPosition(null);
    }
    setIsProcessing(false);

    // If any result contains an object with a 'zoomed' property, suppress popup
    const hasZoomed = queryLayerFeaturesResults.some((arr) => arr === "zoomed");

    let newPopupContent = null;
    let popupCoordinate = undefined;

    if (!hasZoomed) {
      const nonEmptyLayers = queryLayerFeaturesResults
        .filter((arr) => arr && Array.isArray(arr) && arr.length > 0)
        .flat();

      // One list for both popups: every feature this click found that either
      // popup can show, or that drives a variable input. Each popup then
      // renders the active feature only when it qualifies -- the overlay hides
      // on a modal-only feature, the modal closes on a table-only one -- so the
      // two always agree on which feature is selected and report the same
      // N / total. A modal-only feature still occupies a Swiper slide (hidden
      // while active), which is what keeps the counts identical.
      //
      // The eligibility checks above are LAYER-level, so on their own they let
      // through a feature whose every attribute is omitted: it takes a slide,
      // counts toward the total, and renders an empty hidden overlay. Drop
      // those, but only when the feature has nothing else to offer -- a modal
      // is its own render, and a variable mapping is its own reason to exist.
      const unionFeatures = nonEmptyLayers.filter(
        (feature) =>
          hasModalPopup(feature) ||
          publishesVariableInputs(feature) ||
          (isTableEligible(feature) && hasVisiblePopupAttributes(feature)),
      );

      // Nearest-first. Runs here rather than over the raw Promise.all results
      // so the "zoomed" sentinel check above still sees the untouched array,
      // and so ranking only ever sees features that can actually be shown.
      const rankedFeatures = rankQueriedFeatures(
        unionFeatures,
        map,
        // The TRUE click, not `coordinate` -- every layer was queried at
        // evt.coordinate, so ranking against the snapped point would re-sort
        // every other layer around a point the user did not click.
        evt.coordinate,
      );

      newPopupContent = rankedFeatures.length > 0 ? rankedFeatures : null;
      if (rankedFeatures.length === 0) {
        // No click-eligible features at this location. Anchor the empty
        // popup at the cursor so the user still sees "No Attributes Found" --
        // but only when the click genuinely found nothing. When features WERE
        // found and every one of them was filtered out for having nothing to
        // render, the author omitted those attributes on purpose, and an
        // explicit "No Attributes Found" box on every click is noise they did
        // not ask for. Hide the overlay instead, which is what the user saw
        // before those features were dropped.
        popupCoordinate = nonEmptyLayers.length > 0 ? undefined : coordinate;
      }
      // When there ARE features, the popup-sync effect owns the overlay
      // position: it anchors on the active feature's geometry, or hides the
      // overlay when that feature isn't table-eligible. Leaving
      // popupCoordinate undefined here hands it that job.
    }
    popupAnchorRef.current = coordinate;
    setPopupContent(newPopupContent);
    // A fresh click is a fresh gesture, so an earlier dismissal of either popup
    // no longer applies -- both may open again for whatever this click selects.
    setModalDismissed(false);
    setTableDismissed(false);
    popupOverlayRef.current?.setPosition(popupCoordinate);
  };

  // Whether the pointer is busy with something a tooltip would get in the way
  // of: a draw, an extent being drawn, or an annotation edit. Reads refs, as
  // the hover handlers outlive the render that bound them.
  const hoverSuppressed = () => drawing.current || hoverBlockedRef.current;

  // Does hovering this feature write its layer's linked variable inputs? Only
  // on a layer whose one popup is the hover tooltip. A layer with a click
  // table publishes its selection on click, and hovering past one of its
  // features must not overwrite what the user clicked.
  const publishesVariableInputsOnHover = (feature) => {
    const layer = feature.__wrapperLayer;
    if (resolveTablePopupType(layer) !== "hover") return false;
    const links = layer?.attributeVariables?.[feature.layerName];
    return isFieldMap(links) && Object.keys(links).length > 0;
  };

  // Renders the rows and places the tooltip beside the cursor, opening away
  // from the nearer edges of the map. The rows are committed before the
  // overlay moves, so a tooltip never shows the previous feature's rows at
  // the new position for a frame.
  const showHoverTooltip = (map, rows, coordinate, pixel) => {
    const overlay = hoverTooltipOverlayRef.current;
    const root = hoverTooltipRootRef.current;
    // istanbul ignore if -- both are created on mount, before any handler is
    // bound.
    if (!overlay || !root) return;
    flushSync(() => {
      root.render(<HoverTooltip rows={rows} />);
    });
    const { positioning, offset } = hoverTooltipPlacement(
      pixel ?? map.getPixelFromCoordinate(coordinate),
      map.getSize(),
    );
    overlay.setPositioning(positioning);
    overlay.setOffset(offset);
    overlay.setPosition(coordinate);
  };

  const runHoverQuery = async (map, coordinate, pixel) => {
    // Recorded before anything is awaited. Anything that hides the tooltip
    // moves it on, and the result is then dropped.
    const generation = hoverGenerationRef.current;

    const olLayerVisibility = new Map();
    map
      .getLayers()
      .getArray()
      .forEach((olLayer) => {
        const name = olLayer.get("name");
        if (name) olLayerVisibility.set(name, olLayer.getVisible());
      });

    // Hover queries every visible layer that shows the tooltip, whatever its
    // click popups. The layout never opens on hover.
    const hoverLayers = layers.filter((item) => {
      if (isDecorationLayerEntry(item)) return false;
      if (!isHoverEnabled(item)) return false;
      // Below its minZoomQuery a layer answers a query by zooming the map in
      // to it, and hovering must never move the map.
      if (zoomsInsteadOfQuerying(item, map)) return false;
      const name = item.configuration?.props?.name;
      if (!name || !olLayerVisibility.has(name)) return true;
      return olLayerVisibility.get(name) === true;
    });
    if (hoverLayers.length === 0) return;

    // Each feature is tagged with its own layer, which is where the tooltip
    // reads its fields, aliases and order, and the variable write-back its
    // links. Nothing is merged across layers, so hovering one layer never
    // borrows another's settings, and the click table's maps are left alone.
    const queryCalls = hoverLayers.map(async (layer) => {
      try {
        const features = await queryLayerFeatures(
          layer,
          map,
          coordinate,
          pixel,
        );
        if (!Array.isArray(features)) return features;
        return features.map((feature) =>
          feature && typeof feature === "object"
            ? { ...feature, __wrapperLayer: layer }
            : feature,
        );
      } catch (error) {
        // A failed query shows nothing: a tooltip has no room for an error,
        // and the next pause asks again.
        return [];
      }
    });
    const results = await Promise.all(queryCalls);
    if (generation !== hoverGenerationRef.current || hoverSuppressed()) return;

    // Drop non-object entries as well as empty results. The map above passes
    // non-objects through unwrapped, and everything below dereferences each
    // entry.
    const ranked = rankQueriedFeatures(
      results
        .filter((arr) => Array.isArray(arr))
        .flat()
        .filter((feature) => feature && typeof feature === "object"),
      map,
      coordinate,
    );

    // The nearest feature of a hover-only layer that links variable inputs
    // drives them, whether or not it shows anything in the tooltip: a layer
    // can hide every field and still drive the chart below it. The query is
    // debounced, so this is one write per cursor pause.
    const variableFeature = ranked.find(publishesVariableInputsOnHover);
    if (variableFeature) {
      const layer = variableFeature.__wrapperLayer;
      updateVariableInputsForFeature(variableFeature, {
        variables: layer.attributeVariables,
        aliases: layer.attributeAliases,
      });
    }

    // The tooltip shows one feature: the nearest with a field to show. It was
    // taken down by the move that led here, so finding none leaves it down.
    for (const feature of ranked) {
      const rows = hoverAttributeRows(feature);
      if (rows.length > 0) {
        showHoverTooltip(map, rows, coordinate, pixel);
        return;
      }
    }
  };

  const onMapHover = (map, evt) => {
    // Every move takes the tooltip down at once. It described the feature
    // under the cursor where the cursor last rested, and comes back only once
    // the cursor rests again.
    cancelHover();

    if (drawing.current) return;

    // The pointer is over the click table. pointermove still fires from OL
    // there, but the map coordinate is whatever lies BEHIND the table, so a
    // query would describe a feature the user cannot see.
    const popupEl = popupContainerRef.current;
    const target = evt.originalEvent?.target;
    if (popupEl && target && popupEl.contains(target)) return;

    // Snap the preview to the nearest snap-enabled feature immediately (not
    // debounced) so the highlight tracks the cursor responsively.
    updateSnap(map, evt.coordinate);

    if (hoverSuppressed()) return;

    // Debounce: the move above cancelled the previous timer, so the query
    // only fires once the cursor settles for HOVER_DEBOUNCE_MS. Capture
    // coordinate/pixel by value so the deferred call uses the LAST cursor
    // position, not stale.
    const coordinate = evt.coordinate;
    const pixel = evt.pixel;
    hoverDebounceRef.current = setTimeout(() => {
      hoverDebounceRef.current = null;
      runHoverQuery(map, coordinate, pixel);
    }, HOVER_DEBOUNCE_MS);
  };

  // A pointer leaving the map takes the tooltip down -- including onto the
  // popup layout, which is portaled outside the map -- and so does a pan or
  // zoom, which moves the feature out from under it. So does a press: OL
  // raises `singleclick` only after waiting out a possible double-click, and
  // the hover debounce, which started at the last move, runs out first -- so
  // a click made just after moving onto a feature would otherwise flash its
  // tooltip before the click table opened.
  useEffect(() => {
    // Captured rather than read in the cleanup: MapComponent owns the OL map
    // and nulls `visualizationRef` out from under this effect on unmount.
    const map = visualizationRef?.current;
    // istanbul ignore if -- MapComponent is a child, so its map-creating effect
    // has always run by the time this one does.
    if (!map) return;
    // OpenLayers raises no map-level pointer-leave, so the viewport carries
    // it, and the press beside it.
    const viewport = map.getViewport();
    map.on("movestart", cancelHover);
    viewport.addEventListener("pointerleave", cancelHover);
    viewport.addEventListener("pointerdown", cancelHover);

    return () => {
      map.un("movestart", cancelHover);
      viewport.removeEventListener("pointerleave", cancelHover);
      viewport.removeEventListener("pointerdown", cancelHover);
      cancelHover();
    };
  }, [visualizationRef, cancelHover]);

  // --- Linked cursor: publish, receive, clear -----------------------------

  const publishCursorCoordinate = (coordinate) => {
    const groupName = activeCursorGroupRef.current;
    // istanbul ignore if -- unreachable: every path that clears the group name
    // retracts this map's mark first, so nothing is left to publish by the
    // time the name is gone. Kept so leaving a group can never publish into
    // one this map is no longer in.
    if (!groupName || !viewGroupContext) return;
    cursorPublishedRef.current = coordinate;
    viewGroupContext.publishCursor(groupName, cursorMemberId, coordinate);
  };

  const cancelCursorFrame = () => {
    if (cursorFrameRef.current === null) return;
    cancelAnimationFrame(cursorFrameRef.current);
    cursorFrameRef.current = null;
  };

  // Retract this map's mark from every peer. The queued frame is cancelled in
  // the same breath: a flush left in flight would re-show the marker a tick
  // after the clear, which is exactly what a `pointerleave` must not leave
  // behind.
  const clearPeerCursors = () => {
    cancelCursorFrame();
    cursorPendingRef.current = null;
    if (cursorPublishedRef.current === null) return;
    publishCursorCoordinate(null);
  };
  cursorClearRef.current = clearPeerCursors;

  const queueCursorPublish = (coordinate) => {
    cursorPendingRef.current = coordinate;
    if (cursorFrameRef.current !== null) return;
    cursorFrameRef.current = requestAnimationFrame(() => {
      cursorFrameRef.current = null;
      const pending = cursorPendingRef.current;
      cursorPendingRef.current = null;
      if (!pending) return;
      publishCursorCoordinate(pending);
    });
  };

  // The cursor half's own `pointermove` listener. Deliberately NOT hung off
  // `onMapHover`: that handler returns early while a draw gesture is live and
  // again while the pointer rests on the popup, and an early return tells the
  // group nothing -- peers' markers would freeze at the last position instead
  // of going away. Both states clear here instead.
  const handleLinkedCursorMove = (evt) => {
    if (!activeCursorGroupRef.current) return;
    if (drawing.current) {
      clearPeerCursors();
      return;
    }
    const popupElement = popupContainerRef.current;
    const target = evt.originalEvent?.target;
    if (popupElement && target && popupElement.contains(target)) {
      clearPeerCursors();
      return;
    }
    queueCursorPublish(evt.coordinate);
  };
  cursorMoveRef.current = handleLinkedCursorMove;

  // Take this map's own marker down. Guarded on the overlay already carrying a
  // position so the mount-time and tab-change clears, which fire on every map
  // whether or not anything is marked, write nothing.
  const hideCursorMarker = () => {
    const overlay = cursorOverlayRef.current;
    if (!overlay || overlay.getPosition() === undefined) return;
    overlay.setPosition(undefined);
  };

  // Receive a peer's cursor. A null coordinate is the group's "gone" signal.
  const applyPeerCursor = (coordinate) => {
    if (!Array.isArray(coordinate)) {
      hideCursorMarker();
      return;
    }
    cursorOverlayRef.current?.setPosition(coordinate);
  };
  cursorApplyRef.current = applyPeerCursor;
  cursorHideRef.current = hideCursorMarker;

  useEffect(() => {
    // Captured rather than read in the cleanup: MapComponent owns the OL map
    // and nulls `visualizationRef` out from under this effect on unmount.
    const map = visualizationRef?.current;
    // istanbul ignore if -- MapComponent is a child, so its map-creating effect
    // has always run by the time this one does; the same known non-coverage as
    // the overlay effect above.
    if (!map) return;

    const onMove = (evt) => cursorMoveRef.current?.(evt);
    const onLeave = () => cursorClearRef.current?.();
    map.on("pointermove", onMove);
    // OpenLayers raises no map-level pointer-leave, so the viewport carries
    // it. Without this the last position of a pointer on its way out of the
    // map would stay marked on every peer.
    const viewport = map.getViewport();
    viewport.addEventListener("pointerleave", onLeave);

    return () => {
      map.un("pointermove", onMove);
      viewport.removeEventListener("pointerleave", onLeave);
      cursorClearRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualizationRef]);

  useEffect(() => {
    if (!cursorGroupEnabled) {
      activeCursorGroupRef.current = null;
      return;
    }
    activeCursorGroupRef.current = viewGroupName;
    const unregister = viewGroupContext.registerMember(
      viewGroupName,
      cursorMemberId,
      { applyCursor: (coordinate) => cursorApplyRef.current?.(coordinate) },
    );

    return () => {
      // Peers drop this map's mark before it leaves the group -- after the
      // unregister there is nobody left to tell.
      cursorClearRef.current?.();
      activeCursorGroupRef.current = null;
      cursorHideRef.current?.();
      unregister();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorGroupEnabled, viewGroupName, cursorMemberId, viewGroupContext]);

  useEffect(() => {
    // A tab switch moves no pointer, so nothing else would retract the mark
    // this map put on its peers, or the one a peer put on it.
    cursorClearRef.current?.();
    cursorHideRef.current?.();
  }, [activeTabId]);

  useEffect(() => {
    setActiveFeatureIndex(0);
  }, [popupContent]);

  // The wrapper layer is tagged onto each feature at query time (see the
  // queryCalls loop in onMapClick). Reading it back here avoids a fragile
  // sub-layer-name → wrapper-name back-lookup that would fail whenever
  // the user hasn't configured aliases/variables/omitted-attrs on the
  // sub-layer the ESRI service happens to report.
  //
  // The captured `__wrapperLayer` is a closure over the layer object at
  // click time. Host-level variable input changes (e.g., `${f}` in a
  // popup gridItem's args_string) rebuild the `layers` prop with freshly
  // substituted strings — but `modalFeatures` state still holds the
  // old wrapper. Re-resolve here against the current `layers` prop by
  // wrapper name so the popup body always sees up-to-date popupConfig.
  const activeModalLayer = useMemo(() => {
    const captured = activeModalFeature?.__wrapperLayer ?? null;
    if (!captured) return null;
    const name = captured.configuration?.props?.name;
    if (name && Array.isArray(layers)) {
      const fresh = layers.find((l) => l?.configuration?.props?.name === name);
      if (fresh) return fresh;
    }
    return captured;
  }, [activeModalFeature, layers]);
  const activeModalPopupConfig = activeModalLayer?.popupConfig ?? null;

  // Resolve a popup feature's display label. Used both for the header title
  // (active feature) and the carousel prev/next arrows' aria-labels
  // (neighboring features) so screen readers announce them by name.
  const buildFeatureLabel = useCallback(
    (feature, i) => {
      const template = activeModalPopupConfig?.titleTemplate;
      if (feature && template) {
        const substituted = substituteTemplateString(
          template,
          feature.attributes ?? {},
        );
        if (substituted.trim().length > 0) return substituted;
      }
      return feature?.layerName ?? `Feature ${(i ?? 0) + 1}`;
    },
    [activeModalPopupConfig],
  );
  const popupTitleText = activeModalFeature
    ? buildFeatureLabel(activeModalFeature, safeActiveFeatureIndex)
    : "";

  return (
    <div
      ref={mapContainerRef}
      tabIndex={-1}
      style={{ outline: "none", width: "100%", height: "100%" }}
    >
      <MapComponent
        mapConfig={mapConfig}
        mapExtent={mapExtent}
        layers={layersForMap}
        legend={displayedMapLegend}
        layerControl={layerControl}
        mapDrawing={mapDrawing}
        drawing={drawing}
        onMapClick={inDataViewerMode ? () => {} : onMapClick}
        onMapHover={inDataViewerMode ? () => {} : onMapHover}
        onMapMoveEnd={
          inDataViewerMode ? () => {} : (map) => refreshSnapCaches(map)
        }
        visualizationRef={visualizationRef}
        data-testid="backlayer-map"
        dataviewerViz={dataviewerViz}
        runtimeLayerState={runtimeLayerState}
        layerPrepStatus={layerPrepStatus}
        runtimeLayerFetchStatus={runtimeLayerFetchStatus}
      />
      <PopupModal
        show={!!activeModalFeature}
        onClose={closeModal}
        position={activeModalPopupConfig?.position}
        title={
          <span id="popup-modal-title" data-testid="popup-modal-header-title">
            {popupTitleText}
          </span>
        }
        leadingControls={
          popupContent && popupContent.length > 1 ? (
            <PopupModalCarousel
              features={popupContent}
              activeIndex={safeActiveFeatureIndex}
              onActiveIndexChange={setActiveFeatureIndex}
              getLabel={buildFeatureLabel}
            />
          ) : null
        }
        ariaLabelledBy="popup-modal-title"
        triggerRef={mapContainerRef}
      >
        {activeModalFeature ? (
          <PopupModalChrome
            // Remount the body when the carousel switches entries. Different
            // layers' popupConfigs reuse the same gridItem `i` keys ("1",
            // "2", ...), so without a remount React reuses the embedded
            // visualization instances — and their last-fetched state — across
            // layers with different popup layouts.
            key={`${activeModalLayer?.configuration?.props?.name ?? ""}:${safeActiveFeatureIndex}`}
            feature={activeModalFeature}
            popupConfig={activeModalPopupConfig}
          />
        ) : null}
      </PopupModal>
    </div>
  );
};

MapVisualization.propTypes = {
  mapConfig: PropTypes.object, // div element properties for the map
  mapExtent: PropTypes.shape({
    extent: PropTypes.string, // minX,minY,maxX,maxY or lon,lat,zoom
    variable: PropTypes.string,
    // Maps sharing a view group name pan, zoom and rotate together. Read and
    // acted on by MapComponent, which owns the OL view.
    viewGroup: PropTypes.string,
    isGroupInitialExtent: PropTypes.bool,
  }),
  layers: PropTypes.arrayOf(
    PropTypes.shape({
      configuration: configurationPropType,
    }),
  ),
  visualizationRef: PropTypes.shape({ current: PropTypes.any }), // react ref pointing to the ol Map
  baseMap: PropTypes.string, // url for basemap layer, maps to baseMapLayers layers in components/visualizations/utilities.js
  layerControl: PropTypes.bool, // deterimines if a layer control menu should be present
  dataviewerViz: PropTypes.bool, // determines if the map is in the dataviewer so that it doesnt affect the main map
  mapDrawing: mapDrawingPropType, // contains draw interaction metadata like options and limits
  // Whether a click's pin and outline are drawn and listed in the legend; only
  // what differs from the defaults is saved (see resolveMapSelection).
  mapSelection: mapSelectionPropType,
  refreshCount: PropTypes.number,
};

Popup.propTypes = {
  layerAttributes: PropTypes.arrayOf(
    PropTypes.shape({
      layerName: PropTypes.string,
      attributes: PropTypes.object,
    }),
  ),
  onSwipe: PropTypes.func, // function to call on swipe event
  onSwiper: PropTypes.func, // receives the Swiper instance so the popup modal can drive it
  omittedPopupAttributes: PropTypes.object,
  aliases: PropTypes.object,
  order: attributeOrderPropType, // the author's field order per layer; unlisted fields follow
};

export default memo(MapVisualization);
