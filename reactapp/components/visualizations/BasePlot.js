import PropTypes from "prop-types";
import styled from "styled-components";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import { useEffect, useCallback, memo } from "react";
import { convertDatesToLocalISO } from "components/inputs/dateUtils";

const Plotly = require("plotly.js-strict-dist-min");
const Plot = createPlotlyComponent(Plotly);

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

// Convert normalized (0-1) x to date using x2 axis range
const normalizedToDate = (xNorm, x2range) => {
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
const snapDate = (date, step) => {
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
    const ms = 24 * 60 * 60 * 1000;
    snappedDate = new Date(Math.round(d.getTime() / ms) * ms);
  } else if (step === "week") {
    // Snap to nearest Sunday (start of week)
    const day = d.getDay();
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);
    const ms = 7 * 24 * 60 * 60 * 1000;
    snappedDate = new Date(Math.round(startOfWeek.getTime() / ms) * ms);
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

export const addVerticalLine = (plotRef, xValue, options = {}) => {
  if (!plotRef?.current || !plotRef.current.el) return;

  const {
    color = "red",
    width = 2,
    dash = "solid",
    id = `vline_${Date.now()}`,
    variable = null,
    editable = true,
  } = options;

  try {
    // Access the actual Plotly plot object
    const plotElement = plotRef.current.el;
    const currentShapes = plotElement.layout?.shapes || [];
    let x;

    // Try to parse any date string while preserving local time
    try {
      const d = new Date(xValue);
      if (!isNaN(d)) {
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
    } catch (error) {
      // If parsing fails, use the original value
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

    // Filter shapes based on removeExisting option
    const filteredShapes = currentShapes.filter(
      (shape) => shape.meta?.createdBy !== "addVerticalLine",
    );

    Plotly.relayout(plotElement, {
      shapes: [...filteredShapes, newShape],
    });
  } catch (error) {
    console.warn("Failed to add vertical line:", error);
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
  const { verticalLineEditable = true, verticalLineStep = "minute" } = metadata;

  // Handler to restrict vertical line movement to x-direction only and snap to step
  // TODO: what if this isnt a date?
  const handleRelayout = useCallback(
    (eventData) => {
      // Only proceed if shapes were edited
      if (!eventData || !verticalLineEditable) return;
      const plotElement = visualizationRef?.current?.el;
      if (!plotElement) return;
      const updates = {};
      // Snap x0/x1 if changed
      Object.keys(eventData).forEach((key) => {
        const xMatch = key.match(/^shapes\[(\d+)\]\.(x0|x1)$/);
        if (xMatch && verticalLineStep) {
          const shapeIdx = parseInt(xMatch[1], 10);
          const shape = plotElement.layout?.shapes?.[shapeIdx];
          if (shape) {
            let newX = eventData[`shapes[${shapeIdx}].x0`];
            if (newX === undefined) newX = eventData[`shapes[${shapeIdx}].x1`];
            // If newX is a number between 0 and 1, treat as normalized and convert to date
            if (typeof newX === "number" && newX >= 0 && newX <= 1) {
              // Get x2 axis range
              const x2range = plotElement.layout?.xaxis2?.range;
              newX = normalizedToDate(newX, x2range);
            }
            const snapped = snapDate(newX, verticalLineStep);
            // Only update if snapped value differs from current
            if (shape.x0 !== snapped || shape.x1 !== snapped) {
              updates[`shapes[${shapeIdx}].x0`] = snapped;
              updates[`shapes[${shapeIdx}].x1`] = snapped;
            }
          }
        }
        // Snap y0/y1 to 0/1 as before
        const yMatch = key.match(/^shapes\[(\d+)\]\.(y0|y1)$/);
        if (yMatch) {
          const shapeIdx = parseInt(yMatch[1], 10);
          const shape = plotElement.layout?.shapes?.[shapeIdx];
          if (shape && shape.yref === "paper") {
            if (shape.y0 !== 0) updates[`shapes[${shapeIdx}].y0`] = 0;
            if (shape.y1 !== 1) updates[`shapes[${shapeIdx}].y1`] = 1;
          }
        }
      });
      if (Object.keys(updates).length > 0) {
        Plotly.relayout(plotElement, updates);
      }
    },
    [visualizationRef, verticalLineEditable, verticalLineStep],
  );

  return (
    <div ref={ref} style={{ display: "flex", height: "100%" }}>
      <StyledPlot
        ref={visualizationRef}
        data={data}
        layout={{
          ...layout,
          ...{
            width: width,
            height: height,
          },
        }}
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
