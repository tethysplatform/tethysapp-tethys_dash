import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import CheckboxInput from "components/inputs/CheckboxInput";
import BorderSettings from "components/modals/DataViewer/BorderSettings";
import BackgroundSettings from "components/modals/DataViewer/BackgroundSettings";
import Alert from "react-bootstrap/Alert";
import "components/modals/wideModal.css";

const defaultBorderStyle = { value: "none", label: "none" };
const defaultBorderWidth = 1;
const defaultBorderColor = "black";

function getBorderStyle(borderConfig) {
  const sides = ["top", "bottom", "left", "right"];

  // Remove sides with style.value of "none"
  const filteredSides = sides.filter(
    (side) =>
      borderConfig[side]?.style && borderConfig[side].style.value !== "none"
  );

  // Check if "all" and all individual sides exist in the object
  const hasAll = "all" in borderConfig;
  const hasSides = filteredSides.length === sides.length;

  if (hasAll && hasSides) {
    const allBorder = borderConfig.all;
    const isUniform = filteredSides.every((side) => {
      const border = borderConfig[side];
      return (
        (border.color || defaultBorderColor) ===
          (allBorder.color || defaultBorderColor) &&
        border.style.value === allBorder.style.value &&
        (border.width || defaultBorderWidth) ===
          (allBorder.width || defaultBorderWidth)
      );
    });

    if (isUniform) {
      return {
        border: `${allBorder.width || defaultBorderWidth}px ${allBorder.style.value} ${allBorder.color || defaultBorderColor}`,
      };
    }
  }

  // If "all" is not in the object or the borders are different
  let borderStyles = {};
  filteredSides.forEach((side) => {
    if (borderConfig[side]) {
      const border = borderConfig[side];
      borderStyles[`border-${side}`] =
        `${border.width || defaultBorderWidth}px ${border.style.value} ${border.color || defaultBorderColor}`;
    }
  });

  return borderStyles;
}

function parseBorderStyles(styles) {
  const sides = ["top", "bottom", "left", "right"];
  const borderConfig = {};

  if (styles.border) {
    const [width, style, color] = styles.border.split(" ");
    const borderValue = {
      color: color || defaultBorderColor,
      style: { value: style || "none", label: style || "none" },
      width: parseInt(width) || defaultBorderWidth,
    };
    sides.forEach((side) => {
      borderConfig[side] = { ...borderValue };
    });
    borderConfig.all = { ...borderValue };
  } else {
    sides.forEach((side) => {
      const key = `border-${side}`;
      if (styles[key]) {
        const [width, style, color] = styles[key].split(" ");
        borderConfig[side] = {
          color: color || defaultBorderColor,
          style: { value: style || "none", label: style || "none" },
          width: parseInt(width) || defaultBorderWidth,
        };
      } else {
        borderConfig[side] = {
          color: defaultBorderColor,
          style: defaultBorderStyle,
          width: defaultBorderWidth,
        };
      }
    });
    borderConfig.all = { ...borderConfig[sides[0]] };
  }

  return borderConfig;
}

function SettingsPane({ settingsRef, viz, visualizationRef }) {
  const [gridItemRefreshRate, setGridItemRefreshRate] = useState(
    settingsRef.current.refreshRate ?? 0
  );
  const [enforceAspectRatio, setEnforceAspectRatio] = useState(
    settingsRef.current.enforceAspectRatio ? true : false
  );
  const [border, setBorder] = useState(
    parseBorderStyles(settingsRef.current.border ?? {})
  );
  const [boxShadow, setBoxShadow] = useState(
    settingsRef.current.boxShadow ? true : false
  );
  const [backgroundColor, setBackgroundColor] = useState(
    settingsRef.current.backgroundColor ?? "transparent"
  );

  useEffect(() => {
    setGridItemRefreshRate(
      settingsRef.current.refreshRate ? settingsRef.current.refreshRate : 0
    );
    setEnforceAspectRatio(
      settingsRef.current.enforceAspectRatio ? true : false
    );
    // eslint-disable-next-line
  }, [viz]);

  useEffect(() => {
    settingsRef.current.border = getBorderStyle(border);
    // eslint-disable-next-line
  }, [border]);

  useEffect(() => {
    settingsRef.current.backgroundColor = backgroundColor;
    // eslint-disable-next-line
  }, [backgroundColor]);

  function onRefreshRateChange(e) {
    if (parseInt(e.target.value) >= 0) {
      setGridItemRefreshRate(parseInt(e.target.value));
      settingsRef.current.refreshRate = parseInt(e.target.value);
    }
  }

  function onEnforceAspectRatioChange(e) {
    if (e.target.checked === true) {
      settingsRef.current.aspectRatio =
        visualizationRef.current.naturalWidth /
        visualizationRef.current.naturalHeight;
      settingsRef.current.enforceAspectRatio = true;
    } else {
      delete settingsRef.current.enforceAspectRatio;
    }
    setEnforceAspectRatio(e.target.checked);
  }

  function onBoxShadowChange(e) {
    setBoxShadow(e.target.checked);
    if (e.target.checked) {
      if (settingsRef.current.border?.border) {
        settingsRef.current.boxShadow = `0 4px 8px ${settingsRef.current.border.border.split(" ")[2]}`;
      } else if (Object.keys(settingsRef.current.border).length > 0) {
        const boxShadows = [];
        if ("border-right" in settingsRef.current.border) {
          boxShadows.push(
            `4px 0 8px ${settingsRef.current.border["border-right"].split(" ")[2]}`
          );
        }
        if ("border-left" in settingsRef.current.border) {
          boxShadows.push(
            `-4px 0 8px ${settingsRef.current.border["border-left"].split(" ")[2]}`
          );
        }
        if ("border-bottom" in settingsRef.current.border) {
          boxShadows.push(
            `0 4px 8px ${settingsRef.current.border["border-bottom"].split(" ")[2]}`
          );
        }
        if ("border-top" in settingsRef.current.border) {
          boxShadows.push(
            `0 -4px 8px ${settingsRef.current.border["border-top"].split(" ")[2]}`
          );
        }
        settingsRef.current.boxShadow = boxShadows.join(",");
      } else {
        settingsRef.current.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
      }
    } else {
      delete settingsRef.current.boxShadow;
    }
  }

  return (
    <>
      <NormalInput
        label="Refresh Rate (Minutes)"
        type="number"
        value={gridItemRefreshRate}
        onChange={onRefreshRateChange}
        divProps={{ style: { marginBottom: "1rem" } }}
      />
      <BorderSettings border={border} setBorder={setBorder} />
      <BackgroundSettings
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
      />
      <CheckboxInput
        label="Use Box Shadow Styling"
        type="checkbox"
        value={boxShadow}
        onChange={onBoxShadowChange}
        divProps={{ style: { marginBottom: "1rem" } }}
      />
      {visualizationRef.current?.tagName ? (
        <>
          {visualizationRef.current.tagName.toLowerCase() === "img" &&
            visualizationRef.current.naturalWidth && (
              <CheckboxInput
                label="Enforce Aspect Ratio"
                type="checkbox"
                value={enforceAspectRatio}
                onChange={onEnforceAspectRatioChange}
                divProps={{ style: { marginBottom: "1rem" } }}
              />
            )}
        </>
      ) : (
        <Alert key={"warning"} variant={"warning"}>
          Visualization must be loaded to change additional settings.
        </Alert>
      )}
    </>
  );
}

SettingsPane.propTypes = {
  settingsRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  viz: PropTypes.object,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default SettingsPane;
