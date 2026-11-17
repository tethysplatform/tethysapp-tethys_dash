import PropTypes from "prop-types";
import Form from "react-bootstrap/Form";
import NormalInput from "components/inputs/NormalInput";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import { ANCHOR_LABELS } from "components/inputs/AnchorPicker";
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
 * zero. It fires on every step of an edit (each move through the color
 * picker, each keystroke), for a live preview; `onCommit`, when given, fires
 * once the edit is finished: the picker closed, the number field left, a
 * choice made.
 */
const AnnotationStyleControl = ({
  field,
  value,
  storedValue,
  onChange,
  ariaPrefix = "",
  containerRef,
  arrowheadOptions,
  onCommit,
}) => {
  const label = `${ariaPrefix}${FIELD_LABELS[field]}`;
  // A choice is finished the moment it is made.
  const choose = (next) => {
    onChange(next);
    onCommit?.();
  };
  if (COLOR_FIELDS.includes(field)) {
    return (
      <ColorPickerPopOver
        label={label}
        color={value}
        onChange={(color) => onChange(colorValue(color))}
        onClose={onCommit}
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
        onBlur={onCommit}
      />
    );
  }
  if (field === "arrowheads") {
    return (
      <Form.Select
        aria-label={label}
        value={value}
        onChange={(e) => choose(e.target.value)}
      >
        {arrowheadOptions.map((option) => (
          <option key={option} value={option}>
            {ARROWHEAD_LABELS[option]}
          </option>
        ))}
      </Form.Select>
    );
  }
  // Text placement: a short list, which fits the editor panel and the
  // annotation button's panel where the anchor grid would not.
  return (
    <Form.Select
      aria-label={label}
      value={value}
      onChange={(e) => choose(e.target.value)}
    >
      {LABEL_ANCHOR_OPTIONS.map((anchor) => (
        <option key={anchor} value={anchor}>
          {ANCHOR_LABELS[anchor]}
        </option>
      ))}
    </Form.Select>
  );
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
  /** Called once an edit is finished; see the component's comment. */
  onCommit: PropTypes.func,
};

export default AnnotationStyleControl;
