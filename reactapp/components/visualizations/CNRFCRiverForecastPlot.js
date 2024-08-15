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
      showlegend: false,
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
    title: {
      text: data.title,
      font: {
        size: 12,
      },
    },
    responsive: true,
    useResizeHandler: true,
    autosize: true,
    xaxis: {
      type: "date",
      tickformat: "%a<br>%b %d<br>%-I%p",
      linecolor: "lightgray",
      showgrid: true,
      showline: true,
      mirror: true,
      tickfont: {
        size: 8,
      },
      title: {
        text: "<b>Observation / Forecast Time (UTC)</b>",
        font: {
          size: 10,
        },
      },
    },
    yaxis: {
      range: [data.hydro_range_ymin * 0.99, data.hydro_range_ymax * 1.01],
      type: "linear",
      domain: [0, 0.7],
      title: {
        text: "<b>Stage (Feet)</b>",
        font: {
          size: 10,
        },
      },
      tickfont: {
        size: 8,
      },
      nticks: 10,
      linecolor: "lightgray",
      showgrid: true,
      showline: true,
      mirror: true,
    },
    yaxis3: {
      range: [data.forcing_ymin, data.forcing_ymax],
      domain: [0.8, 1],
      title: {
        text: "<b>Rain + Melt (in.)</b>",
        font: {
          size: 10,
        },
      },
      tickfont: {
        size: 8,
      },
      linecolor: "lightgray",
      showgrid: true,
      showline: true,
      mirror: true,
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
    legend: {
      yref: "container",
      yanchor: "top",
      xanchor: "center",
      x: 0.5,
      orientation: "h",
    },
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
