import PropTypes from "prop-types";
import styled from "styled-components";
import Plot from "react-plotly.js";
import { useResizeDetector } from "react-resize-detector";
import { memo } from "react";

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

const BasePlot = ({ plotData }) => {
  const { width, height, ref } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: 100,
  });
  return (
    <div ref={ref} style={{ display: "flex", height: "100%" }}>
      <StyledPlot
        data={plotData.data}
        layout={{
          ...plotData.layout,
          ...{
            width: width,
            height: height,
          },
        }}
        config={plotData.config}
      />
    </div>
  );
};

BasePlot.propTypes = {
  plotData: PropTypes.shape({
    data: PropTypes.array,
    layout: PropTypes.object,
    config: PropTypes.object,
  }),
  rowHeight: PropTypes.number,
  colWidth: PropTypes.number,
};

export default memo(BasePlot);
