import PropTypes from "prop-types";
import Modal from "react-bootstrap/Modal";
import styled from "styled-components";
import Button from "react-bootstrap/Button";
import { useState, useRef, useContext, useEffect, useCallback } from "react";
import Alert from "react-bootstrap/Alert";
import Tab from "react-bootstrap/Tab";
import Tabs from "react-bootstrap/Tabs";
import { v4 as uuidv4 } from "uuid";
import LayerPane from "components/modals/MapLayer/LayerPane";
import SourcePane from "components/modals/MapLayer/SourcePane";
import LegendPane from "components/modals/MapLayer/LegendPane";
import AttributesPane from "components/modals/MapLayer/AttributesPane";
import StylePane from "components/modals/MapLayer/StylePane";
import PopupConfigPane from "components/modals/MapLayer/PopupConfigPane";
import PopupLayoutEditor from "components/modals/MapLayer/PopupLayoutEditor";
import { AppContext, LayoutContext } from "components/contexts/Contexts";
import {
  sourcePropertiesOptions,
  layerPropType,
  legendPropType,
  sourcePropType,
  attributePropsPropType,
  saveLayerJSON,
} from "components/map/utilities";
import { buildGeoTIFFStyleColor } from "components/map/geoTIFFStyle";
import {
  removeEmptyValues,
  checkRequiredKeys,
} from "components/modals/utilities";
import { findSelectOptionByValue } from "components/visualizations/utilities";
import { useMapContext } from "components/contexts/MapContext";
import Select from "react-select";
import appAPI from "services/api/app";
import "components/modals/wideModal.css";

const StyledModalHeader = styled(Modal.Header)`
  height: 7%;
`;

const StyledModalBody = styled(Modal.Body)`
  max-height: 70vh;
  height: 70vh;
  overflow-y: auto;
`;

const StyledAlert = styled(Alert)`
  left: 0;
  position: absolute;
  margin-left: 1rem;
  max-width: 75%;
`;

const FooterContent = styled.div`
  display: flex;
  justify-content: space-between; /* spreads items out */
  align-items: center;
  width: 100%;
  gap: 1rem;
  flex-wrap: wrap; /* allows responsiveness */
`;

