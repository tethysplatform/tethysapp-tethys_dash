import PropTypes from "prop-types";
import DataSelect from "components/inputs/DataSelect";
import { useState, useEffect, useCallback, memo, useContext } from "react";
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
import "components/modals/wideModal.css";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

// loop through the properties of a source type and extract potential settings and placeholders, setting new values from existing values if applicable
export const generatePropertiesArrayWithValues = (
  sourceProperties,
  existingPropertyValues,
) => {
  const properties = [];
  const placeholders = [];
  const types = [];
  // Parallel to the three above and indexed the same way. The row needs the
  // argument's own name to look its discovery state up, and `property` is not
  // it: required arguments are prefixed with "*" and nested ones are joined
  // with " - ", so deriving the name back from the row would be lossy.
  const discovers = [];
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
        discovers.push(
          value?.discover ? { argument: key, ...value.discover } : null,
        );
      }
    }
  };

  // Process required and optional parts with existingValues
  processKeys(sourceProperties?.required, true, "", existingValues);
  processKeys(sourceProperties?.optional, false, "", existingValues);

  return { properties, placeholders, types, discovers };
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

// What discovery has to say about one argument, rendered beneath its select.
// It lives beside the row rather than inside the menu because a failure needs
// more than a menu line to explain, and because the re-read control has to stay
// reachable when the menu is closed.
const ArgumentDiscoveryNote = ({ argument, discovery, onRefresh }) => {
  const {
    state,
    slow,
    failure,
    retryable,
    stale,
    sliceCount,
    enumerated,
    blockedBy,
  } = discovery;
  // A slice is a position, so it is reported against the range the array has
  // rather than against a list of names the source never offered.
  const outOfRange = typeof sliceCount === "number";

  const showNoKey = state === "nokey";
  const showSlow = state === "loading" && slow;
  const showEmpty = state === "empty";
  const showFailure = state === "failed" && Boolean(failure);
  const showStale = stale?.length > 0;
  const showRefresh =
    state === "ready" || state === "empty" || (state === "failed" && retryable);

  // Render nothing at all rather than an empty wrapper. A read that has only
  // just started has nothing to say, and the wrapper's margin alone was enough
  // to grow the row the moment the menu opened -- a layout shift landing
  // between the author's mousedown and mouseup, which is not a thing a status
  // line should ever cause.
  if (
    !showNoKey &&
    !showSlow &&
    !showEmpty &&
    !showFailure &&
    !showStale &&
    !showRefresh
  ) {
    return null;
  }

  return (
    <div
      style={{ marginTop: "0.35rem" }}
      data-testid={`discovery-note-${argument}`}
    >
      {/* Naming what is actually missing: telling an author to enter a url they
          have already entered sends them looking in the wrong place. */}
      {showNoKey && (
        <small style={{ color: "#6c757d" }}>
          {blockedBy?.reason === "dependency"
            ? `Choose ${blockedBy.missingSibling ?? "the argument this one depends on"} first to see the available values.`
            : "Enter a source URL to see the available values."}
        </small>
      )}

      {showSlow && (
        <div role="status" aria-live="polite">
          <small>
            Still reading this source &mdash; large files take a while.
          </small>
        </div>
      )}

      {/* Two different answers that used to read the same. A source that was
          listed and holds nothing is not a source that could not be listed. */}
      {showEmpty && (
        <Alert variant="secondary" style={{ marginTop: "0.35rem" }}>
          {enumerated
            ? "This source was read and offers nothing here \u2014 type the value if you know it."
            : "This source does not list its contents, so nothing can be offered here \u2014 type the value if you know it."}
        </Alert>
      )}

      {showFailure && (
        <Alert variant="danger" role="alert" style={{ marginTop: "0.35rem" }}>
          {failure.detail}
          {failure.remedy && (
            <>
              <br />
              {failure.remedy}
            </>
          )}
          <br />
          <small>You can still type the value.</small>
        </Alert>
      )}

      {/* The value is reported, never corrected: the author is the only one who
          knows whether the source was renamed or the wrong URL was typed. */}
      {showStale && (
        <Alert variant="warning" role="alert" style={{ marginTop: "0.35rem" }}>
          {outOfRange ? (
            <>
              {sliceCount === 0 ? (
                <>This source has no slices at all.</>
              ) : (
                <>
                  This source has {sliceCount} slice
                  {sliceCount === 1 ? "" : "s"}, so only position
                  {sliceCount === 1 ? " 0" : `s 0-${sliceCount - 1}`} exist
                  {sliceCount === 1 ? "s" : ""}.
                </>
              )}{" "}
              The saved {stale.length === 1 ? "position" : "positions"}{" "}
              {stale.join(", ")} {stale.length === 1 ? "is" : "are"} outside it.
            </>
          ) : (
            <>
              This source does not offer{" "}
              {stale.length === 1 ? "the saved value" : "the saved values"}{" "}
              {stale.join(", ")}.
            </>
          )}{" "}
          <small>
            The saved value is left as it is &mdash; pick a listed one, or keep
            it if the source is wrong.
          </small>
        </Alert>
      )}

      {/* Offered after any read that produced an answer, because recovering a
          republished source is what it exists for -- and after a failure only
          when retrying could plausibly succeed. */}
      {showRefresh && (
        <Button
          variant="link"
          size="sm"
          style={{ padding: 0 }}
          onClick={() => onRefresh(argument)}
          aria-label={`Re-read ${argument} values`}
        >
          Re-read
        </Button>
      )}
    </div>
  );
};

