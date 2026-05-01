import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useContext,
} from "react";
import FileUpload from "components/inputs/FileUpload";
import styled from "styled-components";
import {
  sourcePropertiesOptions,
  sourcePropType,
} from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import NormalInput from "components/inputs/NormalInput";
import appAPI from "services/api/app";
import { removeEmptyValues } from "components/modals/utilities";
import { findSelectOptionByValue } from "components/visualizations/utilities";
import { VisualizationArguments } from "components/modals/DataViewer/VisualizationPane";
import { AppContext, LayoutContext } from "components/contexts/Contexts";
import { useMapContext } from "components/contexts/MapContext";
import Button from "react-bootstrap/Button";
import Alert from "react-bootstrap/Alert";
import Spinner from "react-bootstrap/Spinner";
import GeoTIFFSourceModal from "components/modals/MapLayer/GeoTIFFSourceModal";
import "components/modals/wideModal.css";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const GeoTIFFSourcesSection = styled.div`
  margin-top: 1rem;
`;

const GeoTIFFEmptyState = styled.div`
  padding: 1.5rem;
  margin-bottom: 0.75rem;
  border: 1px dashed #adb5bd;
  border-radius: 0.375rem;
  text-align: center;
  color: #6c757d;
`;

const GeoTIFFSourcesList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem 0;
`;

const GeoTIFFSourceRow = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  background: #fff;
`;

const GeoTIFFSourceRowBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const GeoTIFFSourceUrl = styled.div`
  font-family: monospace;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const GeoTIFFSourceSummary = styled.div`
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 0.15rem;
`;

const GeoTIFFChannelLabel = styled.span`
  display: inline-block;
  font-weight: bold;
  margin-right: 0.5rem;
  min-width: 1.25rem;
  color: ${(props) =>
    props.$channel === "R"
      ? "#d32f2f"
      : props.$channel === "G"
        ? "#2e7d32"
        : "#1565c0"};
`;

const GeoTIFFRowControls = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const GeoTIFFHint = styled.div`
  padding: 0.5rem 0.75rem;
  margin: 0.5rem 0 0.75rem;
  border-left: 3px solid #0d6efd;
  background: #e7f1ff;
  font-size: 0.85rem;
  color: #0a4b8c;