const LeftGroup = styled.div`
  flex: 1;
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const RightGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const DYNAMIC_LAYER_PLACEHOLDER_GEOJSON = {
  type: "FeatureCollection",
  features: [],
  crs: { type: "name", properties: { name: "EPSG:4326" } },
};

export function rekeyAttributeMapToLayer(map, targetLayerName) {
  if (!map || typeof map !== "object" || !targetLayerName) return map;
  const keys = Object.keys(map);
  if (keys.length !== 1 || keys[0] === targetLayerName) return map;
  return { [targetLayerName]: map[keys[0]] };
}

// Rekey all attribute-map entries under attributeProps to targetLayerName.
export function normalizeAttributePropsForLayer(
  attributeProps,
  targetLayerName,
) {
  if (!targetLayerName) return attributeProps;
  return {
    ...attributeProps,
    variables: rekeyAttributeMapToLayer(
      attributeProps?.variables,
      targetLayerName,
    ),
    omitted: rekeyAttributeMapToLayer(attributeProps?.omitted, targetLayerName),
    aliases: rekeyAttributeMapToLayer(attributeProps?.aliases, targetLayerName),
  };
}

export function renameLayerInAttributeProps(attributeProps, oldName, newName) {
  if (!oldName || !newName || oldName === newName) return attributeProps;
  const renameKey = (map) => {
    if (!map || typeof map !== "object" || !(oldName in map)) return map;
    const { [oldName]: value, ...rest } = map;
    return { ...rest, [newName]: value };
  };
  return {
    ...attributeProps,
    variables: renameKey(attributeProps?.variables),
    omitted: renameKey(attributeProps?.omitted),
    aliases: renameKey(attributeProps?.aliases),
  };
}

export const getLayerType = (sourceType) => {
  if (sourceType === "GeoTIFF") return "WebGLTile";
  if (sourceType.includes("Vector")) return "VectorTileLayer";
  if (sourceType.includes("Raster")) return "WebGLTile";
  if (sourceType.includes("Tile")) return "TileLayer";
  if (sourceType.includes("Image") || sourceType.includes("WMS"))
    return "ImageLayer";
  return "VectorLayer";
};

const MapLayerModal = ({
  showModal,
  handleModalClose,
  addMapLayer,
  layerInfo,
  visualizationRef,
}) => {
  const [tabKey, setTabKey] = useState("layer");
  const [errorMessage, setErrorMessage] = useState(null);
  const [sourceProps, setSourceProps] = useState(layerInfo.sourceProps ?? {});
  const [layerProps, setLayerProps] = useState(layerInfo.layerProps ?? {});
  const [attributeProps, setAttributeProps] = useState(
    layerInfo.attributeProps ?? {},
  );
  const [style, setStyle] = useState(layerInfo.style);
  const [legend, setLegend] = useState(layerInfo.legend);
  const [popupConfig, setPopupConfig] = useState(layerInfo.popupConfig ?? null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hiddenForExtentDraw, setHiddenForExtentDraw] = useState(false);
  const [showingSubModal, setShowingSubModal] = useState(false);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const legendContainerRef = useRef(null);
  const styleContainerRef = useRef(null);
  const { csrf, mapLayerTemplates, dynamicMapLayers } = useContext(AppContext);
  const { uuid, editable: hostDashboardEditable } = useContext(LayoutContext);
  const mapContext = useMapContext();

  const onRequestHideModal = useCallback(() => {
    setHiddenForExtentDraw(true);
  }, []);

  const handleLayerPropsChange = useCallback((updater) => {
    setLayerProps((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (prev?.name && next?.name && prev.name !== next.name) {
        setAttributeProps((prevAttr) =>
          renameLayerInAttributeProps(prevAttr, prev.name, next.name),
        );
      }
      return next;
    });
  }, []);

  // When drawnExtent arrives, re-show modal and update sourceProps
  useEffect(() => {
    if (!mapContext?.drawnExtent || !hiddenForExtentDraw) return;

    const extent = mapContext.drawnExtent;
    const projection =
      visualizationRef?.current?.getView()?.getProjection()?.getCode() ||
      "EPSG:3857";

    setSourceProps((prev) => ({
      ...prev,
      props: {
        ...prev.props,
        imageExtent: extent.map((v) => v.toFixed(2)).join(", "),
        projection: projection,
      },
    }));

    setHiddenForExtentDraw(false);
    mapContext.setDrawnExtent(null);
  }, [
    mapContext?.drawnExtent,
    hiddenForExtentDraw,
    mapContext,
    visualizationRef,
  ]);

  // When extentDrawMode becomes null while hidden (user cancelled), re-show modal
  useEffect(() => {
    if (hiddenForExtentDraw && !mapContext?.extentDrawMode) {
      setHiddenForExtentDraw(false);
    }
  }, [mapContext?.extentDrawMode, hiddenForExtentDraw]);

  async function saveLayer() {
    setErrorMessage(null);
    if (!sourceProps.type || !layerProps.name) {
      setErrorMessage(
        "Layer type and name must be provided in the configuration pane.",
      );
      return;
    }

    const isRuntime = !!findSelectOptionByValue(
      dynamicMapLayers,
      sourceProps.type,
    );

    const { layerVisibility, ...layerProperties } = layerProps;
    const validSourceProps = removeEmptyValues(sourceProps.props);
    const validLayerProps = removeEmptyValues(layerProperties);

    if (!isRuntime) {
      const missingRequiredProps = checkRequiredKeys(
        sourcePropertiesOptions[sourceProps.type]?.required,
        validSourceProps,
      );
      if (missingRequiredProps.length > 0) {
        setErrorMessage(
          `Missing required ${missingRequiredProps} arguments. Please check the configuration and try again.`,
        );
        return;
      }

      if (sourceProps.type === "Vector Tile") {
        validSourceProps.urls = validSourceProps.urls.split(",");
      }
    }

    if (sourceProps.type === "GeoTIFF") {
      const rawSources = sourceProps.props?.sources ?? [];
      const cleanSourceInfo = (s) => {
        const out = { url: s.url };
        if (typeof s.bands === "string" && s.bands.trim() !== "") {
          out.bands = s.bands;
        }
        if (s.min !== undefined && s.min !== "") out.min = s.min;
        if (s.max !== undefined && s.max !== "") out.max = s.max;
        if (s.nodata !== undefined && s.nodata !== "") out.nodata = s.nodata;
        if (typeof s.projection === "string" && s.projection.trim() !== "") {
          out.projection = s.projection;
        }
        if (Array.isArray(s.overviews) && s.overviews.length > 0) {
          out.overviews = s.overviews;
        }
        return out;
      };
      const restoredSources = rawSources
        .filter((s) => typeof s?.url === "string" && s.url.trim() !== "")
        .map(cleanSourceInfo);
      if (restoredSources.length === 0) {
        setErrorMessage("Add at least one source with a URL before saving.");
        return;
      }
      validSourceProps.sources = restoredSources;
    }

    let mapConfiguration;
    if (isRuntime) {
      const existingLayerId =
        layerInfo?.layerProps?.layerId ?? layerProps?.layerId;
      const layerId = existingLayerId || uuidv4();
      mapConfiguration = {
        configuration: {
          type: "VectorLayer",
          props: {
            ...validLayerProps,
            layerId,
            source: {
              type: "GeoJSON",
              props: {},
              geojson: DYNAMIC_LAYER_PLACEHOLDER_GEOJSON,
            },
            pluginSource: {
              source: sourceProps.source,
              args: sourceProps.args,
            },
          },
        },
      };
    } else {
      mapConfiguration = {
        configuration: {
          type: getLayerType(sourceProps.type),
          props: {
            ...validLayerProps,
            source: {
              type: sourceProps.type,
              props: validSourceProps,
            },
          },
        },
      };
    }

    const minAttributeVariables = removeEmptyValues(
      attributeProps.variables ?? {},
    );

    const minAttributeAliases = removeEmptyValues(attributeProps.aliases ?? {});

    if (layerVisibility === false) {
      mapConfiguration.configuration.layerVisibility = false;
    }

    if (Object.keys(minAttributeAliases).length > 0) {
      mapConfiguration.attributeAliases = attributeProps.aliases;
    }

    if (Object.keys(minAttributeVariables).length > 0) {
      mapConfiguration.attributeVariables = minAttributeVariables;
    }

    if (Object.keys(attributeProps.omitted ?? []).length > 0) {
      mapConfiguration.omittedPopupAttributes = attributeProps.omitted;
    }

    if (attributeProps.queryable === false) {
      mapConfiguration.queryable = false;
    }

    if (legend) {
      if (typeof legend === "object" && Object.keys(legend).length > 0) {
        if (legend.title === "") {
          setErrorMessage(
            "Provide a legend title if showing a legend for this layer",
          );
          return;
        }

        //check if any key in the object is empty
        const hasEmptyValues = (obj) => {
          return Object.values(obj).some(
            (value) => value === "" || value === null || value === undefined,
          );
        };

        if (legend.items.some(hasEmptyValues)) {
          setErrorMessage(
            "All Legend Items must have a label, color, and symbol",
          );
          return;
        }
      }
      mapConfiguration.legend = legend;
    }

    if (!isRuntime && sourceProps.type === "GeoJSON") {
      const geoStr = (sourceProps.geojson ?? "").trim();
      const isJsonBody = geoStr.startsWith("{") || geoStr.startsWith("[");
      mapConfiguration.configuration.props.source.props = {};
      if (isJsonBody) {
        const apiResponse = await saveLayerJSON({
          stringJSON: sourceProps.geojson,
          csrf,
          check_crs: true,
          dashboard_uuid: uuid,
        });
        if (!apiResponse.success) {
          setErrorMessage(
            apiResponse.message ??
              "Failed to upload the json data. Check logs for more information.",
          );
          return;
        }
        mapConfiguration.configuration.props.source.geojson =
          apiResponse.filename;
      } else {
        mapConfiguration.configuration.props.source.geojson = geoStr;
      }
    }

    if (sourceProps.type === "GeoTIFF") {
      const { rampName, rampMin, rampMax } = sourceProps;
      const hasRamp =
        typeof rampName === "string" &&
        rampName.trim() !== "" &&
        typeof rampMin === "string" &&
        rampMin.trim() !== "" &&
        typeof rampMax === "string" &&
        rampMax.trim() !== "" &&
        Number.isFinite(Number(rampMin)) &&
        Number.isFinite(Number(rampMax));
      if (hasRamp) {
        const hasNodata = validSourceProps.sources.some(
          (s) => s?.nodata !== undefined && s.nodata !== "",
        );
        const color = buildGeoTIFFStyleColor({
          rampName,
          rampMin,
          rampMax,
          hasNodata,
        });
        mapConfiguration.configuration.style = { color };
        mapConfiguration.configuration.props.source.rampName = rampName;
        mapConfiguration.configuration.props.source.rampMin = rampMin;
        mapConfiguration.configuration.props.source.rampMax = rampMax;
      }
    } else if (style && style !== "{}") {
      const apiResponse = await saveLayerJSON({
        stringJSON: style,
        csrf,
        dashboard_uuid: uuid,
      });
      if (!apiResponse.success) {
        setErrorMessage(
          apiResponse.message ??
            "Failed to upload the json data. Check logs for more information.",
        );
        return;
      }
      mapConfiguration.configuration.style = apiResponse.filename;
    }

    // Popup config rides along with the rest of the layer config in
    // mapConfiguration. It's stored as JSON inside the parent Map gridItem's
    // args_string — no separate API call, no premature persistence. Edits
    // discard cleanly if the user cancels the dashboard save.
    if (popupConfig) {
      mapConfiguration.popupConfig = popupConfig;
    }

    addMapLayer(mapConfiguration);
    handleModalClose();
  }

  const onLayoutChange = async (e) => {
    setSelectedOption(e);
    const apiResponse = await appAPI.getVisualizationData({
      source: e.source,
      args: {},
    });

    if (!apiResponse.success) {
      setErrorMessage(
        apiResponse.data?.error ?? "Failed to load layer template. Check logs.",
      );
      return;
    }

    const attributeVariables = apiResponse.data.attributeVariables ?? {};
    const attributeAliases = apiResponse.data.attributeAliases ?? {};
    const omittedPopupAttributes =
      apiResponse.data.omittedPopupAttributes ?? {};
    const queryableLayer = apiResponse.data.queryable === false ? false : true;
    const updatedLayerProps = Object.fromEntries(
      Object.entries(apiResponse.data.configuration.props).filter(
        ([key]) => key !== "source",
      ),
    );
    updatedLayerProps.layerVisibility =
      apiResponse.data.configuration.layerVisibility;

    setSourceProps(apiResponse.data.configuration.props.source);
    setLayerProps(updatedLayerProps);

    const effectiveName = layerProps?.name || updatedLayerProps.name;
    setAttributeProps(
      normalizeAttributePropsForLayer(
        {
          variables: attributeVariables,
          omitted: omittedPopupAttributes,
          aliases: attributeAliases,
          queryable: queryableLayer,
        },
        effectiveName,
      ),
    );
    setStyle(apiResponse.data.configuration.style);
    setLegend(apiResponse.data.legend);
  };

  const fetchPluginDefaults = useCallback(
    async (source, args) => {
      try {
        const apiResponse = await appAPI.getVisualizationData({
          source,
          args: args,
        });
        if (!apiResponse.success) {
          return {
            success: false,
            error:
              apiResponse.data?.error ??
              "Failed to fetch plugin defaults. Check logs.",
          };
        }
        const scaffold = apiResponse.data ?? {};
        const config = scaffold.configuration ?? {};
        const attributeVariables = scaffold.attributeVariables ?? {};
        const attributeAliases = scaffold.attributeAliases ?? {};
        const omittedPopupAttributes = scaffold.omittedPopupAttributes ?? {};
        const queryableLayer = scaffold.queryable === false ? false : true;

        const updatedLayerProps = Object.fromEntries(
          Object.entries(config.props ?? {}).filter(
            ([key]) => key !== "source" && key !== "pluginSource",
          ),
        );
        if (config.layerVisibility !== undefined) {
          updatedLayerProps.layerVisibility = config.layerVisibility;
        }

        const effectiveName = layerProps?.name || updatedLayerProps.name;
        setLayerProps((prev) => ({
          ...updatedLayerProps,
          name: effectiveName,
          layerId: prev?.layerId,
        }));

        setAttributeProps(
          normalizeAttributePropsForLayer(
            {
              variables: attributeVariables,
              omitted: omittedPopupAttributes,
              aliases: attributeAliases,
              queryable: queryableLayer,
            },
            effectiveName,
          ),
        );
        setStyle(config.style);
        setLegend(scaffold.legend);
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err?.message || "Failed to fetch plugin defaults.",
        };
      }
    },
    [layerProps?.name, setLayerProps, setAttributeProps, setStyle, setLegend],
  );

  return (
    <>
      <Modal
        show={showModal}
        onHide={handleModalClose}
        className="map-layer"
        dialogClassName="fiftyWideModalDialog"
        contentClassName="mapLayerContent"
        style={
          hiddenForExtentDraw
            ? { visibility: "hidden" }
            : showingSubModal || showLayoutEditor
              ? { zIndex: 1050 }
              : undefined
        }
        backdrop={hiddenForExtentDraw ? false : true}
      >
        <StyledModalHeader closeButton>
          <Modal.Title>Add Map Layer</Modal.Title>
        </StyledModalHeader>
        <StyledModalBody>
          <Tabs
            activeKey={tabKey}
            onSelect={(k) => setTabKey(k)}
            id="map-layer-tabs"
            className="mb-3"
          >
            <Tab
              eventKey="layer"
              title="Layer"
              aria-label="layer-tab"
              className="layer-tab"
            >
              <LayerPane
                layerProps={layerProps}
                setLayerProps={handleLayerPropsChange}
              />
            </Tab>
            <Tab
              eventKey="source"
              title="Source"
              aria-label="layer-source-tab"
              className="layer-source-tab"
            >
              <SourcePane
                sourceProps={sourceProps}
                setSourceProps={setSourceProps}
                setStyle={setStyle}
                setAttributeProps={setAttributeProps}
                setErrorMessage={setErrorMessage}
                onRequestHideModal={onRequestHideModal}
                onFetchPluginDefaults={fetchPluginDefaults}
                onSubModalToggle={setShowingSubModal}
              />
            </Tab>
            <Tab
              eventKey="style"
              title="Style"
              aria-label="layer-style-tab"
              className="layer-style-tab"
            >
              <div ref={styleContainerRef}>
                <StylePane
                  style={style}
                  setStyle={setStyle}
                  setErrorMessage={setErrorMessage}
                  containerRef={styleContainerRef}
                  layerProps={layerProps}
                  sourceProps={sourceProps}
                  setSourceProps={setSourceProps}
                />
              </div>
            </Tab>
            <Tab
              eventKey="legend"
              title="Legend"
              aria-label="layer-legend-tab"
              className="layer-legend-tab"
            >
              <div ref={legendContainerRef}>
                <LegendPane
                  legend={legend}
                  setLegend={setLegend}
                  sourceProps={sourceProps}
                  containerRef={legendContainerRef}
                />
              </div>
            </Tab>
            <Tab
              eventKey="attributes"
              title="Attributes/Table Popup"
              aria-label="layer-attributes-tab"
              className="layer-attributes-tab"
            >
              <AttributesPane
                attributeProps={attributeProps}
                setAttributeProps={setAttributeProps}
                sourceProps={sourceProps}
                layerProps={layerProps}
                tabKey={tabKey}
              />
            </Tab>
            <Tab
              eventKey="popup"
              title="Custom Modal Popup"
              aria-label="layer-popup-tab"
              className="layer-popup-tab"
            >
              <PopupConfigPane
                layerName={layerProps?.name}
                popupConfig={popupConfig}
                onChange={setPopupConfig}
                onOpenLayoutEditor={() => setShowLayoutEditor(true)}
                hostDashboardEditable={hostDashboardEditable !== false}
              />
            </Tab>
          </Tabs>
        </StyledModalBody>
        <Modal.Footer>
          <FooterContent>
            <LeftGroup>
              <label htmlFor="layer-templates" style={{ fontWeight: "bold" }}>
                Layer Templates
              </label>
              <Select
                inputId="layer-templates"
                menuPlacement="top"
                options={mapLayerTemplates}
                value={selectedOption}
                onChange={onLayoutChange}
                aria-label={"Layer Templates Input"}
                styles={{
                  control: (base) => ({
                    ...base,
                    minWidth: "100%",
                  }),
                  container: (base) => ({
                    ...base,
                    flex: 0.5,
                  }),
                }}
              />
            </LeftGroup>
            {errorMessage && (
              <StyledAlert
                key="danger"
                variant="danger"
                dismissible
                onClose={() => setErrorMessage("")}
              >
                {errorMessage}
              </StyledAlert>
            )}
            <RightGroup>
              <Button
                variant="secondary"
                onClick={handleModalClose}
                aria-label={"Close Layer Modal Button"}
              >
                Close
              </Button>
              <Button
                variant="success"
                onClick={saveLayer}
                aria-label={"Create Layer Button"}
              >
                Create
              </Button>
            </RightGroup>
          </FooterContent>
        </Modal.Footer>
      </Modal>
      {showLayoutEditor && (
        <PopupLayoutEditor
          show={showLayoutEditor}
          onClose={() => setShowLayoutEditor(false)}
          popupConfig={popupConfig}
          onSave={(nextGridItems) => {
            setPopupConfig((prev) => ({
              ...prev,
              gridItems: nextGridItems,
            }));
            setShowLayoutEditor(false);
          }}
          layerName={layerProps?.name}
        />
      )}
    </>
  );
};

MapLayerModal.propTypes = {
  showModal: PropTypes.bool, // state for showing map layer modal
  handleModalClose: PropTypes.func, // callback function for when map layer modal closes
  addMapLayer: PropTypes.func, // callback function for adding map layer to the addMapLayer Input
  // contain information about the layer for each tab in the modal
  layerInfo: PropTypes.shape({
    sourceProps: sourcePropType,
    layerProps: PropTypes.shape({
      name: PropTypes.string,
      // Stable UUID for runtime dynamic_map_layer reconciliation identity.
      // Populated when reopening a saved runtime layer; absent for static.
      layerId: PropTypes.string,
    }), // an object of layer properties like opacity, zoom, etc. see components/map/utilities.js (layerPropertiesOptions) for examples
    legend: legendPropType,
    style: PropTypes.string, // name of .json file that is save with the application that contain the actual style json
    attributeProps: attributePropsPropType,
    popupConfig: PropTypes.shape({
      id: PropTypes.number,
      mode: PropTypes.oneOf(["table", "modal"]),
      position: PropTypes.shape({
        leftPct: PropTypes.number,
        topPct: PropTypes.number,
        widthPct: PropTypes.number,
        heightPct: PropTypes.number,
      }),
      titleTemplate: PropTypes.string,
      gridItems: PropTypes.array,
    }),
  }),
  mapLayers: PropTypes.arrayOf(layerPropType),
  existingLayerOriginalName: PropTypes.shape({
    current: PropTypes.any,
  }),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default MapLayerModal;
