import PropTypes from "prop-types";
import styled from "styled-components";
import createPlotlyComponent from "react-plotly.js/factory";
import { useResizeDetector } from "react-resize-detector";
import {
  useEffect,
  useCallback,
  memo,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  checkForVariable,
  convertDatesToLocalISO,
  parseDateMath,
} from "components/inputs/dateUtils";
import {
  VariableInputsContext,
  GridItemContext,
  DataViewerModeContext,
} from "components/contexts/Contexts";
import { format } from "date-fns";
import {
  derivePanes,
  applySubplotToggle,
} from "components/visualizations/subplotToggle";
import SubplotToggleControl from "components/visualizations/SubplotToggleControl";

const Plotly = require("plotly.js-strict-dist-min");
const Plot = createPlotlyComponent(Plotly);

const EMPTY_VERTICAL_LINE = Object.freeze({});

// --- CSV download modebar button ---------------------------------------------
// Serialize the currently-visible traces of a plotly figure to CSV. Only traces
// the user can actually see are included (legend-hidden traces are skipped),
// matching the "download the data visible to the user" intent.
const csvEscape = (v) => {
  if (v === undefined || v === null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Plotly.py encodes numeric arrays as base64 typed-arrays ({ dtype, bdata });
// plotly.js keeps that raw object on gd.data. Decode it (and handle real
// TypedArrays) so numeric x/y values are not lost in the exported CSV.
const DTYPE_TO_TYPED_ARRAY = {
  f8: Float64Array,
  f4: Float32Array,
  i1: Int8Array,
  i2: Int16Array,
  i4: Int32Array,
  u1: Uint8Array,
  u2: Uint16Array,
  u4: Uint32Array,
};

const decodeTypedArray = (spec) => {
  const Ctor = DTYPE_TO_TYPED_ARRAY[spec.dtype];
  if (!Ctor || typeof spec.bdata !== "string") return [];
  const binary = atob(spec.bdata);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return Array.from(new Ctor(bytes.buffer));
};

const toArray = (v) => {
  if (Array.isArray(v)) return v;
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (v && typeof v === "object" && typeof v.bdata === "string" && v.dtype) {
    return decodeTypedArray(v);
  }
  return [];
};

// Serialize a single table trace (header/cells) to its own CSV section.
const buildTableSection = (t) => {
  const headers = (t.header?.values || []).map((h) =>
    Array.isArray(h) ? h.join(" ") : h,
  );
  const columns = (t.cells?.values || []).map(toArray);
  const rowCount = columns.reduce((m, c) => Math.max(m, c.length), 0);
  const lines = [headers.map(csvEscape).join(",")];
  for (let r = 0; r < rowCount; r++) {
    lines.push(columns.map((c) => csvEscape(c[r])).join(","));
  }
  return lines.join("\n");
};

// Choose a comparator for wide-format row keys (String(x) values): numeric if
// every key is a finite number, else chronological if every key parses as a
// date, else lexicographic. Falling back to lexicographic never throws.
const compareRowKeys = (keys) => {
  const isNumeric = keys.every(
    (k) => k.trim() !== "" && Number.isFinite(Number(k)),
  );
  if (isNumeric) return (a, b) => Number(a) - Number(b);

  const isDate = keys.every((k) => !Number.isNaN(Date.parse(k)));
  if (isDate) return (a, b) => Date.parse(a) - Date.parse(b);

  return (a, b) => (a < b ? -1 : a > b ? 1 : 0);
};

// Serialize the cartesian (non-table) traces. Default is a wide table keyed
// by x, sorted per compareRowKeys. If any trace has a duplicate x value, the
// pivot would silently overwrite points (e.g. fill bands, vertical lines), so
// the whole section instead emits in long format (trace,x,y) preserving every
// point in per-trace order.
const buildCartesianSection = (cartesianTraces) => {
  const names = cartesianTraces.map((t, i) => t.name || `series_${i}`);

  const hasDuplicateX = cartesianTraces.some((t) => {
    const xs = toArray(t.x).map(String);
    return new Set(xs).size !== xs.length;
  });

  if (hasDuplicateX) {
    const lines = ["trace,x,y"];
    cartesianTraces.forEach((t, i) => {
      const xs = toArray(t.x);
      const ys = toArray(t.y);
      xs.forEach((xv, j) => {
        lines.push(
          [csvEscape(names[i]), csvEscape(xv), csvEscape(ys[j])].join(","),
        );
      });
    });
    return lines.join("\n");
  }

  const rowsByX = new Map();
  cartesianTraces.forEach((t, i) => {
    const xs = toArray(t.x);
    const ys = toArray(t.y);
    xs.forEach((xv, j) => {
      const key = String(xv);
      if (!rowsByX.has(key)) rowsByX.set(key, { x: xv });
      rowsByX.get(key)[i] = ys[j];
    });
  });

  const sortedKeys = Array.from(rowsByX.keys()).sort(
    compareRowKeys(Array.from(rowsByX.keys())),
  );
  const header = ["x", ...names];
  const lines = [header.map(csvEscape).join(",")];
  for (const key of sortedKeys) {
    const row = rowsByX.get(key);
    lines.push(
      [
        csvEscape(row.x),
        ...cartesianTraces.map((_, i) => csvEscape(row[i])),
      ].join(","),
    );
  }
  return lines.join("\n");
};

export const buildCsvFromGraphDiv = (gd) => {
  const traces = (gd?.data || []).filter(
    (t) => t && t.visible !== false && t.visible !== "legendonly",
  );
  if (!traces.length) return "";

  // Table traces (e.g. the exceedance table) carry header/cells, not x/y;
  // everything else is treated as cartesian (x/y) data.
  const cartesianTraces = traces.filter((t) => t.type !== "table");
  const tableTraces = traces.filter((t) => t.type === "table");

  const sections = [];
  if (cartesianTraces.length) {
    sections.push(buildCartesianSection(cartesianTraces));
  }
  tableTraces.forEach((t) => sections.push(buildTableSection(t)));

  return sections.join("\n\n");
};

export const downloadCsvFromGraphDiv = (gd) => {
  const csv = buildCsvFromGraphDiv(gd);
  if (!csv) return;
  const rawTitle = gd?.layout?.title?.text || gd?.layout?.title || "plot_data";
  const filename =
    String(rawTitle)
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "plot_data";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const csvDownloadButton = {
  name: "downloadCsv",
  title: "Download data as CSV",
  icon: Plotly.Icons?.disk,
  click: (gd) => downloadCsvFromGraphDiv(gd),
};

const StyledPlot = styled(Plot)`
  width: 100%;
  height: 100%;
  padding: 0;
`;

// Convert paper-normalized x to axis-relative x using domain
export const paperToAxisNormalized = (xPaper, domain) => {
  if (!Array.isArray(domain) || domain.length !== 2) return xPaper;
  const [d0, d1] = domain;
  if (d1 === d0) return xPaper;
  // Clamp to domain
  let x = (xPaper - d0) / (d1 - d0);
  if (x < 0) x = 0;
  if (x > 1) x = 1;
  return x;
};

// Convert normalized (0-1) x to date using x axis range
export const normalizedToDate = (xNorm, xrange) => {
  if (!Array.isArray(xrange) || xrange.length !== 2) return xNorm;
  const [start, end] = xrange;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate) || isNaN(endDate)) return xNorm;
  const ms =
    startDate.getTime() + (endDate.getTime() - startDate.getTime()) * xNorm;
  return new Date(ms);
};

// Helper to snap a date to the nearest step
export const snapDate = (date, step) => {
  const d = new Date(date);
  if (isNaN(d)) return date;

  let snappedDate = d;
  if (step === "minute") {
    const ms = 60 * 1000;
    snappedDate = new Date(Math.round(d.getTime() / ms) * ms);
  } else if (step === "hour") {
    const ms = 60 * 60 * 1000;
    snappedDate = new Date(Math.round(d.getTime() / ms) * ms);
  } else if (step === "day") {
    const hour = d.getHours();
    if (hour >= 12) {
      // If it's afternoon, snap to next day
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      snappedDate = nextDay;
    } else {
      // Otherwise snap to current day
      const startOfDay = new Date(d);
      startOfDay.setHours(0, 0, 0, 0);
      snappedDate = startOfDay;
    }
  } else if (step === "week") {
    // Snap to nearest Sunday (start of week)
    const day = d.getDay();
    const hour = d.getHours();
    if (day > 3 || (day === 3 && hour >= 12)) {
      // If it's Thursday afternoon or later, snap to next week
      const nextWeek = new Date(d);
      nextWeek.setDate(d.getDate() + (7 - day));
      nextWeek.setHours(0, 0, 0, 0);
      snappedDate = nextWeek;
    } else {
      // Otherwise snap to current week
      const startOfWeek = new Date(d);
      startOfWeek.setDate(d.getDate() - day);
      startOfWeek.setHours(0, 0, 0, 0);
      snappedDate = startOfWeek;
    }
  } else if (step === "month") {
    // Snap to nearest 1st of the month
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();
    if (day < 16) {
      snappedDate = new Date(year, month, 1);
    } else {
      snappedDate = new Date(year, month + 1, 1);
    }
  } else if (step === "year") {
    // Snap to nearest Jan 1
    const year = d.getFullYear();
    const month = d.getMonth();
    if (month < 6) {
      snappedDate = new Date(year, 0, 1);
    } else {
      snappedDate = new Date(year + 1, 0, 1);
    }
  } else {
    // If no valid step provided, return original date
    console.warn(
      `Invalid step "${step}" for snapping date. Returning original date.`,
    );
  }
  return convertDatesToLocalISO(snappedDate);
};

export const formatToDate = (value, xrange, verticalLineStep) => {
  if (value < 0) value = 0;
  if (value > 1) value = 1;
  const normalizedDate = normalizedToDate(value, xrange);
  if (value === 0 || value === 1) {
    value = convertDatesToLocalISO(normalizedDate);
  } else {
    value = snapDate(normalizedDate, verticalLineStep);
  }

  return value;
};

const getMainAxisRangeDomain = (plotElement) => {
  let xaxis = plotElement.layout.xaxis;
  if (xaxis.matches) {
    // If we're in a subplot, find the correct xaxis
    const match = xaxis.matches.match(/x(\d*)/);
    const axisNum = match && match[1] ? match[1] : "";
    xaxis = plotElement.layout[`xaxis${axisNum}`] || xaxis;
  }
  const xrange = xaxis?.range;
  const xdomain = xaxis?.domain || [0, 1];

  return { xrange, xdomain };
};

export const createVerticalLine = ({
  xValue,
  plotElement,
  returnOutOfRange = false,
  options = {},
}) => {
  const {
    color = "red",
    width = 2,
    dash = "solid",
    id = `vline_${Date.now()}`,
    variable = null,
    editable = false,
  } = options;

  let xPaper;

  const { xrange, xdomain } = getMainAxisRangeDomain(plotElement);

  if (
    Array.isArray(xrange) &&
    Array.isArray(xdomain) &&
    xrange.length === 2 &&
    xdomain.length === 2
  ) {
    let dateObj = parseDateMath({ value: xValue });
    if (dateObj instanceof Date && !isNaN(dateObj)) {
      // Convert date to ms between range
      const start = new Date(xrange[0]).getTime();
      const end = new Date(xrange[1]).getTime();
      const val = dateObj.getTime();
      // Normalize to 0-1 in axis space
      let xNorm = (val - start) / (end - start);

      if (!returnOutOfRange) {
        if (xNorm < 0) xNorm = 0;
        if (xNorm > 1) xNorm = 1;
      }

      // Convert to paper value using domain
      xPaper = xdomain[0] + (xdomain[1] - xdomain[0]) * xNorm;
    } else if (typeof xValue === "number") {
      // If already a normalized value, map to paper
      xPaper = xdomain[0] + (xdomain[1] - xdomain[0]) * xValue;
    } else {
      // fallback: use 0.5 (center)
      xPaper = 0.5;
    }
  } else {
    // fallback: use 0.5 (center)
    xPaper = 0.5;
  }

  const newShape = {
    editable: editable,
    visible: xPaper < 0 || xPaper > 1 ? false : true, // Hide if out of range
    type: "line",
    x0: xPaper,
    x1: xPaper,
    xref: "paper",
    y0: 0,
    y1: 1,
    yref: "paper",
    line: { color, width, dash },
    layer: "below",
    meta: { id, variable, createdBy: "addVerticalLine" }, // Mark as created by this function
  };

  return newShape;
};

export const handleEventData = ({
  eventData,
  plotElement,
  originalVerticalLine,
  verticalLineStep,
  inDataViewerMode,
  gridItemMetadataString,
  variableInputDateFormats,
  setVariableInputValues,
}) => {
  const verticalLineIdx = plotElement.layout?.shapes?.findIndex(
    (s) => s.meta?.createdBy === "addVerticalLine",
  );

  if (verticalLineIdx === -1) return; // No vertical line to

  const { xrange, xdomain } = getMainAxisRangeDomain(plotElement);

  const varticalLineUpdates = Object.entries(eventData).filter(
    ([key, value]) =>
      (key === `shapes[${verticalLineIdx}].x0` ||
        key === `shapes[${verticalLineIdx}].x1`) &&
      typeof value === "number" &&
      originalVerticalLine &&
      value !== originalVerticalLine.x,
  );

  // If the vertical line was updated, we need to snap it to the nearest step and update the layout
  if (varticalLineUpdates.length > 0) {
    const verticalLineShape = plotElement.layout?.shapes?.find(
      (s) => s.meta?.createdBy === "addVerticalLine",
    );

    let x0Paper = verticalLineShape.x0;
    let x1Paper = verticalLineShape.x1;

    // Convert paper value to axis-normalized (0-1)
    let x0Norm = paperToAxisNormalized(x0Paper, xdomain);
    let x1Norm = paperToAxisNormalized(x1Paper, xdomain);

    let xValue = x0Paper;
    let xDate = x0Norm;

    // Compute the difference between new and original for both x0 and x1
    const diff0 = Math.abs(originalVerticalLine.x - x0Paper);
    const diff1 = Math.abs(originalVerticalLine.x - x1Paper);

    if (diff1 > diff0) {
      xValue = x1Paper;
      xDate = x1Norm;
    }

    // snap paper coordintate to date
    xDate = formatToDate(xDate, xrange, verticalLineStep);
    // convert snapped date back to paper coordinate for display
    xValue = createVerticalLine({ xValue: xDate, plotElement }).x0;

    // Always update the shape in paper coordinates
    const updates = {};
    updates[`shapes[${verticalLineIdx}].x0`] = xValue;
    updates[`shapes[${verticalLineIdx}].x1`] = xValue;

    if (verticalLineShape.y0 !== 0)
      updates[`shapes[${verticalLineIdx}].y0`] = 0;
    if (verticalLineShape.y1 !== 1)
      updates[`shapes[${verticalLineIdx}].y1`] = 1;

    // Update the ref to the new values (paper coordinates)
    originalVerticalLine.x = xValue;
    originalVerticalLine.date = xDate;

    if (!inDataViewerMode) {
      const rawVerticalLineValue = JSON.parse(gridItemMetadataString)
        .plotlyVerticalLine.value;
      const rawVerticalLineVar = checkForVariable(rawVerticalLineValue);

      if (rawVerticalLineVar) {
        const dateFormat = variableInputDateFormats[rawVerticalLineVar];
        setVariableInputValues((prev) => ({
          ...prev,
          [rawVerticalLineVar]: format(new Date(xDate), dateFormat),
        }));
        return; // Skip relayout since variable update will trigger it
      }
    }

    Plotly.relayout(plotElement, updates);
    return;
  }

  // if the range was updated by zooming/panning, we may need to adjust the vertical line to stay in the correct place
  const rangeUpdates = Object.keys(eventData).filter((key) =>
    key.includes(".range"),
  );

  if (rangeUpdates.length > 0) {
    let xValue = createVerticalLine({
      xValue: originalVerticalLine.date,
      plotElement,
      returnOutOfRange: true,
    }).x0;

    // Always update the shape in paper coordinates
    const updates = {};
    if (xValue < 0 || xValue > 1) {
      updates[`shapes[${verticalLineIdx}].visible`] = false;
    } else {
      updates[`shapes[${verticalLineIdx}].visible`] = true;
      updates[`shapes[${verticalLineIdx}].x0`] = xValue;
      updates[`shapes[${verticalLineIdx}].x1`] = xValue;

      originalVerticalLine.x = xValue;
    }

    Plotly.relayout(plotElement, updates);
    return;
  }
};

const BasePlot = ({
  data,
  layout,
  config,
  visualizationRef,
  metadata = {},
}) => {
  const { width, height, ref } = useResizeDetector({
    refreshMode: "debounce",
    refreshRate: 100,
  });
  const { gridItemMetadataString } = useContext(GridItemContext);
  const { setVariableInputValues, variableInputDateFormats } = useContext(
    VariableInputsContext,
  );
  const { inDataViewerMode } = useContext(DataViewerModeContext);
  const plotlyVerticalLine = metadata.plotlyVerticalLine || EMPTY_VERTICAL_LINE;
  const {
    step: verticalLineStep,
    mode: verticalLineMode,
    value: verticalLineValue,
  } = plotlyVerticalLine;

  // --- Subplot show/hide (opt-in via metadata.toggle_subplots) ---
  const subplotToggleEnabled = !!metadata.toggle_subplots;
  const reflowOverride = metadata.subplot_toggle?.reflow;
  const subplotLabels = metadata.subplot_toggle?.labels;

  // Panes are derived from the PRISTINE figure; reflow always recomputes from
  // these originals so toggling stays stateless/idempotent.
  const panes = useMemo(
    () =>
      subplotToggleEnabled
        ? derivePanes(data, layout, { labels: subplotLabels })
        : [],
    [subplotToggleEnabled, data, layout, subplotLabels],
  );
  // Only toggleable panes are offered in the control. Non-toggleable panes
  // (e.g. an unlabeled go.Table footer) stay in `panes` — so they keep their
  // own reserved band and are never grouped with a cartesian pane — but they
  // are always visible and never appear as a checkbox.
  const toggleablePanes = useMemo(
    () => panes.filter((p) => p.toggleable),
    [panes],
  );
  const paneIdsKey = panes.map((p) => p.id).join("|");
  const [visiblePaneIds, setVisiblePaneIds] = useState(() =>
    panes.map((p) => p.id),
  );
  // Reset to all-visible whenever the underlying pane set changes (new data).
  useEffect(() => {
    setVisiblePaneIds(panes.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneIdsKey]);

  const { data: plotData, layout: toggledLayout } = useMemo(
    () =>
      applySubplotToggle(
        data,
        layout,
        subplotToggleEnabled ? visiblePaneIds : null,
        { panes, arrangement: reflowOverride },
      ),
    [data, layout, subplotToggleEnabled, visiblePaneIds, panes, reflowOverride],
  );

  // Vertical-line shapes are computed in the el-gated effect below. Subplot
  // toggle geometry does NOT depend on the plot element, so it is applied here
  // via the memo and therefore survives resize/re-render: the effect re-runs
  // off `toggledLayout`, which already encodes the active toggles.
  const [verticalLineShapes, setVerticalLineShapes] = useState(null);
  const plotLayout = useMemo(() => {
    const merged = { ...toggledLayout, width, height };
    if (verticalLineShapes !== null) merged.shapes = verticalLineShapes;
    return merged;
  }, [toggledLayout, width, height, verticalLineShapes]);

  // Merge the always-on "Download data as CSV" modebar button into the plugin's
  // config (plugins may send no config at all, e.g. geoglows plots).
  const plotConfig = useMemo(() => {
    const base = config || {};
    const existing = Array.isArray(base.modeBarButtonsToAdd)
      ? base.modeBarButtonsToAdd
      : [];
    if (existing.some((b) => b && b.name === csvDownloadButton.name)) {
      return base;
    }
    return { ...base, modeBarButtonsToAdd: [...existing, csvDownloadButton] };
  }, [config]);

  // Ref to track the original vertical line shape
  const verticalLineOriginalRef = useRef(null);

  const handleSubplotToggle = useCallback(
    (paneId, checked) => {
      setVisiblePaneIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(paneId);
        } else {
          // Keep at least one TOGGLEABLE pane visible. Counting only toggleable
          // panes means an always-visible footer (e.g. a go.Table) can't stand
          // in for the last subplot and let every heatmap be hidden.
          const toggleableIds = new Set(toggleablePanes.map((p) => p.id));
          const visibleToggleable = prev.filter((id) => toggleableIds.has(id));
          if (visibleToggleable.length <= 1) return prev;
          next.delete(paneId);
        }
        return panes.map((p) => p.id).filter((id) => next.has(id));
      });
    },
    [panes, toggleablePanes],
  );

  // istanbul ignore next - functons tested separately, this is just cleanup
  useEffect(() => {
    const plotElement = visualizationRef?.current?.el;
    if (!plotElement) return;

    if (!plotElement.layout) return;

    // Seed from the toggle-aware shapes (so subplot show/hide visibility is
    // preserved) and strip any prior vertical line to prevent duplicates.
    // `.filter` returns a fresh array, so the subsequent push never mutates
    // `toggledLayout`.
    let currentShapes = (toggledLayout.shapes || []).filter(
      (s) => s.meta?.createdBy !== "addVerticalLine",
    );

    if (verticalLineMode === "on" && verticalLineValue) {
      // The substituted `verticalLineValue` arrives in its source
      // variable's date format (e.g., a slider's outputFormat such as
      // "MM/dd/yyyy'T'HH:mm"). `createVerticalLine`'s internal
      // `parseDateMath` is called without a format hint and so cannot
      // parse non-ISO strings — without this pre-resolution the value
      // fails to parse, `xPaper` falls back to 0.5, and the line
      // snaps to the middle of the plot every time the variable
      // changes (e.g., on every slider move). Look up the source
      // variable's registered format and pre-parse here so
      // createVerticalLine receives a Date that its top-of-function
      // short-circuit accepts unchanged.
      let xValueResolved = verticalLineValue;
      try {
        const rawValue = JSON.parse(gridItemMetadataString)?.plotlyVerticalLine
          ?.value;
        const sourceVar = checkForVariable(rawValue);
        const dateFormat = sourceVar
          ? variableInputDateFormats?.[sourceVar]
          : null;
        if (dateFormat) {
          const parsed = parseDateMath({
            value: verticalLineValue,
            dateFormat,
          });
          if (parsed instanceof Date && !isNaN(parsed)) {
            xValueResolved = parsed;
          }
        }
      } catch {
        // Malformed metadata string — fall back to the raw value and let
        // createVerticalLine's existing fallback handle it.
      }
      const verticalLineShape = createVerticalLine({
        xValue: xValueResolved,
        plotElement,
        options: plotlyVerticalLine,
        returnOutOfRange: true,
      });
      currentShapes.push(verticalLineShape);
      verticalLineOriginalRef.current = {
        x: verticalLineShape.x0,
        date: verticalLineValue,
      };
    }

    setVerticalLineShapes(currentShapes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    width,
    height,
    toggledLayout,
    plotlyVerticalLine,
    gridItemMetadataString,
    variableInputDateFormats,
  ]);

  // istanbul ignore next - functons tested separately, this is just cleanup
  const handleRelayout = useCallback(
    (eventData) => {
      handleEventData({
        eventData,
        plotElement: visualizationRef?.current?.el,
        originalVerticalLine: verticalLineOriginalRef.current,
        verticalLineStep,
        inDataViewerMode,
        gridItemMetadataString,
        variableInputDateFormats,
        setVariableInputValues,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visualizationRef, verticalLineStep],
  );

  return (
    <div
      ref={ref}
      style={{ display: "flex", height: "100%", position: "relative" }}
    >
      <StyledPlot
        ref={visualizationRef}
        data={plotData}
        layout={plotLayout}
        config={plotConfig}
        onRelayout={handleRelayout}
      />
      {subplotToggleEnabled && (
        <SubplotToggleControl
          panes={toggleablePanes}
          visiblePaneIds={visiblePaneIds}
          onToggle={handleSubplotToggle}
        />
      )}
    </div>
  );
};

BasePlot.propTypes = {
  data: PropTypes.array,
  layout: PropTypes.object,
  config: PropTypes.object,
  rowHeight: PropTypes.number,
  colWidth: PropTypes.number,
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
  metadata: PropTypes.object,
};

export default memo(BasePlot);
