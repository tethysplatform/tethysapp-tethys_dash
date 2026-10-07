/* eslint-disable no-template-curly-in-string */
// The help text quotes literal `${feature.<key>}` template syntax.
import PropTypes from "prop-types";
import { memo, useCallback, useRef } from "react";
import Dropdown from "react-bootstrap/Dropdown";
import Form from "react-bootstrap/Form";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import styled from "styled-components";
import { BsQuestionCircle } from "react-icons/bs";
import NormalInput from "components/inputs/NormalInput";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import AnchorPicker, { normalizeAnchor } from "components/inputs/AnchorPicker";
import {
  defaultLabelAnchor,
  defaultLabelColor,
  defaultLabelSize,
} from "components/map/labelStyle";

const Section = styled.div`
  margin-bottom: 1.25rem;
`;

const Row = styled.div`
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
`;

const FieldCol = styled.div`
  flex: 1;
  min-width: 8rem;
`;

const SectionLabel = styled(Form.Label)`
  font-weight: bold;
  margin-bottom: 0;
`;

const HelpRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 0.25rem;
`;

const TooltipIcon = styled(BsQuestionCircle)`
  margin-left: 0.4rem;
  cursor: help;
  color: #6c757d;
`;

const Note = styled.p`
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.5rem;
`;

const TEMPLATE_TOOLTIP_TEXT =
  "Use ${feature.<key>} to substitute each feature's own attributes " +
  '(e.g., "${feature.station_id}"). Dashboard variable inputs may also be ' +
  "referenced with ${Variable Name}. A feature missing an attribute renders " +
  "the rest of the template. An empty template draws no labels.";

// "No floor" is an empty field, not 0 -- 0 is a real zoom level, and coercing a
// blank field to it would suppress labels everywhere but the whole world view.
export const NO_ZOOM_FLOOR = "";

/**
 * Merge render defaults over a stored config on read.
 *
 * Defaults are merged each render rather than written into the stored object,
 * so a layer that has never had its labels touched keeps `null` in its config
 * and an author who never changed the color is not pinned to today's default.
 */
export function withDefaults(labelConfig) {
  const base = {
    template: "",
    anchor: defaultLabelAnchor,
    color: defaultLabelColor,
    size: defaultLabelSize,
    minZoom: NO_ZOOM_FLOOR,
  };
  if (!labelConfig || typeof labelConfig !== "object") return base;
  return {
    template: labelConfig.template ?? base.template,
    // An anchor a plugin wrote, or one left over from a rename, would leave
    // every cell unselected -- the renderer falls back to the default, so the
    // editor has to show the default too.
    anchor: normalizeAnchor(labelConfig.anchor ?? base.anchor),
    color: labelConfig.color ?? base.color,
    // `??` rather than `||`: a size or a zoom floor of 0 is a value the author
    // set, not an absent one.
    size: labelConfig.size ?? base.size,
    minZoom: labelConfig.minZoom ?? base.minZoom,
  };
}

/**
 * Coerce a numeric field from `NormalInput`, which always hands back a string.
 * A blank field means "unset" and must stay blank -- `Number("")` is 0, which
 * would read back as a deliberate zero.
 */
export function coerceNumericField(raw) {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (str === "") return "";
  const parsed = Number(str);
  return Number.isFinite(parsed) ? parsed : str;
}

/**
 * Splice a feature reference into a template at the caret.
 *
 * A template is usually literal text with references mixed in, so inserting has
 * to preserve what is already typed and land where the author was working --
 * replacing the field would make the picker useless for anything but a
 * single-attribute label. Returns the new template and where the caret should
 * end up, so focus can be restored after the controlled re-render.
 */
export function insertAtSelection(template, token, start, end) {
  const text = String(template ?? "");
  const from = Number.isInteger(start) ? start : text.length;
  const to = Number.isInteger(end) ? end : from;
  const head = text.slice(0, from);
  const tail = text.slice(to);
  return { value: `${head}${token}${tail}`, caret: from + token.length };
}

const LabelsPane = ({
  layerName,
  labelConfig,
  onChange,
  containerRef,
  attributeDiscovery,
}) => {
  const resolved = withDefaults(labelConfig);
  const templateWrapRef = useRef(null);

  const emit = useCallback(
    (key, value) => {
      onChange({ ...withDefaults(labelConfig), [key]: value });
    },
    [onChange, labelConfig],
  );

  const handleTemplateChange = useCallback(
    (e) => emit("template", e.target.value),
    [emit],
  );

  const handleAnchorChange = useCallback(
    (anchor) => emit("anchor", anchor),
    [emit],
  );

  const handleColorChange = useCallback(
    (color) => emit("color", color?.hex ?? color),
    [emit],
  );

  const handleSizeChange = useCallback(
    (e) => emit("size", coerceNumericField(e.target.value)),
    [emit],
  );

  const handleZoomFloorChange = useCallback(
    (e) => emit("minZoom", coerceNumericField(e.target.value)),
    [emit],
  );

  // NormalInput does not forward a ref, so the caret is read off the rendered
  // input. Scoped to this pane's own wrapper, not the document.
  const templateInput = () =>
    templateWrapRef.current?.querySelector(
      'input[aria-label="Label Template"]',
    );

  const handleAttributeMenuToggle = useCallback(
    (nextShown) => {
      if (nextShown) attributeDiscovery?.open?.();
    },
    [attributeDiscovery],
  );

  const handleInsertAttribute = useCallback(
    (name) => {
      const input = templateInput();
      const { value, caret } = insertAtSelection(
        resolved.template,
        `\${feature.${name}}`,
        input?.selectionStart,
        input?.selectionEnd,
      );
      emit("template", value);
      // The field is controlled, so the caret has to be restored after React
      // writes the new value back.
      if (input) {
        requestAnimationFrame(() => {
          input.focus();
          try {
            input.setSelectionRange(caret, caret);
          } catch {
            // Some input types reject selection ranges; focus alone is fine.
          }
        });
      }
    },
    [emit, resolved.template],
  );

  const discoveryState = attributeDiscovery?.state ?? "idle";
  const discoveredFields = attributeDiscovery?.fields ?? [];

  return (
    <div data-testid="labels-pane" data-layer-name={layerName ?? ""}>
      <Section>
        <HelpRow>
          <SectionLabel>Label Template</SectionLabel>
          <OverlayTrigger
            placement="top"
            trigger={["hover", "focus"]}
            overlay={
              <Tooltip id="label-template-tooltip">
                {TEMPLATE_TOOLTIP_TEXT}
              </Tooltip>
            }
          >
            <span tabIndex={0} role="button" aria-label="Label Template Help">
              <TooltipIcon size="0.95rem" />
            </span>
          </OverlayTrigger>
        </HelpRow>
        <div ref={templateWrapRef}>
          <NormalInput
            value={resolved.template}
            type="text"
            onChange={handleTemplateChange}
            ariaLabel="Label Template"
            placeholder="${feature.station_id}"
          />
        </div>
        {attributeDiscovery && (
          <Dropdown onToggle={handleAttributeMenuToggle}>
            <Dropdown.Toggle
              size="sm"
              variant="outline-secondary"
              id="label-attribute-picker"
              aria-label="Insert Attribute"
            >
              Insert Attribute
            </Dropdown.Toggle>
            <Dropdown.Menu aria-label="Label Attribute List">
              {discoveryState === "loading" && (
                <Dropdown.ItemText>Reading attributes…</Dropdown.ItemText>
              )}
              {discoveryState === "failed" && (
                <Dropdown.ItemText>
                  {attributeDiscovery.error ??
                    "Could not read this layer's attributes."}{" "}
                  Type the attribute name instead.
                </Dropdown.ItemText>
              )}
              {discoveryState === "ready" && discoveredFields.length === 0 && (
                <Dropdown.ItemText>
                  This source reports no attributes. Type the attribute name
                  instead.
                </Dropdown.ItemText>
              )}
              {discoveryState === "ready" &&
                discoveredFields.map((field) => (
                  <Dropdown.Item
                    key={field.name}
                    onClick={() => handleInsertAttribute(field.name)}
                  >
                    {field.alias && field.alias !== field.name
                      ? `${field.alias} (${field.name})`
                      : field.name}
                  </Dropdown.Item>
                ))}
            </Dropdown.Menu>
          </Dropdown>
        )}
        <Note>
          Leave empty to draw no labels. Labels follow the layer&apos;s own
          visibility.
        </Note>
      </Section>

      <Section>
        <SectionLabel>Placement</SectionLabel>
        <Note>
          Where the label sits relative to each feature. Line features follow
          the line and ignore this setting.
        </Note>
        <AnchorPicker
          value={resolved.anchor}
          onChange={handleAnchorChange}
          label="Label Anchor"
        />
      </Section>

      <Section>
        <SectionLabel>Appearance</SectionLabel>
        <Row style={{ marginTop: "0.5rem" }}>
          <FieldCol>
            <ColorPickerPopOver
              label="Label Text"
              color={resolved.color}
              onChange={handleColorChange}
              containerRef={containerRef}
            />
          </FieldCol>
          <FieldCol>
            <NormalInput
              label="Label Size"
              value={resolved.size}
              type="number"
              min={1}
              onChange={handleSizeChange}
              ariaLabel="Label Size"
              allowEmpty
            />
          </FieldCol>
        </Row>
      </Section>

      <Section>
        <SectionLabel>Label Minimum Zoom</SectionLabel>
        <Note>
          Labels are hidden below this zoom level while the layer&apos;s
          geometry keeps drawing. Leave empty to always draw labels.
        </Note>
        <NormalInput
          value={resolved.minZoom}
          type="number"
          min={0}
          onChange={handleZoomFloorChange}
          ariaLabel="Label Minimum Zoom"
          allowEmpty
        />
      </Section>
    </div>
  );
};

LabelsPane.propTypes = {
  layerName: PropTypes.string,
  labelConfig: PropTypes.shape({
    template: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    anchor: PropTypes.string,
    color: PropTypes.string,
    size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    // A zoom level, matching the layer's own minZoom/maxZoom settings --
    // never a resolution, which is what the layer's flat `maxResolution`
    // property holds. The map scope converts this to a resolution at render
    // time, because the conversion needs the live view's projection.
    minZoom: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  onChange: PropTypes.func.isRequired,
  containerRef: PropTypes.object,
  // Author-triggered attribute discovery. Absent when the editor has no reader
  // for this source, in which case the template stays a plain typed field.
  attributeDiscovery: PropTypes.shape({
    state: PropTypes.oneOf(["idle", "loading", "ready", "failed"]),
    fields: PropTypes.array,
    error: PropTypes.string,
    open: PropTypes.func,
  }),
};

export default memo(LabelsPane);
