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

// Convert normalized (0-1) x to date using x axis range
export const normalizedToDate = (xNorm, xrange) => {
  if (!Array.isArray(xrange) || xrange.length !== 2) return xNorm;
  const [start, end] = xrange;
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
    if (day > 3 || (day === 3 && hour >= 12)) {
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
  } else {
    // If no valid step provided, return original date
    console.warn(
      `Invalid step "${step}" for snapping date. Returning original date.`,
    );
  }
  return convertDatesToLocalISO(snappedDate);
};

export const formatToDate = (value, xrange, verticalLineStep) => {
  if (value < 0) value = 0;
  if (value > 1) value = 1;
  const normalizedDate = normalizedToDate(value, xrange);
  if (value === 0 || value === 1) {
    value = convertDatesToLocalISO(normalizedDate);
  } else {
    value = snapDate(normalizedDate, verticalLineStep);
  }

  return value;
};

const getMainAxisRangeDomain = (plotElement) => {
  let xaxis = plotElement.layout.xaxis;
  if (xaxis.matches) {
    // If we're in a subplot, find the correct xaxis
    const match = xaxis.matches.match(/x(\d*)/);
    const axisNum = match && match[1] ? match[1] : "";
    xaxis = plotElement.layout[`xaxis${axisNum}`] || xaxis;
  }
  const xrange = xaxis?.range;
  const xdomain = xaxis?.domain || [0, 1];

  return { xrange, xdomain };
};

export const createVerticalLine = ({
  xValue,
  plotElement,
  returnOutOfRange = false,
  options = {},
}) => {
  const {
    color = "red",
    width = 2,
    dash = "solid",
    id = `vline_${Date.now()}`,
    variable = null,
    editable = false,
  } = options;

  let xPaper;

  const { xrange, xdomain } = getMainAxisRangeDomain(plotElement);

  if (
    Array.isArray(xrange) &&
    Array.isArray(xdomain) &&
    xrange.length === 2 &&
    xdomain.length === 2
  ) {
    let dateObj = parseDateMath({ value: xValue });
    if (dateObj instanceof Date && !isNaN(dateObj)) {
      // Convert date to ms between range
      const start = new Date(xrange[0]).getTime();
      const end = new Date(xrange[1]).getTime();
      const val = dateObj.getTime();
      // Normalize to 0-1 in axis space
      let xNorm = (val - start) / (end - start);

      if (!returnOutOfRange) {
        if (xNorm < 0) xNorm = 0;
        if (xNorm > 1) xNorm = 1;
      }

      // Convert to paper value using domain
      xPaper = xdomain[0] + (xdomain[1] - xdomain[0]) * xNorm;
    } else if (typeof xValue === "number") {
      // If already a normalized value, map to paper
      xPaper = xdomain[0] + (xdomain[1] - xdomain[0]) * xValue;
    } else {
      // fallback: use 0.5 (center)
      xPaper = 0.5;
    }
  } else {
    // fallback: use 0.5 (center)
    xPaper = 0.5;
  }

  const newShape = {
    editable: editable,
    visible: xPaper < 0 || xPaper > 1 ? false : true, // Hide if out of range
    type: "line",
    x0: xPaper,
    x1: xPaper,
    xref: "paper",
    y0: 0,
    y1: 1,
    yref: "paper",
    line: { color, width, dash },
    layer: "below",
    meta: { id, variable, createdBy: "addVerticalLine" }, // Mark as created by this function
  };

  return newShape;
};

