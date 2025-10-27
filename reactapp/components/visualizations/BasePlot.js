import PropTypes from "prop-types";
import styled from "styled-components";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import { memo, useEffect } from "react";
import { parseDateMath, checkForVariable } from "components/inputs/DatePicker";

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
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(xValue)) {
      // Format: 'YYYY-MM-DD HH:mm'
      x = xValue.replace(" ", "T") + ":00.000Z";
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(xValue)) {
      // Format: 'YYYY-MM-DD'
      x = xValue + "T00:00:00.000Z";
    } else {
      // Fallback: try Date constructor
      const d = new Date(xValue);
      x = !isNaN(d) ? d.toISOString() : xValue;
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
