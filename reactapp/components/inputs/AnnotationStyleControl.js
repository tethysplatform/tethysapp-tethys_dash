import PropTypes from "prop-types";
import Form from "react-bootstrap/Form";
import NormalInput from "components/inputs/NormalInput";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import AnchorPicker, { ANCHOR_LABELS } from "components/inputs/AnchorPicker";
import {
  coerceNumericField,
  colorValue,
} from "components/modals/MapLayer/LabelsPane";
import { LABEL_ANCHOR_OPTIONS } from "components/map/labelStyle";

export const ARROWHEAD_LABELS = {
  none: "None",
  end: "End",
  start: "Start",
  both: "Both ends",
};

// Which style properties each kind of annotation draws with, so a line never
// shows a text-size control.
export const FIELDS_BY_KIND = {
  line: ["lineColor", "lineWidth", "arrowheads"],
  text: ["textColor", "textSize", "haloColor", "textAnchor", "textRotation"],
};

export const FIELD_LABELS = {
  lineColor: "Line Color",
  lineWidth: "Line Width",
  arrowheads: "Arrowheads",
  textColor: "Text Color",
  textSize: "Text Size",
  haloColor: "Text Outline Color",
  textAnchor: "Text Placement",
  textRotation: "Text Rotation",
};

const COLOR_FIELDS = ["lineColor", "textColor", "haloColor"];
// Arrow-key bounds for each number field. A size has to be positive; a
// rotation is any angle either way round.
const NUMBER_FIELD_LIMITS = {
  lineWidth: { min: 1 },
  textSize: { min: 1 },
  textRotation: { min: -360, max: 360 },
};

/**
 * One annotation style control. `onChange` receives the new value, or
 * `undefined` for a cleared number field -- which means "unset" rather than
 * zero.
 */
const AnnotationStyleControl = ({
  field,
  value,
  storedValue,
  onChange,
  ariaPrefix = "",
  containerRef,
  arrowheadOptions,
  compactAnchor,
}) => {
  const label = `${ariaPrefix}${FIELD_LABELS[field]}`;
  if (COLOR_FIELDS.includes(field)) {
    return (
      <ColorPickerPopOver
        label={label}
        color={value}
        onChange={(color) => onChange(colorValue(color))}
        containerRef={containerRef}
        hideLabel
      />
    );
  }
  if (field in NUMBER_FIELD_LIMITS) {
    return (
      // Bound to what is stored, not to the resolved value: clearing the field
      // to type a new number must leave it empty, not snap back to the value
      // it inherits -- which shows as the placeholder instead.
      <NormalInput
        value={storedValue ?? ""}
        placeholder={String(value)}
        type="number"
        min={NUMBER_FIELD_LIMITS[field].min}
        max={NUMBER_FIELD_LIMITS[field].max}
        onChange={(e) => {
          const next = coerceNumericField(e.target.value);
          onChange(next === "" ? undefined : next);
        }}
        ariaLabel={label}
        allowEmpty
      />
    );
  }
  if (field === "arrowheads") {
    return (
      <Form.Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {arrowheadOptions.map((option) => (
          <option key={option} value={option}>
            {ARROWHEAD_LABELS[option]}
          </option>
        ))}
      </Form.Select>
    );
  }
  if (field === "textAnchor" && compactAnchor) {
    return (
      <Form.Select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {LABEL_ANCHOR_OPTIONS.map((anchor) => (
          <option key={anchor} value={anchor}>
            {ANCHOR_LABELS[anchor]}
          </option>
        ))}
      </Form.Select>
    );
  }
  return <AnchorPicker value={value} onChange={onChange} label={label} />;
};

AnnotationStyleControl.propTypes = {
  field: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  // The stored value (an override, or the authored default), if any.
  storedValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  ariaPrefix: PropTypes.string,
  containerRef: PropTypes.object,
  arrowheadOptions: PropTypes.arrayOf(PropTypes.string),
  compactAnchor: PropTypes.bool,
};

export default AnnotationStyleControl;
