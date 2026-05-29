import { useContext, useState } from "react";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import { AppContext } from "components/contexts/Contexts";
import VisualizationCard from "components/modals/DataViewer/VisualizationCard";
import VisualizationGroup from "components/modals/DataViewer/VisualizationGroup";
import { InputGroup, FormControl, Button } from "react-bootstrap";
import { BsSearch } from "react-icons/bs";
import { addPlugin, getPlugins, removePlugin, syncToServer } from "services/pluginRegistry";
import { fetchMfeMetadata } from "services/mfeMetadataLoader";
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
  const { visualizations, csrf } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [visualizationItems, setVisualizationItems] = useState(visualizations);
  const [sectionsOpened, setSectionsOpened] = useState([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerFields, setRegisterFields] = useState({
    url: "", scope: "", module: "", label: "",
    remoteType: "vite-esm", description: "", group: "Custom",
  });
  const [autoFilledArgs, setAutoFilledArgs] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [removeTarget, setRemoveTarget] = useState(null);

  const handleRemovePlugin = () => {
    if (!removeTarget) return;
    removePlugin(removeTarget.id);
    syncToServer(csrf);
    setVisualizationItems((prev) =>
      prev
        .map((group) => ({
          ...group,
          options: group.options.filter(
            (o) => o.runtimePluginId !== removeTarget.id,
          ),
        }))
        .filter((group) => group.options.length > 0),
    );
    setRemoveTarget(null);
  };

  const tryAutoFill = async () => {
    if (!registerFields.url || !registerFields.scope) return;
    setLoadingMeta(true);
    const meta = await fetchMfeMetadata({
      url: registerFields.url,
      scope: registerFields.scope,
      remoteType: registerFields.remoteType || "vite-esm",
    });
    setLoadingMeta(false);
    if (!meta) return;

    setRegisterFields((f) => ({
      ...f,
      label: f.label || meta.label,
      description: f.description || meta.description,
    }));
    if (meta.args && Object.keys(meta.args).length > 0) {
      setAutoFilledArgs(
        Object.entries(meta.args).map(([name, spec]) => ({
          name,
          type: Array.isArray(spec) ? "enum" : spec,
          enumValues: Array.isArray(spec) ? spec.join(", ") : "",
        })),
      );
    }
  };

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
                <div style={{ display: "flex", gap: "4px" }}>
                  <FormControl
                    placeholder="Scope *"
                    value={registerFields.scope}
                    onChange={(e) => setRegisterFields((f) => ({ ...f, scope: e.target.value }))}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    disabled={!registerFields.url || !registerFields.scope || loadingMeta}
                    onClick={tryAutoFill}
                    style={{
                      background: "#6c757d",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      whiteSpace: "nowrap",
                      opacity: (!registerFields.url || !registerFields.scope || loadingMeta) ? 0.5 : 1,
                    }}
                  >
                    {loadingMeta ? "..." : "Auto-fill"}
                  </button>
                </div>
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
              {/* Args from ./meta auto-fill (read-only) */}
              {autoFilledArgs.length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "0.8rem", color: "#666" }}>
                  <strong>Args detected:</strong> {autoFilledArgs.map((a) => a.name).join(", ")}
                </div>
              )}
              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  disabled={!registerFields.url || !registerFields.scope || !registerFields.module || !registerFields.label}
                  onClick={() => {
                    const serializedArgs = {};
                    for (const arg of autoFilledArgs) {
                      if (!arg.name.trim()) continue;
                      if (arg.type === "enum") {
                        serializedArgs[arg.name.trim()] = arg.enumValues.split(",").map((v) => v.trim()).filter(Boolean);
                      } else {
                        serializedArgs[arg.name.trim()] = arg.type;
                      }
                    }
                    addPlugin({ ...registerFields, args: serializedArgs });
                    syncToServer(csrf);
                    setRegisterFields({ url: "", scope: "", module: "", label: "", remoteType: "vite-esm", description: "", group: "Custom" });
                    setAutoFilledArgs([]);
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
                        args: newEntry.args || {},
                        module: newEntry.module,
                        scope: newEntry.scope,
                        url: newEntry.url,
                        remoteType: newEntry.remoteType,
                        runtimePluginId: newEntry.id,
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
                    onRemove={
                      metadata.runtimePluginId
                        ? () => setRemoveTarget({ id: metadata.runtimePluginId, label: metadata.label })
                        : undefined
                    }
                  />
                ))}
              </>
            </VisualizationGroup>
          ))}
        </StyledModalBody>
      </Modal>
      <Modal
        show={!!removeTarget}
        onHide={() => setRemoveTarget(null)}
        centered
        size="sm"
      >
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Remove Plugin</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Remove <strong>{removeTarget?.label}</strong>? This will unregister the
          plugin from your dashboard.
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleRemovePlugin}>
            Remove
          </Button>
        </Modal.Footer>
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
