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
  buttonText = "Toggle Table",
  variant = "primary",
  data = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Default dummy data if none provided
  const defaultData = [
    { id: 1, name: "John Doe", email: "john@example.com", role: "Admin" },
    { id: 2, name: "Jane Smith", email: "jane@example.com", role: "User" },
    { id: 3, name: "Bob Johnson", email: "bob@example.com", role: "Editor" },
    { id: 4, name: "Alice Brown", email: "alice@example.com", role: "Viewer" },
    {
      id: 5,
      name: "Charlie Wilson",
      email: "charlie@example.com",
      role: "User",
    },
  ];

  const tableData = data.length > 0 ? data : defaultData;

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
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr key={row.id || index}>
                  <td>{row.id || index + 1}</td>
                  <td>{row.name || "N/A"}</td>
                  <td>{row.email || "N/A"}</td>
                  <td>{row.role || "N/A"}</td>
                </tr>
              ))}
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
