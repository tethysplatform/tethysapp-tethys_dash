import PropTypes from "prop-types";
import { useContext, useEffect, useRef } from "react";
import DatePicker from "components/inputs/DatePicker";
import { VariableInputsContext } from "components/contexts/Contexts";
import { getDependentVariableInputs } from "components/visualizations/utilities";
import { checkForVariable } from "components/inputs/dateUtils";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";
import NormalInput from "components/inputs/NormalInput";
import styled from "styled-components";
import DataSelect from "components/inputs/DataSelect";

const FlexDiv = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const PlotlySettings = ({ settings, setSettings, visualizationRef }) => {
  const { variableInputValues } = useContext(VariableInputsContext);
  const containerRef = useRef();

  const verticalLineMode = settings?.plotlyVerticalLine?.mode || "off";
  const verticalLineValue = settings?.plotlyVerticalLine?.value || "";
  const verticalLineColor =
    settings?.plotlyVerticalLine?.color !== undefined
      ? settings.plotlyVerticalLine.color
      : "#ff0000";
  const verticalLineWidth = settings?.plotlyVerticalLine?.width || 2;
  const verticalLineDash = settings?.plotlyVerticalLine?.dash || "solid";
  const verticalLineStep = settings?.plotlyVerticalLine?.step || "minute";
  const verticalLineEditable = settings?.plotlyVerticalLine?.editable ?? false;

  const handleVerticalLineModeChange = (mode) => {
    if (mode === "off") {
      setSettings((prev) => {
        const { plotlyVerticalLine, ...rest } = prev;
        return { ...rest };
      });
    } else {
      setSettings((prev) => ({
        ...prev,
        plotlyVerticalLine: {
          ...prev?.plotlyVerticalLine,
          mode: mode,
          value: prev?.plotlyVerticalLine?.value || "",
          color: prev?.plotlyVerticalLine?.color || "#ff0000", //red
          width: prev?.plotlyVerticalLine?.width || 2,
          dash: prev?.plotlyVerticalLine?.dash || "solid",
          step: prev?.plotlyVerticalLine?.step || "minute",
          editable: prev?.plotlyVerticalLine?.editable ?? false,
        },
      }));
    }
  };

  const handleVerticalLineValueChange = (value) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        value: value,
      },
    }));

    let resolvedValue = value;
    if (checkForVariable(value)) {
      const dependentVars = getDependentVariableInputs(value);
      resolvedValue = variableInputValues[dependentVars[0]];

      if (!resolvedValue) return;
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
    <div ref={containerRef}>
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
                onChange={(e) => handleVerticalLineValueChange(e)}
              />
            </div>

            {/* Styling Options */}
            <FlexDiv>
              <div>
                <ColorPickerPopover
                  label="Color"
                  color={verticalLineColor}
                  onChange={handleVerticalLineColorChange}
                  containerRef={containerRef}
                />
              </div>
              <div>
                <NormalInput
                  label="Width"
                  onChange={(e) =>
                    handleVerticalLineWidthChange(e.target.value)
                  }
                  value={verticalLineWidth}
                  type="number"
                  ariaLabel="Vertical Line Width"
                  min="1"
                  max="10"
                />
              </div>
              <div>
                <DataSelect
                  label="Line Style"
                  value={verticalLineDash}
                  onChange={handleVerticalLineDashChange}
                  options={[
                    { value: "solid", label: "Solid" },
                    { value: "dash", label: "Dashed" },
                    { value: "dot", label: "Dotted" },
                    { value: "dashdot", label: "Dash-Dot" },
                  ]}
                  ariaLabel="Vertical Line Style"
                  creatable={false}
                />
              </div>
            </FlexDiv>
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
