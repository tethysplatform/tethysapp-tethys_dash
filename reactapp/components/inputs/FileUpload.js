import { useState } from "react";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
`;

const FileUpload = ({ label, onFileUpload, extensionsAllowed }) => {
  const [warningMessage, setWarningMessage] = useState(null);

  // On file select (from the pop up)
  const onFileChange = (event) => {
    const uploadedFile = event.target.files[0];
    const extension = uploadedFile.name.split(".").pop();

    if (
      extensionsAllowed === undefined ||
      extensionsAllowed.includes(extension)
    ) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const fileContent = e.target.result;
        // Do something with the file content
        onFileUpload({ uploadedFile, fileContent });
      };

      reader.readAsText(uploadedFile);
    } else {
      setWarningMessage(
        `${extension} is not a valid extension. The uploaded file must be one of the following extensions: ${extensionsAllowed.join(", ")}`
      );
    }
  };

  return (
    <StyledDiv>
      {warningMessage && (
        <Alert key="warning" variant="warning" dismissible>
          {warningMessage}
        </Alert>
      )}
      <Form.Group controlId="formFile">
        <Form.Label>
          <b>{label}</b>
        </Form.Label>
        <Form.Control type="file" onChange={onFileChange} />
      </Form.Group>
    </StyledDiv>
  );
};

export default FileUpload;
