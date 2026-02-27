import PropTypes from "prop-types";
import styled from "styled-components";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import {
  useEffect,
  useCallback,
  memo,
  useContext,
  useRef,
  useState,
} from "react";
import {
  checkForVariable,
  convertDatesToLocalISO,
  parseDateMath,
} from "components/inputs/dateUtils";
import {
  VariableInputsContext,
  GridItemContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import { format } from "date-fns";

const Plotly = require("plotly.js-strict-dist-min");
const Plot = createPlotlyComponent(Plotly);

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

// Convert paper-normalized x to axis-relative x using domain
export const paperToAxisNormalized = (xPaper, domain) => {
  if (!Array.isArray(domain) || domain.length !== 2) return xPaper;
  const [d0, d1] = domain;
  if (d1 === d0) return xPaper;
  // Clamp to domain
  let x = (xPaper - d0) / (d1 - d0);
  if (x < 0) x = 0;
  if (x > 1) x = 1;
  return x;
};

// Convert normalized (0-1) x to date using x2 axis range
export const normalizedToDate = (xNorm, x2range) => {
  if (!Array.isArray(x2range) || x2range.length !== 2) return xNorm;
  const [start, end] = x2range;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate) || isNaN(endDate)) return xNorm;
  const ms =
    startDate.getTime() + (endDate.getTime() - startDate.getTime()) * xNorm;
  return new Date(ms);
};

// Helper to snap a date to the nearest step
export const snapDate = (date, step) => {
  const d = new Date(date);
  if (isNaN(d)) return date;

  let snappedDate = d;
  if (step === "minute") {
    const ms = 60 * 1000;
    snappedDate = new Date(Math.round(d.getTime() / ms) * ms);
  } else if (step === "hour") {
    const ms = 60 * 60 * 1000;
    snappedDate = new Date(Math.round(d.getTime() / ms) * ms);
  } else if (step === "day") {
    const hour = d.getHours();
    if (hour >= 12) {
      // If it's afternoon, snap to next day
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      snappedDate = nextDay;
    } else {
      // Otherwise snap to current day
      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      snappedDate = startOfDay;
    }
  } else if (step === "week") {
    // Snap to nearest Sunday (start of week)
    const day = d.getDay();
    const hour = d.getHours();
    if (day >= 3 || (day === 3 && hour >= 12)) {
      // If it's Thursday afternoon or later, snap to next week
      const nextWeek = new Date(d);
      nextWeek.setDate(d.getDate() + (7 - day));
      nextWeek.setHours(0, 0, 0, 0);
      snappedDate = nextWeek;
    } else {
      // Otherwise snap to current week
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - day);
      startOfWeek.setHours(0, 0, 0, 0);
      snappedDate = startOfWeek;
    }
  } else if (step === "month") {
    // Snap to nearest 1st of the month
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    if (day < 16) {
      snappedDate = new Date(year, month, 1);
    } else {
      snappedDate = new Date(year, month + 1, 1);
    }
  } else if (step === "year") {
    // Snap to nearest Jan 1
    const year = d.getFullYear();
    const month = d.getMonth();
    if (month < 6) {
      snappedDate = new Date(year, 0, 1);
    } else {
      snappedDate = new Date(year + 1, 0, 1);
    }
  }
  return convertDatesToLocalISO(snappedDate);
};

export const formatToDate = (value, x2range, verticalLineStep) => {
  if (value < 0) value = 0;
  if (value > 1) value = 1;
  const normalizedDate = normalizedToDate(value, x2range);
  if (value === 0 || value === 1) {
    value = convertDatesToLocalISO(normalizedDate);
  } else {
    value = snapDate(normalizedDate, verticalLineStep);
  }

  return value;
};

