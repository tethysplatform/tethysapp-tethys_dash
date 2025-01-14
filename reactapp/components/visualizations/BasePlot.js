import PropTypes from "prop-types";
import styled from "styled-components";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import { memo } from "react";
import useConditionalChecks from "hooks/useConditionalChecks";

const Plotly = require("plotly.js-cartesian-dist-min");
const Plot = createPlotlyComponent(Plotly);

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

const StyledErrorDiv = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const BasePlot = ({ plotData, visualizationRef, customErrors }) => {
  const { width, height, ref } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: 100,
  });
  const { passed, resultMessages } = useConditionalChecks(customErrors);

  return (
    passed ? (
      <div ref={ref} style={{ display: "flex", height: "100%" }}>
        <StyledPlot
          ref={visualizationRef}
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
    ) : (
      // These will only show if the useConditionalChecks hook finds any failures
      // It will then map through all of the possible errors that occured.
      resultMessages.map((message, messageIndex) => (
        <StyledErrorDiv key={messageIndex}>
          <h2>{message}</h2>
        </StyledErrorDiv>
      ))
    )
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
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  customErrors: PropTypes.arrayOf(
    PropTypes.shape({
      variableName: PropTypes.string,
      operator: PropTypes.string,
      comparison: PropTypes.string,
      resultMessage: PropTypes.string,
    })
  ),
};

export default memo(BasePlot);
