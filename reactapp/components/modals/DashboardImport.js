import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import { useState, useContext } from "react";
import PropTypes from "prop-types";
import {
  AvailableDashboardsContext,
  AppContext,
  LayoutContext,
} from "components/contexts/Contexts";
import Alert from "react-bootstrap/Alert";
import styled from "styled-components";
import { useLayoutSuccessAlertContext } from "components/contexts/LayoutAlertContext";
import {
  handleGridItemImport,
  detectImportFormat,
  validateGridItemBatch,
} from "components/dashboard/DashboardItem";

const StyledAlert = styled(Alert)`
  margin-top: 0.5rem;
`;

const PreviewText = styled.div`
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 0.25rem;
  font-size: 0.9rem;
`;

function DashboardImportModal({ showModal, setShowModal, onImportGridItem }) {
  const [jsonContent, setJsonContent] = useState(null);
  const [importFormat, setImportFormat] = useState(null);
  const [selectedTabs, setSelectedTabs] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const { importDashboard } = useContext(AvailableDashboardsContext);
  const { setSuccessMessage, setShowSuccessMessage } =
    useLayoutSuccessAlertContext();
  const { csrf } = useContext(AppContext);
  const layoutContext = useContext(LayoutContext);

  const getAllGridItems = (format, selectedTabIndices) => {
    if (format.type === "single" || format.type === "array") {
      return format.gridItems;
    }
    const tabs =
      format.type === "dashboard"
        ? format.tabs.filter((_, i) => selectedTabIndices.includes(i))
        : format.tabs;
    return tabs.flatMap((tab) => tab.gridItems || []);
  };

  const onImport = async () => {
    setErrorMessage("");

    if (!onImportGridItem) {
      const apiResponse = await importDashboard(jsonContent);
      if (apiResponse["success"]) {
        setShowModal(false);
        setShowSuccessMessage(true);
        const newDashboard = apiResponse["new_dashboard"];
        setSuccessMessage(
          `Successfully imported the dashboard as ${newDashboard.name}`,
        );
      } else {
        setErrorMessage(
          apiResponse["message"] ?? "Failed to import the dashboard",
        );
      }
      return;
    }

    const allGridItems = getAllGridItems(importFormat, selectedTabs);
    const validation = validateGridItemBatch(allGridItems);
    if (!validation.valid) {
      setErrorMessage(validation.errors.join("\n"));
      return;
    }

    const processedGridItems = [];
    for (const item of allGridItems) {
      const result = await handleGridItemImport(
        item,
        csrf,
        layoutContext.uuid,
      );
      if (!result.success) {
        setErrorMessage(result.message ?? "Failed to import grid item");
        return;
      }
      processedGridItems.push(result.importedGridItem);
    }

    setShowModal(false);
    setShowSuccessMessage(true);

    if (importFormat.type === "single") {
      setSuccessMessage("Successfully imported dashboard item");
      onImportGridItem({
        type: "single",
        gridItems: processedGridItems,
        tabs: [],
      });
    } else if (importFormat.type === "array") {
      setSuccessMessage(
        `Successfully imported ${processedGridItems.length} dashboard items`,
      );
      onImportGridItem({
        type: "array",
        gridItems: processedGridItems,
        tabs: [],
      });
    } else {
      const tabs =
        importFormat.type === "dashboard"
          ? importFormat.tabs.filter((_, i) => selectedTabs.includes(i))
          : importFormat.tabs;

      let itemIndex = 0;
      const processedTabs = tabs.map((tab) => {
        const tabItems = processedGridItems.slice(
          itemIndex,
          itemIndex + (tab.gridItems?.length || 0),
        );
        itemIndex += tab.gridItems?.length || 0;
        return { ...tab, gridItems: tabItems };
      });

      const tabCount = processedTabs.length;
      setSuccessMessage(
        `Successfully imported ${tabCount} tab${tabCount !== 1 ? "s" : ""}`,
      );
      onImportGridItem({
        type: importFormat.type,
        gridItems: [],
        tabs: processedTabs,
      });
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
        setErrorMessage("");

        if (onImportGridItem) {
          const format = detectImportFormat(parsedJson);
          if (!format) {
            setErrorMessage("Unrecognized JSON format");
            setImportFormat(null);
            return;
          }
          setImportFormat(format);
          if (format.type === "dashboard") {
            setSelectedTabs(format.tabs.map((_, i) => i));
          }
        }
      } catch (error) {
        setErrorMessage("Invalid JSON structure");
        setImportFormat(null);
      }
    };
    reader.readAsText(file);
  };

  const handleTabToggle = (index) => {
    setSelectedTabs((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index],
    );
  };

  const isImportDisabled = () => {
    if (!onImportGridItem) {
      return !jsonContent;
    }
    if (!importFormat) return true;
    if (importFormat.type === "dashboard" && selectedTabs.length === 0)
      return true;
    return false;
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
        {onImportGridItem && importFormat && (
          <PreviewText data-testid="import-preview">
            {importFormat.summary}
            {importFormat.type === "dashboard" &&
              importFormat.tabs.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  {importFormat.tabs.map((tab, index) => (
                    <Form.Check
                      key={index}
                      type="checkbox"
                      label={`${tab.name || "Unnamed tab"} (${tab.gridItems?.length || 0} items)`}
                      checked={selectedTabs.includes(index)}
                      onChange={() => handleTabToggle(index)}
                      data-testid={`tab-checkbox-${index}`}
                    />
                  ))}
                </div>
              )}
          </PreviewText>
        )}
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
          onClick={onImport}
          aria-label={"Import Button"}
          disabled={isImportDisabled()}
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
