import PropTypes from "prop-types";
import { ColorPicker as RCPColorPicker, useColor } from "react-color-palette";
import { useMemo } from "react";
import debounce from "lodash.debounce";
import "react-color-palette/css";

// True for a hex color whose alpha is zero ("#rrggbb00" or "#rgb0") -- what
// the picker hands back when its alpha is dragged to zero, i.e. "no color".
export function isTransparentColor(color) {
  if (typeof color !== "string") return false;
  const hex = color.trim();
  return /^#[0-9a-f]{8}$/i.test(hex)
    ? hex.slice(7).toLowerCase() === "00"
    : /^#[0-9a-f]{4}$/i.test(hex) && hex[4] === "0";
}

const ColorPicker = ({ color, onChange, hideInput }) => {
  const [pickerColor, setPickerColor] = useColor(color);

  // debounce the change before comitting it. Without this the color picker cursor shakes and causes weird behavior
  const onColorChange = useMemo(
    () =>
      debounce((newColor) => {
        onChange(newColor.hex);
        setPickerColor(newColor);
      }, 5), // debounce at 5ms
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <RCPColorPicker
      color={pickerColor}
      onChange={onColorChange}
      hideInput={hideInput}
    />
  );
};

ColorPicker.propTypes = {
  color: PropTypes.string.isRequired, // color in hex, rgb, or hsv
  onChange: PropTypes.func.isRequired, // callback function with new color in hex
  hideInput: PropTypes.arrayOf(PropTypes.string), // array of inputs (hex, rgb, hsv) to hide
};

export default ColorPicker;
