import { useContext, useState } from "react";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import { AppContext } from "components/contexts/Contexts";
import VisualizationCard from "components/modals/DataViewer/VisualizationCard";
import VisualizationGroup from "components/modals/DataViewer/VisualizationGroup";
import { InputGroup, FormControl } from "react-bootstrap";
import { BsSearch } from "react-icons/bs";
import { addPlugin, getPlugins, syncToServer } from "services/pluginRegistry";
import { BsPlus } from "react-icons/bs";
import "components/modals/wideModal.css";

const StyledModalBody = styled(Modal.Body)`
  height: 75vh;
  max-height: 75vh;
  overflow-y: auto;
`;

function VisualizationSelector({
  showModal,
  handleModalClose,
  setSelectVizTypeOption,
}) {
  const { visualizations } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [visualizationItems, setVisualizationItems] = useState(visualizations);
  const [sectionsOpened, setSectionsOpened] = useState([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerFields, setRegisterFields] = useState({
    url: "", scope: "", module: "", label: "",
    remoteType: "vite-esm", description: "", group: "Custom",
  });

  const onSearch = (e) => {
    setSearch(e.target.value);
    const lowerQuery = e.target.value.toLowerCase();
    setVisualizationItems(
      visualizations
        .map((group) => {
          const filteredOptions = group.options.filter((option) => {
            const labelMatch = option.label.toLowerCase().includes(lowerQuery);
            const tagMatch = option.tags.some((tag) =>
              tag.toLowerCase().includes(lowerQuery)
            );
            return labelMatch || tagMatch;
          });

          if (filteredOptions.length > 0) {
            return {
              label: group.label,
              options: filteredOptions,
            };
          }

          return null;
        })
        .filter((group) => group !== null)
    );
  };

  const handleOnClick = (metadata) => {
    setSelectVizTypeOption(metadata);
    handleModalClose();
  };

  return (
    <>
      <Modal
        className="visualization-selector"
        show={showModal}
        onHide={handleModalClose}
        dialogClassName="seventyWideModalDialog"
        aria-label={"Selected Visualization Type Modal"}
      >
        <Modal.Header closeButton>
          <Modal.Title>Available Visualizations</Modal.Title>
        </Modal.Header>
        <StyledModalBody>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <InputGroup style={{ flex: 1 }}>
              <FormControl
                onChange={onSearch}
                value={search}
                type="text"
                aria-label="Visualization Search Input"
                placeholder="Search by Name or Tags"
              />
              <InputGroup.Text>
                <BsSearch />
              </InputGroup.Text>
            </InputGroup>
            <button
              onClick={() => setShowRegisterForm((prev) => !prev)}
              style={{
                background: showRegisterForm ? "#dc3545" : "#0d6efd",
                color: "#fff",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "0.85rem",
              }}
            >
              <BsPlus size={18} />
              {showRegisterForm ? "Cancel" : "Register"}
            </button>
          </div>
          {showRegisterForm && (
            <div style={{
              background: "#f8f9fa",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
            }}>
              <h6 style={{ marginBottom: "12px" }}>Register Remote Module</h6>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <FormControl
                  placeholder="remoteEntry.js URL *"
                  value={registerFields.url}
                  onChange={(e) => setRegisterFields((f) => ({ ...f, url: e.target.value }))}
                />
                <FormControl
                  placeholder="Scope *"
                  value={registerFields.scope}
                  onChange={(e) => setRegisterFields((f) => ({ ...f, scope: e.target.value }))}
                />
                <FormControl
                  placeholder="Module (e.g., ./MyPanel) *"
                  value={registerFields.module}
                  onChange={(e) => setRegisterFields((f) => ({ ...f, module: e.target.value }))}
                />
                <FormControl
                  placeholder="Label *"
                  value={registerFields.label}
                  onChange={(e) => setRegisterFields((f) => ({ ...f, label: e.target.value }))}
                />
                <FormControl
                  placeholder="Description"
                  value={registerFields.description}
                  onChange={(e) => setRegisterFields((f) => ({ ...f, description: e.target.value }))}
                />
                <FormControl
                  placeholder="Group (default: Custom)"
                  value={registerFields.group}
                  onChange={(e) => setRegisterFields((f) => ({ ...f, group: e.target.value }))}
                />
              </div>
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  disabled={!registerFields.url || !registerFields.scope || !registerFields.module || !registerFields.label}
                  onClick={() => {
                    addPlugin(registerFields);
                    syncToServer(document.querySelector("[name=csrfmiddlewaretoken]")?.value || "");
                    setRegisterFields({ url: "", scope: "", module: "", label: "", remoteType: "vite-esm", description: "", group: "Custom" });
                    setShowRegisterForm(false);
                    const runtime = getPlugins();
                    const newEntry = runtime[runtime.length - 1];
                    if (newEntry) {
                      const entry = {
                        source: newEntry.label,
                        value: newEntry.label,
                        label: newEntry.label,
                        type: "client_custom_remote",
                        tags: newEntry.tags || [],
                        description: newEntry.description || "",
                        args: { url: newEntry.url, scope: newEntry.scope, module: newEntry.module, remoteType: newEntry.remoteType },
                        module: newEntry.module,
                        scope: newEntry.scope,
                        url: newEntry.url,
                        remoteType: newEntry.remoteType,
                      };
                      setVisualizationItems((prev) => {
                        const grp = newEntry.group || "Custom";
                        const existing = prev.find((g) => g.label === grp);
                        if (existing) {
                          return prev.map((g) => g.label === grp ? { ...g, options: [...g.options, entry] } : g);
                        }
                        return [...prev, { label: grp, options: [entry] }];
                      });
                    }
                  }}
                  style={{
                    background: "#198754",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 16px",
                    cursor: "pointer",
                    opacity: (!registerFields.url || !registerFields.scope || !registerFields.module || !registerFields.label) ? 0.5 : 1,
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          )}
          {visualizationItems.map(({ label, options }, index) => (
            <VisualizationGroup
              key={index}
              title={label}
              sectionsOpened={sectionsOpened}
              setSectionsOpened={setSectionsOpened}
            >
              <>
                {options.map((metadata, index) => (
                  <VisualizationCard
                    key={index}
                    onClick={() => handleOnClick(metadata)}
                    {...metadata}
                  />
                ))}
              </>
            </VisualizationGroup>
          ))}
        </StyledModalBody>
      </Modal>
    </>
  );
}

VisualizationSelector.propTypes = {
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
  setSelectVizTypeOption: PropTypes.func,
};

export default VisualizationSelector;
