import { memo, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import ColorPickerPopOver from "components/inputs/ColorPickerPopOver";
import NormalInput from "components/inputs/NormalInput";
import {
  DEFAULT_BORDER_WIDTH,
  MAX_BORDER_WIDTH,
  MIN_BORDER_WIDTH,
  isTransparentColor,
} from "components/map/imageBorder";

const BorderField = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const BorderFieldLabel = styled.span`
  font-weight: bold;
  min-width: 10rem;
`;

const BorderWidthControl = styled.div`
  max-width: 6rem;
`;

// A static image's border color and width, saved as `borderColor` /
// `borderWidth` in its source props.
const StaticImageBorderFields = ({
  borderColor,
  borderWidth,
  setSourceProps,
}) => {
  // The color popover renders inside the pane, so it stays within the modal.
  const containerRef = useRef(null);

  // Set a border prop, or remove it when `value` is undefined. Returns the
  // same object when nothing changes, so a picker drag that repeats a value
  // does not re-render the pane.
  const setBorderProp = useCallback(
    (key, value) => {
      setSourceProps((prev) => {
        if (prev?.props?.[key] === value) return prev;
        const nextProps = { ...(prev?.props ?? {}) };
        if (value === undefined) {
          delete nextProps[key];
        } else {
          nextProps[key] = value;
        }
        return { ...prev, props: nextProps };
      });
    },
    [setSourceProps],
  );

  // A fully transparent color is the "no border" value, so it removes the
  // key rather than saving an invisible border.
  const handleColorChange = useCallback(
    (color) =>
      setBorderProp(
        "borderColor",
        !color || isTransparentColor(color) ? undefined : color,
      ),
    [setBorderProp],
  );

  // Widths below the minimum are not saved; the layer then draws the default.
  const handleWidthChange = useCallback(
    (e) => {
      const raw = e.target.value;
      const width = Number(raw);
      setBorderProp(
        "borderWidth",
        raw === "" || !Number.isFinite(width) || width < MIN_BORDER_WIDTH
          ? undefined
          : width,
      );
    },
    [setBorderProp],
  );

  return (
    <div ref={containerRef}>
      <BorderField>
        <BorderFieldLabel>Border color</BorderFieldLabel>
        {/* The picker keeps the current alpha as the author moves through
            hues, so it opens opaque even though "no border" is transparent. */}
        <ColorPickerPopOver
          label="Border"
          color={borderColor ?? "transparent"}
          pickerColor={borderColor ?? "#000000"}
          onChange={handleColorChange}
          containerRef={containerRef}
          hideLabel
        />
      </BorderField>
      <BorderField>
        <BorderFieldLabel>Border width (px)</BorderFieldLabel>
        <BorderWidthControl>
          <NormalInput
            value={borderWidth ?? ""}
            type="number"
            min={MIN_BORDER_WIDTH}
            max={MAX_BORDER_WIDTH}
            placeholder={String(DEFAULT_BORDER_WIDTH)}
            onChange={handleWidthChange}
            ariaLabel="Border Width"
            allowEmpty
          />
        </BorderWidthControl>
      </BorderField>
    </div>
  );
};

StaticImageBorderFields.propTypes = {
  borderColor: PropTypes.string,
  borderWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  setSourceProps: PropTypes.func.isRequired,
};

export default memo(StaticImageBorderFields);