export const createVerticalLine = (xValue, options = {}) => {
  const {
    color = "red",
    width = 2,
    dash = "solid",
    id = `vline_${Date.now()}`,
    variable = null,
    editable = false,
  } = options;

  let x;

  // Try to parse any date string while preserving local time
  const d = parseDateMath({ value: xValue });
  if (d) {
    // Extract local time components to avoid timezone conversion
    // Use the local date/time values directly without timezone adjustment
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");
    const milliseconds = String(d.getMilliseconds()).padStart(3, "0");

    // Construct ISO string using local time components
    x = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z`;
  } else {
    // If not a valid date, use the original value
    x = xValue;
  }

  const newShape = {
    editable: editable,
    type: "line",
    x0: x,
    x1: x,
    xref: "x2",
    y0: 0,
    y1: 1,
    yref: "paper",
    line: { color, width, dash },
    layer: "below",
    meta: { id, variable, createdBy: "addVerticalLine" }, // Mark as created by this function
  };

  return newShape;
};

export const shiftVerticalLine = ({
  eventData,
  verticalLineEditable,
  plotElement,
  originalVerticalLine,
  verticalLineStep,
  inDataViewerMode,
  gridItemMetadataString,
  variableInputDateFormats,
  setVariableInputValues,
}) => {
  // Only proceed if shapes were edited
  if (!eventData || !verticalLineEditable) return;

  const verticalLineIdx = plotElement.layout?.shapes?.findIndex(
    (s) => s.meta?.createdBy === "addVerticalLine",
  );

  // if eventData is not numbers then no need to update shift because it already happened
  const varticalLineUpdates = Object.entries(eventData).filter(
    ([key, value]) =>
      (key === `shapes[${verticalLineIdx}].x0` ||
        key === `shapes[${verticalLineIdx}].x1`) &&
      typeof value === "number",
  );
  if (varticalLineUpdates.length === 0) return;

  const verticalLineShape = plotElement.layout?.shapes?.find(
    (s) => s.meta?.createdBy === "addVerticalLine",
  );

  const xaxis2 = plotElement.layout?.xaxis2;
  const x2range = xaxis2?.range;
  const x2domain = xaxis2?.domain;

  // Convert paper-normalized x0/x1 to axis-relative
  let x0Norm =
    typeof verticalLineShape.x0 === "number"
      ? paperToAxisNormalized(verticalLineShape.x0, x2domain)
      : verticalLineShape.x0;
  let x1Norm =
    typeof verticalLineShape.x1 === "number"
      ? paperToAxisNormalized(verticalLineShape.x1, x2domain)
      : verticalLineShape.x1;

  const newX0Value = formatToDate(x0Norm, x2range, verticalLineStep);
  const newX1Value = formatToDate(x1Norm, x2range, verticalLineStep);

  let xValue = newX0Value;
  if (originalVerticalLine) {
    // Compute the difference between new and original for both x0 and x1
    const diff0 = Math.abs(
      new Date(originalVerticalLine.x0).getTime() -
        new Date(newX0Value).getTime(),
    );
    const diff1 = Math.abs(
      new Date(originalVerticalLine.x1).getTime() -
        new Date(newX1Value).getTime(),
    );

    if (diff1 > diff0) {
      xValue = newX1Value;
    }
  }

  const updates = {};
  updates[`shapes[${verticalLineIdx}].x0`] = xValue;
  updates[`shapes[${verticalLineIdx}].x1`] = xValue;

  if (verticalLineShape.y0 !== 0) updates[`shapes[${verticalLineIdx}].y0`] = 0;
  if (verticalLineShape.y1 !== 1) updates[`shapes[${verticalLineIdx}].y1`] = 1;

  // Update the ref to the new values
  if (originalVerticalLine) {
    originalVerticalLine.x0 = xValue;
    originalVerticalLine.x1 = xValue;
  }

  if (!inDataViewerMode) {
    const rawVerticalLineValue = JSON.parse(gridItemMetadataString)
      .plotlyVerticalLine.value;
    const rawVerticalLineVar = checkForVariable(rawVerticalLineValue);

    if (rawVerticalLineVar) {
      const dateFormat = variableInputDateFormats[rawVerticalLineVar];
      setVariableInputValues((prev) => ({
        ...prev,
        [rawVerticalLineVar]: format(new Date(xValue), dateFormat),
      }));
      return; // Skip relayout since variable update will trigger it
    }
  }

  Plotly.relayout(plotElement, updates);
};

const BasePlot = ({
  data,
  layout,
  config,
  visualizationRef,
  metadata = {},
}) => {
  const { width, height, ref } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: 100,
  });
  const { gridItemMetadataString } = useContext(GridItemContext);
  const { setVariableInputValues, variableInputDateFormats } = useContext(
    VariableInputsContext,
  );
  const { inDataViewerMode } = useContext(DataViewerModeContext);
  const { plotlyVerticalLine = {} } = metadata;
  const {
    editable: verticalLineEditable,
    step: verticalLineStep,
    mode: verticalLineMode,
    value: verticalLineValue,
  } = plotlyVerticalLine;
  const [plotLayout, setPlotLayout] = useState({
    ...layout,
    ...{
      width: width,
      height: height,
    },
  });

  // Ref to track the original vertical line shape
  const verticalLineOriginalRef = useRef(null);

  useEffect(() => {
    const plotElement = visualizationRef?.current?.el;
    if (!plotElement) return;

    if (!plotElement.layout) return;

    // remove current vertical line shape if it exists to prevent duplicates
    let currentShapes = plotElement.layout?.shapes || [];
    currentShapes = currentShapes.filter(
      (s) => s.meta?.createdBy !== "addVerticalLine",
    );

    if (verticalLineMode === "on" && verticalLineValue) {
      const verticalLineShape = createVerticalLine(
        verticalLineValue,
        plotlyVerticalLine,
      );
      currentShapes.push(verticalLineShape);
      verticalLineOriginalRef.current = {
        x0: verticalLineShape.x0,
        x1: verticalLineShape.x1,
      };
    }

    setPlotLayout((prevLayout) => ({
      ...prevLayout,
      ...layout,
      ...{
        width: width,
        height: height,
      },
      shapes: currentShapes,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, layout, plotlyVerticalLine]);

  const handleRelayout = useCallback(
    (eventData) => {
      shiftVerticalLine({
        eventData,
        verticalLineEditable,
        plotElement: visualizationRef?.current?.el,
        originalVerticalLine: verticalLineOriginalRef.current,
        verticalLineStep,
        inDataViewerMode,
        gridItemMetadataString,
        variableInputDateFormats,
        setVariableInputValues,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visualizationRef, verticalLineEditable, verticalLineStep],
  );

  return (
    <div ref={ref} style={{ display: "flex", height: "100%" }}>
      <StyledPlot
        ref={visualizationRef}
        data={data}
        layout={plotLayout}
        config={config}
        onRelayout={handleRelayout}
      />
    </div>
  );
};

BasePlot.propTypes = {
  data: PropTypes.array,
  layout: PropTypes.object,
  config: PropTypes.object,
  rowHeight: PropTypes.number,
  colWidth: PropTypes.number,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  metadata: PropTypes.object,
};

export default memo(BasePlot);
