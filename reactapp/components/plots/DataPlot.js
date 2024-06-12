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


const DataPlot = ({rowHeight, colWidth}) => {
  const [ plotData, setPlotData ] = useState(null);
  
  useEffect(() => {
    appAPI.getPlotData()
      .then((data) => {
        // Derived from this example: https://plotly.com/javascript/time-series/#time-series-with-rangeslider
        let traces = [];
        let plot_color;

        for (let series of data.series["storage"]) {
          plot_color = series.title.includes("Storage") ? "rgb(8, 48, 255)" : 
            series.title.includes("Gross Pool") ? "rgb(31, 113, 181)" : 
              series.title.includes("Conservation High") ? "rgb(211, 211, 211)" : 
                series.title.includes("Conservation") && "rgb(146, 197, 222)";

          traces.push({
            type: "scatter",
            mode: series.title.includes("Conservation") ? "lines+markers" : "lines",
            name: series.title,
            x: series.x,
            y: series.y,
            yaxis: "y2",
            legend: "legend2",
            legendgroup: "legend2",
            fill: series.title.includes("Conservation") && "tozeroy",
            fillcolor: plot_color,
            marker: {
              symbol: series.title.includes("Conservation") && "triangle-down",
            },
            line: {
              color: plot_color,
              dash: series.title.includes("Gross Pool") ? "dot" : "solid"
            }
          })
        }
        for (let series of data.series["elevation"]) {
          traces.push({
            type: "scatter",
            mode: "none",
            name: series.title,
            x: series.x,
            y: series.y,
            yaxis: "y4",
            showlegend: false
          })
        }
        for (let series of data.series["flow"]) {
          plot_color = series.title.includes("Inflow") ? "rgb(27, 158, 119)" : 
            series.title.includes("Outflow") && "rgb(217, 95, 2)";

          traces.push({
            type: "scatter",
            mode: "lines",
            name: series.title,
            x: series.x,
            y: series.y,
            line: {
              color: plot_color, 
              dash: plot_color ? "solid" : "dot"
            },
            legend: "legend3",
            legendgroup: "legend3",
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
            autorange: "nonnegative",
            type: 'linear',
            domain: [0, 0.5],
            title: "Flow<br>(cfs)",
          },
          yaxis2: {
            autorange: true,
            domain: [0.5, 1],
            title: "Storage<br>(ac-ft)",
          },
          yaxis4: {
            autorange: true,
            domain: [0.5, 1],
            side: "right",
            overlaying: "y2",
            title: "Elevation<br>(ft)",
          },
          legend: {
            title: "Precipitation",
            xref: "container",
            yref: "container",
            y: .5,
            x: 1.1,
            groupclick: "toggleitem",
            tracegroupgap: 30,
          },
          legend2: {
            title: "Storage",
            groupclick: "toggleitem"
          },
          legend3: {
            title: "Flow",
            groupclick: "toggleitem",
          },
          legend4: {
            title: "SWE",
            groupclick: "toggleitem",
          },
          hovermode: "x",
          hoversubplots: "axis"
        };

        let shapes = [];
        let seriesCount = ("storage" in data.series && "elevation" in data.series) ? 
          Object.keys(data.series).length-1 : Object.keys(data.series).length;
        seriesCount = ("precip" in data.series && "swe" in data.series) ? seriesCount-1 : seriesCount;
        for (let i=1; i < seriesCount; i++) {
          let shapeHeight = i/seriesCount;
          shapes.push({
            type: 'line',
            xref: 'paper',
            yref: 'paper',
            x0: 0,
            x1: 1,
            y0: shapeHeight,
            y1: shapeHeight
          })
        }

        if ("precip" in data.series) {
          layout['yaxis']['domain'] = [0, 0.33]
          layout['yaxis2']['domain'] = [0.33, 0.66]
          layout['yaxis4']['domain'] = [0.33, 0.66]
          layout['yaxis3'] = {
            autorange: "reversed",
            domain: [0.66, 1],
            title: "Precipitation<br>(in)",
          }
          for (let series of data.series["precip"]) {
            traces.push({
              type: "bar",
              name: series.title,
              x: series.x,
              y: series.y,
              yaxis: "y3",
              color: "blue",
              legend: "legend",
              legendgroup: "legend",
            })
          }
        }

        if ("swe" in data.series) {
          layout['yaxis']['domain'] = [0, 0.33]
          layout['yaxis2']['domain'] = [0.33, 0.66]
          layout['yaxis4']['domain'] = [0.33, 0.66]
          layout['yaxis5'] = {
            domain: [0.66, 1],
            title: "SWE<br>(in)",
            side: "right",
          }
          for (let series of data.series["swe"]) {
            traces.push({
              type: "scatter",
              mode: "lines",
              name: series.title,
              x: series.x,
              y: series.y,
              yaxis: "y5",
              fill: "tozeroy",
              fillcolor: "rgb(8, 48, 107)",
              line: {
                color: "rgb(51, 51, 51)",
              },
              legend: "legend4",
              legendgroup: "legend4",
            })
          }
        }

        if ("precip" in data.series && "swe" in data.series) {
          layout['yaxis3']['domain'] = [0.66, 0.83]
          layout['yaxis5']['domain'] = [0.83, 1]
          shapes.push({
            type: 'line',
            xref: 'paper',
            yref: 'paper',
            x0: 0,
            x1: 1,
            y0: 0.83,
            y1: 0.83
          })
        }

        layout['shapes'] = shapes
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


export default memo(DataPlot)