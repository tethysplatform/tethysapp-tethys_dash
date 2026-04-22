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
import { AppContext, LayoutContext } from "components/contexts/Contexts";
import {
  sourcePropertiesOptions,
  layerPropType,
  legendPropType,
  sourcePropType,
  attributePropsPropType,
  saveLayerJSON,
} from "components/map/utilities";
import {
  removeEmptyValues,
  checkRequiredKeys,
} from "components/modals/utilities";
import { findSelectOptionByValue } from "components/visualizations/utilities";
import { useMapContext } from "components/contexts/MapContext";
import Select from "react-select";
import appAPI from "services/api/app";
import "components/modals/wideModal.css";

// Empty-but-valid GeoJSON FeatureCollection used as the scaffold snapshot
// for runtime dynamic_map_layer plugins. Satisfies validate_geojson's CRS
// requirement and ModuleLoader's direct config.geojson.crs.properties.name
// read so the OL VectorLayer can be instantiated before the first runtime
// fetch completes.
const DYNAMIC_LAYER_PLACEHOLDER_GEOJSON = {
  type: "FeatureCollection",
  features: [],
  crs: { type: "name", properties: { name: "EPSG:4326" } },
};

// Rekey a layer-keyed attribute map (variables/omitted/aliases) to a new
// layer name. Only acts on single-key maps — multi-layer sources like WMS
// or ESRI Image Services intentionally carry multiple layer keys and must
// not be collapsed. Returns the input unchanged when the map is empty,
// already correctly keyed, or has more than one entry.
function rekeyAttributeMapToLayer(map, targetLayerName) {
  if (!map || typeof map !== "object" || !targetLayerName) return map;
  const keys = Object.keys(map);
  if (keys.length !== 1 || keys[0] === targetLayerName) return map;
  return { [targetLayerName]: map[keys[0]] };
}

// Rekey all attribute-map entries under attributeProps to targetLayerName.
function normalizeAttributePropsForLayer(attributeProps, targetLayerName) {
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

// Rename a specific layer key across attributeProps. Used when the author
// renames the layer in LayerPane — the previous-name key must be moved to
// the new name or click/popup lookups by layer.name would miss.
function renameLayerInAttributeProps(attributeProps, oldName, newName) {
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
  const [selectedOption, setSelectedOption] = useState(null);
  const [hiddenForExtentDraw, setHiddenForExtentDraw] = useState(false);
  const legendContainerRef = useRef(null);
  const styleContainerRef = useRef(null);
  const { csrf, mapLayerTemplates, dynamicMapLayers } = useContext(AppContext);
  const { uuid } = useContext(LayoutContext);
  const mapContext = useMapContext();

  const onRequestHideModal = useCallback(() => {
    setHiddenForExtentDraw(true);
  }, []);

  // Intercept layerProps updates to preserve the invariant that attribute-map
  // keys (variables/omitted/aliases) match the current layer name. Without
  // this, a plugin scaffolds attribute maps keyed by the builder's layer name
  // (e.g. "Stream Gauges"); if the author renames the layer in LayerPane, the
  // maps are left keyed by the stale name and click/popup lookups miss. Only
  // rewrites entries already keyed by the previous name (untouched when the
  // map is empty), so static multi-layer sources (WMS, ESRI Image) are
  // unaffected.
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

    // Detect runtime dynamic_map_layer via AppContext lookup. sourceProps.type
    // for a runtime layer is the plugin's intake source name, which appears
    // in dynamicMapLayers (grouped by the "Dynamic Map Layers" label).
    const isRuntime = !!findSelectOptionByValue(
      dynamicMapLayers,
      sourceProps.type,
    );

    const { layerVisibility, ...layerProperties } = layerProps;
    const validSourceProps = removeEmptyValues(sourceProps.props);
    const validLayerProps = removeEmptyValues(layerProperties);

    // Static sources enforce their required-field schema (url, LAYERS, etc.).
    // Runtime plugins skip this — features come from the plugin at viewer
    // time, not from a URL the author typed in.
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

    const getLayerType = (sourceType) => {
      if (sourceType.includes("Vector")) return "VectorTileLayer";
      if (sourceType.includes("Raster")) return "WebGLTile";
      if (sourceType.includes("Tile")) return "TileLayer";
      if (sourceType.includes("Image") || sourceType.includes("WMS"))
        return "ImageLayer";
      return "VectorLayer";
    };

    let mapConfiguration;
    if (isRuntime) {
      // Runtime layers persist as VectorLayer with a GeoJSON source holding
      // an empty placeholder FC (valid crs) plus a sibling pluginSource
      // reference block. At viewer time, runtimeLayerFetcher (Unit 5) fetches
      // real features and swaps them into the preserved OL layer (Unit 4).
      // layerId is a stable UUID assigned at save time; used by Unit 4's
      // identity keep-branch and the per-layer WebSocket correlation id.
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
              source: sourceProps.source ?? sourceProps.type,
              args: sourceProps.args ?? {},
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

    // Runtime layers persist their placeholder FC inline (set above); skip
    // the save-time upload so source.geojson stays an object, not a filename.
    if (!isRuntime && sourceProps.type === "GeoJSON") {
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
      mapConfiguration.configuration.props.source.props = {};
      mapConfiguration.configuration.props.source.geojson =
        apiResponse.filename;
    }

    if (style && style !== "{}") {
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
    // Scaffolds emit attribute maps keyed by the template's layer name.
    // Rekey to the effective layer name (preserving the author's earlier
    // rename in LayerPane) so click/popup lookups stay in sync.
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

  // Fetch scaffold for a dynamic_map_layer plugin and apply it to the
  // Style / Legend / Attributes / LayerProps panes. Unlike onLayoutChange
  // (which handles static Layer Templates), this preserves the runtime
  // sourceProps (plugin source name + args) — we only want the scaffold
  // to pre-fill the pane state, not reshape the source.
  //
  // Called from SourcePane in two contexts:
  //   - Automatically on initial plugin selection (via handleLayerTypeChange).
  //   - Explicitly via the "Fetch defaults" button the author clicks after
  //     editing plugin args. (Arg edits do NOT auto-fire to avoid spamming
  //     slow / side-effecting plugins.)
  //
  // Returns { success: bool, error?: string } so SourcePane can display
  // inline feedback. Throws nothing.
  const fetchPluginDefaults = useCallback(
    async (source, args) => {
      try {
        const apiResponse = await appAPI.getVisualizationData({
          source,
          args: args ?? {},
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
        // Preserve the current layer name (author may have renamed the
        // layer in the Layer pane) — only fall back to the scaffold's
        // name when the current name is empty.
        const effectiveName =
          layerProps?.name || updatedLayerProps.name;
        setLayerProps((prev) => ({
          ...updatedLayerProps,
          name: prev?.name || updatedLayerProps.name,
          layerId: prev?.layerId,
        }));
        // The scaffold keys attribute maps by the plugin builder's layer
        // name (e.g. "Stream Gauges"); rekey to the effective (user-set)
        // layer name so click/popup lookups find the expected variables.
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
          error: err?.message ?? "Failed to fetch plugin defaults.",
        };
      }
    },
    [
      layerProps?.name,
      setLayerProps,
      setAttributeProps,
      setStyle,
      setLegend,
    ],
  );

  return (
    <>
      <Modal
        show={showModal}
        onHide={handleModalClose}
        className="map-layer"
        dialogClassName="fiftyWideModalDialog"
        contentClassName="mapLayerContent"
        style={hiddenForExtentDraw ? { visibility: "hidden" } : undefined}
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
              title="Attributes/Popup"
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
