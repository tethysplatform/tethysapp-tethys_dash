import PropTypes from "prop-types";
import { memo, useCallback } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import styled from "styled-components";
import { BsQuestionCircle } from "react-icons/bs";
import PreviewCanvas from "components/modals/MapLayer/PreviewCanvas";

const QueryLabel = styled.label`
  margin-bottom: 1rem;
  font-weight: bold;
`;

const SECTION_PAD = "1.25rem";

const SIZE_MIN = 20;
const SIZE_MAX = 100;
const POS_MIN = 0;
const POS_MAX = 100;

// Default position centers a 60×60 popup in the viewport.
export const DEFAULT_POSITION = {
  leftPct: 20,
  topPct: 20,
  widthPct: 60,
  heightPct: 60,
};

const Section = styled.div`
  margin-bottom: ${SECTION_PAD};
`;

const Row = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const FieldCol = styled.div`
  flex: 1;
  min-width: 6rem;
`;

const TooltipIcon = styled(BsQuestionCircle)`
  margin-left: 0.4rem;
  cursor: help;
  color: #6c757d;
`;

const HelpRow = styled.div`
  display: flex;
  align-items: center;
`;

const Note = styled.p`
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.5rem;
`;

/* eslint-disable no-template-curly-in-string */
const TITLE_TOOLTIP_TEXT =
  "Use ${feature.<key>} to substitute the clicked feature's attributes " +
  '(e.g., "Site: ${feature.station_name}"). Missing attributes resolve to ' +
  "an empty string. See docs for the full feature.* syntax.";

