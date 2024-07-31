export default function getCNRFCHEFSPlotInfo(data, location) {
  let traces = [];
  let plot_color;

  for (let series of data.deterministic_series) {
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
      name: series.title.includes("Observed")
        ? series.title
        : "Deterministic " + series.title,
      x: series.x,
      y: series.y,
      line: {
        color: plot_color,
      },
      text: series.text,
      hovertemplate: "%{text} <extra></extra>",
      legendgroup: "1",
    });
  }
  for (const seriesName in data.hefs_series) {
    const series = data.hefs_series[seriesName];
    if (seriesName === "ensembles") {
      for (let ensemble of series) {
        traces.push({
          type: "scatter",
          mode: "lines",
          name: "Ensembles",
          x: ensemble.x,
          y: ensemble.y,
          line: {
            color: "gray",
          },
          legendgroup: "1",
          showlegend: ensemble.title === "Ensemble 1" ? true : false,
          hoverinfo: "none",
          visible: "legendonly",
        });
      }
    } else if (seriesName === "hourly_probabilities") {
      for (let prob of series) {
        traces.push({
          type: "scatter",
          mode: "lines",
          fill: "toself",
          fillcolor: prob.color,
          name: prob.title,
          x: prob.x,
          y: prob.y,
          line: {
            width: 0,
          },
          legendgroup: "2",
          hoverinfo: "none",
          showlegend: prob.showlegend,
          legendgrouptitle: series.title !== "Ensemble Mean" && {
            text: "<b>Hourly Probabilities</b>",
          },
        });
      }
    } else {
      traces.push({
        type: "scatter",
        mode: "lines",
        name: series.title,
        x: series.x,
        y: series.y,
        line: {
          color: series.title === "Ensemble Mean" && "green",
          width: series.title !== "Ensemble Mean" && 0,
        },
        showlegend: series.title === "Ensemble Mean" && true,
        text: series.text,
        hovertemplate: "%{text} <extra></extra>",
        legendgroup: "1",
      });
    }
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
        size: 15,
      },
    },
    responsive: true,
    useResizeHandler: true,
    autosize: true,
    xaxis: {
      range: [data.range_xmin, data.range_xmax],
      type: "date",
      tickformat: "%a<br>%b %d<br>%-I%p",
      linecolor: "lightgray",
      showgrid: true,
      showline: true,
      mirror: true,
      nticks: 10,
      title: {
        text: "<b>Observation / Forecast Time (UTC)</b>",
      },
    },
    yaxis: {
      range: [data.range_ymin * 0.95, data.range_ymax * 1.05],
      type: "linear",
      title: {
        text: "<b>Stage (Feet)</b>",
      },
      nticks: 10,
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
