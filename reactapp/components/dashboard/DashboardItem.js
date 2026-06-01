import PropTypes from "prop-types";
import styled, { css } from "styled-components";
import Container from "react-bootstrap/Container";
import { memo, useState, useContext, useEffect } from "react";
import { BsInfoCircle, BsClipboard } from "react-icons/bs";
import {
  EditingContext,
  VariableInputsContext,
  DataViewerModeContext,
  AppContext,
  LayoutContext,
  TabContext,
  GridItemContext,
  StreamingContext,
} from "components/contexts/Contexts";
import { useAppTourContext } from "components/contexts/AppTourContext";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import BaseVisualization from "components/visualizations/Base";
import ErrorBoundary from "components/error/ErrorBoundary";
import TileErrorFallback from "components/error/TileErrorFallback";
import { confirm } from "components/inputs/DeleteConfirmation";
import {
  getGridItem,
  downloadJSONFile,
  findVisualizationBySource,
} from "components/visualizations/utilities";
import CustomAlert from "components/dashboard/CustomAlert";
import { loadLayerJSONs, saveLayerJSON } from "components/map/utilities";
import { valuesEqual } from "components/modals/utilities";
import { v4 as uuidv4 } from "uuid";

const StyledContainer = styled(Container)`
  position: relative;
  padding: 0;
`;

const StyledButtonDiv = styled.div`
  position: absolute;
  margin: 0.5rem;
  right: 0;
  top: 0;
`;

const StyledDiv = styled.div`
  height: 100%;
  width: 100%;
  ${(props) =>
    props.$borderProps
      ? css(props.$borderProps)
      : props.$isEditing && "border: 1px solid #dcdcdc"};
  background-color: ${(props) =>
    props.$backgroundColorProps
      ? props.$backgroundColorProps
      : props.$isEditing
        ? "whitesmoke"
        : "transparent"};
  box-shadow: ${(props) =>
    props.$boxShadowProps
      ? props.$boxShadowProps
      : props.$isEditing
        ? "0 4px 8px rgba(0, 0, 0, 0.1)"
        : "none"};
  position: relative;
`;

const InfoIconWrapper = styled.div`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  display: flex;
  align-items: center;
`;

const CopyIconWrapper = styled.button`
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  background: transparent;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  opacity: 0.15;
  transition: opacity 120ms ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;

  &:hover,
  &:focus-visible {
    opacity: 0.7;
  }
`;

const AttributionTooltip = styled.div`
  max-height: 50vh;
  overflow-y: auto;
  display: ${(props) => (props.$show ? "block" : "none")};
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: rgba(21, 32, 42, 0.97);
  color: #fbfcfc;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.75rem 1.5rem 0.75rem 1rem;
  font-size: 0.95em;
  max-width: 25vw;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  scrollbar-gutter: stable both-edges;
`;

export const minMapLayerStructure = `Map layers must have at minimum, the following structure:
{
    configuration: {
        type: <Some Value>,
        props: {
            source: {
                type: <Some Value>
            }
        }
    }
}`;

export const requiredGridItemKeys = [
  "i",
  "x",
  "y",
  "w",
  "h",
  "source",
  "args_string",
  "metadata_string",
];

export function detectImportFormat(json) {
  if (Array.isArray(json)) {
    const count = json.length;
    return {
      type: "array",
      gridItems: json,
      tabs: [],
      summary: `${count} grid item${count !== 1 ? "s" : ""} to add to current tab`,
    };
  }

  if (json && typeof json === "object") {
    if (Array.isArray(json.tabs)) {
      const tabSummaries = json.tabs.map(
        (tab) =>
          `${tab.name || "Unnamed tab"} (${tab.gridItems?.length || 0} items)`,
      );
      return {
        type: "dashboard",
        gridItems: [],
        tabs: json.tabs,
        summary: `${json.tabs.length} tab${json.tabs.length !== 1 ? "s" : ""}: ${tabSummaries.join(", ")}`,
      };
    }

    if (json.name !== undefined && Array.isArray(json.gridItems)) {
      const count = json.gridItems.length;
      return {
        type: "tab",
        gridItems: [],
        tabs: [json],
        summary: `Tab: ${json.name} with ${count} item${count !== 1 ? "s" : ""}`,
      };
    }

    if (requiredGridItemKeys.every((key) => key in json)) {
      return {
        type: "single",
        gridItems: [json],
        tabs: [],
        summary: "1 grid item",
      };
    }
  }

  return null;
}