export const handleEventData = ({
  eventData,
  plotElement,
  originalVerticalLine,
  verticalLineStep,
  inDataViewerMode,
  gridItemMetadataString,
  variableInputDateFormats,
  setVariableInputValues,
}) => {
  const verticalLineIdx = plotElement.layout?.shapes?.findIndex(
    (s) => s.meta?.createdBy === "addVerticalLine",
  );

  if (verticalLineIdx === -1) return; // No vertical line to

  const { xrange, xdomain } = getMainAxisRangeDomain(plotElement);

  const varticalLineUpdates = Object.entries(eventData).filter(
    ([key, value]) =>
      (key === `shapes[${verticalLineIdx}].x0` ||
        key === `shapes[${verticalLineIdx}].x1`) &&
      typeof value === "number" &&
      originalVerticalLine &&
      value !== originalVerticalLine.x,
  );

  // If the vertical line was updated, we need to snap it to the nearest step and update the layout
  if (varticalLineUpdates.length > 0) {
    const verticalLineShape = plotElement.layout?.shapes?.find(
      (s) => s.meta?.createdBy === "addVerticalLine",
    );

    let x0Paper = verticalLineShape.x0;
    let x1Paper = verticalLineShape.x1;

    // Convert paper value to axis-normalized (0-1)
    let x0Norm = paperToAxisNormalized(x0Paper, xdomain);
    let x1Norm = paperToAxisNormalized(x1Paper, xdomain);

    let xValue = x0Paper;
    let xDate = x0Norm;

    // Compute the difference between new and original for both x0 and x1
    const diff0 = Math.abs(originalVerticalLine.x - x0Paper);
    const diff1 = Math.abs(originalVerticalLine.x - x1Paper);

    if (diff1 > diff0) {
      xValue = x1Paper;
      xDate = x1Norm;
    }

    // snap paper coordintate to date
    xDate = formatToDate(xDate, xrange, verticalLineStep);
    // convert snapped date back to paper coordinate for display
    xValue = createVerticalLine({ xValue: xDate, plotElement }).x0;

    // Always update the shape in paper coordinates
    const updates = {};
    updates[`shapes[${verticalLineIdx}].x0`] = xValue;
    updates[`shapes[${verticalLineIdx}].x1`] = xValue;

    if (verticalLineShape.y0 !== 0)
      updates[`shapes[${verticalLineIdx}].y0`] = 0;
    if (verticalLineShape.y1 !== 1)
      updates[`shapes[${verticalLineIdx}].y1`] = 1;

    // Update the ref to the new values (paper coordinates)
    originalVerticalLine.x = xValue;
    originalVerticalLine.date = xDate;

    if (!inDataViewerMode) {
      const rawVerticalLineValue = JSON.parse(gridItemMetadataString)
        .plotlyVerticalLine.value;
      const rawVerticalLineVar = checkForVariable(rawVerticalLineValue);

      if (rawVerticalLineVar) {
        const dateFormat = variableInputDateFormats[rawVerticalLineVar];
        setVariableInputValues((prev) => ({
          ...prev,
          [rawVerticalLineVar]: format(new Date(xDate), dateFormat),
        }));
        return; // Skip relayout since variable update will trigger it
      }
    }

    Plotly.relayout(plotElement, updates);
    return;
  }

  // if the range was updated by zooming/panning, we may need to adjust the vertical line to stay in the correct place
  const rangeUpdates = Object.keys(eventData).filter((key) =>
    key.includes(".range"),
  );

  if (rangeUpdates.length > 0) {
    let xValue = createVerticalLine({
      xValue: originalVerticalLine.date,
      plotElement,
      returnOutOfRange: true,
    }).x0;

    // Always update the shape in paper coordinates
    const updates = {};
    if (xValue < 0 || xValue > 1) {
      updates[`shapes[${verticalLineIdx}].visible`] = false;
    } else {
      updates[`shapes[${verticalLineIdx}].visible`] = true;
      updates[`shapes[${verticalLineIdx}].x0`] = xValue;
      updates[`shapes[${verticalLineIdx}].x1`] = xValue;

      originalVerticalLine.x = xValue;
    }

    Plotly.relayout(plotElement, updates);
    return;
  }
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

  // istanbul ignore next - functons tested separately, this is just cleanup
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
      const verticalLineShape = createVerticalLine({
        xValue: verticalLineValue,
        plotElement,
        options: plotlyVerticalLine,
        returnOutOfRange: true,
      });
      currentShapes.push(verticalLineShape);
      verticalLineOriginalRef.current = {
        x: verticalLineShape.x0,
        date: verticalLineValue,
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

  // istanbul ignore next - functons tested separately, this is just cleanup
  const handleRelayout = useCallback(
    (eventData) => {
      handleEventData({
        eventData,
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
    [visualizationRef, verticalLineStep],
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
