import styled from 'styled-components';
import Plot from 'react-plotly.js';
import appAPI from '../../services/api/app';
import { useEffect, useState, memo } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import getCDECPlotInfo from 'components/plots/CDECPlot'
import getUSACEPlotInfo from 'components/plots/USACEPlot'


const StyledPlot= styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

const StyledSpinner= styled(Spinner)`
  margin: auto;
  display: block;
`;


const BasePlot = ({rowHeight, colWidth, itemData}) => {
  const [ plotData, setPlotData ] = useState(null);
  
  useEffect(() => {
    appAPI.getPlotData(itemData)
      .then((data) => {
        let plotInfo;
        if (itemData['type'] === "CDECPlot") {
          plotInfo = getCDECPlotInfo(data)
        } else if (itemData['type'] === "USACEPlot") {
          plotInfo = getUSACEPlotInfo(data)
        } else {
          throw new Error('Plot type is not configured');
        }

        setPlotData({
          data: plotInfo['traces'],
          layout: plotInfo['layout'],
          config: plotInfo['configOptions'],
        });
      });
  }, []);

  if (!plotData) {
    return (
      <StyledSpinner animation="border" variant="info" />
    );
  } else {
    let revision = parseInt(rowHeight.toString() + colWidth.toString())
    const styledPlot = (
      <StyledPlot data={plotData.data} layout={plotData.layout} config={plotData.config} useResizeHandler={true} revision={revision}/>
    );
    return (
        styledPlot
    )
  }
}


export default memo(BasePlot)