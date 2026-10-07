/* eslint-disable no-template-curly-in-string */
// The template placeholder quotes literal `${feature.<key>}` syntax.
import PropTypes from "prop-types";
import { memo, useCallback } from "react";
import Form from "react-bootstrap/Form";
import styled from "styled-components";
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

const FieldCol = styled.div`
  flex: 1;
  min-width: 8rem;
`;

const SectionLabel = styled(Form.Label)`
  font-weight: bold;
  margin-bottom: 0;
`;

const Note = styled.p`
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.5rem;
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
      <Section>
        <SectionLabel>Template</SectionLabel>
        <NormalInput
          value={resolved.template}
          type="text"
          onChange={handleTemplateChange}
          ariaLabel="Template"
          placeholder="${feature.station_id}"
        />
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
        <SectionLabel>Text</SectionLabel>
        <FieldCol style={{ marginTop: "0.5rem" }}>
          <ColorPickerPopOver
            label="Color"
            color={resolved.color}
            onChange={handleColorChange}
            containerRef={containerRef}
          />
        </FieldCol>
        <FieldCol style={{ marginTop: "0.75rem" }}>
          <NormalInput
            label="Size"
            value={resolved.size}
            type="number"
            min={1}
            onChange={handleSizeChange}
            ariaLabel="Size"
            allowEmpty
          />
        </FieldCol>
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
};

export default memo(LabelsPane);
