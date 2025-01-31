import { ColorPicker as RCPColorPicker, useColor } from "react-color-palette";
import "react-color-palette/css";

const ColorPicker = ({ color, onChangeComplete, hideInput }) => {
  const [pickerColor, setPickerColor] = useColor(color);

  return (
    <RCPColorPicker
      color={pickerColor}
      onChange={setPickerColor}
      onChangeComplete={onChangeComplete}
      hideInput={hideInput}
    />
  );
};

export default ColorPicker;
