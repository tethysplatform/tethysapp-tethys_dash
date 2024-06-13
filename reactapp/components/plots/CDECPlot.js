import styled from 'styled-components';
import Plot from 'react-plotly.js';
import appAPI from '../../services/api/app';
import { useEffect, useState, memo } from 'react';
import LoadingAnimation from 'components/loader/LoadingAnimation';


const StyledPlot= styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;


const CDECPlot = ({rowHeight, colWidth, itemData}) => {
  const [ plotData, setPlotData ] = useState(null);
  
  useEffect(() => {
    appAPI.getPlotData(itemData)
      .then((data) => {
        // Derived from this example: https://plotly.com/javascript/time-series/#time-series-with-rangeslider
        let traces = [];
        for (let series of data.series) {
          traces.push({
            type: "scatter",
            mode: "lines",
            name: series.title,
            x: series.x,
            y: series.y,
            yaxis: series.title.includes("STORAGE") ? "y1" : "y2"
          })
        }

        let layout = {
          title: data.title,
          responsive: true,
          useResizeHandler: true,
          autosize: true,
          xaxis: {
            autorange: true,
            rangeselector: {buttons: [
                {step: 'all'},
                {
                  count: 6,
                  label: '6m',
                  step: 'month',
                  stepmode: 'backward'
                },{
                  count: 1,
                  label: '1m',
                  step: 'month',
                  stepmode: 'backward'
                },{
                  count: 7,
                  label: '1w',
                  step: 'day',
                  stepmode: 'backward'
                },{
                  count: 3,
                  label: '3d',
                  step: 'day',
                  stepmode: 'backward'
                },{
                  count: 12,
                  label: '12h',
                  step: 'hour',
                  stepmode: 'backward'
                }
              ]},
            type: 'date'
          },
          yaxis: {
            autorange: true,
            type: 'linear',
            title: "Storage<br>(ac-ft)",
          },
          yaxis2: {
            autorange: true,
            type: 'linear',
            side: "right",
            overlaying: "y1",
            title: "Elevation<br>(ft)",
          },
          legend: {
            title: "Precipitation",
            xref: "container",
            yref: "container",
            y: .5,
            x: 1.1,
          },
          hovermode: "x",
          hoversubplots: "axis"
        };

        const configOptions = {
          responsive: true,
          modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
          modeBarButtonsToAdd: ['hoverClosestCartesian', 'hoverCompareCartesian']
        }

        setPlotData({
          data: traces,
          layout: layout,
          config: configOptions,
        });
      });
  }, []);

  if (!plotData) {
    return (
      <LoadingAnimation />
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


export default memo(CDECPlot)