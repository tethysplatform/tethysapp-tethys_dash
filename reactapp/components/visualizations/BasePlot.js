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
import { format, parseISO } from "date-fns";
import {
  derivePanes,
  applySubplotToggle,
} from "components/visualizations/subplotToggle";
import SubplotToggleControl from "components/visualizations/SubplotToggleControl";
import { csvDownloadButton } from "components/visualizations/csvExport";

const Plotly = require("plotly.js-strict-dist-min");
const Plot = createPlotlyComponent(Plotly);

const EMPTY_VERTICAL_LINE = Object.freeze({});

const StyledPlot = styled(Plot)`
  padding: 0;
  /* Fills the tile normally. Where a minimum is in play and the tile is
     smaller, the plot takes that explicit size instead and ScrollBox
     scrolls it -- 100% would clamp it back to the tile and there would
     be nothing to scroll. */
  width: ${({ $width }) => ($width ? `${$width}px` : "100%")};
  height: ${({ $height }) => ($height ? `${$height}px` : "100%")};
  flex: ${({ $height, $width }) =>
    $height || $width ? "0 0 auto" : "1 1 auto"};
`;

/* The measured element, and the scroll container. Measuring here rather
   than on the outer box matters twice over: ResizeObserver reports the
   content box, so `width` already excludes any scrollbar, and the height
   stays the tile's however tall the figure grows -- overflow scrolls it
   rather than growing this box, so there is no resize feedback loop. */
const ScrollBox = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  overflow-y: ${({ $scrollsY }) => ($scrollsY ? "auto" : "visible")};
  /* Hidden rather than visible by default: a plot is otherwise fitted to
     the measured width and must never produce a horizontal scrollbar. */
  overflow-x: ${({ $scrollsX }) => ($scrollsX ? "auto" : "hidden")};
