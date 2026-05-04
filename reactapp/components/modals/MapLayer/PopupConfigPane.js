import PropTypes from "prop-types";
import { memo, useCallback } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import styled from "styled-components";
import { BsQuestionCircle } from "react-icons/bs";

const SECTION_PAD = "1.25rem";
const ANCHOR_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "top-left", label: "Top Left" },
  { value: "top-right", label: "Top Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
];

const SIZE_MIN = 20;
const SIZE_MAX = 95;
const SIZE_DEFAULT = 60;

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
  min-width: 8rem;
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

// User-facing help text showing the literal `${feature.<key>}` template
// syntax. eslint's no-template-curly-in-string lint catches accidental
// missing-backtick mistakes elsewhere; these strings are intentional.
/* eslint-disable no-template-curly-in-string */
const TITLE_TOOLTIP_TEXT =
  'Use ${feature.<key>} to substitute the clicked feature\'s attributes ' +
  '(e.g., "Site: ${feature.station_name}"). Missing attributes resolve to ' +
  "an empty string. See docs for the full feature.* syntax.";
/* eslint-enable no-template-curly-in-string */

/**
 * Clamp the supplied numeric percentage to the allowed range. Non-finite or
 * empty values fall back to the default so we never emit NaN to the parent.
 */
function clampSizePct(raw) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return SIZE_DEFAULT;
  if (num < SIZE_MIN) return SIZE_MIN;
  if (num > SIZE_MAX) return SIZE_MAX;
  return num;
}

/**
 * Coerce raw offset input. Empty strings preserve the editor's typing state by
 * becoming 0 in the persisted config (negatives are allowed).
 */
