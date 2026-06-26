import { useRef } from "react";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import CheckboxInput from "components/inputs/CheckboxInput";
import BorderSettings from "components/modals/DataViewer/BorderSettings";
import BackgroundSettings from "components/modals/DataViewer/BackgroundSettings";
import Alert from "react-bootstrap/Alert";
import CustomMessaging from "components/modals/DataViewer/CustomMessaging";
import PlotlySettings from "components/modals/DataViewer/PlotlySettings";
import "components/modals/wideModal.css";

function checkTransparency(color) {
  const hex = color.slice(1);

  // Must be either 6 or 8 hex digits
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return true;

  // If it's 8-digit hex, check alpha
  if (hex.length === 8) {
    const alpha = parseInt(hex.slice(6, 8), 16);
    return alpha === 0;
  }

  return false; // 6-digit hex has no alpha = opaque
}

function getBorderStyle(borderConfig) {
  const sides = ["top", "bottom", "left", "right"];
  const filteredSides = sides.filter(
    (side) =>
      borderConfig[side]?.style && borderConfig[side].style.value !== "none",
  );

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

  let borderStyles = {};
  filteredSides.forEach((side) => {
    const border = borderConfig[side];
    borderStyles[`border-${side}`] =
      `${border.width}px ${border.style.value} ${border.color}`;
  });

  return borderStyles;
}

function getShadowBox(borderSettings) {
  if (borderSettings?.border) {
    return `0 4px 8px ${borderSettings.border.split(" ")[2]}`;
  } else if (Object.keys(borderSettings).length > 0) {
    const boxShadows = [];
    if ("border-right" in borderSettings) {
      boxShadows.push(
        `4px 0 8px ${borderSettings["border-right"].split(" ")[2]}`,
      );
    }
    if ("border-left" in borderSettings) {
      boxShadows.push(
        `-4px 0 8px ${borderSettings["border-left"].split(" ")[2]}`,
      );
    }
    if ("border-bottom" in borderSettings) {
      boxShadows.push(
        `0 4px 8px ${borderSettings["border-bottom"].split(" ")[2]}`,
      );
    }
    if ("border-top" in borderSettings) {
      boxShadows.push(
        `0 -4px 8px ${borderSettings["border-top"].split(" ")[2]}`,
      );
    }
    return boxShadows.join(",");
  } else {
    return "0 4px 8px rgba(0, 0, 0, 0.1)";
  }
}

function getValidMessaging(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value.trim() !== ""),
  );
}