ArgumentDiscoveryNote.propTypes = {
  argument: PropTypes.string.isRequired,
  discovery: PropTypes.object.isRequired,
  onRefresh: PropTypes.func.isRequired,
};

// The author-facing surface for reading a shapefile's fields: an explicit action
// rather than an automatic read, the pending state, what failed and what the
// author can do about it, and any saved field references the source no longer
// has.
//
// The drift list renders here, next to the action that produced it, rather than
// being split across the style and attributes panes -- a style-rule reference
// that has gone missing would otherwise be invisible to an author who never
// opens the attributes tab.
const ShapefileDiscoveryPanel = ({ discovery }) => {
  const { state, slow, fields, failure, drift, load } = discovery;

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <Button
        variant="outline-primary"
        size="sm"
        onClick={load}
        disabled={state === "loading" || !discovery.resolvedUrl}
        aria-label="Read shapefile fields"
      >
        {state === "loading" ? (
          <>
            <Spinner
              as="span"
              animation="border"
              size="sm"
              role="status"
              aria-hidden="true"
            />
            <span style={{ marginLeft: "0.4rem" }}>Reading&hellip;</span>
          </>
        ) : (
          "Read shapefile fields"
        )}
      </Button>
      <small style={{ color: "#6c757d", marginLeft: "0.5rem" }}>
        Reads the source once so the Style and Attributes tabs can offer its
        fields.
      </small>

      {state === "loading" && slow && (
        <div role="status" aria-live="polite" style={{ marginTop: "0.5rem" }}>
          <small>
            Still reading this shapefile &mdash; large archives can take a
            while.
          </small>
        </div>
      )}

      {state === "ready" && (
        <Alert variant="success" style={{ marginTop: "0.5rem" }}>
          Found {fields.length} field{fields.length === 1 ? "" : "s"}
          {fields.length > 0 ? `: ${fields.join(", ")}` : "."}
        </Alert>
      )}

      {state === "error" && failure && (
        <Alert variant="danger" role="alert" style={{ marginTop: "0.5rem" }}>
          {failure.detail}
          {failure.remedy && (
            <>
              <br />
              {failure.remedy}
            </>
          )}
          <br />
          <small>
            Style rules, popup settings and attribute variables already saved
            are unchanged.
          </small>
        </Alert>
      )}

      {drift.length > 0 && (
        <Alert variant="warning" role="alert" style={{ marginTop: "0.5rem" }}>
          Saved settings reference {drift.length === 1 ? "a field" : "fields"}{" "}
          this source does not have: {drift.join(", ")}. Rules and popup rows
          using {drift.length === 1 ? "it" : "them"} will not match anything.
        </Alert>
      )}
    </div>
  );
};

ShapefileDiscoveryPanel.propTypes = {
  discovery: PropTypes.shape({
    state: PropTypes.string,
    slow: PropTypes.bool,
    fields: PropTypes.arrayOf(PropTypes.string),
    failure: PropTypes.shape({
      detail: PropTypes.string,
      remedy: PropTypes.string,
    }),
    drift: PropTypes.arrayOf(PropTypes.string),
    load: PropTypes.func,
    resolvedUrl: PropTypes.string,
  }).isRequired,
};

