import { useState } from "react";
import Button from "react-bootstrap/Button";
import Collapse from "react-bootstrap/Collapse";
import Table from "react-bootstrap/Table";
import PropTypes from "prop-types";
import styled from "styled-components";

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
  overflow: hidden;
`;

const CSVUploader = ({
  buttonText = "Toggle Table",  // TODO maybe add these args to metadata
  variant = "primary",
  headers = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Default dummy data if none provided
  console.log("CSVUploader headers:", headers);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <StyledContainer>
      <StyledButton
        variant={variant}
        onClick={handleToggle}
        aria-controls="collapsible-table"
        aria-expanded={isOpen}
      >
        {buttonText} {isOpen ? "▲" : "▼"}
      </StyledButton>

      <Collapse in={isOpen}>
        <div id="collapsible-table">
          <StyledTable striped bordered hover responsive>
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th key={index}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* {tableData.map((row, index) => (
                <tr key={row.id || index}>
                  <td>{row.id || index + 1}</td>
                  <td>{row.name || "N/A"}</td>
                  <td>{row.email || "N/A"}</td>
                  <td>{row.role || "N/A"}</td>
                </tr>
              ))} */}
            </tbody>
          </StyledTable>
        </div>
      </Collapse>
    </StyledContainer>
  );
};

CSVUploader.propTypes = {
  buttonText: PropTypes.string,
  variant: PropTypes.string,
  data: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      email: PropTypes.string,
      role: PropTypes.string,
    })
  ),
};

export default CSVUploader;