`;

// Plotly reports a position on a date axis as a string with no zone, such as
// "2026-06-12 16:11:23.4567" -- or "2026-06-12_16:11:23.4567" from a drag,
// its shape editor swapping the space for "_" -- and draws it as wall-clock
// time. parseISO reads it the same way, as local time.
const plotlyDateToMs = (value) =>
  parseISO(String(value).replace("_", " ")).getTime();

// A date in Plotly's own form, wall-clock time with no zone. The line has to
// be given its time this way: Plotly draws a date string with an offset, but
// its shape editor cannot read one back, and a drag then loses the line.
const toPlotlyDate = (date) => format(date, "yyyy-MM-dd HH:mm:ss");

// A date's position on Plotly's own scale, where a date string is its
// wall-clock time with any offset discarded, read as if UTC, and a bare
// number is milliseconds. NaN for anything that is not a date. Trace data
// arrives as JSON, so a date is never a Date object here.
const wallClockMs = (value) => {
  if (typeof value === "number") return value;
  const d = parseISO(
    String(value).replace(/(:\d\d(?:\.\d+)?)(?:Z|[+-]\d\d(?::?\d\d)?)$/i, "$1"),
  );
  return Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
};

// The [min, max] of the data on the line's x axis, "x" and any axis sharing
// its range through `matches`, on wallClockMs's scale -- or null when Plotly
// does not autorange that axis, or there is no data to measure.
const autorangedLineAxisExtent = (data, layout) => {
  const matched = layout.xaxis?.matches;
  const axis = (matched && layout[`xaxis${matched.slice(1)}`]) || layout.xaxis;
  // Plotly autoranges an axis unless it is given a range and not also told
  // to autorange.
  const autoranged =
    axis?.autorange === undefined
      ? !Array.isArray(axis?.range)
      : axis.autorange !== false;
  if (!autoranged) return null;

  const group = new Set(matched ? ["x", matched] : ["x"]);
  for (const [key, other] of Object.entries(layout)) {
    const id = key.match(/^xaxis(\d*)$/);
    if (id && group.has(other?.matches)) group.add(`x${id[1]}`);
  }
  let min = Infinity;
  let max = -Infinity;
  for (const trace of data) {
    if (trace.visible === false || trace.visible === "legendonly") continue;
    if (!group.has(trace.xaxis || "x") || !Array.isArray(trace.x)) continue;
    for (const x of trace.x) {
      const ms = wallClockMs(x);
      if (ms < min) min = ms;
      if (ms > max) max = ms;
    }
  }
  return min <= max ? [min, max] : null;
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

// The line is anchored to the x axis's data rather than the paper, so Plotly
// places it and keeps it there through zooms and pans. On an axis with a set
// range, such as one the plugin pinned or the user zoomed, a line outside the
// range is clipped; on an autoranged axis it would count toward the
// autorange like a trace does and stretch the axis, so BasePlot hides it
// while it is outside the data. Its time goes in as local wall-clock time
// with no zone (see toPlotlyDate), which is how Plotly draws every date on
// the axis, the plugin's range included: it discards any offset it is given.
// The line is for date axes; on any other axis Plotly cannot place it.
// Returns null when the value cannot be read as a date: no line is better
// than one drawn somewhere arbitrary.
export const createVerticalLine = ({ xValue, options = {} }) => {
  const {
    color = "red",
    width = 2,
    dash = "solid",
    id = `vline_${Date.now()}`,
    variable = null,
    editable = false,
  } = options;

  const date = parseDateMath({ value: xValue });
  if (!(date instanceof Date) || isNaN(date)) return null;
  const x = toPlotlyDate(date);

  return {
    editable: editable,
    type: "line",
    x0: x,
    x1: x,
    xref: "x",
    y0: 0,
    y1: 1,
    yref: "paper",
    line: { color, width, dash },
    layer: "below",
    meta: { id, variable, createdBy: "addVerticalLine" }, // Mark as created by this function
  };
};

// Snaps a dragged vertical line to the nearest step, back to the full plot
// height, and publishes its new time to the variable it is tied to. Zooms and
// pans need nothing: the line is anchored to the data. `lastLineX` is where
// the line was last placed, which tells which end of it was dragged.
// `lineVariable` is the variable the line is tied to, `{name, dateFormat}`,
// or null. Returns where the line was snapped to, or null when nothing was
// dragged.
export const handleEventData = ({
  eventData,
  plotElement,
  lastLineX,
  verticalLineStep,
  inDataViewerMode,
  lineVariable,
  setVariableInputValues,
}) => {
  const shapes = plotElement?.layout?.shapes ?? [];
  const lineIdx = shapes.findIndex(
    (s) => s.meta?.createdBy === "addVerticalLine",
  );
  if (lineIdx === -1) return null;
  const key = (prop) => `shapes[${lineIdx}].${prop}`;
  if (!["x0", "x1", "y0", "y1"].some((prop) => key(prop) in eventData)) {
    return null;
  }

  const line = shapes[lineIdx];
  const last = plotlyDateToMs(lastLineX);
  const x0 = plotlyDateToMs(line.x0);
  const x1 = plotlyDateToMs(line.x1);
  // Dragging the line moves both ends; dragging an end moves only that one.
  const moved = Math.abs(x1 - last) > Math.abs(x0 - last) ? x1 : x0;
  if (Number.isNaN(moved)) return null; // not on a date axis
  const snapped = toPlotlyDate(
    parseISO(snapDate(new Date(moved), verticalLineStep)),
  );
  const snappedMs = plotlyDateToMs(snapped);

  // Still where it was last placed: the echo of an earlier snap.
  if (
    snappedMs === last &&
    x0 === last &&
    x1 === last &&
    line.y0 === 0 &&
    line.y1 === 1
  ) {
    return null;
  }

  const updates = { [key("x0")]: snapped, [key("x1")]: snapped };
  if (line.y0 !== 0) updates[key("y0")] = 0;
  if (line.y1 !== 1) updates[key("y1")] = 1;
  Plotly.relayout(plotElement, updates);

  if (!inDataViewerMode && lineVariable) {
    const { name, dateFormat } = lineVariable;
    setVariableInputValues((prev) => ({
      ...prev,
      [name]: dateFormat ? format(parseISO(snapped), dateFormat) : snapped,
    }));
  }
  return snapped;
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
    // The line editor shows "minute" until another step is picked, and
    // saves nothing for it until then.
    step: verticalLineStep = "minute",
    mode: verticalLineMode,
    value: verticalLineValue,
  } = plotlyVerticalLine;

  // --- Minimum plot size (opt-in via metadata.min_plot_height/width) ---
  // A plot is otherwise sized to its tile, whatever the figure asked for,
  // so a tall stack of subplots in a short tile leaves each one a sliver,
  // and a long time axis in a narrow one becomes unreadable. Given a
  // floor, the plot keeps that size and the tile scrolls. Prefer trimming
  // what is drawn -- see the subplot toggles below -- and reach for these
  // when everything has to stay on screen at a readable size. Ignored
  // until the tile has been measured, and whenever the tile is already at
  // least that big, so nothing scrolls that need not.
  //
  // The two axes interact: a scrollbar on one takes space from the other's
  // content box, which is what ResizeObserver reports here. That settles
  // rather than oscillating, because a scrollbar only ever shrinks the
  // other axis and shrinking can only switch scrolling on, never off.
  const floorOf = (value) => (Number(value) > 0 ? Number(value) : 0);
  const minPlotHeight = floorOf(metadata.min_plot_height);
  const minPlotWidth = floorOf(metadata.min_plot_width);
  const scrollsY = minPlotHeight > 0 && height > 0 && height < minPlotHeight;
  const scrollsX = minPlotWidth > 0 && width > 0 && width < minPlotWidth;
  const plotHeight = scrollsY ? minPlotHeight : height;
  const plotWidth = scrollsX ? minPlotWidth : width;

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

  // The variable the line is tied to, named in the raw (unsubstituted)
  // metadata, with the date format its values arrive in, e.g. a slider's
  // outputFormat such as "MM/dd/yyyy'T'HH:mm".
  const lineVariable = useMemo(() => {
    let name = null;
    try {
      name = checkForVariable(
        JSON.parse(gridItemMetadataString)?.plotlyVerticalLine?.value,
      );
    } catch {
      // Malformed metadata string: the line is tied to no variable.
    }
    return name
      ? { name, dateFormat: variableInputDateFormats?.[name] ?? null }
      : null;
  }, [gridItemMetadataString, variableInputDateFormats]);

  // Measured once per figure, not on every move of the line.
  const lineAxisExtent = useMemo(
    () =>
      verticalLineMode === "on"
        ? autorangedLineAxisExtent(plotData, toggledLayout)
        : null,
    [verticalLineMode, plotData, toggledLayout],
  );

  const verticalLineShape = useMemo(
    () => {
      if (verticalLineMode !== "on" || !verticalLineValue) return null;
      const shape = createVerticalLine({
        // Read with the variable's format, without which parseDateMath
        // cannot read it.
        xValue: parseDateMath({
          value: verticalLineValue,
          dateFormat: lineVariable?.dateFormat,
        }),
        options: plotlyVerticalLine,
      });
      // On an autoranged axis, a line outside the data would stretch the
      // axis to reach it. Plotly leaves a hidden one out of the autorange.
      if (shape && lineAxisExtent) {
        const x = wallClockMs(shape.x0);
        if (x < lineAxisExtent[0] || x > lineAxisExtent[1]) {
          shape.visible = false;
        }
      }
      return shape;
    },
    // toggledLayout is not read, but a new figure must re-read a relative
    // value such as "now", which nothing else here changes for.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      verticalLineMode,
      verticalLineValue,
      plotlyVerticalLine,
      lineVariable,
      lineAxisExtent,
      toggledLayout,
    ],
  );

  // Where the line was last placed, which tells handleEventData which end of
  // it a drag moved. Read when the line is computed, before Plotly can move it.
  const lastLineXRef = useRef(null);
  useEffect(() => {
    lastLineXRef.current = verticalLineShape?.x0 ?? null;
  }, [verticalLineShape]);

  // Added on top of the toggle-aware shapes, so subplot show/hide visibility
  // is preserved; any prior vertical line is stripped to prevent duplicates.
  const plotLayout = useMemo(() => {
    const merged = { ...toggledLayout, width: plotWidth, height: plotHeight };
    if (verticalLineShape) {
      merged.shapes = [
        ...(toggledLayout.shapes || []).filter(
          (s) => s.meta?.createdBy !== "addVerticalLine",
        ),
        verticalLineShape,
      ];
    }
    return merged;
  }, [toggledLayout, plotWidth, plotHeight, verticalLineShape]);

  // Merge the always-on "Download data as CSV" modebar button into the plugin's
  // config (plugins may send no config at all, e.g. geoglows plots).
  const configWithCsv = useMemo(() => {
    const base = config || {};
    // A full-toolbar override (modeBarButtons) makes plotly IGNORE
    // modeBarButtonsToAdd (e.g. cnrfc_hefs curates its toolbar this way), so
    // append the CSV button as its own group inside the override instead.
    if (Array.isArray(base.modeBarButtons)) {
      const hasCsv = base.modeBarButtons.some(
        (group) =>
          Array.isArray(group) &&
          group.some(
            (b) =>
              b === csvDownloadButton.name ||
              (b && b.name === csvDownloadButton.name),
          ),
      );
      if (hasCsv) {
        return base;
      }
      return {
        ...base,
        modeBarButtons: [...base.modeBarButtons, [csvDownloadButton]],
      };
    }
    const existing = Array.isArray(base.modeBarButtonsToAdd)
      ? base.modeBarButtonsToAdd
      : [];
    if (existing.some((b) => b && b.name === csvDownloadButton.name)) {
      return base;
    }
    return { ...base, modeBarButtonsToAdd: [...existing, csvDownloadButton] };
  }, [config]);

  // Plotly's newer shape editor -- click a shape to activate it, then drag --
  // cannot move a shape placed on a date axis: in 2.35 it reads the line's
  // position back as NaN and loses it. A draggable line uses the older
  // editor instead, which drags shapes directly. That editor applies to every
  // shape in the figure, so while the line is draggable the plugin's own
  // shapes are too; nothing a drag does to them is kept.
  const lineDraggable =
    verticalLineMode === "on" && plotlyVerticalLine.editable === true;
  const plotConfig = useMemo(
    () =>
      lineDraggable
        ? {
            ...configWithCsv,
            edits: { ...configWithCsv.edits, shapePosition: true },
          }
        : configWithCsv,
    [configWithCsv, lineDraggable],
  );

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

  // istanbul ignore next - handleEventData is tested separately
  const handleRelayout = useCallback(
    (eventData) => {
      const snapped = handleEventData({
        eventData,
        plotElement: visualizationRef?.current?.el,
        lastLineX: lastLineXRef.current,
        verticalLineStep,
        inDataViewerMode,
        lineVariable,
        setVariableInputValues,
      });
      if (snapped) lastLineXRef.current = snapped;
    },
    [
      visualizationRef,
      verticalLineStep,
      inDataViewerMode,
      lineVariable,
      setVariableInputValues,
    ],
  );

  return (
    // The control sits outside ScrollBox on purpose: it is positioned
    // against this box, so it stays put while the figure scrolls under it.
    <div style={{ display: "flex", height: "100%", position: "relative" }}>
      <ScrollBox ref={ref} $scrollsY={scrollsY} $scrollsX={scrollsX}>
        <StyledPlot
          ref={visualizationRef}
          data={plotData}
          layout={plotLayout}
          config={plotConfig}
          onRelayout={handleRelayout}
          $height={scrollsY ? plotHeight : 0}
          $width={scrollsX ? plotWidth : 0}
        />
      </ScrollBox>
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