const SourcePane = ({
  sourceProps,
  setSourceProps,
  setStyle,
  setAttributeProps,
  setErrorMessage,
  onRequestHideModal,
  onFetchPluginDefaults,
  shapefileDiscovery,
  argumentDiscovery,
}) => {
  const [sourceProperties, setSourceProperties] = useState([]); // array of objects that represent properties that will be rendered in the table
  const [propertyPlaceholders, SetPropertyPlaceholders] = useState([]); // array of objects that represent placeholders for the table inputs
  const [propertyTypes, SetPropertyTypes] = useState([]); // array of objects that represent types for the table inputs
  const [propertyDiscovers, setPropertyDiscovers] = useState([]); // per-row discovery declarations, indexed like the arrays above
  const [sourceType, setSourceType] = useState({}); // source type dropdown selection {value: ..., label: ...}
  const [geoJSON, setGeoJSON] = useState("{}"); // track the geojson value
  const [geoJSONSource, setGeoJSONSource] = useState("custom"); // track the geojson value
  const [pluginFetching, setPluginFetching] = useState(false);
  const [pluginFetchError, setPluginFetchError] = useState(null);

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
      const { properties, placeholders, types, discovers } =
        generatePropertiesArrayWithValues(
          sourcePropertiesOptions[sourceProps.type],
          sourceProps.props,
        );
      setSourceProperties(properties);
      SetPropertyPlaceholders(placeholders);
      SetPropertyTypes(types);
      setPropertyDiscovers(discovers);
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

  // One entry per row, aligned with the arrays above. Rows with no discovery
  // declaration get null and keep rendering as whatever type they already were.
  const selectConfigs = propertyDiscovers.map((declaration) => {
    if (!declaration || !argumentDiscovery) return null;
    const entry = argumentDiscovery.discoveries[declaration.argument];
    if (!entry) return null;
    return {
      options: entry.options,
      isLoading: entry.state === "loading",
      separator: declaration.separator,
      // Deferred out of the event on purpose. react-select opens the menu from
      // inside its own mousedown handler, where it calls preventDefault and
      // then focuses its input itself. Starting the read synchronously there
      // makes React flush a re-render of the whole editor mid-event -- which in
      // a browser leaves the control blurred and the menu shut before the
      // author can pick anything. Letting the handler finish first costs a
      // tick and keeps focus where they put it.
      onMenuOpen: () =>
        setTimeout(() => argumentDiscovery.load(declaration.argument), 0),
      content: (
        <ArgumentDiscoveryNote
          argument={declaration.argument}
          discovery={entry}
          onRefresh={argumentDiscovery.refresh}
        />
      ),
    };
  });

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
    let discovers = [];
    const isRuntime = e.type === "map_layer";
    if (!isRuntime) {
      // update table values and placeholders from new source type
      ({ properties, placeholders, types, discovers } =
        generatePropertiesArrayWithValues(
          sourcePropertiesOptions[e.value],
          sourceProps.props,
        ));
    }
    setSourceProperties(properties);
    SetPropertyPlaceholders(placeholders);
    SetPropertyTypes(types);
    setPropertyDiscovers(discovers);

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
                    selectConfigs={selectConfigs}
                  />
                  <p>
                    <em>* indicates a required property</em>
                  </p>
                </>
              )}
              {sourceType.value === "Shapefile" && shapefileDiscovery && (
                <ShapefileDiscoveryPanel discovery={shapefileDiscovery} />
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
  shapefileDiscovery: ShapefileDiscoveryPanel.propTypes.discovery,
  argumentDiscovery: PropTypes.shape({
    discoveries: PropTypes.object,
    load: PropTypes.func,
    refresh: PropTypes.func,
  }),
  sourceProps: sourcePropType,
  setSourceProps: PropTypes.func, // setter for sourceProps state
  setStyle: PropTypes.func, // setter for style state (used by Fetch defaults applied from MapLayer)
  setAttributeProps: PropTypes.func, // setter for attributeProps state
  setErrorMessage: PropTypes.func,
  onRequestHideModal: PropTypes.func, // callback to hide the modal for extent drawing
  onFetchPluginDefaults: PropTypes.func,
};

export default memo(SourcePane);
