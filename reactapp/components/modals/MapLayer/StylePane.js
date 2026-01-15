import PropTypes from "prop-types";
import { useEffect, useState, useRef, memo, useContext } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import NormalInput from "components/inputs/NormalInput";
import RuleStyleEditor from "components/inputs/RuleStyleEditor";
import { LayoutContext } from "components/contexts/Contexts";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const StylePane = ({ style, setStyle, setErrorMessage, containerRef }) => {
  const [styleSource, setStyleSource] = useState("custom"); // track the geojson value
  const [styleMode, setStyleMode] = useState("json"); // "json" or "rules"
  const [rules, setRules] = useState([]);
  const { uuid } = useContext(LayoutContext);

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
    // eslint-disable-next-line
  }, [style]);

  // Only sync rules from style JSON when switching to rules mode
  const lastStyleMode = useRef(styleMode);
  useEffect(() => {
    if (lastStyleMode.current !== styleMode && styleMode === "rules") {
      try {
        if (typeof style === "string" && style.trim().startsWith("{")) {
          const parsed = JSON.parse(style);
          setRules(Array.isArray(parsed.rules) ? parsed.rules : []);
        }
      } catch (e) {
        setRules([]);
      }
    }
    lastStyleMode.current = styleMode;
  }, [styleMode, style]);

  // Only update style JSON when rules change and in rules mode
  const lastRules = useRef(rules);
  useEffect(() => {
    if (styleMode === "rules" && lastRules.current !== rules) {
      setStyle(JSON.stringify({ rules }, null, 2));
    }
    lastRules.current = rules;
  }, [rules, styleMode, setStyle]);

  function handleStyleJSONUpload({ fileContent }) {
    setStyle(fileContent);
    if (styleMode === "rules") {
      try {
        const parsed = JSON.parse(fileContent);
        setRules(Array.isArray(parsed.rules) ? parsed.rules : []);
      } catch {
        setRules([]);
      }
    }
  }

  function handleStyleJSONChange(e) {
    setStyle(e.target.value);
    if (styleMode === "rules") {
      try {
        const parsed = JSON.parse(e.target.value);
        setRules(Array.isArray(parsed.rules) ? parsed.rules : []);
      } catch {
        setRules([]);
      }
    }
  }

  function handleStyleSourceChange(e) {
    const source = e.target.value;
    setStyleSource(source);

    if (source === "custom") {
      setStyle("{}");
    } else {
      setStyle("");
    }
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
          <DataRadioSelect
            label="Style Editor Mode"
            selectedRadio={styleMode}
            radioOptions={[
              { value: "json", label: "JSON Editor" },
              { value: "rules", label: "Rule-based Editor" },
            ]}
            onChange={(e) => setStyleMode(e.target.value)}
          />
          <FileUpload
            label="Upload style file"
            onFileUpload={handleStyleJSONUpload}
            extensionsAllowed={["json"]}
          />
          {styleMode === "json" ? (
            <StyledTextInput
              value={style}
              onChange={handleStyleJSONChange}
              aria-label={"style-text-area"}
            />
          ) : (
            <RuleStyleEditor
              rules={rules}
              setRules={setRules}
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
};

export default memo(StylePane);
