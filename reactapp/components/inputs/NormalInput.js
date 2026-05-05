import { useState, useEffect } from "react";
import Form from "react-bootstrap/Form";
import PropTypes from "prop-types";

const hasUnclosedVariable = (val) => {
  const lastOpen = val.lastIndexOf("${");
  if (lastOpen === -1) return false;
  const closeAfter = val.indexOf("}", lastOpen + 2);
  return closeAfter === -1;
};

const NormalInput = ({
  label,
  onChange,
  value,
  type,
  ariaLabel,
  placeholder,
  divProps,
  labelProps,
  min,
  max,
  allowEmpty = false,
}) => {
  const isNumber = type === "number";
  const [rawValue, setRawValue] = useState(String(value ?? ""));

  useEffect(() => {
    const strValue = String(value ?? "");
    if (strValue !== "NaN") {
      setRawValue(strValue);
    }
  }, [value]);

  const handleChange = (e) => {
    const val = e.target.value;

    if (!isNumber) {
      onChange(e);
      return;
    }

    if (!hasUnclosedVariable(val)) {
      const nonVarParts = val.replace(/\$\{[^}]*\}/g, "");
      if (
        nonVarParts !== "" &&
        nonVarParts !== "-" &&
        nonVarParts !== "." &&
        nonVarParts !== "-." &&
        isNaN(Number(nonVarParts)) &&
        !nonVarParts.endsWith("$")
      )
        return;
    }

    setRawValue(val);

    if (
      !allowEmpty &&
      (val === "" ||
        val === "-" ||
        val === "." ||
        val === "-." ||
        hasUnclosedVariable(val) ||
        val === "$")
    )
      return;

    onChange(e);
  };

  return (
    <div {...divProps}>
      {label && (
        <Form.Label className="no-caret" {...labelProps}>
          <b>{label}</b>:
        </Form.Label>
      )}
      <Form.Control
        aria-label={ariaLabel || label + " Input"}
        type={isNumber ? "text" : type}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
          }
          if (isNumber && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
            const num = Number(rawValue);
            if (isNaN(num)) return;
            const step = e.key === "ArrowUp" ? 1 : -1;
            let newVal = num + step;
            if (min !== undefined && newVal < min) newVal = min;
            if (max !== undefined && newVal > max) newVal = max;
            const newStr = String(newVal);
            setRawValue(newStr);
            onChange({ target: { value: newStr } });
            e.preventDefault();
          }
        }}
        value={isNumber ? rawValue : value}
        placeholder={placeholder}
        min={min !== undefined ? min : null}
        max={max !== undefined ? max : null}
      />
    </div>
  );
};

NormalInput.propTypes = {
  placeholder: PropTypes.string,
  ariaLabel: PropTypes.string,
  label: PropTypes.string, // label for the input
  onChange: PropTypes.func, // callback function when the input changes
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // state for input value
  type: PropTypes.string, // type of input to use
  divProps: PropTypes.object, // additional props to pass to the parent div
  labelProps: PropTypes.object, // additional props to pass to the label
  min: PropTypes.number, // minimum value for the input
  max: PropTypes.number, // maximum value for the input
  allowEmpty: PropTypes.bool, // propagate empty-string / "-" / "$" values to the parent. Off by default to preserve last-valid-value during mid-edit typing
};

export default NormalInput;
