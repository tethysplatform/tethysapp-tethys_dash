import { useState, useContext } from "react";
import Button from "react-bootstrap/Button";
import Collapse from "react-bootstrap/Collapse";
import Table from "react-bootstrap/Table";
import PropTypes from "prop-types";
import styled from "styled-components";
import FileUpload from "components/inputs/FileUpload";
import { DataViewerModeContext } from "components/contexts/Contexts";

const StyledContainer = styled.div`
  max-width: 600px;
  margin: 20px 0;
`;

const StyledButton = styled(Button)`
  margin-bottom: 10px;
`;

const StyledTable = styled(Table)`
  margin-top: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  overflow-y: auto;
`;

const StyledTableWrapper = styled.div`
  max-height: 50vh;
`;

const CSVUploader = ({
  buttonText = "Toggle Table", // TODO add these args to metadata
  variant = "primary",
  headers = [],
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const { inDataViewerMode } = useContext(DataViewerModeContext);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const parseCSV = (fileName, fileContent) => {
    const lines = fileContent.trim().split("\n");
    const parsedHeaders = lines[0].split(",").map((h) => h.trim());
    const parsedRows = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      return parsedHeaders.reduce((obj, key, i) => {
        obj[key] = values[i];
        return obj;
      }, {});
    });
    setRows(parsedRows);
    // TODO save the file under workspace, pass filename to VariableInputValues and read the file
    if (inDataViewerMode) {
      onChange(fileName);
    } else {
      onChange(parsedRows);
    }
  };

  const handleFileUpload = (fileData) => {
    // Process the uploaded file data here
    parseCSV(fileData.uploadedFileName, fileData.fileContent);
    setIsOpen(true);
  };

  return (
    <StyledContainer>
      <FileUpload
        label=""
        onFileUpload={handleFileUpload}
        extensionsAllowed={["csv"]}
      ></FileUpload>
      <StyledButton
        variant={variant}
        onClick={handleToggle}
        aria-controls="collapsible-table"
        aria-expanded={isOpen}
      >
        {buttonText} {isOpen ? "▲" : "▼"}
      </StyledButton>

      <Collapse in={isOpen}>
        <div id="collapsible-table" data-testid="collapsible-table">
          {headers.length > 0 && (
            <StyledTableWrapper className="table-responsive">
              <StyledTable striped bordered hover>
                <thead>
                  <tr>
                    {headers.map((header, index) => (
                      <th key={index}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {headers.map((h, j) => (
                        <td key={j}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </StyledTable>
            </StyledTableWrapper>
          )}
        </div>
      </Collapse>
    </StyledContainer>
  );
};

CSVUploader.propTypes = {
  buttonText: PropTypes.string,
  variant: PropTypes.string,
  headers: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func.isRequired,
};

export default CSVUploader;
