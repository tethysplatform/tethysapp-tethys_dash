import PropTypes from "prop-types";
import styled from "styled-components";
import Plot from "react-plotly.js";
import { memo } from "react";

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

const BasePlot = ({ plotData, rowHeight, colWidth }) => {
  let revision = parseInt(rowHeight.toString() + colWidth.toString());
  return (
    <StyledPlot
      data={plotData.data}
      layout={plotData.layout}
      config={plotData.config}
      useResizeHandler={true}
      revision={revision}
    />
  );
};

BasePlot.propTypes = {
  plotData: PropTypes.shape({
    data: PropTypes.object,
    layout: PropTypes.object,
    config: PropTypes.object,
  }),
  rowHeight: PropTypes.number,
  colWidth: PropTypes.number,
};

export default memo(BasePlot);
