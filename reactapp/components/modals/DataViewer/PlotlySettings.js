import PropTypes from "prop-types";
import { useContext, useEffect } from "react";
import DatePicker from "components/inputs/DatePicker";
import { addVerticalLine } from "components/visualizations/BasePlot";
import { VariableInputsContext } from "components/contexts/Contexts";
import { getDependentVariableInputs } from "components/visualizations/utilities";
import { checkForVariable } from "components/inputs/DatePicker";

const PlotlySettings = ({ settings, setSettings, visualizationRef }) => {
  const { variableInputValues } = useContext(VariableInputsContext);

  const verticalLineMode = settings?.plotlyVerticalLine?.mode || "off";
  const verticalLineValue = settings?.plotlyVerticalLine?.value || "";
  const verticalLineColor = settings?.plotlyVerticalLine?.color || "red";
  const verticalLineWidth = settings?.plotlyVerticalLine?.width || 2;
  const verticalLineDash = settings?.plotlyVerticalLine?.dash || "solid";

  // Update vertical line when variable input values change or when mode is on
  useEffect(() => {
    if (verticalLineMode === "on" && verticalLineValue) {
      let resolvedValue = verticalLineValue;

      if (checkForVariable(verticalLineValue)) {
        const dependentVars = getDependentVariableInputs(verticalLineValue);
        resolvedValue = variableInputValues[dependentVars[0]];

        if (!resolvedValue) return;
      }

      addVerticalLine(visualizationRef, resolvedValue, {
        color: verticalLineColor,
        width: verticalLineWidth,
        dash: verticalLineDash,
      });
    }
  }, [
    variableInputValues,
    verticalLineMode,
    verticalLineValue,
    verticalLineColor,
    verticalLineWidth,
    verticalLineDash,
    visualizationRef,
  ]);

  const handleVerticalLineModeChange = (mode) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        mode: mode,
        value: mode === "off" ? "" : prev?.plotlyVerticalLine?.value || "",
        color: prev?.plotlyVerticalLine?.color || "red",
        width: prev?.plotlyVerticalLine?.width || 2,
        dash: prev?.plotlyVerticalLine?.dash || "solid",
      },
    }));
  };

  const handleVerticalLineValueChange = (value) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        value: value,
      },
    }));

    if (verticalLineMode === "on" && value) {
      let resolvedValue = value;
      if (checkForVariable(value)) {
        const dependentVars = getDependentVariableInputs(value);
        resolvedValue = variableInputValues[dependentVars[0]];

        if (!resolvedValue) return;
      }
      addVerticalLine(visualizationRef, resolvedValue, {
        color: verticalLineColor,
        width: verticalLineWidth,
        dash: verticalLineDash,
      });
    }
  };

  const handleVerticalLineColorChange = (color) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        color: color,
      },
    }));
  };

  const handleVerticalLineWidthChange = (width) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        width: parseInt(width) || 1,
      },
    }));
  };

  const handleVerticalLineDashChange = (dash) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        dash: dash,
      },
    }));
  };

  return (
    <div>
      <div className="mb-3">
        <label className="form-label fw-bold">Vertical Line</label>

        {/* Radio buttons for mode selection */}
        <div className="mb-2">
          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="verticalLineMode"
              id="verticalLineOff"
              checked={verticalLineMode === "off"}
              onChange={() => handleVerticalLineModeChange("off")}
            />
            <label className="form-check-label" htmlFor="verticalLineOff">
              Off
            </label>
          </div>

          <div className="form-check">
            <input
              className="form-check-input"
              type="radio"
              name="verticalLineMode"
              id="verticalLineOn"
              checked={verticalLineMode === "on"}
              onChange={() => handleVerticalLineModeChange("on")}
            />
            <label className="form-check-label" htmlFor="verticalLineOn">
              On
            </label>
          </div>
        </div>

        {/* Conditional inputs when vertical line is on */}
        {verticalLineMode === "on" && (
          <div className="mt-2">
            <div className="mb-3">
              <DatePicker
                label="Date/Time"
                value={verticalLineValue}
                type="date-hour"
                onChange={(e) => handleVerticalLineValueChange(e)}
              />
            </div>

            {/* Styling Options */}
            <div className="row">
              <div className="col-md-4 mb-2">
                <label className="form-label">Color</label>
                <input
                  type="color"
                  className="form-control form-control-color"
                  value={verticalLineColor}
                  onChange={(e) =>
                    handleVerticalLineColorChange(e.target.value)
                  }
                />
              </div>

              <div className="col-md-4 mb-2">
                <label className="form-label">Width</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="10"
                  value={verticalLineWidth}
                  onChange={(e) =>
                    handleVerticalLineWidthChange(e.target.value)
                  }
                />
              </div>

              <div className="col-md-4 mb-2">
                <label className="form-label">Line Style</label>
                <select
                  className="form-select"
                  value={verticalLineDash}
                  onChange={(e) => handleVerticalLineDashChange(e.target.value)}
                >
                  <option value="solid">Solid</option>
                  <option value="dash">Dashed</option>
                  <option value="dot">Dotted</option>
                  <option value="dashdot">Dash-Dot</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

PlotlySettings.propTypes = {
  settings: PropTypes.object,
  setSettings: PropTypes.func.isRequired,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};

export default PlotlySettings;
