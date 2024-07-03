function getCDECPlotInfo(data) {
  let traces = [];
  for (let series of data.series) {
    traces.push({
      type: "scatter",
      mode: "lines",
      name: series.title,
      x: series.x,
      y: series.y,
      yaxis: series.title.includes("STORAGE") ? "y1" : "y2",
    });
  }

  let layout = {
    title: data.title,
    responsive: true,
    useResizeHandler: true,
    autosize: true,
    xaxis: {
      autorange: true,
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
    },
    yaxis: {
      autorange: true,
      type: "linear",
      title: "Storage<br>(ac-ft)",
    },
    yaxis2: {
      autorange: true,
      type: "linear",
      side: "right",
      overlaying: "y1",
      title: "Elevation<br>(ft)",
    },
    legend: {
      title: "Precipitation",
      xref: "container",
      yref: "container",
      y: 0.5,
      x: 1.1,
    },
    hovermode: "x",
    hoversubplots: "axis",
  };

  const configOptions = {
    responsive: true,
    modeBarButtonsToRemove: ["lasso2d", "select2d", "autoScale2d"],
    modeBarButtonsToAdd: ["hoverClosestCartesian", "hoverCompareCartesian"],
  };

  return {
    traces: traces,
    layout: layout,
    configOptions: configOptions,
  };
}

export default getCDECPlotInfo;
