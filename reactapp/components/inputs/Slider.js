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
    return formatDate(parseDateMath({ value: date }), format);
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

export const calculateSliderValues = ({
  min,
  max,
  step,
  unit,
  dataType,
  rawMinDateFormat,
  rawMaxDateFormat,
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
      // For relative, output as 'now-xU' where U is unit
      const unitAbbr = Object.keys(unitMap).find((k) => unitMap[k] === unit);
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
  label,
  step,
  min,
  max,
  initialValue,
  initialRange,
  rangeMode = false,
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
}) => {
  const { gridItemArgsString } = useContext(GridItemContext);
  const { variableInputDateFormats } = useContext(VariableInputsContext);
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
  const unit = dateTimeDelta;
  const values = useMemo(
    () =>
      calculateSliderValues({
        min,
        max,
        step,
        unit,
        dataType,
        rawMinDateFormat,
        rawMaxDateFormat,
      }),
    [min, max, step, unit, dataType, rawMinDateFormat, rawMaxDateFormat],
  );

  // Track index/indices
  const [currentIdx, setCurrentIdx] = useState(() =>
    getInitialIndices(values, initialValue, initialRange, rangeMode),
  );

  // Debounced version of currentIdx for onChange calls
  const debouncedCurrentIdx = useDebounce(currentIdx, debounceDelay);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(
    speeds.length > 0 ? speeds[0].value : 1000,
  );
  const intervalRef = useRef(null);
  const prev = useRef({
    rangeMode,
    initialRange,
    initialValue,
    min,
    max,
  });

  // Update speed if speeds prop changes
  useEffect(() => {
    if (Array.isArray(speeds) && speeds.length > 0) {
      setSpeed((prev) => {
        // If current speed is not in new speeds, reset to first
        const found = speeds.find((s) => s.value === prev);
        return found ? prev : speeds[0].value;
      });
    }
    // eslint-disable-next-line
  }, [JSON.stringify(speeds)]);

  useEffect(() => {
    // Only update index if relevant props changed
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
  }, [rangeMode, initialRange, initialValue, min, max, values]);

  useEffect(() => {
    // Only call onChange if index actually changed
    if (rangeMode) {
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
    // eslint-disable-next-line
  }, [debouncedCurrentIdx, outputFormat, rangeMode, isDateType, values]);

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

  if (rangeMode && (!Array.isArray(currentIdx) || currentIdx.length !== 2))
    return null;
  if (!rangeMode && Array.isArray(currentIdx)) return null;

  const sliderValue = rangeMode ? currentIdx : currentIdx;
  const sliderMin = 0;
  const sliderMax = values.length - 1;
  const displayValue = rangeMode
    ? `${formatValue(values[currentIdx[0]], outputFormat, isDateType)} - ${formatValue(values[currentIdx[1]], outputFormat, isDateType)}`
    : formatValue(values[currentIdx], outputFormat, isDateType);

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
        {/* Top controls - Play button and Speed selector */}
        <Row className="align-items-center mb-2">
          <Col className="d-flex justify-content-center gap-2">
            {showPlayControls && (
              <>
                {/* Play/Stop button */}
                {!playing ? (
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
                )}
                {/* Speed selector dropdown only if more than one speed */}
                {showSpeedDropdown && (
                  <Form.Select
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    disabled={playing}
                    aria-label="Speed select"
                    style={{ width: "auto", minWidth: "80px" }}
                  >
                    {speeds.map(({ label, value }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Form.Select>
                )}
              </>
            )}
          </Col>
        </Row>

        <Row className="align-items-center">
          {/* Left controls - First and Previous */}
          <Col xs="auto" className="d-flex gap-1">
            <Button
              variant="primary"
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
              onClick={goBackStep}
              title="Previous step"
              aria-label="previous step"
              disabled={playing}
            >
              <CenteredButtonSpan>
                <FaBackward />
              </CenteredButtonSpan>
            </Button>
          </Col>

          {/* Start value */}
          <Col xs="auto" className="text-center" aria-label="Min Value">
            <strong>{formatValue(values[0], outputFormat, isDateType)}</strong>
          </Col>

          {/* Slider */}
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
            <div
              aria-label="Display Value"
              className="text-center fw-bold mt-2"
            >
              {displayValue}
            </div>
          </Col>

          {/* End value */}
          <Col xs="auto" className="text-center" aria-label="Max Value">
            <strong>
              {formatValue(values[values.length - 1], outputFormat, isDateType)}
            </strong>
          </Col>

          {/* Right controls - Next and Last */}
          <Col xs="auto" className="d-flex gap-1">
            <Button
              variant="primary"
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
              onClick={goToLast}
              title="Go to last"
              aria-label="go to last"
              disabled={playing}
            >
              <CenteredButtonSpan>
                <FaFastForward />
              </CenteredButtonSpan>
            </Button>
          </Col>
        </Row>
      </Form>
    </>
  );
};

Slider.propTypes = {
  label: PropTypes.string,
  step: PropTypes.number.isRequired,
  min: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  max: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  initialValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialRange: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  ),
  rangeMode: PropTypes.bool,
  outputFormat: PropTypes.string.isRequired,
  dataType: PropTypes.string.isRequired,
  dateTimeDelta: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  debounceDelay: PropTypes.number,
  speeds: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    }),
  ),
};

export default memo(Slider);
