import PropTypes from "prop-types";
import { useEffect, useState, useRef, memo, useContext } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import NormalInput from "components/inputs/NormalInput";
import RuleStyleEditor from "components/inputs/RuleStyleEditor";
import RampPicker from "components/modals/MapLayer/RampPicker";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import { resolveRamp } from "components/map/colorRamps";
import Button from "react-bootstrap/Button";
import { LayoutContext, AppContext } from "components/contexts/Contexts";
import { getStyleFields } from "components/map/utilities";
import { findSelectOptionByValue } from "components/visualizations/utilities";

const EditorModeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
  justify-content: space-between;
`;

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const CenteredDiv = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40vh;
  width: 100%;
  text-align: center;
  font-size: large;
  font-weight: bold;
`;

const GeoTIFFSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SectionHeading = styled.h5`
  margin: 0 0 6px 0;
`;

const RangeRow = styled.div`
  display: flex;
  gap: 12px;
  align-items: flex-end;
`;

const RangeCell = styled.div`
  flex: 1;
`;

const ModeRow = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
`;

const ClassTable = styled.table`
  width: 100%;
  margin: 0.5rem 0;
  th {
    font-size: 0.8rem;
    font-weight: 600;
    padding-bottom: 0.25rem;
  }
  td {
    padding: 0.15rem 0.35rem 0.15rem 0;
    vertical-align: middle;
  }
