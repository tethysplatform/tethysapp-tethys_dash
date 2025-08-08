import PropTypes from "prop-types";
import { useEffect, useState, memo } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import NormalInput from "components/inputs/NormalInput";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const StylePane = ({ style, setStyle, setErrorMessage }) => {
  const [styleSource, setStyleSource] = useState("custom"); // track the geojson value

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

  function handleStyleJSONUpload({ fileContent }) {
    setStyle(fileContent);
  }

  function handleStyleJSONChange(e) {
    setStyle(e.target.value);
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