function coerceOffset(raw) {
  if (raw === "" || raw === null || raw === undefined) return 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

function buildDefaultConfig() {
  return {
    mode: "table",
    size: { widthPct: SIZE_DEFAULT, heightPct: SIZE_DEFAULT },
    anchor: { name: "center", offsetX: 0, offsetY: 0 },
    titleTemplate: "",
    gridItems: [],
  };
}

/**
 * Take an arbitrary popupConfig and fill in any defaults so the form always
 * has concrete values. Unknown fields pass through.
 */
function withDefaults(popupConfig) {
  const base = buildDefaultConfig();
  if (!popupConfig) return base;
  return {
    ...base,
    ...popupConfig,
    size: {
      widthPct: popupConfig.size?.widthPct ?? base.size.widthPct,
      heightPct: popupConfig.size?.heightPct ?? base.size.heightPct,
    },
    anchor: {
      name: popupConfig.anchor?.name ?? base.anchor.name,
      offsetX: popupConfig.anchor?.offsetX ?? base.anchor.offsetX,
      offsetY: popupConfig.anchor?.offsetY ?? base.anchor.offsetY,
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
      const nextMode = e.target.value === "modal" ? "modal" : "table";
      emit({ ...resolved, mode: nextMode });
    },
    [emit, resolved],
  );

  const handleSizeChange = useCallback(
    (key, raw) => {
      const next = { ...resolved.size, [key]: clampSizePct(raw) };
      emit({ ...resolved, size: next });
    },
    [emit, resolved],
  );

  const handleAnchorNameChange = useCallback(
    (e) => {
      emit({
        ...resolved,
        anchor: { ...resolved.anchor, name: e.target.value },
      });
    },
    [emit, resolved],
  );

  const handleAnchorOffsetChange = useCallback(
    (key, raw) => {
      emit({
        ...resolved,
        anchor: { ...resolved.anchor, [key]: coerceOffset(raw) },
      });
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
  const layoutButtonDisabled =
    !!isSaving &&
    (resolved.gridItems === null || resolved.gridItems === undefined);

  return (
    <div data-testid="popup-config-pane" data-layer-name={layerName ?? ""}>
      <Section>
        <Form.Label as="legend" style={{ fontWeight: "bold" }}>
          Popup Mode
        </Form.Label>
        <Form.Check
          inline
          type="radio"
          id="popup-mode-table"
          label="Table (default attribute popup)"
          name="popup-mode"
          value="table"
          aria-label="Popup Mode Table"
          checked={!isModal}
          onChange={handleModeChange}
        />
        <Form.Check
          inline
          type="radio"
          id="popup-mode-modal"
          label="Modal (custom dashboard popup)"
          name="popup-mode"
          value="modal"
          aria-label="Popup Mode Modal"
          checked={isModal}
          onChange={handleModeChange}
        />
        <Note>
          Table mode keeps today&apos;s inline attribute popup. Modal mode opens
          a custom dashboard whose visualizations receive the clicked feature
          via{" "}
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
            <Form.Label style={{ fontWeight: "bold" }}>Default Size</Form.Label>
            <Row>
              <FieldCol>
                <Form.Label htmlFor="popup-size-width">Width (%)</Form.Label>
                <Form.Control
                  id="popup-size-width"
                  type="number"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  value={resolved.size.widthPct}
                  aria-label="Popup Width Percent"
                  onChange={(e) => handleSizeChange("widthPct", e.target.value)}
                  onBlur={(e) => handleSizeChange("widthPct", e.target.value)}
                />
              </FieldCol>
              <FieldCol>
                <Form.Label htmlFor="popup-size-height">Height (%)</Form.Label>
                <Form.Control
                  id="popup-size-height"
                  type="number"
                  min={SIZE_MIN}
                  max={SIZE_MAX}
                  value={resolved.size.heightPct}
                  aria-label="Popup Height Percent"
                  onChange={(e) =>
                    handleSizeChange("heightPct", e.target.value)
                  }
                  onBlur={(e) => handleSizeChange("heightPct", e.target.value)}
                />
              </FieldCol>
            </Row>
            <Note>
              Sizes are percentages of the viewport. Allowed range:{" "}
              {SIZE_MIN}–{SIZE_MAX}.
            </Note>
          </Section>

          <Section>
            <Form.Label style={{ fontWeight: "bold" }}>
              Default Anchor
            </Form.Label>
            <Row>
              <FieldCol>
                <Form.Label htmlFor="popup-anchor-name">Anchor</Form.Label>
                <Form.Select
                  id="popup-anchor-name"
                  value={resolved.anchor.name}
                  aria-label="Popup Anchor Name"
                  onChange={handleAnchorNameChange}
                >
                  {ANCHOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Form.Select>
              </FieldCol>
              <FieldCol>
                <Form.Label htmlFor="popup-offset-x">X offset (px)</Form.Label>
                <Form.Control
                  id="popup-offset-x"
                  type="number"
                  value={resolved.anchor.offsetX}
                  aria-label="Popup Anchor Offset X"
                  onChange={(e) =>
                    handleAnchorOffsetChange("offsetX", e.target.value)
                  }
                />
              </FieldCol>
              <FieldCol>
                <Form.Label htmlFor="popup-offset-y">Y offset (px)</Form.Label>
                <Form.Control
                  id="popup-offset-y"
                  type="number"
                  value={resolved.anchor.offsetY}
                  aria-label="Popup Anchor Offset Y"
                  onChange={(e) =>
                    handleAnchorOffsetChange("offsetY", e.target.value)
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
                disabled={layoutButtonDisabled}
              >
                Edit popup layout
              </Button>
              <Note>
                Configure the visualizations that render inside the popup
                modal. Edits save independently from the layer&apos;s other
                settings.
              </Note>
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
    size: PropTypes.shape({
      widthPct: PropTypes.number,
      heightPct: PropTypes.number,
    }),
    anchor: PropTypes.shape({
      name: PropTypes.string,
      offsetX: PropTypes.number,
      offsetY: PropTypes.number,
    }),
    titleTemplate: PropTypes.string,
    gridItems: PropTypes.array,
  }),
  onChange: PropTypes.func.isRequired,
  onOpenLayoutEditor: PropTypes.func,
  hostDashboardEditable: PropTypes.bool,
  isSaving: PropTypes.bool,
};

PopupConfigPane.defaultProps = {
  popupConfig: null,
  onOpenLayoutEditor: () => {},
  hostDashboardEditable: true,
  isSaving: false,
};

export default memo(PopupConfigPane);