export function clampPct(raw, fallback, min, max) {
  if (raw === "" || raw === null || raw === undefined) return fallback;
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

export function reconcilePosition(next) {
  const result = { ...next };
  if (result.leftPct + result.widthPct > 100) {
    result.leftPct = Math.max(0, 100 - result.widthPct);
  }
  if (result.topPct + result.heightPct > 100) {
    result.topPct = Math.max(0, 100 - result.heightPct);
  }
  return result;
}

function buildDefaultConfig() {
  return {
    mode: "table",
    position: { ...DEFAULT_POSITION },
    titleTemplate: "",
    gridItems: [],
  };
}

export function withDefaults(popupConfig) {
  const base = buildDefaultConfig();
  if (!popupConfig) return base;
  return {
    ...base,
    ...popupConfig,
    position: {
      leftPct: popupConfig.position?.leftPct ?? base.position.leftPct,
      topPct: popupConfig.position?.topPct ?? base.position.topPct,
      widthPct: popupConfig.position?.widthPct ?? base.position.widthPct,
      heightPct: popupConfig.position?.heightPct ?? base.position.heightPct,
    },
    titleTemplate: popupConfig.titleTemplate ?? "",
  };
}

const PopupConfigPane = ({
  layerName,
  popupConfig,
  onChange,
  onOpenLayoutEditor,
  hostDashboardEditable,
  isSaving,
}) => {
  const resolved = withDefaults(popupConfig);
  const isModal = resolved.mode === "modal";

  const emit = useCallback(
    (next) => {
      onChange(next);
    },
    [onChange],
  );

  const handleModeChange = useCallback(
    (e) => {
      const nextMode = e.target.checked ? "modal" : "table";
      emit({ ...resolved, mode: nextMode });
    },
    [emit, resolved],
  );

  const handleCanvasChange = useCallback(
    (nextPosition) => {
      emit({ ...resolved, position: reconcilePosition(nextPosition) });
    },
    [emit, resolved],
  );

  const handlePctFieldChange = useCallback(
    (key, raw) => {
      const isPos = key === "leftPct" || key === "topPct";
      const min = isPos ? POS_MIN : SIZE_MIN;
      const max = isPos ? POS_MAX : SIZE_MAX;
      const next = {
        ...resolved.position,
        [key]: clampPct(raw, resolved.position[key], min, max),
      };
      emit({ ...resolved, position: reconcilePosition(next) });
    },
    [emit, resolved],
  );

  const handleTitleChange = useCallback(
    (e) => {
      emit({ ...resolved, titleTemplate: e.target.value });
    },
    [emit, resolved],
  );

  const showLayoutButton = hostDashboardEditable !== false;

  return (
    <div data-testid="popup-config-pane" data-layer-name={layerName ?? ""}>
      <Section>
        <QueryLabel>
          <input
            type="checkbox"
            onChange={handleModeChange}
            checked={isModal}
          ></input>{" "}
          Enable Custom Popup Modal
        </QueryLabel>
        <Note>
          The default attribute table popup always shows when a feature on this
          layer is clicked. Enable a custom popup modal to also open a
          configurable dashboard parameterized by the clicked feature&apos;s
          attributes via{" "}
          <code>
            {/* eslint-disable-next-line no-template-curly-in-string */}
            {"${feature.<key>}"}
          </code>{" "}
          substitution.
        </Note>
      </Section>

      {isModal && (
        <>
          <Section>
            <Form.Label style={{ fontWeight: "bold" }}>
              Default Position
            </Form.Label>
            <Note>
              Drag the rectangle to reposition the popup; drag a handle to
              resize. Values are percentages of the runtime viewport.
            </Note>
            <PreviewCanvas
              value={resolved.position}
              onChange={handleCanvasChange}
              minWidthPct={SIZE_MIN}
              minHeightPct={SIZE_MIN}
            />
            <Row>
              <FieldCol>
                <Form.Label htmlFor="popup-pos-left">Left (%)</Form.Label>
                <Form.Control
                  id="popup-pos-left"
                  type="number"
                  min={POS_MIN}
                  max={POS_MAX}
                  value={resolved.position.leftPct}
                  aria-label="Popup Left Percent"
                  onChange={(e) =>
                    handlePctFieldChange("leftPct", e.target.value)
                  }
                />
              </FieldCol>
              <FieldCol>
                <Form.Label htmlFor="popup-pos-top">Top (%)</Form.Label>
                <Form.Control
                  id="popup-pos-top"
                  type="number"
                  min={POS_MIN}
                  max={POS_MAX}
                  value={resolved.position.topPct}
                  aria-label="Popup Top Percent"
                  onChange={(e) =>
                    handlePctFieldChange("topPct", e.target.value)
                  }
                />
              </FieldCol>
              <FieldCol>
                <Form.Label htmlFor="popup-pos-width">Width (%)</Form.Label>
                <Form.Control
                  id="popup-pos-width"
                  type="number"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  value={resolved.position.widthPct}
                  aria-label="Popup Width Percent"
                  onChange={(e) =>
                    handlePctFieldChange("widthPct", e.target.value)
                  }
                />
              </FieldCol>
              <FieldCol>
                <Form.Label htmlFor="popup-pos-height">Height (%)</Form.Label>
                <Form.Control
                  id="popup-pos-height"
                  type="number"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  value={resolved.position.heightPct}
                  aria-label="Popup Height Percent"
                  onChange={(e) =>
                    handlePctFieldChange("heightPct", e.target.value)
                  }
                />
              </FieldCol>
            </Row>
          </Section>

          <Section>
            <HelpRow>
              <Form.Label
                htmlFor="popup-title-template"
                style={{ fontWeight: "bold", marginBottom: 0 }}
              >
                Title Template
              </Form.Label>
              <OverlayTrigger
                placement="top"
                trigger={["hover", "focus"]}
                overlay={
                  <Tooltip id="popup-title-template-tooltip">
                    {TITLE_TOOLTIP_TEXT}
                  </Tooltip>
                }
              >
                <span
                  tabIndex={0}
                  role="button"
                  aria-label="Title Template Help"
                >
                  <TooltipIcon size="0.95rem" />
                </span>
              </OverlayTrigger>
            </HelpRow>
            <Form.Control
              id="popup-title-template"
              type="text"
              value={resolved.titleTemplate}
              // eslint-disable-next-line no-template-curly-in-string
              placeholder="Site: ${feature.station_name}"
              aria-label="Popup Title Template"
              onChange={handleTitleChange}
            />
          </Section>

          {showLayoutButton && (
            <Section>
              <Button
                variant="primary"
                aria-label="Edit Popup Layout Button"
                onClick={onOpenLayoutEditor}
                disabled={!!isSaving}
              >
                Edit popup layout
              </Button>
            </Section>
          )}
        </>
      )}
    </div>
  );
};

PopupConfigPane.propTypes = {
  layerName: PropTypes.string,
  popupConfig: PropTypes.shape({
    id: PropTypes.number,
    mode: PropTypes.oneOf(["table", "modal"]),
    position: PropTypes.shape({
      leftPct: PropTypes.number,
      topPct: PropTypes.number,
      widthPct: PropTypes.number,
      heightPct: PropTypes.number,
    }),
    titleTemplate: PropTypes.string,
    gridItems: PropTypes.array,
  }),
  onChange: PropTypes.func.isRequired,
  onOpenLayoutEditor: PropTypes.func,
  hostDashboardEditable: PropTypes.bool,
  isSaving: PropTypes.bool,
};

export default memo(PopupConfigPane);
