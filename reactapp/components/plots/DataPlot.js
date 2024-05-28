import styled from 'styled-components';
import Plot from 'react-plotly.js';
import appAPI from '../../services/api/app';
import { useEffect, useState, memo } from 'react';
import LoadingAnimation from 'components/loader/LoadingAnimation';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';


const StyledPlot= styled(Plot)`
  width: 100%;
  height: 100%
`;


const DataPlot = () => {    
  const dashboardContext = useSelectedDashboardContext()[0];
  const [ plotData, setPlotData ] = useState(null);

  useEffect(() => {
    appAPI.getPlotData()
      .then((data) => {
        // Derived from this example: https://plotly.com/javascript/time-series/#time-series-with-rangeslider
        let traces = [];
        for (let series of data.series) {
          traces.push({
            type: "scatter",
            mode: "lines",
            name: "Testing",
            x: series.x,
            y: series.y,
          })
        }

        let layout = {
          title: 'Time Series ',
          responsive: true,
          useResizeHandler: true,
          autosize: true,
          xaxis: {
            autorange: true,
            range: ['2015-02-17', '2017-02-16'],
            rangeselector: {buttons: [
                {
                  count: 1,
                  label: '1m',
                  step: 'month',
                  stepmode: 'backward'
                },
                {
                  count: 6,
                  label: '6m',
                  step: 'month',
                  stepmode: 'backward'
                },
                {step: 'all'}
              ]},
            rangeslider: {range: ['2015-02-17', '2017-02-16']},
            type: 'date'
          },
          yaxis: {
            autorange: true,
            range: [86.8700008333, 138.870004167],
            type: 'linear'
          }
        };

        const config = {responsive: true}

        setPlotData({
          data: traces,
          layout: layout,
          config: config
        });
      });
  }, []);

  if (!plotData) {
    return (
      <LoadingAnimation />
    );
  } else {
    const styledPlot = (
      <StyledPlot data={plotData.data} layout={plotData.layout} config={plotData.config} useResizeHandler={true} revision={dashboardContext['name']}/>
    );
    return (
        styledPlot
    )
  }
}


export default memo(DataPlot)