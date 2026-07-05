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
      format.type === "dashboard" || format.type === "mixed"
        ? format.tabs.filter((_, i) => selectedTabIndices.includes(i))
        : format.tabs;
    const tabItems = tabs.flatMap((tab) => tab.gridItems || []);
    const looseItems = format.type === "mixed" ? format.gridItems : [];
    return [...looseItems, ...tabItems];
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
      const result = await handleGridItemImport(item, csrf, layoutContext.uuid);
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
      const looseItemCount =
        importFormat.type === "mixed" ? importFormat.gridItems.length : 0;
      const processedLooseItems = processedGridItems.slice(0, looseItemCount);
      const processedTabItems = processedGridItems.slice(looseItemCount);

      const tabs =
        importFormat.type === "dashboard" || importFormat.type === "mixed"
          ? importFormat.tabs.filter((_, i) => selectedTabs.includes(i))
          : importFormat.tabs;

      let itemIndex = 0;
      const processedTabs = tabs.map((tab) => {
        const tabItems = processedTabItems.slice(
          itemIndex,
          itemIndex + (tab.gridItems?.length || 0),
        );
        itemIndex += tab.gridItems?.length || 0;
        return { ...tab, gridItems: tabItems };
      });

      const parts = [];
      if (processedLooseItems.length > 0) {
        parts.push(
          `${processedLooseItems.length} item${processedLooseItems.length !== 1 ? "s" : ""} to active tab`,
        );
      }
      const tabCount = processedTabs.length;
      parts.push(`${tabCount} tab${tabCount !== 1 ? "s" : ""}`);
      setSuccessMessage(`Successfully imported ${parts.join(" and ")}`);
      onImportGridItem({
        type: importFormat.type,
        gridItems: processedLooseItems,
        tabs: processedTabs,
      });
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    if (!onImportGridItem) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          setJsonContent(JSON.parse(reader.result));
          setErrorMessage("");
        } catch (error) {
          setErrorMessage("Invalid JSON structure");
        }
      };
      reader.readAsText(files[0]);
      return;
    }

    setErrorMessage("");
    setImportFormat(null);

    const readPromises = files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              resolve(JSON.parse(reader.result));
            } catch (error) {
              reject(new Error(`Invalid JSON in ${file.name}`));
            }
          };
          reader.readAsText(file);
        }),
    );

    Promise.all(readPromises)
      .then((parsedFiles) => {
        const allGridItems = [];
        const allTabs = [];

        for (const parsed of parsedFiles) {
          const format = detectImportFormat(parsed);
          if (!format) {
            setErrorMessage("Unrecognized JSON format in one or more files");
            return;
          }
          allGridItems.push(...format.gridItems);
          allTabs.push(...format.tabs);
        }

        let mergedFormat;
        if (allTabs.length > 0 && allGridItems.length > 0) {
          const tabSummaries = allTabs.map(
            (tab) =>
              `${tab.name || "Unnamed tab"} (${tab.gridItems?.length || 0} items)`,
          );
          mergedFormat = {
            type: "mixed",
            gridItems: allGridItems,
            tabs: allTabs,
            summary: `${allGridItems.length} grid item${allGridItems.length !== 1 ? "s" : ""} to active tab + ${allTabs.length} tab${allTabs.length !== 1 ? "s" : ""}: ${tabSummaries.join(", ")}`,
          };
        } else if (allTabs.length > 0) {
          const tabSummaries = allTabs.map(
            (tab) =>
              `${tab.name || "Unnamed tab"} (${tab.gridItems?.length || 0} items)`,
          );
          mergedFormat = {
            type:
              allTabs.length === 1 && parsedFiles.length === 1
                ? "tab"
                : "dashboard",
            gridItems: [],
            tabs: allTabs,
            summary:
              allTabs.length === 1 && parsedFiles.length === 1
                ? `Tab: ${allTabs[0].name} with ${allTabs[0].gridItems?.length || 0} items`
                : `${allTabs.length} tab${allTabs.length !== 1 ? "s" : ""}: ${tabSummaries.join(", ")}`,
          };
        } else {
          mergedFormat = {
            type: allGridItems.length === 1 ? "single" : "array",
            gridItems: allGridItems,
            tabs: [],
            summary:
              allGridItems.length === 1
                ? "1 grid item"
                : `${allGridItems.length} grid items to add to current tab`,
          };
        }

        setImportFormat(mergedFormat);
        if (
          mergedFormat.type === "dashboard" ||
          mergedFormat.type === "mixed"
        ) {
          setSelectedTabs(mergedFormat.tabs.map((_, i) => i));
        }
      })
      .catch((error) => {
        setErrorMessage(error.message);
        setImportFormat(null);
      });
  };

  const handleTabToggle = (index) => {
    setSelectedTabs((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
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
          multiple={!!onImportGridItem}
          onChange={handleFileChange}
          data-testid="file-input"
        />
        {onImportGridItem && importFormat && (
          <PreviewText data-testid="import-preview">
            {importFormat.summary}
            {(importFormat.type === "dashboard" ||
              importFormat.type === "mixed") &&
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
