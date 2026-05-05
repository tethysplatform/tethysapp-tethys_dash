import { useState, useEffect, useRef, useMemo, memo, useContext } from "react";
import { Button, Form, Row, Col } from "react-bootstrap";
import PropTypes from "prop-types";
import SliderLib from "rc-slider";
import "rc-slider/assets/index.css";
import {
  addSeconds,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInSeconds,
  differenceInMinutes,
  differenceInHours,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  format as formatDate,
} from "date-fns";
import { parseDateMath } from "components/inputs/dateUtils";
import { valuesEqual } from "components/modals/utilities";
import {
  GridItemContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { checkForVariable } from "components/inputs/dateUtils";
import {
  FaPlay,
  FaStop,
  FaFastForward,
  FaForward,
  FaFastBackward,
  FaBackward,
} from "react-icons/fa";
import styled from "styled-components";

const CenteredButtonSpan = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

const ButtonCol = styled(Col)`
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
`;

const FlexDiv = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const timeDeltas = {
  Seconds: addSeconds,
  Minutes: addMinutes,
  Hours: addHours,
  Days: addDays,
  Weeks: addWeeks,
  Months: addMonths,
  Years: addYears,
};

const diffDeltas = {
  Seconds: differenceInSeconds,
  Minutes: differenceInMinutes,
  Hours: differenceInHours,
  Days: differenceInDays,
  Weeks: differenceInWeeks,
  Months: differenceInMonths,
  Years: differenceInYears,
};

// Helper function to convert a date to local ISO string (YYYY-MM-DDTHH:mm:ss)
function toLocalISOString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate()) +
    "T" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds())
  );
}

function formatNumber(n, template) {
  return template.replace(/\{\{n(:0*(\d+))?\}\}/, (_, __, pad) => {
    if (pad) {
      return String(n).padStart(Number(pad), "0");
    }
    return n;
  });
}

function formatDateValue(date, format) {
  try {
    return formatDate(
      parseDateMath({ value: date, dateFormat: format }),
      format,
    );
  } catch (err) {
    console.error("Date formatting error:", err.message);
    return date.toString();
  }
}

const formatValue = (val, outputFormat, isDateType) => {
  return isDateType
    ? formatDateValue(val, outputFormat)
    : formatNumber(val, outputFormat);
};

/**
 * Aligns a date to the nearest step boundary in the given direction.
 * The alignment grid is defined by: offset + n * step (in the given unit).
 * Sub-units are zeroed before alignment (e.g., minutes/seconds for Hours).
 */
export const alignDateToStep = (
  date,
  step,
  unit,
  offset = 0,
  direction = "ceil",
) => {
  const d = new Date(date);
  const roundFn = direction === "floor" ? Math.floor : Math.ceil;

  // Zero out sub-units and align to the step grid
  switch (unit) {
    case "Seconds": {
      d.setMilliseconds(0);
      const s = d.getSeconds();
      d.setSeconds(offset + roundFn((s - offset) / step) * step);
      break;
    }
    case "Minutes": {
      d.setSeconds(0, 0);
      const m = d.getMinutes();
      d.setMinutes(offset + roundFn((m - offset) / step) * step);
      break;
    }
    case "Hours": {
      d.setMinutes(0, 0, 0);
      const h = d.getHours();
      d.setHours(offset + roundFn((h - offset) / step) * step);
      break;
    }
    case "Days": {
      const hadTime =
        d.getHours() > 0 || d.getMinutes() > 0 || d.getSeconds() > 0;
      d.setHours(0, 0, 0, 0);
      if (direction !== "floor" && hadTime) {
        d.setDate(d.getDate() + 1);
      }
      break;
    }
    case "Weeks": {
      const hadTime =
        d.getHours() > 0 || d.getMinutes() > 0 || d.getSeconds() > 0;
      d.setHours(0, 0, 0, 0);
      const day = d.getDay(); // 0=Sun
      if (direction === "floor") {
        if (day !== 0) {
          d.setDate(d.getDate() - day);
        }
      } else {
        if (day !== 0 || hadTime) {
          d.setDate(d.getDate() + (7 - day));
        }
      }
      break;
    }
    case "Months": {
      const hadSubMonth =
        d.getDate() > 1 ||
        d.getHours() > 0 ||
        d.getMinutes() > 0 ||
        d.getSeconds() > 0;
      d.setHours(0, 0, 0, 0);
      d.setDate(1);
      if (direction !== "floor" && hadSubMonth) {
        d.setMonth(d.getMonth() + 1);
      }
      break;
    }
    case "Years": {
      const hadSubYear =
        d.getMonth() > 0 ||
        d.getDate() > 1 ||
        d.getHours() > 0 ||
        d.getMinutes() > 0 ||
        d.getSeconds() > 0;
      d.setHours(0, 0, 0, 0);
      d.setMonth(0, 1);
      if (direction !== "floor" && hadSubYear) {
        d.setFullYear(d.getFullYear() + 1);
        d.setMonth(0, 1);
      }
      break;
    }
    default:
      break;
  }
  return d;
};

