import PropTypes from "prop-types";
import { ColorPicker as RCPColorPicker, useColor } from "react-color-palette";
import { useMemo } from "react";
import debounce from "lodash.debounce";
import "react-color-palette/css";

const ColorPicker = ({ color, onChange, hideInput }) => {
  const [pickerColor, setPickerColor] = useColor(color);

  // debounce the change before comitting it. Without this the color picker cursor shakes and causes weird behavior
  const onColorChange = useMemo(
    () =>
      debounce((newColor) => {
        onChange(newColor.hex);
        setPickerColor(newColor);
      }, 5), // debounce at 5ms
    // eslint-disable-next-line
    []
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