function SettingsPane({
  settings,
  setSettings,
  visualizationRef,
  vizInputsValues,
}) {
  const settingsPaneRef = useRef(null);

  const onRefreshRateChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 0) {
      setSettings((prev) => ({ ...prev, refreshRate: value }));
    }
  };

  const onBoxShadowChange = (checked) => {
    setSettings((prev) => {
      if (checked) {
        return {
          ...prev,
          boxShadow: getShadowBox(prev.border ?? {}),
        };
      } else {
        const { boxShadow, ...rest } = prev;
        return rest;
      }
    });
  };

  const onAttributionChange = (checked) => {
    setSettings((prev) => {
      if (checked) {
        const { attribution, ...rest } = prev;
        return rest;
      } else {
        return { ...prev, attribution: false };
      }
    });
  };

  const onBackgroundColorChange = (color) => {
    setSettings((prev) => {
      const isTransparent = checkTransparency(color);
      const { backgroundColor, ...rest } = prev;
      return isTransparent ? rest : { ...rest, backgroundColor: color };
    });
  };

  const onBorderChange = (borderConfig) => {
    const newBorder = getBorderStyle(borderConfig);
    setSettings((prev) => {
      const hasBorder = Object.keys(newBorder).length > 0;
      const updated = {
        ...prev,
        ...(hasBorder ? { border: newBorder } : { border: undefined }),
        ...(prev.boxShadow ? { boxShadow: getShadowBox(newBorder) } : {}),
      };
      return updated;
    });
  };

  const onCustomMessagingChange = (customMessaging) => {
    const cleaned = getValidMessaging(customMessaging);
    setSettings((prev) => {
      const { customMessaging, ...rest } = prev;
      return Object.keys(cleaned).length > 0
        ? { ...rest, customMessaging: cleaned }
        : rest;
    });
  };

  const onFillViewportChange = (checked) => {
    setSettings((prev) => {
      if (checked) {
        return { ...prev, fillViewport: true };
      } else {
        const { fillViewport, ...rest } = prev;
        return rest;
      }
    });
  };

  const onEnforceAspectRatioChange = (checked) => {
    if (
      checked &&
      visualizationRef.current?.naturalWidth &&
      visualizationRef.current?.naturalHeight
    ) {
      const aspectRatio =
        visualizationRef.current.naturalWidth /
        visualizationRef.current.naturalHeight;

      setSettings((prev) => ({
        ...prev,
        aspectRatio,
        enforceAspectRatio: true,
      }));
    } else {
      setSettings((prev) => {
        const { enforceAspectRatio, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <div ref={settingsPaneRef}>
      <NormalInput
        label="Refresh Rate (Minutes)"
        type="number"
        value={settings.refreshRate ?? 0}
        onChange={onRefreshRateChange}
        divProps={{ style: { marginBottom: ".5rem" } }}
      />
      <BorderSettings
        initialBorder={settings.border}
        onChange={onBorderChange}
        settingsPaneRef={settingsPaneRef}
      />
      <BackgroundSettings
        initialBackgroundColor={settings.backgroundColor}
        onChange={onBackgroundColorChange}
        settingsPaneRef={settingsPaneRef}
      />
      <CheckboxInput
        label="Use Box Shadow Styling"
        type="checkbox"
        value={!!settings.boxShadow}
        onChange={onBoxShadowChange}
        divProps={{ style: { marginBottom: ".5rem" } }}
      />
      <CheckboxInput
        label="Show Attribution"
        type="checkbox"
        value={settings.attribution !== false}
        onChange={onAttributionChange}
        divProps={{ style: { marginBottom: ".5rem" } }}
      />
      <CheckboxInput
        label="Fill Viewport"
        type="checkbox"
        value={!!settings.fillViewport}
        onChange={onFillViewportChange}
        divProps={{ style: { marginBottom: ".25rem" } }}
      />
      <small
        className="no-caret"
        style={{ display: "block", marginBottom: ".5rem", color: "#666" }}
      >
        Fills the screen below the navigation when viewed, on any screen size.
        Covers other items on the tab.
      </small>
      <CustomMessaging
        vizInputsValues={vizInputsValues}
        initialCustomMessaging={settings.customMessaging}
        onChange={onCustomMessagingChange}
      />
      {visualizationRef.current?.tagName ? (
        <>
          {visualizationRef.current.tagName.toLowerCase() === "img" &&
            visualizationRef.current.naturalWidth && (
              <CheckboxInput
                label="Enforce Aspect Ratio"
                type="checkbox"
                value={!!settings.enforceAspectRatio}
                onChange={onEnforceAspectRatioChange}
                inputProps={{ disabled: !!settings.fillViewport }}
                divProps={{ style: { marginBottom: "1rem" } }}
              />
            )}
        </>
      ) : (visualizationRef.current?.el?.className || "").includes("plotly") ? (
        <PlotlySettings
          settings={settings}
          setSettings={setSettings}
          visualizationRef={visualizationRef}
        />
      ) : (
        <Alert key={"warning"} variant={"warning"}>
          Visualization must be loaded to change additional settings.
        </Alert>
      )}
    </div>
  );
}

SettingsPane.propTypes = {
  settings: PropTypes.object,
  setSettings: PropTypes.func,
  vizType: PropTypes.string,
  vizInputsValues: PropTypes.object,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default SettingsPane;