export function validateGridItemBatch(items) {
  const errors = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const missingKeys = requiredGridItemKeys.filter(
      (key) => !Object.prototype.hasOwnProperty.call(item, key),
    );
    if (missingKeys.length > 0) {
      errors.push(
        `Item ${i + 1}: missing ${missingKeys.join(", ")}`,
      );
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export const handleGridItemExport = async (gridItem, dashboard_uuid) => {
  const { id, uuid, ...exportedGridItem } = gridItem;
  exportedGridItem.metadata_string = JSON.parse(
    exportedGridItem.metadata_string,
  );
  const gridItemArgs = JSON.parse(exportedGridItem.args_string);
  exportedGridItem.args_string = gridItemArgs;

  if (exportedGridItem.source === "Map") {
    if ("layers" in gridItemArgs && gridItemArgs["layers"].length > 0) {
      for (const mapLayer of gridItemArgs["layers"]) {
        const apiResponse = await loadLayerJSONs(
          mapLayer,
          dashboard_uuid,
          true,
        );
        if (!apiResponse.success) {
          return apiResponse;
        }
      }
    }
  }

  return exportedGridItem;
};

export const handleGridItemImport = async (gridItem, csrf, dashboard_uuid) => {
  const importedGridItem = JSON.parse(JSON.stringify(gridItem));
  if (typeof importedGridItem.args_string === "string") {
    importedGridItem.args_string = JSON.parse(importedGridItem.args_string);
  }

  if (
    !requiredGridItemKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(importedGridItem, key),
    )
  ) {
    return {
      success: false,
      message: `Grid Items must include ${requiredGridItemKeys.join(", ")} keys`,
    };
  }

  if (importedGridItem.source === "Map") {
    if (
      "layers" in importedGridItem.args_string &&
      importedGridItem.args_string["layers"].length > 0
    ) {
      for (const mapLayer of importedGridItem.args_string["layers"]) {
        if (
          !mapLayer?.configuration?.props?.source?.type ||
          !mapLayer?.configuration?.type
        ) {
          return {
            success: false,
            message: minMapLayerStructure,
          };
        }

        if (
          mapLayer.configuration.props.source.type === "GeoJSON" &&
          mapLayer.configuration.props.source.geojson &&
          typeof mapLayer.configuration.props.source.geojson === "object"
        ) {
          const apiResponse = await saveLayerJSON({
            stringJSON: JSON.stringify(
              mapLayer.configuration.props.source.geojson,
            ),
            csrf,
            check_crs: true,
            dashboard_uuid,
          });

          if (apiResponse.success) {
            mapLayer.configuration.props.source.geojson = apiResponse.filename;
          } else {
            return apiResponse;
          }
        }

        if (mapLayer.configuration.style) {
          const apiResponse = await saveLayerJSON({
            stringJSON: JSON.stringify(mapLayer.configuration.style),
            csrf,
            check_crs: false,
            dashboard_uuid,
          });

          if (apiResponse.success) {
            mapLayer.configuration.style = apiResponse.filename;
          } else {
            return apiResponse;
          }
        }
      }
    }
  }
  importedGridItem.args_string = JSON.stringify(importedGridItem.args_string);
  importedGridItem.metadata_string = JSON.stringify(
    importedGridItem.metadata_string,
  );

  return {
    success: true,
    importedGridItem,
  };
};

const DashboardItem = () => {
  const {
    gridItemSource,
    gridItemI,
    gridItemMetadataString,
    gridItemIndex,
    gridItemUUID,
  } = useContext(GridItemContext);
  const { isEditing, setIsEditing } = useContext(EditingContext);
  const [showDataViewerModal, setShowDataViewerModal] = useState(false);
  const [gridItemMessage, setGridItemMessage] = useState("");
  const [showGridItemMessage, setShowGridItemMessage] = useState(false);
  const [gridItemWarning, setGridItemWarning] = useState("");
  const [showGridItemWarning, setShowGridItemWarning] = useState(false);
  const [gridItemStyling, setGridItemStyling] = useState(
    JSON.parse(gridItemMetadataString),
  );
  const { getActiveTab, updateTab } = useContext(TabContext);
  const { variableInputValues, setVariableInputValues } = useContext(
    VariableInputsContext,
  );
  const { setInDataViewerMode } = useContext(DataViewerModeContext);
  const { visualizations } = useContext(AppContext);
  const { uuid } = useContext(LayoutContext);
  // Plan 2026-05-28-002 Unit 7 — read chatbox-driven streaming flag so
  // edit/delete/reorder affordances no-op while the LLM is mutating tiles
  // via patch_visualization. StreamingContext is provided by DashboardLoader
  // (Unit 6) and consumed only by DashboardItem to keep the per-turn
  // re-render footprint isolated. Falsy default for hosts without the
  // Provider (e.g., legacy tests not yet updated).
  const { isStreaming = false } = useContext(StreamingContext) ?? {};
  const { setAppTourStep, activeAppTour } = useAppTourContext();
  const [attribution, setAttribution] = useState(
    findVisualizationBySource(visualizations, gridItemSource)?.attribution,
  );
  const [showAttribution, setShowAttribution] = useState(false);

  useEffect(() => {
    setAttribution(
      findVisualizationBySource(visualizations, gridItemSource)?.attribution,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridItemSource]);

  useEffect(() => {
    setGridItemStyling(JSON.parse(gridItemMetadataString));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridItemMetadataString]);

  async function deleteGridItem(e) {
    // Plan 2026-05-28-002 Unit 7 — guard BEFORE confirm() so the modal does
    // not open at all when the chatbox is mid-turn (R5). If the guard fired
    // after confirm, the user would see the modal, dismiss it, and have a
    // silent no-op afterwards — confusing.
    if (isStreaming) {
      setGridItemWarning(
        "Editing paused while the chatbox is updating this dashboard.",
      );
      setShowGridItemWarning(true);
      return;
    }
    if (await confirm("Are you sure you want to delete the item?")) {
      const { gridItems, id: activeTabId } = getActiveTab();
      const updated_grid_items = JSON.parse(JSON.stringify(gridItems));
      updated_grid_items.splice(gridItemIndex, 1);

      updateTab(activeTabId, { gridItems: updated_grid_items });
      setIsEditing(true);
    }
  }

  function editGridItem() {
    // Plan 2026-05-28-002 Unit 7 — gate edit-modal-open while chatbox
    // streams (R5). Open modals that predate the stream are unaffected
    // per the Scope Boundary "open edit modals at stream start are not
    // auto-closed" — accepted v1 UX cost.
    if (isStreaming) {
      setGridItemWarning(
        "Editing paused while the chatbox is updating this dashboard.",
      );
      setShowGridItemWarning(true);
      return;
    }
    setShowDataViewerModal(true);
    setIsEditing(true);
    setInDataViewerMode(true);
    if (activeAppTour) {
      setAppTourStep(34);
    }
  }

  function updateGridItemOrder(newIndex) {
    // Plan 2026-05-28-002 Unit 7 — gate per-tile reorder affordances
    // (arrows / dropdown menu entries calling bringGridItemToFront /
    // bringGridItemForward / etc., which all delegate here). The
    // react-grid-layout drag-to-reorder gesture is NOT routed through
    // here, so it remains enabled per R6.
    if (isStreaming) {
      setGridItemWarning(
        "Editing paused while the chatbox is updating this dashboard.",
      );
      setShowGridItemWarning(true);
      return;
    }
    const { gridItems, id: activeTabId } = getActiveTab();
    const updatedGridItems = [...gridItems];
    const [movingGridItem] = updatedGridItems.splice(gridItemIndex, 1);
    updatedGridItems.splice(newIndex, 0, movingGridItem);
    updateTab(activeTabId, { gridItems: updatedGridItems });
  }

  function bringGridItemtoFront() {
    const { gridItems } = getActiveTab();
    const newIndex = gridItems.length - 1;
    updateGridItemOrder(newIndex);
  }

  function bringGridItemForward() {
    const newIndex = gridItemIndex + 1;
    updateGridItemOrder(newIndex);
  }

  function sendGridItemtoBack() {
    const newIndex = 0;
    updateGridItemOrder(newIndex);
  }

  function sendGridItembackward() {
    const newIndex = gridItemIndex - 1;
    updateGridItemOrder(newIndex);
  }

  async function exportGridItem() {
    const { gridItems } = getActiveTab();
    const gridItem = JSON.parse(JSON.stringify(gridItems[gridItemIndex]));

    const exportedGridItem = await handleGridItemExport(gridItem, uuid);

    try {
      downloadJSONFile(exportedGridItem, "TethysDashGridItem.json");
    } catch (err) {
      setShowGridItemWarning(true);
      setGridItemWarning("Failed to export grid item.");
    }
  }

  function copyGridItem() {
    const { gridItems, id: activeTabId } = getActiveTab();
    let maxGridItemI = gridItems.reduce((acc, value) => {
      return (acc = acc > parseInt(value.i) ? acc : parseInt(value.i));
    }, 0);
    const copiedGridItem = getGridItem(gridItems, gridItemI);
    const newGridItem = { ...copiedGridItem };
    newGridItem.i = `${parseInt(maxGridItemI) + 1}`;
    newGridItem.id = null;
    newGridItem.uuid = uuidv4();
    if (newGridItem.source === "Variable Input") {
      const newGridItemArgs = JSON.parse(newGridItem.args_string);
      let copiedVariableName = newGridItemArgs.variable_name;
      let finding_valid_name = true;
      let i = 2;
      let newVariableName = newGridItemArgs.variable_name + "_1";
      do {
        if (!Object.keys(variableInputValues).includes(newVariableName)) {
          finding_valid_name = false;
        } else {
          newVariableName = newGridItemArgs.variable_name + "_" + i;
        }
        i++;
      } while (finding_valid_name);
      newGridItemArgs.variable_name = newVariableName;
      newGridItem.args_string = JSON.stringify(newGridItemArgs);
      variableInputValues[newVariableName] =
        variableInputValues[copiedVariableName];
      setVariableInputValues(variableInputValues);
    }
    const updatedGridItems = JSON.parse(JSON.stringify(gridItems));
    updateTab(activeTabId, { gridItems: [...updatedGridItems, newGridItem] });
    setIsEditing(true);
  }

  async function copyGridItemContext(e) {
    e.stopPropagation();
    const activeTab = getActiveTab();
    const gridItem = activeTab?.gridItems?.[gridItemIndex];
    if (!gridItem) {
      setGridItemWarning("Could not read tile metadata");
      setShowGridItemWarning(true);
      return;
    }
    try {
      await window.navigator.clipboard.writeText(gridItemUUID);
      setGridItemMessage("UUID copied to clipboard");
      setShowGridItemMessage(true);
    } catch {
      setGridItemWarning("Failed to copy UUID");
      setShowGridItemWarning(true);
    }
  }

  function hideDataViewerModal() {
    setShowDataViewerModal(false);
    setInDataViewerMode(false);
  }

  function renderAttributionWithLinks(text) {
    // Regex to match URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) => {
      if (urlRegex.test(part)) {
        let href = part;
        if (!href.startsWith("http")) {
          href = "http://" + href;
        }
        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--bs-primary)", wordBreak: "break-all" }}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  }

  return (
    <>
      <StyledDiv
        $isEditing={isEditing}
        $borderProps={gridItemStyling?.border}
        $backgroundColorProps={gridItemStyling?.backgroundColor}
        $boxShadowProps={gridItemStyling?.boxShadow}
        aria-label="gridItemDiv"
        className="no-caret"
      >
        <StyledContainer
          fluid
          className="h-100 gridVisualization"
          aria-label="gridItem"
        >
          <CustomAlert
            alertType={"success"}
            showAlert={showGridItemMessage}
            setShowAlert={setShowGridItemMessage}
            alertMessage={gridItemMessage}
          />
          <CustomAlert
            alertType={"warning"}
            showAlert={showGridItemWarning}
            setShowAlert={setShowGridItemWarning}
            alertMessage={gridItemWarning}
          />
          <ErrorBoundary
            fallback={(error, errorInfo) => (
              <TileErrorFallback error={error} errorInfo={errorInfo} />
            )}
          >
            <BaseVisualization key={gridItemI} />
          </ErrorBoundary>
        </StyledContainer>
        {gridItemStyling?.attribution !== false && attribution && (
          <InfoIconWrapper
            onMouseEnter={() => setShowAttribution(true)}
            onMouseLeave={() => setShowAttribution(false)}
            aria-label="attribution-info-icon"
          >
            <BsInfoCircle
              size={22}
              color="var(--bs-primary)"
              style={{ cursor: "pointer" }}
            />
            <AttributionTooltip
              $show={showAttribution}
              aria-label="attribution-tooltip"
              onMouseLeave={() => setShowAttribution(false)}
            >
              {renderAttributionWithLinks(attribution)}
            </AttributionTooltip>
          </InfoIconWrapper>
        )}
        {showDataViewerModal && (
          <DataViewerModal
            showModal={showDataViewerModal}
            handleModalClose={hideDataViewerModal}
            setGridItemMessage={setGridItemMessage}
            setShowGridItemMessage={setShowGridItemMessage}
          />
        )}
        <CopyIconWrapper
          type="button"
          aria-label="Copy grid item UUID"
          onClick={copyGridItemContext}
        >
          <BsClipboard size={14} />
        </CopyIconWrapper>
      </StyledDiv>
      {isEditing && (
        <StyledButtonDiv>
          <DashboardItemDropdown
            gridItemIndex={gridItemIndex}
            deleteGridItem={deleteGridItem}
            editGridItem={editGridItem}
            exportGridItem={exportGridItem}
            copyGridItem={copyGridItem}
            bringGridItemtoFront={bringGridItemtoFront}
            bringGridItemForward={bringGridItemForward}
            sendGridItemtoBack={sendGridItemtoBack}
            sendGridItembackward={sendGridItembackward}
            isStreaming={isStreaming}
          />
        </StyledButtonDiv>
      )}
    </>
  );
};

DashboardItem.propTypes = {
  gridItemSource: PropTypes.string,
  gridItemI: PropTypes.string,
  gridItemArgsString: PropTypes.string,
  gridItemMetadataString: PropTypes.string,
  gridItemIndex: PropTypes.number,
  gridItemUUID: PropTypes.string,
  shouldLoad: PropTypes.bool,
};

export default memo(DashboardItem, valuesEqual);