`;

const StylePane = ({
  style,
  setStyle,
  setErrorMessage,
  containerRef,
  sourceProps,
  setSourceProps,
  layerProps,
  shapefileDiscovery,
}) => {
  const [styleSource, setStyleSource] = useState("custom"); // track the geojson value
  const [styleMode, setStyleMode] = useState("json"); // "json" or "rules"
  const [rules, setRules] = useState([]);
  const [defaultStyle, setDefaultStyle] = useState({});
  const { uuid } = useContext(LayoutContext);
  const [availableFields, setAvailableFields] = useState([]);
  const { dynamicMapLayers } = useContext(AppContext);

  useEffect(() => {
    // A shapefile's fields come from the shared, author-triggered discovery
    // instead. This effect re-runs on every source-props change -- which for a
    // typed url is once per keystroke -- and each run there is a multi-megabyte
    // download.
    if (shapefileDiscovery?.isShapefile) {
      setAvailableFields(shapefileDiscovery.fields);
      return;
    }

    const isDynamic = !!findSelectOptionByValue(
      dynamicMapLayers,
      sourceProps.type,
    );
    const fetchAvailableFields = async () => {
      try {
        const fields = await getStyleFields({
          sourceProps,
          layerProps,
          dashboard_uuid: uuid,
          isDynamicMapLayer: isDynamic,
        });
        setAvailableFields(fields);
      } catch (e) {
        setAvailableFields([]);
      }
    };
    fetchAvailableFields();
  }, [
    sourceProps,
    layerProps,
    uuid,
    dynamicMapLayers,
    shapefileDiscovery?.isShapefile,
    shapefileDiscovery?.fields,
  ]);

  useEffect(() => {
    if (
      (sourceProps.type === "GeoTIFF" || sourceProps.type === "Zarr") &&
      !sourceProps.rampName &&
      setSourceProps
    ) {
      setSourceProps((prev) => ({ ...prev, rampName: "turbo" }));
    }
  }, [sourceProps.type, sourceProps.rampName, setSourceProps]);

  useEffect(() => {
    const fetchJSON = async () => {
      if (style.includes("/")) {
        const response = await fetch(style);
        if (!response.ok) {
          setErrorMessage("Failed to retrieve JSON");
        }
        setStyle(style);
        setStyleSource("url");
      } else {
        const apiResponse = await appAPI.downloadJSON({
          filename: style,
          dashboard_uuid: uuid,
        });
        setStyle(JSON.stringify(apiResponse.data, null, 4));
        setStyleSource("custom");
      }
    };

    // if using already existing style, then load the json and set style accordingly
    if (
      typeof style === "string" &&
      (style.endsWith(".json") || style.endsWith(".geojson"))
    ) {
      fetchJSON();
    } else if (typeof style === "object" && style !== null) {
      setStyle(JSON.stringify(style, null, 4));
      setStyleSource("custom");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  // Only sync rules from style JSON when switching to rules mode
  const lastStyleMode = useRef(styleMode);
  useEffect(() => {
    if (lastStyleMode.current !== styleMode && styleMode === "rules") {
      try {
        if (typeof style === "string" && style.trim().startsWith("{")) {
          const parsed = JSON.parse(style);
          setRules(Array.isArray(parsed.rules) ? parsed.rules : []);
          if (parsed.default && typeof parsed.default === "object") {
            setDefaultStyle(parsed.default);
          }
        } else {
          setRules([]);
          setDefaultStyle({});
        }
      } catch (e) {
        setRules([]);
        setDefaultStyle({});
      }
    }
    lastStyleMode.current = styleMode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleMode]);

  // Only update style JSON when rules or default style change and in rules mode
  const lastRules = useRef(rules);
  const lastDefaultStyle = useRef(defaultStyle);

  useEffect(() => {
    if (
      styleMode === "rules" &&
      (lastRules.current !== rules || lastDefaultStyle.current !== defaultStyle)
    ) {
      setStyle(JSON.stringify({ rules, default: defaultStyle }, null, 2));
    }
    lastRules.current = rules;
    lastDefaultStyle.current = defaultStyle;
  }, [rules, defaultStyle, styleMode, setStyle]);

  function handleStyleJSONUpload({ fileContent }) {
    setStyle(fileContent);
  }

  function handleStyleJSONChange(e) {
    setStyle(e.target.value);
  }

  function handleStyleSourceChange(newSource) {
    setStyleSource(newSource);

    if (newSource === "custom") {
      setStyle("{}");
    } else {
      setStyle("");
    }
  }

  if (sourceProps.type === "GeoTIFF" || sourceProps.type === "Zarr") {
    const selectedRamp = sourceProps.rampName ?? null;
    const rampMin = sourceProps.rampMin ?? "";
    const rampMax = sourceProps.rampMax ?? "";
    const rampReverse = sourceProps.rampReverse === true;

    const handleRampSelect = (rampName) => {
      if (!setSourceProps) return;
      setSourceProps((prev) => ({ ...prev, rampName }));
    };
    const handleReverseToggle = (e) => {
      if (!setSourceProps) return;
      const checked = e.target.checked;
      setSourceProps((prev) => ({ ...prev, rampReverse: checked }));
    };
    const handleMinChange = (e) => {
      if (!setSourceProps) return;
      const value = e.target.value;
      setSourceProps((prev) => ({ ...prev, rampMin: value }));
    };
    const handleMaxChange = (e) => {
      if (!setSourceProps) return;
      const value = e.target.value;
      setSourceProps((prev) => ({ ...prev, rampMax: value }));
    };

    const isCategorical = sourceProps.styleMode === "categorical";
    const classes = sourceProps.classes ?? [];

    const setMode = (mode) => {
      if (!setSourceProps) return;
      setSourceProps((prev) => ({ ...prev, styleMode: mode }));
    };
    const updateClasses = (next) => {
      if (!setSourceProps) return;
      setSourceProps((prev) => ({ ...prev, classes: next }));
    };
    // New rows borrow a color from the selected ramp, spread across however many
    // classes exist, so a usable style appears without picking colors by hand.
    const addClass = () => {
      const palette = resolveRamp(selectedRamp, rampReverse) ?? [];
      const index = classes.length;
      const seeded =
        palette.length > 0
          ? palette[
              Math.round((index / Math.max(index, 4)) * (palette.length - 1))
            ]
          : "#888888";
      updateClasses([...classes, { value: "", color: seeded, label: "" }]);
    };
    const updateClass = (index, patch) =>
      updateClasses(
        classes.map((c, i) => (i === index ? { ...c, ...patch } : c)),
      );
    const removeClass = (index) =>
      updateClasses(classes.filter((_, i) => i !== index));

    return (
      <GeoTIFFSection>
        <SectionHeading>
          {isCategorical ? "Classes" : "Color Ramp"}
        </SectionHeading>
        <ModeRow role="radiogroup" aria-label="Raster Style Mode">
          <label>
            <input
              type="radio"
              name="raster-style-mode"
              checked={!isCategorical}
              onChange={() => setMode("continuous")}
            />{" "}
            Continuous
          </label>
          <label>
            <input
              type="radio"
              name="raster-style-mode"
              checked={isCategorical}
              onChange={() => setMode("categorical")}
            />{" "}
            Categorical
          </label>
        </ModeRow>

        {/* A ramp has no meaning for discrete classes; each class carries its
            own color. The selection is still kept so switching back to
            Continuous restores it, and it seeds new class colors. */}
        {!isCategorical && (
          <>
            <RampPicker
              selectedRamp={selectedRamp}
              onChange={handleRampSelect}
              reversed={rampReverse}
            />
            <ModeRow>
              <label>
                <input
                  type="checkbox"
                  checked={rampReverse}
                  aria-label="Reverse Color Ramp"
                  onChange={handleReverseToggle}
                />{" "}
                Reverse ramp
              </label>
            </ModeRow>
          </>
        )}

        {isCategorical ? (
          <>
            <ClassTable>
              <thead>
                <tr>
                  <th>Value</th>
                  <th>Color</th>
                  <th>Label</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {classes.map((entry, index) => (
                  <tr key={index}>
                    <td>
                      <NormalInput
                        value={entry.value ?? ""}
                        type="number"
                        onChange={(e) =>
                          updateClass(index, { value: e.target.value })
                        }
                        ariaLabel={`Class ${index + 1} Value`}
                        allowEmpty
                      />
                    </td>
                    <td>
                      <ColorPickerPopOver
                        label={`Class ${index + 1}`}
                        hideLabel
                        color={entry.color}
                        onChange={(color) => updateClass(index, { color })}
                        containerRef={containerRef}
                      />
                    </td>
                    <td>
                      <NormalInput
                        value={entry.label ?? ""}
                        onChange={(e) =>
                          updateClass(index, { label: e.target.value })
                        }
                        ariaLabel={`Class ${index + 1} Label`}
                        allowEmpty
                      />
                    </td>
                    <td>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        aria-label={`Remove class ${index + 1}`}
                        onClick={() => removeClass(index)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ClassTable>
            <Button variant="primary" size="sm" onClick={addClass}>
              Add class
            </Button>
            <RangeRow>
              <RangeCell>
                <ColorPickerPopOver
                  label="Other values"
                  color={sourceProps.fallbackColor ?? ""}
                  onChange={(color) =>
                    setSourceProps((prev) => ({
                      ...prev,
                      fallbackColor: color,
                    }))
                  }
                  containerRef={containerRef}
                />
              </RangeCell>
            </RangeRow>
          </>
        ) : (
          <RangeRow>
            <RangeCell>
              <NormalInput
                label="Min"
                value={rampMin}
                type="number"
                onChange={handleMinChange}
                ariaLabel="Ramp Min"
                allowEmpty
              />
            </RangeCell>
            <RangeCell>
              <NormalInput
                label="Max"
                value={rampMax}
                type="number"
                onChange={handleMaxChange}
                ariaLabel="Ramp Max"
                allowEmpty
              />
            </RangeCell>
          </RangeRow>
        )}
      </GeoTIFFSection>
    );
  }

  // Absent from this list, the Style tab renders a dead-end "not available for
  // this source type" panel instead of the rule editor -- so styling a shapefile
  // layer would be impossible regardless of what field discovery returned.
  const supportedTypes = [
    "GeoJSON",
    "ESRI Feature Service",
    "PMTiles Vector",
    "Shapefile",
    "GeoPackage",
    "GeoParquet",
  ];
  const isDynamicMapLayer = findSelectOptionByValue(
    dynamicMapLayers,
    sourceProps.type,
  );
  if (!supportedTypes.includes(sourceProps.type) && !isDynamicMapLayer) {
    return (
      <CenteredDiv>
        Custom Styling is only available for {supportedTypes.join(", ")} layers.
      </CenteredDiv>
    );
  }

  return (
    <>
      <DataRadioSelect
        label="Style Source"
        selectedRadio={styleSource}
        radioOptions={[
          { value: "custom", label: "Custom" },
          { value: "url", label: "URL" },
        ]}
        onChange={handleStyleSourceChange}
      />
      {styleSource === "custom" ? (
        <>
          <EditorModeRow>
            <DataRadioSelect
              label="Style Editor Mode"
              selectedRadio={styleMode}
              radioOptions={[
                { value: "json", label: "JSON Editor" },
                { value: "rules", label: "Rule-based Editor" },
              ]}
              onChange={setStyleMode}
              divProps={{ style: { "margin-bottom": 0 } }}
            />
            {styleMode === "rules" && (
              <Button
                variant="info"
                onClick={() =>
                  setRules([
                    ...rules,
                    {
                      conditionField: "",
                      conditionType: "=",
                      conditionValue: "",
                      geometryType: "point",
                    },
                  ])
                }
                aria-label="Add Rule Button"
                style={{ width: "30%" }}
              >
                + Add Rule
              </Button>
            )}
          </EditorModeRow>
          {styleMode === "json" ? (
            <>
              <FileUpload
                label="Upload style file"
                onFileUpload={handleStyleJSONUpload}
                extensionsAllowed={["json"]}
              />
              <StyledTextInput
                value={style}
                onChange={handleStyleJSONChange}
                aria-label={"style-text-area"}
              />
            </>
          ) : (
            <RuleStyleEditor
              rules={rules}
              setRules={setRules}
              availableFields={availableFields}
              defaultStyle={defaultStyle}
              setDefaultStyle={setDefaultStyle}
              containerRef={containerRef}
            />
          )}
        </>
      ) : (
        <NormalInput
          label="URL"
          value={style}
          type="text"
          onChange={handleStyleJSONChange}
        />
      )}
    </>
  );
};

StylePane.propTypes = {
  // Shared, author-triggered field discovery for a shapefile source. Supplied by
  // the modal so both panes read one result.
  shapefileDiscovery: PropTypes.shape({
    isShapefile: PropTypes.bool,
    fields: PropTypes.arrayOf(PropTypes.string),
  }),
  style: PropTypes.string, // stringified json for styling layer
  setStyle: PropTypes.func,
  setErrorMessage: PropTypes.func,
  sourceProps: PropTypes.shape({
    type: PropTypes.string,
    rampName: PropTypes.string,
    rampMin: PropTypes.string,
    rampMax: PropTypes.string,
    // Flip the ramp so its last color lands on the low end of the range.
    rampReverse: PropTypes.bool,
    // "categorical" colors by exact class value instead of a ramp range.
    styleMode: PropTypes.string,
    classes: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        color: PropTypes.string,
        label: PropTypes.string,
      }),
    ),
    fallbackColor: PropTypes.string,
    geojson: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    props: PropTypes.shape({
      sources: PropTypes.arrayOf(PropTypes.shape({ url: PropTypes.string })),
    }),
  }),
  setSourceProps: PropTypes.func,
  layerProps: PropTypes.shape({
    name: PropTypes.string, // name of the layer
    opacity: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // opacity of the layer (0-1)
    minResolution: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    maxResolution: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    minZoom: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    maxZoom: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    layerVisibility: PropTypes.bool,
  }),
  containerRef: PropTypes.object,
  availableFields: PropTypes.array,
};

export default memo(StylePane);
