import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const StylePane = ({ style, setStyle }) => {
  const [styleJSON, setStyleJSON] = useState("{}");

  useEffect(() => {
    (async () => {
      if (styleJSON === "{}" && style) {
        const apiResponse = await appAPI.downloadJSON({
          filename: style,
        });
        setStyleJSON(JSON.stringify(apiResponse.data, null, 4));
      }
    })();
    setStyle(styleJSON);
  }, [styleJSON]);

  function handleStyleJSONUpload({ fileContent }) {
    setStyleJSON(fileContent);
  }

  function handleStyleJSONChange(e) {
    setStyleJSON(e.target.value);
  }

  return (
    <>
      <FileUpload
        label="Upload style file"
        onFileUpload={handleStyleJSONUpload}
        extensionsAllowed={["json"]}
      />
      <StyledTextInput value={styleJSON} onChange={handleStyleJSONChange} />
    </>
  );
};

StylePane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default StylePane;