export const calculateSliderValues = ({
  min,
  max,
  step,
  unit,
  dataType,
  rawMinDateFormat,
  rawMaxDateFormat,
  alignSteps = false,
  alignOffset = 0,
}) => {
  // Helper to ensure max is always included
  const ensureMaxIncluded = (arr, max, eqFn = (a, b) => a === b) => {
    if (arr.length === 0 || !eqFn(arr[arr.length - 1], max)) arr.push(max);
    return arr;
  };

  if (dataType === "Number") {
    // Convert min and max to step units
    const arr = [];
    let steps = Math.floor((max - min) / step);
    for (let i = 0; i <= steps; i++) {
      arr.push(min + i * step);
    }
    // If last value doesn't match max, add max
    return ensureMaxIncluded(arr, max);
  }

  if (dataType === "Date") {
    const unitMap = {
      S: "Seconds",
      m: "Minutes",
      H: "Hours",
      D: "Days",
      W: "Weeks",
      M: "Months",
      Y: "Years",
    };

    const isRelative = (val) =>
      typeof val === "string" &&
      /^now([+-]\d+[SmHDWMY])?(-\d+[SmHDWMY])*?$/.test(val);

    // Helper to parse relative date string and return offset in requested unit
    const unitToHours = {
      Seconds: 1 / 3600,
      Minutes: 1 / 60,
      Hours: 1,
      Days: 24,
      Weeks: 168,
      Months: 730, // Approximate
      Years: 8760, // Approximate
    };

    const parseRel = (val, targetUnit) => {
      if (val === "now") return 0;
      let total = 0;
      const regex = /([+-])(\d+)([SmHDWMY])/g;
      let m;
      while ((m = regex.exec(val))) {
        const sign = m[1] === "+" ? 1 : -1;
        const amount = sign * parseInt(m[2], 10);
        let srcUnit = unitMap[m[3]];

        // Convert amount in srcUnit to hours, then to targetUnit
        const asHours = amount * unitToHours[srcUnit];
        const asTarget = asHours / unitToHours[targetUnit];
        total += asTarget;
      }
      // Always return integer offset for stepping
      return Math.round(total);
    };

    if (isRelative(min) && isRelative(max)) {
      const unitAbbr = Object.keys(unitMap).find((k) => unitMap[k] === unit);

      if (alignSteps) {
        // Floor "now" to the step grid so computation is stable within
        // a step interval (e.g., 9:01 and 9:29 both anchor to 9:00).
        // Output absolute ISO strings so formatValue produces stable results.
        const now = new Date();
        const anchoredNow = alignDateToStep(
          now,
          step,
          unit,
          alignOffset,
          "floor",
        );
        const minOffset = parseRel(min, unit);
        const maxOffset = parseRel(max, unit);
        let minDate = timeDeltas[unit](anchoredNow, minOffset);
        let maxDate = timeDeltas[unit](anchoredNow, maxOffset);
        minDate = alignDateToStep(minDate, step, unit, alignOffset);
        maxDate = alignDateToStep(maxDate, step, unit, alignOffset);
        const arr = [];
        const diff = diffDeltas[unit](maxDate, minDate);
        let steps = Math.floor(diff / step);
        for (let i = 0; i <= steps; i++) {
          const d = timeDeltas[unit](minDate, i * step);
          arr.push(toLocalISOString(d).replace(/\.\d+$/, ""));
        }
        return ensureMaxIncluded(
          arr,
          toLocalISOString(maxDate).replace(/\.\d+$/, ""),
          (a, b) => a.replace(/\.\d+$/, "") === b.replace(/\.\d+$/, ""),
        ).map((d) => d.replace(/\.\d+$/, ""));
      }

      // For relative, output as 'now-xU' where U is unit
      const minVal = parseRel(min, unit);
      const maxVal = parseRel(max, unit);
      const arr = [];
      const stepVal = step;
      const forward = minVal <= maxVal;
      let current = minVal;
      while (
        (forward && current <= maxVal) ||
        (!forward && current >= maxVal)
      ) {
        let suffix = "now";
        if (current !== 0) {
          suffix = `now${current < 0 ? "-" : "+"}${Math.abs(current)}${unitAbbr}`;
        }
        arr.push(suffix);
        current += stepVal * (forward ? 1 : -1);
      }
      // Ensure max is included
      let suffix = "now";
      if (maxVal !== 0) {
        suffix = `now${maxVal < 0 ? "-" : "+"}${Math.abs(maxVal)}${unitAbbr}`;
      }
      arr.push(suffix);
      // Remove duplicates
      return Array.from(new Set(arr));
    }

    // Convert any relative dates to absolute dates for uniform processing
    let minDate;
    let maxDate;

    if (isRelative(min)) {
      const now = new Date();
      const offset = parseRel(min, unit);
      minDate = timeDeltas[unit](now, offset);
    }

    if (isRelative(max)) {
      const now = new Date();
      const offset = parseRel(max, unit);
      maxDate = timeDeltas[unit](now, offset);
    }

    // Absolute dates (including converted relative dates)
    if (!minDate) {
      minDate =
        parseDateMath({ value: min, dateFormat: rawMinDateFormat }) ||
        new Date();
    }
    if (!maxDate) {
      maxDate =
        parseDateMath({ value: max, dateFormat: rawMaxDateFormat }) ||
        new Date();
    }
    if (alignSteps) {
      minDate = alignDateToStep(minDate, step, unit, alignOffset);
      maxDate = alignDateToStep(maxDate, step, unit, alignOffset);
    }
    const arr = [];
    const diff = diffDeltas[unit](maxDate, minDate);
    let steps = Math.floor(diff / step);
    for (let i = 0; i <= steps; i++) {
      const d = timeDeltas[unit](minDate, i * step);
      arr.push(toLocalISOString(d).replace(/\.\d+$/, ""));
    }
    // If last value doesn't match max, add max
    return ensureMaxIncluded(
      arr,
      toLocalISOString(maxDate).replace(/\.\d+$/, ""),
      (a, b) => a.replace(/\.\d+$/, "") === b.replace(/\.\d+$/, ""),
    ).map((d) => d.replace(/\.\d+$/, ""));
  }
  return [];
};

// Debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

const getInitialIndices = (values, initialValue, initialRange, rangeMode) => {
  if (rangeMode) {
    if (Array.isArray(initialRange) && initialRange.length === 2) {
      return [
        Math.max(
          0,
          values.findIndex((v) => v === initialRange[0]),
        ),
        Math.max(
          0,
          values.findIndex((v) => v === initialRange[1]),
        ),
      ];
    } else {
      return [0, values.length - 1];
    }
  } else {
    const idx = values.findIndex((v) => v === initialValue);
    return idx !== -1 ? idx : 0;
  }
};

const Slider = ({
  variable_name,
  label,
  step,
  min,
  max,
  initialValue,
  initialRange,
  rangeMode: rangeModeRaw = false,
  outputFormat,
  dataType,
  dateTimeDelta,
  onChange,
  debounceDelay = 300, // Default 300ms debounce delay
  speeds = [
    { label: "Slow", value: 1000 },
    { label: "Medium", value: 500 },
    { label: "Fast", value: 200 },
  ],
  values: valuesProp,
  labels: labelsProp,
  alignOffset = 0,
  alignSteps = false,
}) => {
  const { gridItemArgsString } = useContext(GridItemContext);
  const {
    variableInputDateFormats,
    variableInputValues,
    setVariableInputSliderMeta,
  } = useContext(VariableInputsContext);
  const [rawValue, setRawValue] = useState(null);
  const rawMetadata =
    JSON.parse(gridItemArgsString || "{}")?.[
      "variable_options_source.metadata"
    ] || {};
  const rawMin = rawMetadata?.min;
  const rawMax = rawMetadata?.max;
  const rawMinVar = checkForVariable(rawMin);
  const rawMaxVar = checkForVariable(rawMax);
  let rawMinDateFormat;
  let rawMaxDateFormat;

  if (rawMinVar) {
    rawMinDateFormat = variableInputDateFormats[rawMinVar];
  }
  if (rawMaxVar) {
    rawMaxDateFormat = variableInputDateFormats[rawMaxVar];
  }

  const isDateType = dataType === "Date";
  const isArrayType = dataType === "Array";
  const rangeMode = isArrayType ? false : rangeModeRaw;
  const unit = dateTimeDelta;

  // For aligned relative date sliders, recalculate values when a step boundary
  // is crossed so the window of absolute dates shifts forward.
  const isRelativeRange =
    isDateType &&
    typeof min === "string" &&
    min.startsWith("now") &&
    typeof max === "string" &&
    max.startsWith("now");
  const [stepEpoch, setStepEpoch] = useState(0);
  useEffect(() => {
    if (!alignSteps || !isRelativeRange) return;
    const flooredNow = alignDateToStep(
      new Date(),
      step,
      unit,
      alignOffset,
      "floor",
    );
    const nextBoundary = timeDeltas[unit](flooredNow, step);
    const msUntilNext = nextBoundary.getTime() - Date.now() + 100;
    const tid = setTimeout(() => setStepEpoch((e) => e + 1), msUntilNext);
    return () => clearTimeout(tid);
  }, [stepEpoch, step, unit, alignSteps, alignOffset, isRelativeRange]);

  // For Array mode, keep a stable reference to avoid spurious resets on refresh
  const prevArrayRef = useRef(valuesProp);
  const values = useMemo(() => {
    if (isArrayType) {
      const incoming = Array.isArray(valuesProp) ? valuesProp : [];
      // Only return a new reference if the content actually changed
      const prev = prevArrayRef.current;
      if (
        Array.isArray(prev) &&
        prev.length === incoming.length &&
        prev.every((v, i) => v === incoming[i])
      ) {
        return prev;
      }
      prevArrayRef.current = incoming;
      return incoming;
    }
    return calculateSliderValues({
      min,
      max,
      step,
      unit,
      dataType,
      rawMinDateFormat,
      rawMaxDateFormat,
      alignOffset,
      alignSteps,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isArrayType,
    valuesProp,
    min,
    max,
    step,
    unit,
    dataType,
    rawMinDateFormat,
    rawMaxDateFormat,
    alignOffset,
    alignSteps,
    stepEpoch,
  ]);

  // Publish pre-formatted slider values to context for ImageSequence preloading
  const prevFormattedRef = useRef(null);
  useEffect(() => {
    if (!setVariableInputSliderMeta || !variable_name || values.length === 0)
      return;
    const formatted = isArrayType
      ? values
      : values.map((v) => formatValue(v, outputFormat, isDateType));
    if (
      prevFormattedRef.current &&
      prevFormattedRef.current.length === formatted.length &&
      prevFormattedRef.current.every((v, i) => v === formatted[i])
    ) {
      return;
    }
    prevFormattedRef.current = formatted;
    setVariableInputSliderMeta((prev) => ({
      ...prev,
      [variable_name]: { values: formatted },
    }));
  }, [
    variable_name,
    values,
    outputFormat,
    isDateType,
    isArrayType,
    setVariableInputSliderMeta,
  ]);

  // Track index/indices
  const [currentIdx, setCurrentIdx] = useState(() =>
    getInitialIndices(values, initialValue, initialRange, rangeMode),
  );

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(
    speeds.length > 0 ? speeds[0].value : 1000,
  );

  // Debounced version of currentIdx for onChange calls
  // During playback, reduce debounce to match speed so fast speeds aren't bottlenecked
  const effectiveDebounce = playing
    ? Math.min(debounceDelay, speed)
    : debounceDelay;
  const debouncedCurrentIdx = useDebounce(currentIdx, effectiveDebounce);
  const intervalRef = useRef(null);
  const prev = useRef({
    rangeMode,
    initialRange,
    initialValue,
    min,
    max,
  });

  useEffect(() => {
    let sliderVariableValue = variableInputValues[variable_name];
    if (!sliderVariableValue) return;
    sliderVariableValue = sliderVariableValue.toString();

    if (isArrayType) {
      // Array mode: use strict equality, bypass formatValue entirely
      const currentValue = values[debouncedCurrentIdx];
      const idx = values.findIndex((v) => v === sliderVariableValue);
      if (idx === -1) {
        setRawValue(sliderVariableValue);
      } else {
        setRawValue(null);
        if (sliderVariableValue !== currentValue) {
          setCurrentIdx(idx);
        }
      }
    } else {
      const currentValue = formatValue(
        values[debouncedCurrentIdx],
        outputFormat,
        isDateType,
      );
      // Find the index of the sliderVariableValue in values
      const idx = values.findIndex((v) =>
        valuesEqual(
          sliderVariableValue,
          formatValue(v, outputFormat, isDateType),
        ),
      );
      if (idx === -1) {
        // Value does not align with an index, store as rawValue
        setRawValue(sliderVariableValue);
      } else {
        setRawValue(null);
        if (!valuesEqual(sliderVariableValue, currentValue)) {
          setCurrentIdx(idx);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variableInputValues]);

  // Update speed if speeds prop changes
  useEffect(() => {
    if (Array.isArray(speeds) && speeds.length > 0) {
      setSpeed((prev) => {
        // If current speed is not in new speeds, reset to first
        const found = speeds.find((s) => s.value === prev);
        return found ? prev : speeds[0].value;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(speeds)]);

  useEffect(() => {
    if (isArrayType) {
      // Array mode: clamp index to new array length (position preservation on refresh)
      if (prev.current.valuesLength !== values.length) {
        setCurrentIdx((prevIdx) =>
          values.length === 0 ? 0 : Math.min(prevIdx, values.length - 1),
        );
        prev.current = { ...prev.current, valuesLength: values.length };
      }
    } else {
      // Number/Date mode: reset to initial indices when relevant props change
      const shouldUpdate =
        prev.current.rangeMode !== rangeMode ||
        !valuesEqual(prev.current.initialRange, initialRange) ||
        prev.current.initialValue !== initialValue ||
        prev.current.min !== min ||
        prev.current.max !== max ||
        prev.current.valuesLength !== values.length;
      if (shouldUpdate) {
        setCurrentIdx(
          getInitialIndices(values, initialValue, initialRange, rangeMode),
        );
        prev.current = {
          rangeMode,
          initialRange,
          initialValue,
          min,
          max,
          valuesLength: values.length,
        };
      }
    }
  }, [isArrayType, rangeMode, initialRange, initialValue, min, max, values]);

  useEffect(() => {
    if (isArrayType) {
      // Array mode: emit raw value without formatting
      if (values.length > 0 && debouncedCurrentIdx < values.length) {
        onChange(values[debouncedCurrentIdx]);
      }
    } else if (rangeMode) {
      const arr = Array.isArray(debouncedCurrentIdx)
        ? debouncedCurrentIdx
        : [0, values.length - 1];
      const formatted = arr
        .map((i) => formatValue(values[i], outputFormat, isDateType))
        .join(",");
      onChange(formatted);
    } else {
      const formatted = formatValue(
        values[debouncedCurrentIdx],
        outputFormat,
        isDateType,
      );
      onChange(formatted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedCurrentIdx,
    outputFormat,
    rangeMode,
    isDateType,
    isArrayType,
    values,
  ]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx((idx) => {
          if (rangeMode) {
            let [start, end] = idx;
            const rangeSize = end - start;
            let nextStart = start + 1;
            let nextEnd = end + 1;
            // If nextEnd exceeds bounds, wrap to first valid range
            if (nextEnd > values.length - 1) {
              nextStart = 0;
              nextEnd = rangeSize;
            }
            if (nextEnd <= nextStart) nextEnd = nextStart + 1;
            return [nextStart, nextEnd];
          } else {
            let next = idx + 1;
            return next >= values.length ? 0 : next;
          }
        });
      }, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, values, rangeMode]);

  const onRangeChange = (val) => {
    if (rangeMode) {
      setCurrentIdx([val[0], val[1]]);
    } else {
      setCurrentIdx(val);
    }
  };

  const goToFirst = () => {
    if (rangeMode) {
      let rangeSize = 1;
      rangeSize = currentIdx[1] - currentIdx[0];
      rangeSize = Math.max(1, Math.min(rangeSize, values.length - 1));
      setCurrentIdx([0, rangeSize]);
    } else {
      setCurrentIdx(0);
    }
  };

  const goToLast = () => {
    if (rangeMode) {
      let rangeSize = 1;
      rangeSize = currentIdx[1] - currentIdx[0];
      rangeSize = Math.max(1, Math.min(rangeSize, values.length - 1));
      setCurrentIdx([values.length - 1 - rangeSize, values.length - 1]);
    } else {
      setCurrentIdx(values.length - 1);
    }
  };

  const goBackStep = () => {
    if (rangeMode) {
      let rangeSize = 1;
      rangeSize = currentIdx[1] - currentIdx[0];
      rangeSize = Math.max(1, Math.min(rangeSize, values.length - 1));
      let [start] = currentIdx;
      let newStart = Math.max(0, start - 1);
      let newEnd = Math.min(values.length - 1, newStart + rangeSize);
      setCurrentIdx([newStart, newEnd]);
    } else {
      setCurrentIdx(Math.max(0, currentIdx - 1));
    }
  };

  const goForwardStep = () => {
    if (rangeMode) {
      let rangeSize = 1;
      rangeSize = currentIdx[1] - currentIdx[0];
      rangeSize = Math.max(1, Math.min(rangeSize, values.length - 1));
      let [start] = currentIdx;
      let newStart = Math.min(values.length - 1 - rangeSize, start + 1);
      let newEnd = Math.min(values.length - 1, newStart + rangeSize);
      setCurrentIdx([newStart, newEnd]);
    } else {
      setCurrentIdx(Math.min(values.length - 1, currentIdx + 1));
    }
  };

  // Empty array guard for Array mode
  if (isArrayType && values.length === 0) {
    return (
      <>
        {label && (
          <Form.Label className="no-caret">
            <b>{label}</b>:
          </Form.Label>
        )}
        <Form>
          <div className="text-center text-muted py-2">No data available</div>
        </Form>
      </>
    );
  }

  if (rangeMode && (!Array.isArray(currentIdx) || currentIdx.length !== 2))
    return null;
  if (!rangeMode && Array.isArray(currentIdx)) return null;

  // For non-indexed value, snap handle to nearest index but display raw value
  let sliderValue = rangeMode ? currentIdx : currentIdx;
  const labels = isArrayType && Array.isArray(labelsProp) ? labelsProp : null;
  let displayValue;
  if (isArrayType) {
    const currentLabel =
      labels?.[currentIdx] ?? `${currentIdx + 1} / ${values.length}`;
    displayValue = currentLabel;
  } else if (rangeMode) {
    displayValue = `${formatValue(values[currentIdx[0]], outputFormat, isDateType)} - ${formatValue(values[currentIdx[1]], outputFormat, isDateType)}`;
  } else {
    displayValue = formatValue(values[currentIdx], outputFormat, isDateType);
  }

  if (!rangeMode && !isArrayType && rawValue !== null) {
    // Find the closest index for the handle, support both date and number types
    let closestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < values.length; i++) {
      let diff;
      if (isDateType) {
        const valDate = parseDateMath({
          value: values[i],
          dateFormat: outputFormat,
        });
        const rawDate = parseDateMath({
          value: rawValue,
          dateFormat: outputFormat,
        });
        if (!valDate || !rawDate) continue;
        diff = Math.abs(valDate.getTime() - rawDate.getTime());
      } else {
        diff = Math.abs(Number(values[i]) - Number(rawValue));
      }
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    sliderValue = closestIdx;
    displayValue =
      formatValue(rawValue, outputFormat, isDateType) + " (custom)";
  } else if (!rangeMode && isArrayType && rawValue !== null) {
    // Array mode: use strict equality for rawValue matching
    const idx = values.findIndex((v) => v === rawValue);
    if (idx !== -1) {
      sliderValue = idx;
    }
    displayValue =
      (labels?.[sliderValue] ?? `${sliderValue + 1} / ${values.length}`) +
      " (custom)";
  }
  const sliderMin = 0;
  const sliderMax = values.length - 1;

  const showPlayControls = Array.isArray(speeds) && speeds.length > 0;
  const showSpeedDropdown = Array.isArray(speeds) && speeds.length > 1;

  return (
    <>
      {label && (
        <Form.Label className="no-caret">
          <b>{label}</b>:
        </Form.Label>
      )}
      <Form>
        {/* Controls row: all buttons and speed above slider */}
        <Row className="align-items-center mb-2 justify-content-center">
          <ButtonCol>
            <FlexDiv>
              <Button
                variant="primary"
                size="sm"
                onClick={goToFirst}
                title="Go to first"
                aria-label="go to first"
                disabled={playing}
              >
                <CenteredButtonSpan>
                  <FaFastBackward />
                </CenteredButtonSpan>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={goBackStep}
                title="Previous step"
                aria-label="previous step"
                disabled={playing}
              >
                <CenteredButtonSpan>
                  <FaBackward />
                </CenteredButtonSpan>
              </Button>
            </FlexDiv>
            <FlexDiv>
              {showSpeedDropdown && (
                <>
                  <Form.Label className="mb-0 ms-2">
                    <b>Speed:</b>
                  </Form.Label>
                  <Form.Select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    disabled={playing}
                    aria-label="Speed select"
                    style={{ width: "auto", minWidth: "80px" }}
                    size="sm"
                  >
                    {speeds.map(({ label, value }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Form.Select>
                </>
              )}
              {showPlayControls &&
                (!playing ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setPlaying(true)}
                    title="Play"
                    aria-label="play"
                  >
                    <CenteredButtonSpan>
                      <FaPlay />
                    </CenteredButtonSpan>
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setPlaying(false)}
                    title="Stop"
                    aria-label="stop"
                  >
                    <CenteredButtonSpan>
                      <FaStop />
                    </CenteredButtonSpan>
                  </Button>
                ))}
            </FlexDiv>
            <FlexDiv>
              <Button
                variant="primary"
                size="sm"
                onClick={goForwardStep}
                title="Next step"
                aria-label="next step"
                disabled={playing}
              >
                <CenteredButtonSpan>
                  <FaForward />
                </CenteredButtonSpan>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={goToLast}
                title="Go to last"
                aria-label="go to last"
                disabled={playing}
              >
                <CenteredButtonSpan>
                  <FaFastForward />
                </CenteredButtonSpan>
              </Button>
            </FlexDiv>
          </ButtonCol>
        </Row>
        <Row className="align-items-center">
          <Col xs="auto" className="text-center" aria-label="Min Value">
            <strong>
              {isArrayType
                ? (labels?.[0] ?? "1")
                : formatValue(values[0], outputFormat, isDateType)}
            </strong>
          </Col>
          <Col>
            <SliderLib
              range={rangeMode}
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={sliderValue}
              onChange={onRangeChange}
              disabled={playing && !rangeMode ? true : false}
              styles={{
                handle: {
                  borderColor: "#0d6efd",
                  backgroundColor: "#fff",
                },
                track: {
                  backgroundColor: "#0d6efd",
                },
                rail: {
                  backgroundColor: "#ddd",
                },
              }}
            />
          </Col>
          <Col xs="auto" className="text-center" aria-label="Max Value">
            <strong>
              {isArrayType
                ? (labels?.[values.length - 1] ?? values.length)
                : formatValue(
                    values[values.length - 1],
                    outputFormat,
                    isDateType,
                  )}
            </strong>
          </Col>
        </Row>
        <Row className="align-items-center">
          <Col>
            <div aria-label="Display Value" className="text-center fw-bold">
              {displayValue}
            </div>
          </Col>
        </Row>
      </Form>
    </>
  );
};

Slider.propTypes = {
  variable_name: PropTypes.string.isRequired,
  label: PropTypes.string,
  step: PropTypes.number,
  min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialRange: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  ),
  rangeMode: PropTypes.bool,
  outputFormat: PropTypes.string,
  dataType: PropTypes.string.isRequired,
  values: PropTypes.array,
  labels: PropTypes.arrayOf(PropTypes.string),
  dateTimeDelta: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  debounceDelay: PropTypes.number,
  speeds: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    }),
  ),
  alignSteps: PropTypes.bool,
  alignOffset: PropTypes.number,
};

export default memo(Slider);
