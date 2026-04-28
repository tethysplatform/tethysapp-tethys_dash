import PropTypes from "prop-types";
import { useEffect, useState, useRef, memo, useContext } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import NormalInput from "components/inputs/NormalInput";
import RuleStyleEditor from "components/inputs/RuleStyleEditor";
import RampPicker from "components/modals/MapLayer/RampPicker";
import Button from "react-bootstrap/Button";
import { LayoutContext } from "components/contexts/Contexts";
import { getStyleFields } from "components/map/utilities";

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

const StylePane = ({
  style,
  setStyle,
  setErrorMessage,
  containerRef,
  sourceProps,
  setSourceProps,
  layerProps,
}) => {
  const [styleSource, setStyleSource] = useState("custom"); // track the geojson value
  const [styleMode, setStyleMode] = useState("json"); // "json" or "rules"
  const [rules, setRules] = useState([]);
  const [defaultStyle, setDefaultStyle] = useState({});
  const { uuid } = useContext(LayoutContext);
  const [availableFields, setAvailableFields] = useState([]);

  useEffect(() => {
    const isUrlGeoJSON =
      sourceProps?.type === "GeoJSON" &&
      typeof sourceProps?.geojson === "string" &&
      sourceProps.geojson.trim() !== "" &&
      !sourceProps.geojson.trim().startsWith("{");
    if (isUrlGeoJSON) {
      setAvailableFields([]);
      return;
    }

    const fetchAvailableFields = async () => {
      try {
        const fields = await getStyleFields({
          sourceProps,
          layerProps,
          dashboard_uuid: uuid,
        });
        setAvailableFields(fields);
      } catch (e) {
        setAvailableFields([]);
      }
    };
    fetchAvailableFields();
  }, [sourceProps, layerProps, uuid]);

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

  if (sourceProps.type === "GeoTIFF") {
    const selectedRamp = sourceProps.rampName ?? null;
    const rampMin = sourceProps.rampMin ?? "";
    const rampMax = sourceProps.rampMax ?? "";

    const handleRampSelect = (rampName) => {
      if (!setSourceProps) return;
      setSourceProps((prev) => ({ ...prev, rampName }));
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

    return (
      <GeoTIFFSection>
        <SectionHeading>Color Ramp</SectionHeading>
        <RampPicker selectedRamp={selectedRamp} onChange={handleRampSelect} />
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
      </GeoTIFFSection>
    );
  }

  const supportedTypes = ["GeoJSON", "ESRI Feature Service", "PMTiles Vector"];
  if (!supportedTypes.includes(sourceProps.type)) {
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
  style: PropTypes.string, // stringified json for styling layer
  setStyle: PropTypes.func,
  setErrorMessage: PropTypes.func,
  sourceProps: PropTypes.shape({
    type: PropTypes.string,
    rampName: PropTypes.string,
    rampMin: PropTypes.string,
    rampMax: PropTypes.string,
    geojson: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  }),
  setSourceProps: PropTypes.func,
  layerProps: PropTypes.shape({
    name: PropTypes.string, // name of the layer
    opacity: PropTypes.string,
    minResolution: PropTypes.string,
    maxResolution: PropTypes.string,
    minZoom: PropTypes.string,
    maxZoom: PropTypes.string,
    layerVisibility: PropTypes.bool,
  }),
  containerRef: PropTypes.object,
  availableFields: PropTypes.array,
};

export default memo(StylePane);
