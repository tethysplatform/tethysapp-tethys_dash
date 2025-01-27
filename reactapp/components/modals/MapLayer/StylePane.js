import PropTypes from "prop-types";
import { useEffect, useState, useRef } from "react";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import appAPI from "services/api/app";

const StyledTextInput = styled.textarea`
  width: 100%;
  height: 30vh;
`;

const StylePane = ({ style, setStyle }) => {
  // layer name and source must be the same key must be the same
  useEffect(() => {
    (async () => {
      if (style && typeof style === "string") {
        const apiResponse = await appAPI.downloadJSON({
          filename: style,
        });
        setStyle(JSON.stringify(apiResponse.data, null, 4));
      }
    })();
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
      <StyledTextInput value={style} onChange={handleStyleJSONChange} />
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
