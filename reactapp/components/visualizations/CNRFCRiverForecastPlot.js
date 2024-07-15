var Plotly = require("plotly.js/lib/core");

export default function getCNRFCRiverForecastPlotInfo(data) {
  let traces = [];
  let plot_color;

  for (let series of data.forcing_series) {
    plot_color = series.title.includes("Observed")
      ? "rgb(25, 25, 255)"
      : "rgb(25, 255, 0)";

    traces.push({
      type: "bar",
      name: series.title,
      x: series.x,
      y: series.y,
      yaxis: "y3",
      fillcolor: plot_color,
      hovertemplate:
        "<i>" + series.title + "</i>: %{y:.2f} inches <extra></extra>",
    });
  }
  for (let series of data.hydro_series) {
    plot_color = series.title.includes("Raw")
      ? "rgb(52, 225, 235)"
      : series.title.includes("Simulated")
        ? "rgb(0, 0, 255)"
        : series.title.includes("Forecast")
          ? "rgb(25, 255, 0)"
          : "rgb(255, 102, 255)";

    traces.push({
      type: "scatter",
      mode: "lines",
      name: series.title,
      x: series.x,
      y: series.y,
      yaxis: "y",
      line: {
        color: plot_color,
      },
      text: series.text,
      hovertemplate: "%{text} <extra></extra>",
    });
  }

  const shapes = [];
  const annotations = [];
  for (let series of data.hydro_thresholds) {
    shapes.push({
      type: "line",
      y0: series.value,
      y1: series.value,
      xref: "paper",
      x0: 0,
      x1: 1,
      line: {
        color: series.color,
        dash: "dot",
      },
    });
    annotations.push({
      showarrow: false,
      text: series.name,
      xref: "paper",
      x: 0,
      xanchor: "left",
      y: series.value,
      yanchor: "bottom",
    });
  }

  shapes.push({
    type: "line",
    x0: data.observed_forecast_split_dt,
    x1: data.observed_forecast_split_dt,
    yref: "paper",
    y0: 0,
    y1: 1,
    line: {
      color: "black",
    },
  });

  let layout = {
    title: data.title,
    responsive: true,
    useResizeHandler: true,
    autosize: true,
    xaxis: {
      rangeselector: {
        buttons: [
          { step: "all" },
          {
            count: 6,
            label: "6m",
            step: "month",
            stepmode: "backward",
          },
          {
            count: 1,
            label: "1m",
            step: "month",
            stepmode: "backward",
          },
          {
            count: 7,
            label: "1w",
            step: "day",
            stepmode: "backward",
          },
          {
            count: 3,
            label: "3d",
            step: "day",
            stepmode: "backward",
          },
          {
            count: 12,
            label: "12h",
            step: "hour",
            stepmode: "backward",
          },
        ],
      },
      type: "date",
      tickformat: "%a<br>%b %d<br>%-I%p<br>UTC",
      tickvals: data.dateticks,
    },
    yaxis: {
      range: [data.hydro_range_ymin, data.hydro_range_ymax],
      type: "linear",
      domain: [0, 0.7],
      title: "Stage<br>(ft)",
      nticks: 10,
    },
    yaxis3: {
      range: [data.forcing_ymin, data.forcing_ymax],
      domain: [0.8, 1],
      title: "Rain + Melt<br>(in)",
    },
    hovermode: "x",
    hoversubplots: "axis",
    images: [
      {
        source: "/static/aquainsight/images/NOAA_chart_bg.jpg",
        xref: "domain",
        yref: "domain",
        x: 0.5,
        y: 0.35,
        sizex: 1,
        sizey: 0.7,
        xanchor: "center",
        yanchor: "middle",
        layer: "below",
      },
    ],
    shapes: shapes,
    annotations: annotations,
  };

  const configOptions = {
    responsive: true,
    modeBarButtons: [
      ["toImage"],
      ["zoom2d", "pan2d", "zoomIn2d", "zoomOut2d"],
      ["autoScale2d", "resetScale2d"],
      ["hoverClosestCartesian", "hoverCompareCartesian"],
    ],
  };

  return {
    traces: traces,
    layout: layout,
    configOptions: configOptions,
  };
}