`;

const singleBandIndex = (bandsStr) => {
  if (typeof bandsStr !== "string") return null;
  const parts = bandsStr
    .trim()
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  if (parts.length !== 1) return null;
  return parts[0];
};

const formatSummary = (source) => {
  const bandsDisplay = (() => {
    const s = typeof source.bands === "string" ? source.bands.trim() : "";
    if (s === "") return "—";
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    if (parts.length === 0) return "—";
    return `[${parts.join(",")}]`;
  })();
  const fieldDisplay = (v) => {
    if (v === undefined || v === null) return "—";
    const s = String(v).trim();
    return s === "" ? "—" : s;
  };
  return `bands: ${bandsDisplay} · min: ${fieldDisplay(
    source.min,
  )} · max: ${fieldDisplay(source.max)}`;
};

// loop through the properties of a source type and extract potential settings and placeholders, setting new values from existing values if applicable
export const generatePropertiesArrayWithValues = (
  sourceProperties,
  existingPropertyValues,
) => {
  const properties = [];
  const placeholders = [];
  const types = [];
  let existingValues = existingPropertyValues ?? {};

  const processKeys = (obj, required, parentKey, mappingObj) => {
    // loop through each key/value pair in the object
    for (const [key, value] of Object.entries(obj || {})) {
      // if processing a nested object, combine the parent with the key to get a master key
      const property = parentKey ? `${parentKey} - ${key}` : key;

      // try to get existing value if present
      const valueInMap = mappingObj[key];
      const existingValue = valueInMap?.value ?? valueInMap;

      if (
        value &&
        typeof value === "object" &&
        !Object.keys(value).includes("placeholder")
      ) {
        processKeys(value, required, property, existingValue || {});
      } else {
        const propertyName = `${required ? "*" : ""}${property}`;
        // Add to the result array with mapped value or empty string
        properties.push({
          property: propertyName,
          value: existingValue
            ? Array.isArray(existingValue)
              ? existingValue.join(",")
              : existingValue
            : "",
        });
        placeholders.push({ value: value.placeholder });
        types.push(value?.type ?? "text");
      }
    }
  };

  // Process required and optional parts with existingValues
  processKeys(sourceProperties?.required, true, "", existingValues);
  processKeys(sourceProperties?.optional, false, "", existingValues);

  return { properties, placeholders, types };
};

// coverts a flat object of properties from the generatePropertiesArrayWithValues function into a nested object
function parsePropertiesArray(properties) {
  return properties.reduce((acc, item) => {
    let { property, value } = item;
    const parts = property.split(" - "); // Split by delimiter
    property = property.replace(/^\*/, "");

    // source properties can be {value: ..., placeholder:...} or just a straight value
    if (parts.length > 1) {
      let [parentKey, childKey] = parts.map((part) => part.trim());
      parentKey = parentKey.replace(/^\*/, "");
      acc[parentKey] = acc[parentKey] || {};
      acc[parentKey][childKey] = value?.value ?? value;
    } else {
      acc[property] = value?.value ?? value;
    }

    return acc;
  }, {});
}

const SourcePane = ({
  sourceProps,
  setSourceProps,
  setStyle,
  setAttributeProps,
  setErrorMessage,
  onRequestHideModal,
  onFetchPluginDefaults,
  onSubModalToggle,
}) => {
  const [sourceProperties, setSourceProperties] = useState([]); // array of objects that represent properties that will be rendered in the table
  const [propertyPlaceholders, SetPropertyPlaceholders] = useState([]); // array of objects that represent placeholders for the table inputs
  const [propertyTypes, SetPropertyTypes] = useState([]); // array of objects that represent types for the table inputs
  const [sourceType, setSourceType] = useState({}); // source type dropdown selection {value: ..., label: ...}
  const [geoJSON, setGeoJSON] = useState("{}"); // track the geojson value
  const [geoJSONSource, setGeoJSONSource] = useState("custom"); // track the geojson value
  const [pluginFetching, setPluginFetching] = useState(false);
  const [pluginFetchError, setPluginFetchError] = useState(null);

  const [sources, setSources] = useState(() =>
    Array.isArray(sourceProps?.props?.sources) ? sourceProps.props.sources : [],
  );
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null); // null → Add; number → Edit
  const addButtonRef = useRef(null);
  const editButtonRefs = useRef(new Map());
  const pendingReturnFocusRef = useRef({ current: null });

  const { uuid } = useContext(LayoutContext);
  const mapContext = useMapContext();
  const { dynamicMapLayers } = useContext(AppContext);

  const selectedPluginOption =
    (sourceProps.source &&
      findSelectOptionByValue(
        dynamicMapLayers,
        sourceProps.source,
        "source",
      )) ||
    (sourceProps.type &&
      findSelectOptionByValue(dynamicMapLayers, sourceProps.type));
  const isDynamicMapLayer = !!selectedPluginOption;
  const savedAsDynamicPlugin = !!sourceProps.source;
  const pluginUnavailable = savedAsDynamicPlugin && !isDynamicMapLayer;

  const pluginArgSchema = selectedPluginOption?.args ?? {};
  const pluginVizArguments = Object.entries(pluginArgSchema).map(
    ([argName, argType]) => ({ name: argName, label: argName, type: argType }),
  );

  const handlePluginArgChange = useCallback(
    (key) => (newValue) => {
      setSourceProps((prev) => ({
        ...prev,
        args: {
          ...(prev?.args ?? {}),
          [key]: newValue?.value ?? newValue,
        },
      }));
    },
    [setSourceProps],
  );

  const runFetchPluginDefaults = useCallback(
    async (source, args) => {
      if (!onFetchPluginDefaults) return;
      setPluginFetchError(null);
      setPluginFetching(true);
      const result = await onFetchPluginDefaults(source, args);
      setPluginFetching(false);
      if (!result?.success) {
        setPluginFetchError(
          result?.error ?? "Failed to fetch plugin defaults.",
        );
      }
    },
    [onFetchPluginDefaults],
  );

  useEffect(() => {
    if (typeof onSubModalToggle === "function") {
      onSubModalToggle(subModalOpen);
    }
  }, [subModalOpen, onSubModalToggle]);

  useEffect(() => {
    if (sourceProps?.type === "GeoTIFF") {
      const incoming = Array.isArray(sourceProps?.props?.sources)
        ? sourceProps.props.sources
        : [];
      setSources(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceProps?.type, sourceProps?.props?.sources]);

  useEffect(() => {
    // if loading existing layer, then set states appropriately
    if (isDynamicMapLayer) {
      setSourceType({
        value: selectedPluginOption.value,
        label: selectedPluginOption.label,
      });
    } else if (pluginUnavailable) {
      setSourceType({
        value: sourceProps.type ?? sourceProps.source,
        label: sourceProps.type ?? sourceProps.source,
      });
    } else if (sourceProps.type) {
      const { properties, placeholders, types } =
        generatePropertiesArrayWithValues(
          sourcePropertiesOptions[sourceProps.type],
          sourceProps.props,
        );
      setSourceProperties(properties);
      SetPropertyPlaceholders(placeholders);
      SetPropertyTypes(types);
      setSourceType({ value: sourceProps.type, label: sourceProps.type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceProps.type, sourceProps.source, sourceProps.props?.imageExtent]);

  useEffect(() => {
    const fetchGeoJSON = async () => {
      if (sourceProps.geojson.includes("/")) {
        setGeoJSON(sourceProps.geojson);
        setGeoJSONSource("url");
      } else {
        const apiResponse = await appAPI.downloadJSON({
          filename: sourceProps.geojson,
          dashboard_uuid: uuid,
        });
        if (apiResponse.success) {
          setGeoJSON(JSON.stringify(apiResponse.data, null, 4));
          setSourceProps((previousSourceProps) => ({
            ...previousSourceProps,
            ...{ geojson: JSON.stringify(apiResponse.data) },
          }));
          setGeoJSONSource("custom");
        } else {
          setErrorMessage("Failed to retrieve JSON");
        }
      }
    };
    if (!sourceProps.type || sourceProps.type !== "GeoJSON") return;

    const geo = sourceProps.geojson;
    if (
      typeof geo === "string" &&
      (geo.endsWith(".json") || geo.endsWith(".geojson"))
    ) {
      fetchGeoJSON();
    } else if (typeof geo === "object" && geo !== null) {
      setGeoJSON(JSON.stringify(geo, null, 4));
      setSourceProps((prev) => ({
        ...prev,
        geojson: JSON.stringify(geo),
      }));
      setGeoJSONSource("custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceProps.geojson]);

  const potentialMapLayers = Object.keys(sourcePropertiesOptions).map(
    (option) => ({
      value: option,
      label: option,
    }),
  );
  potentialMapLayers.push(...dynamicMapLayers);

  function handlePropertyChange({ newValue, rowIndex, field }) {
    // update table values
    const updatedSourceProperties = JSON.parse(
      JSON.stringify(sourceProperties),
    );
    updatedSourceProperties[rowIndex][field] = newValue;
    setSourceProperties(updatedSourceProperties);

    // update layer source props
    const parsedSourceProps = parsePropertiesArray(updatedSourceProperties);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{
        props: removeEmptyValues(parsedSourceProps),
      },
    }));
  }

  function handleLayerTypeChange(e) {
    setSourceType(e);
    setPluginFetchError(null);

    let properties = [];
    let placeholders = [];
    let types = [];
    const isRuntime = e.type === "map_layer";
    if (!isRuntime) {
      // update table values and placeholders from new source type
      ({ properties, placeholders, types } = generatePropertiesArrayWithValues(
        sourcePropertiesOptions[e.value],
        sourceProps.props,
      ));
    }
    setSourceProperties(properties);
    SetPropertyPlaceholders(placeholders);
    SetPropertyTypes(types);

    const parsedSourceProps = parsePropertiesArray(properties);
    setSourceProps(() => {
      if (isRuntime) {
        return {
          ...e,
          type: e.value,
          props: removeEmptyValues(parsedSourceProps),
          args: {},
        };
      }
      return {
        type: e.value,
        props: removeEmptyValues(parsedSourceProps),
      };
    });

    // reset attribute variable and omitted popup attributes since the source has changed
    setAttributeProps({});

    if (isRuntime) {
      runFetchPluginDefaults(e.source, {});
    }
  }

  function handleDrawExtentOnMap() {
    // Read current values from the sourceProperties table
    const currentProps = parsePropertiesArray(sourceProperties);
    const imageUrl = currentProps.url || "";
    const projection = currentProps.projection || "";

    let initialExtent = null;
    if (currentProps.imageExtent) {
      const parsed = currentProps.imageExtent
        .split(",")
        .map((v) => parseFloat(v.trim()));
      if (parsed.length === 4 && parsed.every((v) => isFinite(v))) {
        initialExtent = parsed;
      }
    }

    if (!imageUrl) {
      setErrorMessage("Please enter an image URL before drawing the extent.");
      return;
    }

    mapContext.setExtentDrawMode({
      initialExtent,
      imageUrl,
      projection: projection || null,
    });
    onRequestHideModal();
  }

  function handleGeoJSONUpload({ fileContent }) {
    setGeoJSON(fileContent);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ geojson: fileContent },
    }));
  }

  function handleGeoJSONChange(e) {
    setGeoJSON(e.target.value);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ geojson: e.target.value },
    }));
  }

  function handleGeoJSONSourceChange(source) {
    setGeoJSONSource(source);

    let newGeoJSON;
    if (source === "custom") {
      newGeoJSON = "{}";
    } else {
      newGeoJSON = "";
    }
    setGeoJSON(newGeoJSON);
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ geojson: newGeoJSON },
    }));
  }

  function syncSourcesToProps(updatedSources) {
    setSourceProps((previousSourceProps) => ({
      ...previousSourceProps,
      props: {
        ...(previousSourceProps?.props ?? {}),
        sources: updatedSources,
      },
    }));
  }

  function handleOpenAddGeoTIFFSource() {
    pendingReturnFocusRef.current = { current: addButtonRef.current };
    setEditingIndex(null);
    setSubModalOpen(true);
  }

  function handleOpenEditGeoTIFFSource(index) {
    const triggerEl = editButtonRefs.current.get(index);
    pendingReturnFocusRef.current = { current: triggerEl };
    setEditingIndex(index);
    setSubModalOpen(true);
  }

  function handleGeoTIFFSubModalHide() {
    setSubModalOpen(false);
  }

  function handleGeoTIFFSubModalSave(sourceInfo) {
    setSources((prevSources) => {
      let updated;
      if (editingIndex === null) {
        updated = [...prevSources, sourceInfo];
      } else {
        updated = prevSources.map((row, idx) =>
          idx === editingIndex ? sourceInfo : row,
        );
      }
      syncSourcesToProps(updated);
      return updated;
    });
  }

  function handleRemoveGeoTIFFSource(index) {
    const confirmed = window.confirm("Remove this source?");
    if (!confirmed) return;
    setSources((prevSources) => {
      const updated = prevSources.filter((_, idx) => idx !== index);
      syncSourcesToProps(updated);
      return updated;
    });
  }

  // Render helper for the GeoTIFF branch — keeps the main JSX readable.
  function renderGeoTIFFPane() {
    const allSingleBand =
      sources.length === 3 &&
      sources.every((s) => singleBandIndex(s.bands) !== null);
    const channelLabels = ["R", "G", "B"];
    const editingInitialValue =
      editingIndex === null ? null : sources[editingIndex];

    const isLikelyScientificSingleBand =
      sources.length === 1 &&
      (typeof sources[0]?.bands !== "string" ||
        sources[0].bands.trim() === "" ||
        singleBandIndex(sources[0].bands) !== null);

    return (
      <GeoTIFFSourcesSection>
        <h5>Sources</h5>
        <GeoTIFFHint role="note">
          GeoTIFF layers render in the source's native projection; the dashboard
          map view will be reprojected to match the data on load. Basemaps in
          EPSG:3857 may look distorted if your COG uses a different projection.{" "}
          <strong>Files must be Cloud Optimized GeoTIFFs</strong> — plain
          strip-based TIFFs and some compression/predictor combinations may fail
          silently. Convert with{" "}
          <code style={{ fontSize: "0.85em" }}>
            gdal_translate -of COG -co COMPRESS=DEFLATE -co PREDICTOR=YES
            input.tif output.tif
          </code>
          .
        </GeoTIFFHint>
        {sources.length === 0 ? (
          <GeoTIFFEmptyState>
            Add at least one source to render this layer
          </GeoTIFFEmptyState>
        ) : (
          <GeoTIFFSourcesList role="list">
            {sources.map((source, index) => {
              const oneBased = index + 1;
              const url = source?.url ?? "";
              return (
                <GeoTIFFSourceRow key={index}>
                  <GeoTIFFSourceRowBody>
                    <GeoTIFFSourceUrl title={url}>
                      {allSingleBand && (
                        <GeoTIFFChannelLabel $channel={channelLabels[index]}>
                          {channelLabels[index]}:
                        </GeoTIFFChannelLabel>
                      )}
                      {url}
                    </GeoTIFFSourceUrl>
                    <GeoTIFFSourceSummary>
                      {formatSummary(source)}
                    </GeoTIFFSourceSummary>
                  </GeoTIFFSourceRowBody>
                  <GeoTIFFRowControls>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      aria-label={`Edit source ${oneBased}`}
                      ref={(el) => {
                        if (el) editButtonRefs.current.set(index, el);
                        else editButtonRefs.current.delete(index);
                      }}
                      onClick={() => handleOpenEditGeoTIFFSource(index)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      aria-label={`Remove source ${oneBased}`}
                      onClick={() => handleRemoveGeoTIFFSource(index)}
                    >
                      Remove
                    </Button>
                  </GeoTIFFRowControls>
                </GeoTIFFSourceRow>
              );
            })}
          </GeoTIFFSourcesList>
        )}
        <Button
          variant="primary"
          size="sm"
          ref={addButtonRef}
          onClick={handleOpenAddGeoTIFFSource}
        >
          Add source
        </Button>
        {isLikelyScientificSingleBand && (
          <GeoTIFFHint role="note">
            Single-band source detected — scientific rasters render near-black
            without a color ramp. Pick one in the Style tab.
          </GeoTIFFHint>
        )}
        <GeoTIFFSourceModal
          show={subModalOpen}
          onHide={handleGeoTIFFSubModalHide}
          onSave={handleGeoTIFFSubModalSave}
          initialValue={editingInitialValue}
          returnFocusRef={pendingReturnFocusRef.current}
        />
      </GeoTIFFSourcesSection>
    );
  }

  return (
    <>
      <DataSelect
        label={"Source Type"}
        aria-label={"Source Type Input"}
        selectedOption={sourceType}
        onChange={handleLayerTypeChange}
        options={potentialMapLayers}
      />

      {pluginUnavailable && (
        <Alert variant="warning" role="alert">
          <Alert.Heading>Plugin not available</Alert.Heading>
          <p>
            This layer was configured with the dynamic map-layer plugin
            <strong> {sourceProps.source}</strong>, but it is no longer
            installed on this server (or your account does not have access to
            it). The layer&apos;s saved style, legend, and attribute settings
            are preserved, but no features will load at viewer time. Remove the
            layer or replace its source to restore rendering.
          </p>
        </Alert>
      )}

      {sourceType.value && !pluginUnavailable && (
        <>
          {sourceType.value === "GeoJSON" ? (
            <>
              <DataRadioSelect
                label="GeoJSON Source"
                selectedRadio={geoJSONSource}
                radioOptions={[
                  { value: "custom", label: "Custom" },
                  { value: "url", label: "URL" },
                ]}
                onChange={handleGeoJSONSourceChange}
              />
              {geoJSONSource === "custom" ? (
                <>
                  <FileUpload
                    label="Upload GeoJSON file"
                    onFileUpload={handleGeoJSONUpload}
                    extensionsAllowed={["json", "geojson"]}
                  />
                  <StyledTextInput
                    aria-label={"geojson-source-text-area"}
                    value={geoJSON}
                    onChange={handleGeoJSONChange}
                  />
                </>
              ) : (
                <NormalInput
                  label="URL"
                  value={geoJSON}
                  type="text"
                  onChange={handleGeoJSONChange}
                />
              )}
            </>
          ) : isDynamicMapLayer ? (
            <>
              {pluginVizArguments.length > 0 ? (
                <VisualizationArguments
                  selectedVizTypeOption={sourceType}
                  vizArguments={pluginVizArguments}
                  vizInputsValues={sourceProps.args ?? {}}
                  handleInputChange={handlePluginArgChange}
                />
              ) : (
                <p>
                  <em>This plugin takes no arguments.</em>
                </p>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "0.75rem",
                }}
              >
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    runFetchPluginDefaults(
                      sourceProps.source ?? sourceType.value,
                      sourceProps.args ?? {},
                    )
                  }
                  disabled={pluginFetching}
                  aria-label="Fetch plugin defaults"
                >
                  {pluginFetching ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />
                      <span style={{ marginLeft: "0.4rem" }}>
                        Fetching&hellip;
                      </span>
                    </>
                  ) : (
                    "Fetch defaults"
                  )}
                </Button>
                <small style={{ color: "#6c757d" }}>
                  Re-runs the plugin with the current args above and overwrites
                  Style / Legend / Attributes panes.
                </small>
              </div>
              {pluginFetchError && (
                <Alert
                  variant="danger"
                  role="alert"
                  style={{ marginTop: "0.5rem" }}
                >
                  {pluginFetchError}
                </Alert>
              )}
            </>
          ) : sourceType.value === "GeoTIFF" ? (
            renderGeoTIFFPane()
          ) : (
            <>
              {sourceProperties.length > 0 && (
                <>
                  <InputTable
                    label="Source Properties"
                    onChange={handlePropertyChange}
                    values={sourceProperties}
                    disabledFields={["required", "property"]}
                    placeholders={propertyPlaceholders}
                    show_placeholder_on_hover={true}
                    types={propertyTypes}
                  />
                  <p>
                    <em>* indicates a required property</em>
                  </p>
                </>
              )}
              {sourceType.value === "Static Image" &&
                mapContext &&
                onRequestHideModal && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleDrawExtentOnMap}
                    aria-label="Draw Extent on Map Button"
                  >
                    Draw Extent on Map
                  </Button>
                )}
            </>
          )}
        </>
      )}
    </>
  );
};

SourcePane.propTypes = {
  sourceProps: sourcePropType,
  setSourceProps: PropTypes.func, // setter for sourceProps state
  setStyle: PropTypes.func, // setter for style state (used by Fetch defaults applied from MapLayer)
  setAttributeProps: PropTypes.func, // setter for attributeProps state
  setErrorMessage: PropTypes.func,
  onRequestHideModal: PropTypes.func, // callback to hide the modal for extent drawing
  onFetchPluginDefaults: PropTypes.func,
  onSubModalToggle: PropTypes.func, // (open: boolean) => void — parent raises zIndex while GeoTIFF sub-modal is open
};

export default memo(SourcePane);
