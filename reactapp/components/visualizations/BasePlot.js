import PropTypes from "prop-types";
import styled from "styled-components";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import { memo } from "react";

const Plotly = require("plotly.js-strict-dist-min");
const Plot = createPlotlyComponent(Plotly);

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

export const addVerticalLine = (plotRef, xValue, options = {}) => {
  if (!plotRef?.current || !plotRef.current.el) return;

  const {
    color = "red",
    width = 2,
    dash = "solid",
    id = `vline_${Date.now()}`,
    variable = null,
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
      type: "line",
      x0: x,
      x1: x,
      y0: 0,
      y1: 1,
      yref: "paper",
      line: { color, width, dash },
      layer: "below",
      meta: { id, variable, createdBy: "addVerticalLine" }, // Mark as created by this function
    };

    // Filter shapes based on removeExisting option
    const filteredShapes = currentShapes.filter(
      (shape) => shape.meta?.createdBy !== "addVerticalLine"
    );

    Plotly.relayout(plotElement, {
      shapes: [...filteredShapes, newShape],
    });
  } catch (error) {
    console.warn("Failed to add vertical line:", error);
  }
};

const BasePlot = ({ data, layout, config, visualizationRef }) => {
  const { width, height, ref } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: 100,
  });

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
};

export default memo(BasePlot);
