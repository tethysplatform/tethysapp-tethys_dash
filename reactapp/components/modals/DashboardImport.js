import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import { useState, useContext } from "react";
import PropTypes from "prop-types";
import {
  AvailableDashboardsContext,
  AppContext,
} from "components/contexts/Contexts";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { useLayoutSuccessAlertContext } from "components/contexts/LayoutAlertContext";
import { handleGridItemImport } from "components/dashboard/DashboardItem";

const StyledAlert = styled(Alert)`
  margin-top: 0.5rem;
`;

function DashboardImportModal({ showModal, setShowModal, onImportGridItem }) {
  const [jsonContent, setJsonContent] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const { importDashboard } = useContext(AvailableDashboardsContext);
  const { setSuccessMessage, setShowSuccessMessage } =
    useLayoutSuccessAlertContext();
  const { csrf } = useContext(AppContext);

  const onImport = async (jsonContent) => {
    setErrorMessage("");

    let apiResponse;
    if (onImportGridItem) {
      apiResponse = await handleGridItemImport(jsonContent, csrf);
    } else {
      apiResponse = await importDashboard(jsonContent);
    }
    if (apiResponse["success"]) {
      setShowModal(false);
      setShowSuccessMessage(true);
      if (onImportGridItem) {
        setSuccessMessage("Successfully imported dashboard item");
        onImportGridItem(apiResponse.importedGridItem);
      } else {
        const newDashboard = apiResponse["new_dashboard"];
        setSuccessMessage(
          `Successfully imported the dashboard as ${newDashboard.name}`
        );
      }
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
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsedJson = JSON.parse(reader.result);
        setJsonContent(parsedJson);
      } catch (error) {
        setErrorMessage("Invalid JSON structure");
      }
    };
    reader.readAsText(file);
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
        <Modal.Title>
          {onImportGridItem ? "Import Dashboard Item" : "Import Dashboard"}
        </Modal.Title>
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
          aria-label={"Close Import Modal Button"}
        >
          Close
        </Button>
        <Button
          variant="success"
          onClick={() => onImport(jsonContent)}
          aria-label={"Import Button"}
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
  onImportGridItem: PropTypes.func,
};

export default DashboardImportModal;
