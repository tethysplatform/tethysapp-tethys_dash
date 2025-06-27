import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import CheckboxInput from "components/inputs/CheckboxInput";
import BorderSettings from "components/modals/DataViewer/BorderSettings";
import BackgroundSettings from "components/modals/DataViewer/BackgroundSettings";
import Alert from "react-bootstrap/Alert";
import CustomMessaging from "components/modals/DataViewer/CustomMessaging";
import "components/modals/wideModal.css";

export const defaultBorderStyle = { value: "none", label: "none" };
export const defaultBorderWidth = 1;
export const defaultBorderColor = "black";

function checkTransparency(color) {
  // Handle HEX format
  if (color.startsWith("#")) {
    color = color.replace(/^#/, ""); // Remove the `#`

    if (color.length === 8) {
      // #RRGGBBAA format
      let alpha = parseInt(color.slice(6, 8), 16); // Convert AA to decimal
      return alpha === 0;
    }

    // #RRGGBB format (fully opaque)
    return false;
  }

  // Handle RGB(A) format
  const rgbaMatch = color.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/
  );

  let alpha = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1; // Default alpha = 1 (opaque)
  return alpha === 0;
}

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
        border.color === allBorder.color &&
        border.style.value === allBorder.style.value &&
        border.width === allBorder.width
      );
    });

    if (isUniform) {
      return {
        border: `${allBorder.width}px ${allBorder.style.value} ${allBorder.color}`,
      };
    }
  }

  // If "all" is not in the object or the borders are different
  let borderStyles = {};
  filteredSides.forEach((side) => {
    const border = borderConfig[side];
    borderStyles[`border-${side}`] =
      `${border.width}px ${border.style.value} ${border.color}`;
  });

  return borderStyles;
}

function parseBorderStyles(styles) {
  const sides = ["top", "bottom", "left", "right"];
  const borderConfig = {};

  if (styles.border) {
    const [width, style, color] = styles.border.split(" ");
    const borderValue = {
      color: color,
      style: { value: style, label: style },
      width: parseInt(width),
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
          color: color,
          style: { value: style, label: style },
          width: parseInt(width),
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

function getShadowBox(borderSettings) {
  if (borderSettings?.border) {
    return `0 4px 8px ${borderSettings.border.split(" ")[2]}`;
  } else if (Object.keys(borderSettings).length > 0) {
    const boxShadows = [];
    if ("border-right" in borderSettings) {
      boxShadows.push(
        `4px 0 8px ${borderSettings["border-right"].split(" ")[2]}`
      );
    }
    if ("border-left" in borderSettings) {
      boxShadows.push(
        `-4px 0 8px ${borderSettings["border-left"].split(" ")[2]}`
      );
    }
    if ("border-bottom" in borderSettings) {
      boxShadows.push(
        `0 4px 8px ${borderSettings["border-bottom"].split(" ")[2]}`
      );
    }
    if ("border-top" in borderSettings) {
      boxShadows.push(
        `0 -4px 8px ${borderSettings["border-top"].split(" ")[2]}`
      );
    }
    return boxShadows.join(",");
  } else {
    return "0 4px 8px rgba(0, 0, 0, 0.1)";
  }
}

function getValidMessaging(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([key, value]) => value.trim() !== "")
  );
}

function SettingsPane({
  settingsRef,
  vizType,
  visualizationRef,
  vizInputsValues,
}) {
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
    settingsRef.current.backgroundColor ?? "rgba(0, 0, 0, 0)"
  );
  const [customMessaging, setCustomMessaging] = useState(
    settingsRef.current.customMessaging ?? {}
  );

  useEffect(() => {
    setGridItemRefreshRate(
      settingsRef.current.refreshRate ? settingsRef.current.refreshRate : 0
    );
    setEnforceAspectRatio(
      settingsRef.current.enforceAspectRatio ? true : false
    );
    // eslint-disable-next-line
  }, [vizType]);

  useEffect(() => {
    const newBorder = getBorderStyle(border);
    if (Object.keys(newBorder).length > 0) {
      settingsRef.current.border = newBorder;
    } else {
      delete settingsRef.current.border;
    }
    if (boxShadow) {
      settingsRef.current.boxShadow = getShadowBox(newBorder);
    }
    // eslint-disable-next-line
  }, [border]);

  useEffect(() => {
    const customMessages = getValidMessaging(customMessaging);
    if (Object.keys(customMessages).length > 0) {
      settingsRef.current.customMessaging = customMessages;
    } else {
      delete settingsRef.current.customMessaging;
    }
    // eslint-disable-next-line
  }, [customMessaging]);

  useEffect(() => {
    if (checkTransparency(backgroundColor)) {
      delete settingsRef.current.backgroundColor;
    } else {
      settingsRef.current.backgroundColor = backgroundColor;
    }
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
      settingsRef.current.boxShadow = getShadowBox(
        settingsRef.current.border ?? {}
      );
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
        divProps={{ style: { marginBottom: ".5rem" } }}
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
        divProps={{ style: { marginBottom: ".5rem" } }}
      />
      <CustomMessaging
        vizInputsValues={vizInputsValues}
        customMessaging={customMessaging}
        setCustomMessaging={setCustomMessaging}
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
  vizType: PropTypes.string,
  vizInputsValues: PropTypes.object,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default SettingsPane;
