import PropTypes from "prop-types";
import { useShapefileDiscovery } from "components/modals/MapLayer/shapefileDiscovery";
import useSourceArgumentDiscovery from "components/modals/MapLayer/sourceArgumentDiscovery";
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
import StylePane, {
  supportsVectorStyling,
} from "components/modals/MapLayer/StylePane";
import LabelsPane from "components/modals/MapLayer/LabelsPane";
import PopupConfigPane from "components/modals/MapLayer/PopupConfigPane";
import PopupLayoutEditor from "components/modals/MapLayer/PopupLayoutEditor";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { POPUP_TAB_ID } from "components/map/viewGroup";
import {
  sourcePropertiesOptions,
  layerPropType,
  legendPropType,
  sourcePropType,
  attributePropsPropType,
  saveLayerJSON,
  resolveTablePopupType,
} from "components/map/utilities";
import {
  isClassStyleMode,
  isRampBoundSet,
  isUsableClass,
  rasterStyleSettings,
} from "components/map/geoTIFFStyle";
import {
  removeEmptyValues,
  removeEmptyLayerProps,
  checkRequiredKeys,
} from "components/modals/utilities";
import {
  findSelectOptionByValue,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import { useMapContext } from "components/contexts/MapContext";
import { getDynamicLayerSourceType } from "components/modals/MapLayer/runtimeLayerSource";
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

/**
 * The saved style of a raster layer (GeoTIFF or Zarr, static or dynamic): the
 * editor's ramp settings, and only those.
 *
 * Never a compiled OpenLayers style. That depends on the file -- its nodata, its
 * value range -- so it is compiled each time the layer loads (applyAutoRamp in
 * components/map/ModuleLoader.js), and for a dynamic layer per fetch.
 *
 * A class table is saved only when it has a class that can be drawn, and then
 * in place of the range; the ramp name is kept beside it so switching back to a
 * ramp does not lose the chosen palette. Each bound is independent: a set one
 * pins that end of the ramp, an empty one is resolved from the file. Values keep
 * the type the editor's inputs give them, so bounds are saved as numeric
 * strings. The mask is not here: it is a source property, edited on the
 * Source pane and saved as `source.props.mask_below`, because the Zarr reader
 * writes it into the slice's alpha band as it reads -- it describes the data
 * being read, not how the result is coloured.
 *
 * @param {object} rasterStyle The editor's raster style settings.
 * @returns {object} `{rampName?, rampMin?, rampMax?, rampReverse?, styleMode?,
 *   classes?, fallbackColor?}`, empty when nothing is set.
 */
export function buildRasterStyleSettings(rasterStyle) {
  const {
    rampName,
    rampMin,
    rampMax,
    rampReverse,
    styleMode,
    classes,
    fallbackColor,
  } = rasterStyle ?? {};
  const style = {};
  const hasRampName = typeof rampName === "string" && rampName.trim() !== "";
  const usableClasses = (classes ?? []).filter(isUsableClass);

  if (isClassStyleMode(styleMode) && usableClasses.length > 0) {
    style.styleMode = styleMode;
    style.classes = usableClasses;
    if (fallbackColor) style.fallbackColor = fallbackColor;
    if (hasRampName) style.rampName = rampName;
    if (rampReverse === true) style.rampReverse = true;
  } else if (hasRampName) {
    style.rampName = rampName;
    if (isRampBoundSet(rampMin)) style.rampMin = rampMin;
    if (isRampBoundSet(rampMax)) style.rampMax = rampMax;
    // Kept only when set, so an unreversed layer's config is unchanged from
    // before this option existed.
    if (rampReverse === true) style.rampReverse = true;
  }
  return style;
}

/**
 * The saved source of a dynamic GeoTIFF layer: its source props with no URL,
 * since each plugin fetch names the file. Its styling is its saved style (see
 * buildRasterStyleSettings), not part of its source.
 *
 * @param {object} validSourceProps The editor's source props with empty values
 *   removed.
 * @returns {object} `{type: "GeoTIFF", props}`.
 */
export function buildRuntimeRasterSource(validSourceProps) {
  // eslint-disable-next-line no-unused-vars
  const { url, ...props } = validSourceProps ?? {};
  return { type: "GeoTIFF", props };
}

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

// A vector layer can be drawn to an intermediate canvas and re-blitted while
// panning rather than redrawing every feature each frame. Only the plain
// vector class has that alternative, so the upgrade applies there and leaves
// every other layer type alone.
export const applyRenderAsImage = (type, props) =>
  props?.renderAsImage && type === "VectorLayer" ? "VectorImageLayer" : type;

export const getLayerType = (sourceType) => {
  if (sourceType === "GeoTIFF" || sourceType === "Zarr") return "WebGLTile";
  // Explicit rather than left to the fallthrough below. "Shapefile" happens to
  // match none of the substring tests, so it would reach VectorLayer anyway --
  // but a label variant like "Zipped Shapefile Tile" would silently route to the
  // wrong layer class with no error. The label is load-bearing, and it is also
  // persisted user data: renaming one costs a migration over every dashboard.
  if (sourceType === "Shapefile") return "VectorLayer";
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
  // A raster's style is its ramp settings rather than a style JSON, so it is
  // edited apart from `style`, in the shape it is saved in. A saved style that
  // carries no settings -- every non-raster layer's -- reads as none.
  const [rasterStyle, setRasterStyle] = useState(() =>
    rasterStyleSettings(layerInfo.style),
  );
  const [legend, setLegend] = useState(layerInfo.legend);
  const [popupConfig, setPopupConfig] = useState(layerInfo.popupConfig ?? null);
  // Label configuration is stored inside `configuration.props`, so it arrives
  // here already folded into `layerProps` by AddMapLayer's edit path -- no
  // separate load line, and it reaches a plugin-supplied layer the same way.
  // It is held as its own slice rather than edited in place inside `layerProps`
  // so the save path can write it past the empty-value pruning that would
  // otherwise strip a size or zoom floor of 0.
  const [labels, setLabels] = useState(layerInfo.labels ?? null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [hiddenForExtentDraw, setHiddenForExtentDraw] = useState(false);
  const [showLayoutEditor, setShowLayoutEditor] = useState(false);
  const legendContainerRef = useRef(null);
  const styleContainerRef = useRef(null);
  const labelsContainerRef = useRef(null);
  const { csrf, mapLayerTemplates, dynamicMapLayers } = useContext(AppContext);
  const { uuid, editable: hostDashboardEditable } = useContext(LayoutContext);
  const { variableInputValues, variableInputDateFormats } = useContext(
    VariableInputsContext,
  );
  const mapContext = useMapContext();
  // The popup layout editor and the runtime popup modal both mount their reused
  // dashboard layout under a synthetic tab, and this modal is opened from inside
  // that subtree -- so the same signal MapExtent reads reaches the layer editor
  // through context. Feature references inside a popup resolve against the
  // feature that opened it, so a per-feature label there has no coherent
  // meaning and the tab is hidden rather than silently mis-resolving.
  const activeTabId = useContext(TabContext)?.activeTabId;
  const inPopupLayout = activeTabId === POPUP_TAB_ID;
  // Same predicate the Style tab uses to decide a source carries per-feature
  // vector geometry. Rasters, tiles and WMS images have no features to label.
  const showLabelsTab =
    !inPopupLayout && supportsVectorStyling(sourceProps, dynamicMapLayers);

  // Field discovery for a shapefile source, held here rather than in either pane
  // because both read from it. The modal already hoists every pane's state, so a
  // new context would buy nothing -- and one read serves both panes instead of
  // each paying for its own download.
  const shapefileDiscovery = useShapefileDiscovery({
    sourceProps,
    layerName: layerProps?.name,
    variableInputValues,
    variableInputDateFormats,
    style,
    attributeProps,
    popupConfig,
  });

  // Argument discovery sits at the same level and for the same reason: the
  // source pane renders the controls, but the state has to outlive a single
  // pane render or a list read once would be read again on the next keystroke.
  const argumentDiscovery = useSourceArgumentDiscovery({
    sourceProps,
    variableInputValues,
    variableInputDateFormats,
  });

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
    const isRuntimeGeoTIFF =
      isRuntime &&
      getDynamicLayerSourceType(dynamicMapLayers, sourceProps) === "GeoTIFF";

    const { layerVisibility, ...layerProperties } = layerProps;
    const validSourceProps = removeEmptyValues(sourceProps.props);
    // Layer props keep numeric 0 (snapSublayer: 0 is an explicit override),
    // which removeEmptyValues' truthy filter would silently strip on save.
    const validLayerProps = removeEmptyLayerProps(layerProperties);
    // The copy that rode in on `layerProps` is stale the moment the Labels tab
    // is touched, and it has already been through the pruning above. The live
    // slice is written back onto `configuration.props` below instead.

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

    let mapConfiguration;
    if (isRuntime) {
      const existingLayerId =
        layerInfo?.layerProps?.layerId ?? layerProps?.layerId;
      const layerId = existingLayerId || uuidv4();
      mapConfiguration = {
        configuration: {
          type: isRuntimeGeoTIFF
            ? "WebGLTile"
            : applyRenderAsImage("VectorLayer", validLayerProps),
          props: {
            ...validLayerProps,
            layerId,
            source: isRuntimeGeoTIFF
              ? buildRuntimeRasterSource(validSourceProps)
              : {
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
          type: applyRenderAsImage(
            getLayerType(sourceProps.type),
            validLayerProps,
          ),
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

    const resolvedTablePopupType = resolveTablePopupType(attributeProps);
    if (resolvedTablePopupType !== "click") {
      mapConfiguration.tablePopupType = resolvedTablePopupType;
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

    const isRasterLayer =
      isRuntimeGeoTIFF ||
      (!isRuntime &&
        (sourceProps.type === "GeoTIFF" || sourceProps.type === "Zarr"));
    if (isRasterLayer) {
      // The ramp settings are the whole saved style. The compiled OpenLayers
      // style, and the `normalize`/`interpolate` source behavior that goes with
      // it, are derived from them each time the layer loads.
      const rasterStyleToSave = buildRasterStyleSettings(rasterStyle);
      // The Style tab defaults a raster's ramp to turbo as it mounts, so by
      // the time this runs there is always at least a ramp name to save. The
      // guard keeps an empty `style` key out of the saved config if that ever
      // stops being true.
      // istanbul ignore else -- unreachable; see above
      if (Object.keys(rasterStyleToSave).length > 0) {
        mapConfiguration.configuration.style = rasterStyleToSave;
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

    // Written straight onto `configuration.props`, past `removeEmptyLayerProps`:
    // a label size or a zoom floor of 0 is a value the author set, and the flat
    // pruning above drops nested objects' falsy members. Living inside
    // `configuration.props` is also what makes it round-trip with no load
    // wiring -- AddMapLayer's edit path hands everything but `source` back as
    // `layerProps`.
    if (labels && typeof labels === "object") {
      mapConfiguration.configuration.labels = labels;
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
    const layerTablePopupType = resolveTablePopupType(apiResponse.data);
    const updatedLayerProps = Object.fromEntries(
      Object.entries(apiResponse.data.configuration.props).filter(
        ([key]) => key !== "source",
      ),
    );
    updatedLayerProps.layerVisibility =
      apiResponse.data.configuration.layerVisibility;

    setSourceProps(apiResponse.data.configuration.props.source);
    setLayerProps(updatedLayerProps);
    // A template may ship its own labels; they belong in the Labels tab
    // rather than left buried in the configuration where nothing renders them.
    setLabels(apiResponse.data.configuration.labels ?? null);

    const effectiveName = layerProps?.name || updatedLayerProps.name;
    setAttributeProps(
      normalizeAttributePropsForLayer(
        {
          variables: attributeVariables,
          omitted: omittedPopupAttributes,
          aliases: attributeAliases,
          tablePopupType: layerTablePopupType,
        },
        effectiveName,
      ),
    );
    setStyle(apiResponse.data.configuration.style);
    setRasterStyle(rasterStyleSettings(apiResponse.data.configuration.style));
    setLegend(apiResponse.data.legend);
  };

  // Which plugin is selected now, for a plugin's defaults that arrive after the
  // author has already moved on to another.
  const selectedPluginSourceRef = useRef(sourceProps?.source);
  selectedPluginSourceRef.current = sourceProps?.source;

  const fetchPluginDefaults = useCallback(
    async (source, args) => {
      try {
        const resolvedArgs = updateObjectWithVariableInputs({
          args,
          variableInputs: variableInputValues,
          variableInputDateFormats,
        });
        const apiResponse = await appAPI.getVisualizationData({
          source,
          args: resolvedArgs,
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
        const scaffoldTablePopupType = resolveTablePopupType(scaffold);

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
        // Same reason as the template path: a plugin-supplied label config
        // has to be editable in the Labels tab.
        setLabels(config.labels ?? null);

        setAttributeProps(
          normalizeAttributePropsForLayer(
            {
              variables: attributeVariables,
              omitted: omittedPopupAttributes,
              aliases: attributeAliases,
              tablePopupType: scaffoldTablePopupType,
            },
            effectiveName,
          ),
        );
        setStyle(config.style);
        setLegend(scaffold.legend);

        // A dynamic GeoTIFF's style is its ramp settings, so the scaffold's are
        // loaded into the Style tab in place of the editor's, and its source
        // props with them. From here they are the author's to change: this is
        // the plugin offering a starting point, not claiming the style.
        if (
          getDynamicLayerSourceType(dynamicMapLayers, { source }) === "GeoTIFF"
        ) {
          // The author picked another plugin while this one was answering.
          if (selectedPluginSourceRef.current !== source) {
            return { success: true };
          }
          const scaffoldSource = config.props?.source ?? {};
          setRasterStyle(rasterStyleSettings(config.style));
          setSourceProps((prev) => ({
            ...prev,
            props: { ...(scaffoldSource.props ?? {}) },
          }));
        }
        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err?.message || "Failed to fetch plugin defaults.",
        };
      }
    },
    [
      layerProps?.name,
      dynamicMapLayers,
      setLayerProps,
      setAttributeProps,
      setStyle,
      setRasterStyle,
      setLegend,
      variableInputValues,
      variableInputDateFormats,
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
        style={
          hiddenForExtentDraw
            ? { visibility: "hidden" }
            : showLayoutEditor
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
                shapefileDiscovery={shapefileDiscovery}
                argumentDiscovery={argumentDiscovery}
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
                  rasterStyle={rasterStyle}
                  setRasterStyle={setRasterStyle}
                  shapefileDiscovery={shapefileDiscovery}
                />
              </div>
            </Tab>
            {showLabelsTab && (
              <Tab
                eventKey="labels"
                title="Labels"
                aria-label="layer-labels-tab"
                className="layer-labels-tab"
              >
                <div ref={labelsContainerRef}>
                  <LabelsPane
                    layerName={layerProps?.name}
                    labelConfig={labels}
                    onChange={setLabels}
                    containerRef={labelsContainerRef}
                  />
                </div>
              </Tab>
            )}
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
                shapefileDiscovery={shapefileDiscovery}
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
    // Label configuration sits beside `style` on the layer's configuration, not
    // among its props. `minZoom` holds an authored zoom level; the map scope
    // converts it to a resolution at render time.
    labels: PropTypes.shape({
      template: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      anchor: PropTypes.string,
      color: PropTypes.string,
      size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      minZoom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
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
