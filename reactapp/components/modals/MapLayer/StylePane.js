import PropTypes from "prop-types";
import { useEffect } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const StylePane = ({ style, setStyle }) => {
  useEffect(() => {
    const fetchJSON = async () => {
      const apiResponse = await appAPI.downloadJSON({
        filename: style,
      });
      setStyle(JSON.stringify(apiResponse.data, null, 4));
    };

    // if using already existing style, then load the json and set style accordingly
    if (style && typeof style === "string") {
      fetchJSON();
    }
    // eslint-disable-next-line
  }, []);

  function handleStyleJSONUpload({ fileContent }) {
    setStyle(fileContent);
  }

  function handleStyleJSONChange(e) {
    setStyle(e.target.value);
  }

  return (
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
  );
};

StylePane.propTypes = {
  style: PropTypes.string, // stringified json for styling layer
  setStyle: PropTypes.func,
};

export default StylePane;
