import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useState, useContext } from "react";
import PropTypes from "prop-types";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { useLayoutSuccessAlertContext } from "components/contexts/LayoutAlertContext";

const StyledAlert = styled(Alert)`
  margin-top: 0.5rem;
`;

function DashboardImportModal({ showModal, setShowModal }) {
  const [jsonContent, setJsonContent] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const { importDashboard } = useContext(AvailableDashboardsContext);
  const { setSuccessMessage, setShowSuccessMessage } =
    useLayoutSuccessAlertContext();

  const onImport = async (dashboardJSON) => {
    setErrorMessage("");

    const apiResponse = await importDashboard(dashboardJSON);
    if (apiResponse["success"]) {
      const newDashboard = apiResponse["new_dashboard"];

      setShowModal(false);
      setSuccessMessage(
        `Successfully imported the dashboard as ${newDashboard.name}`
      );
      setShowSuccessMessage(true);
    } else {
      setErrorMessage(
        apiResponse["message"] ?? "Failed to import the dashboard"
      );
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsedJson = JSON.parse(reader.result);
          setJsonContent(parsedJson);
        } catch (error) {
          console.error("Invalid JSON file:", error);
          setJsonContent({ error: "Invalid JSON file" });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <Modal
      className="dashboardImport"
      show={showModal}
      onHide={handleModalClose}
      aria-label="Dashboard Import Modal"
      centered
    >
      <Modal.Header closeButton>
        <Modal.Title>Import Dashboard</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <input
          type="file"
          accept=".json"
          onChange={handleFileChange}
          data-testid="file-input"
        />
        {errorMessage && (
          <StyledAlert
            key="danger"
            variant="danger"
            onClose={() => setErrorMessage("")}
            dismissible={true}
          >
            {errorMessage}
          </StyledAlert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="secondary"
          onClick={handleModalClose}
          aria-label={"Close Thumbnail Modal Button"}
        >
          Close
        </Button>
        <Button
          variant="success"
          onClick={() => onImport(jsonContent)}
          aria-label={"Update Thumbnail Button"}
          disabled={!jsonContent}
        >
          Import
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

DashboardImportModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default DashboardImportModal;
