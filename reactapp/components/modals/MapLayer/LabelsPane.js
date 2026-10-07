/* eslint-disable no-template-curly-in-string */
// The template placeholder quotes literal `${feature.<key>}` syntax.
import PropTypes from "prop-types";
import { memo, useCallback } from "react";
import Form from "react-bootstrap/Form";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Tooltip from "react-bootstrap/Tooltip";
import { BsQuestionCircle } from "react-icons/bs";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import CheckboxInput from "components/inputs/CheckboxInput";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import AnchorPicker, { normalizeAnchor } from "components/inputs/AnchorPicker";
import {
  defaultLabelAnchor,
  defaultLabelColor,
  defaultLabelSize,
} from "components/map/labelStyle";

// One row per setting: the label on the left, the control on the right, and
// the explanation folded into a hover tip rather than a paragraph under the
// field. Keeps the pane scannable -- six settings read as six lines.
const Field = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const FieldLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex: 0 0 auto;
  min-width: 10rem;
`;

// Inputs are sized to what they hold: a zoom level and a font size are two or
// three characters, and a template is a short phrase -- none of them want the
// full width of the pane.
const Control = styled.div`
  flex: 0 1 auto;
  max-width: ${(props) => props.$width || "16rem"};
  width: 100%;
`;

const TooltipIcon = styled(BsQuestionCircle)`
  cursor: help;
  color: #6c757d;
  flex: 0 0 auto;
`;

const SectionLabel = styled(Form.Label)`
  font-weight: bold;
  margin-bottom: 0;
`;

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
    allowOverlap: false,
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
    // `??` again: a stored `false` is the author having turned this off, not an
    // absent value to fill in from the default.
    allowOverlap: labelConfig.allowOverlap ?? base.allowOverlap,
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

/** The explanation for a setting, on hover, to the left of its label. */
const InfoTip = ({ id, children }) => (
  <OverlayTrigger
    placement="bottom"
    trigger={["hover", "focus"]}
    overlay={<Tooltip id={id}>{children}</Tooltip>}
  >
    <span tabIndex={0} role="button" aria-label={`${id} help`}>
      <TooltipIcon size="0.95rem" />
    </span>
  </OverlayTrigger>
);

InfoTip.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.node,
};

const LabelsPane = ({ layerName, labelConfig, onChange, containerRef }) => {
  const resolved = withDefaults(labelConfig);

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

  const handleAllowOverlapChange = useCallback(
    (checked) => emit("allowOverlap", !!checked),
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

  return (
    <div data-testid="labels-pane" data-layer-name={layerName ?? ""}>
      <Field>
        <FieldLabel>
          <InfoTip id="Template">
            Text drawn beside each feature. Use ${"${feature.<key>}"} to insert
            that feature&apos;s own attribute, and ${"${Variable Name}"} for a
            dashboard variable input. A feature missing an attribute still draws
            the rest of the template. Leave empty to draw no labels.
          </InfoTip>
          <SectionLabel>Template</SectionLabel>
        </FieldLabel>
        <Control>
          <NormalInput
            value={resolved.template}
            type="text"
            onChange={handleTemplateChange}
            ariaLabel="Template"
            placeholder="${feature.station_id}"
          />
        </Control>
      </Field>

      <Field>
        <FieldLabel>
          <InfoTip id="Placement">
            Where the label sits relative to each feature. Line features follow
            the line and ignore this setting.
          </InfoTip>
          <SectionLabel>Placement</SectionLabel>
        </FieldLabel>
        <Control $width="auto">
          <AnchorPicker
            value={resolved.anchor}
            onChange={handleAnchorChange}
            label="Label Anchor"
          />
        </Control>
      </Field>

      <Field>
        <FieldLabel>
          <InfoTip id="Allow Overlapping Labels">
            Labels that would collide are hidden by default, so only some of a
            crowded layer&apos;s labels draw. Allow overlap to draw every one of
            them instead.
          </InfoTip>
          <SectionLabel>Allow Overlapping Labels</SectionLabel>
        </FieldLabel>
        <Control $width="auto">
          <CheckboxInput
            label="Allow Overlapping Labels"
            type="checkbox"
            value={resolved.allowOverlap}
            onChange={handleAllowOverlapChange}
            divProps={{ style: { gap: 0 } }}
            hideLabel
          />
        </Control>
      </Field>

      <Field>
        <FieldLabel>
          <SectionLabel>Text Color</SectionLabel>
        </FieldLabel>
        <Control $width="auto">
          <ColorPickerPopOver
            label="Text Color"
            color={resolved.color}
            onChange={handleColorChange}
            containerRef={containerRef}
            hideLabel
          />
        </Control>
      </Field>

      <Field>
        <FieldLabel>
          <SectionLabel>Text Size</SectionLabel>
        </FieldLabel>
        <Control $width="6rem">
          <NormalInput
            value={resolved.size}
            type="number"
            min={1}
            onChange={handleSizeChange}
            ariaLabel="Text Size"
            allowEmpty
          />
        </Control>
      </Field>

      <Field>
        <FieldLabel>
          <InfoTip id="Minimum Display Zoom">
            Labels are hidden below this zoom level while the layer&apos;s
            geometry keeps drawing. Leave empty to always draw labels.
          </InfoTip>
          <SectionLabel>Minimum Display Zoom</SectionLabel>
        </FieldLabel>
        <Control $width="6rem">
          <NormalInput
            value={resolved.minZoom}
            type="number"
            min={0}
            onChange={handleZoomFloorChange}
            ariaLabel="Minimum Display Zoom"
            allowEmpty
          />
        </Control>
      </Field>
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
    // Draw every label rather than hiding the ones that collide.
    allowOverlap: PropTypes.bool,
  }),
  onChange: PropTypes.func.isRequired,
  containerRef: PropTypes.object,
};

export default memo(LabelsPane);
