import PropTypes from "prop-types";
import { useRef } from "react";
import DatePicker from "components/inputs/DatePicker";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";
import NormalInput from "components/inputs/NormalInput";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import CheckboxInput from "components/inputs/CheckboxInput";
import styled from "styled-components";
import DataSelect from "components/inputs/DataSelect";
import { findSelectOptionByValue } from "components/visualizations/utilities";

const FlexDiv = styled.div`
  display: flex;
  column-gap: 1rem;
  flex-wrap: wrap;
`;

const IndentedDiv = styled.div`
  margin-left: 1rem;
  padding-left: 1rem;
`;

const PaddedDiv = styled.div`
  padding-bottom: 0.5rem;
`;

const lineDashOptions = [
  { value: "solid", label: "Solid" },
  { value: "dash", label: "Dashed" },
  { value: "dot", label: "Dotted" },
  { value: "dashdot", label: "Dash-Dot" },
];

const snapOptions = [
  { value: "minute", label: "Minute" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const PlotlySettings = ({ settings, setSettings }) => {
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

  const handleVerticalLineEditableChange = (checked) => {
    setSettings((prev) => {
      const { plotlyVerticalLine } = prev;
      const { editable, step, ...lineSettings } = plotlyVerticalLine;
      if (!checked) {
        return {
          ...prev,
          plotlyVerticalLine: {
            ...lineSettings,
          },
        };
      }

      return {
        ...prev,
        plotlyVerticalLine: { ...lineSettings, editable: true },
      };
    });
  };

  const handleVerticalLineStepChange = (stepOption) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        step: stepOption.value,
      },
    }));
  };

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

  const handleVerticalLineDashChange = (dashOption) => {
    setSettings((prev) => ({
      ...prev,
      plotlyVerticalLine: {
        ...prev?.plotlyVerticalLine,
        dash: dashOption.value,
      },
    }));
  };

  return (
    <div ref={containerRef}>
      <FlexDiv>
        <b>Vertical Line:</b>
        <DataRadioSelect
          radioOptions={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
          ]}
          selectedRadio={verticalLineMode}
          onChange={handleVerticalLineModeChange}
          divProps={{ style: { width: "auto", paddingBottom: 0 } }}
        />
      </FlexDiv>
      <IndentedDiv>
        {verticalLineMode === "on" && (
          <div>
            <PaddedDiv>
              <DatePicker
                label="Date/Time"
                value={verticalLineValue}
                onChange={handleVerticalLineValueChange}
              />
            </PaddedDiv>
            <FlexDiv>
              <div>
                <ColorPickerPopover
                  label="Color"
                  color={verticalLineColor}
                  onChange={handleVerticalLineColorChange}
                  containerRef={containerRef}
                  divProps={{ style: { flexDirection: "column" } }}
                />
              </div>
              <div>
                <NormalInput
                  label="Width"
                  labelProps={{ style: { marginBottom: 0 } }}
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
                  value={findSelectOptionByValue(
                    lineDashOptions,
                    verticalLineDash,
                  )}
                  onChange={handleVerticalLineDashChange}
                  options={lineDashOptions}
                  ariaLabel="Vertical Line Style"
                  creatable={false}
                />
              </div>
              <div>
                <CheckboxInput
                  label="Draggable"
                  value={verticalLineEditable}
                  onChange={handleVerticalLineEditableChange}
                  divProps={{ style: { flexDirection: "column" } }}
                />
              </div>
              {verticalLineEditable && (
                <div>
                  <DataSelect
                    label="Snap to"
                    value={findSelectOptionByValue(
                      snapOptions,
                      verticalLineStep,
                    )}
                    onChange={handleVerticalLineStepChange}
                    options={snapOptions}
                    creatable={false}
                  />
                </div>
              )}
            </FlexDiv>
          </div>
        )}
      </IndentedDiv>
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
