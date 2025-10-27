import { useState, useEffect, useRef, memo } from "react";
import { Button, Form, Row, Col } from "react-bootstrap";
import PropTypes from "prop-types";
import SliderLib from "rc-slider";
import "rc-slider/assets/index.css";
import {
  addMinutes,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  differenceInMinutes,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  format as formatDate,
} from "date-fns";
import { parseDateMath } from "components/inputs/DatePicker";
import { valuesEqual } from "components/modals/utilities";

export const timeDeltas = {
  Minutes: addMinutes,
  Days: addDays,
  Weeks: addWeeks,
  Months: addMonths,
  Years: addYears,
};

const diffDeltas = {
  Minutes: differenceInMinutes,
  Days: differenceInDays,
  Weeks: differenceInWeeks,
  Months: differenceInMonths,
  Years: differenceInYears,
};

function dateToIndex(date, minDate, unit) {
  return diffDeltas[unit](date, minDate);
}

function indexToDate(index, minDate, unit) {
  return timeDeltas[unit](minDate, index);
}

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

function formatDateValue(date, template) {
  try {
    if (!date) return "";
    return formatDate(
      parseDateMath({ value: date, type: "date-hour" }),
      template
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
  speeds = [
    { label: "Slow", value: 1000 },
    { label: "Medium", value: 500 },
    { label: "Fast", value: 200 },
  ],
}) => {
  const isDateType = dataType === "Date";
  const unit = dateTimeDelta;

  const [value, setValue] = useState(() =>
    rangeMode ? (initialRange ?? [min, max]) : (initialValue ?? min)
  );
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(speeds[0].value);
  const intervalRef = useRef(null);
  const prev = useRef({
    rangeMode,
    initialRange,
    initialValue,
    min,
    max,
  });

  useEffect(() => {
    // Only update value if the relevant props actually changed
    const shouldUpdate =
      prev.current.rangeMode !== rangeMode ||
      !valuesEqual(prev.current.initialRange, initialRange) ||
      prev.current.initialValue !== initialValue ||
      prev.current.min !== min ||
      prev.current.max !== max;
    if (shouldUpdate) {
      let newValue = value;
      if (rangeMode) {
        if (Array.isArray(initialRange)) {
          newValue = initialRange;
        } else {
          newValue = [min, max];
        }
      } else {
        if (
          typeof initialValue === "number" ||
          typeof initialValue === "string"
        ) {
          newValue = initialValue;
        } else {
          newValue = min;
        }
      }
      setValue(newValue);
      prev.current = {
        rangeMode,
        initialRange,
        initialValue,
        min,
        max,
      };
    }
    // eslint-disable-next-line
  }, [rangeMode, initialRange, initialValue, min, max]);

  useEffect(() => {
    // Only call onChange if value actually changed
    if (rangeMode) {
      // Defensive: ensure value is array before map
      const arr = Array.isArray(value) ? value : [min, max];
      const formatted = arr
        .map((v) => formatValue(v, outputFormat, isDateType))
        .join(",");
      onChange(formatted);
    } else {
      const formatted = formatValue(value, outputFormat, isDateType);
      onChange(formatted);
    }
    // eslint-disable-next-line
  }, [value, outputFormat, rangeMode, isDateType]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setValue((v) => {
          const minValue = isDateType
            ? parseDateMath({ value: min, type: "date-hour" })
            : min;
          const maxValue = isDateType
            ? parseDateMath({ value: max, type: "date-hour" })
            : max;

          if (rangeMode) {
            // Range mode play logic:
            // Advance both values by step, loop when max reached

            if (isDateType && unit) {
              const minDateObj = new Date(minValue);
              const maxDateObj = new Date(maxValue);

              const startIndex = dateToIndex(
                new Date(parseDateMath({ value: v[0], type: "date-hour" })),
                minDateObj,
                unit
              );
              const endIndex = dateToIndex(
                new Date(parseDateMath({ value: v[1], type: "date-hour" })),
                minDateObj,
                unit
              );
              const rangeSize = endIndex - startIndex;

              let nextStart = startIndex + Number(step);
              let nextEnd = endIndex + Number(step);

              if (nextEnd > dateToIndex(maxDateObj, minDateObj, unit)) {
                nextStart = 0;
                nextEnd = rangeSize;
              }

              const nextRange = [
                toLocalISOString(indexToDate(nextStart, minDateObj, unit)),
                toLocalISOString(indexToDate(nextEnd, minDateObj, unit)),
              ];
              return nextRange;
            } else {
              // Numeric range mode
              const rangeSize = v[1] - v[0];
              let nextStart = v[0] + Number(step);
              let nextEnd = v[1] + Number(step);

              if (nextEnd > max) {
                nextStart = min;
                nextEnd = min + rangeSize;
              }
              return [nextStart, nextEnd];
            }
          } else {
            // Single value play logic
            if (isDateType && unit) {
              const currentDate = new Date(
                parseDateMath({ value: v, type: "date-hour" })
              );
              const nextDate = indexToDate(
                dateToIndex(currentDate, new Date(minValue), unit) +
                  Number(step),
                new Date(minValue),
                unit
              );
              return nextDate > new Date(maxValue)
                ? min
                : toLocalISOString(nextDate);
            } else {
              const next = v + Number(step);
              return next > max ? min : next;
            }
          }
        });
      }, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, step, min, max, isDateType, unit, rangeMode]);

  const onRangeChange = (val) => {
    if (rangeMode) {
      const snapped = val.map((n) => Math.round(n / step) * step);
      if (isDateType && unit) {
        const newDates = snapped.map((idx) =>
          toLocalISOString(
            indexToDate(
              idx,
              new Date(parseDateMath({ value: min, type: "date-hour" })),
              unit
            )
          )
        );
        setValue(newDates);
      } else {
        setValue(snapped);
      }
    } else {
      const snapped = Math.round(val / step) * step;
      if (isDateType && unit) {
        const newDate = indexToDate(
          snapped,
          new Date(parseDateMath({ value: min, type: "date-hour" })),
          unit
        );
        setValue(toLocalISOString(newDate));
      } else {
        setValue(snapped);
      }
    }
  };

  const goToFirst = () => {
    if (rangeMode) {
      if (isDateType && unit) {
        const minDateObj = new Date(
          parseDateMath({ value: min, type: "date-hour" })
        );
        const currentRange = value.map(
          (v) => new Date(parseDateMath({ value: v, type: "date-hour" }))
        );
        // Calculate range size in index units
        const startIndex = dateToIndex(currentRange[0], minDateObj, unit);
        const endIndex = dateToIndex(currentRange[1], minDateObj, unit);
        const rangeSize = endIndex - startIndex;
        const newRange = [
          toLocalISOString(minDateObj),
          toLocalISOString(indexToDate(rangeSize, minDateObj, unit)),
        ];
        setValue([...newRange]);
      } else {
        const rangeSize = value[1] - value[0];
        const newRange = [min, min + rangeSize];
        setValue([...newRange]);
      }
    } else {
      setValue(min);
    }
  };

  const goToLast = () => {
    if (rangeMode) {
      if (isDateType && unit) {
        const maxDateObj = new Date(
          parseDateMath({ value: max, type: "date-hour" })
        );
        const currentRange = value.map(
          (v) => new Date(parseDateMath({ value: v, type: "date-hour" }))
        );
        const rangeSize = dateToIndex(currentRange[1], currentRange[0], unit);
        const newRange = [
          toLocalISOString(indexToDate(-rangeSize, maxDateObj, unit)),
          toLocalISOString(maxDateObj),
        ];
        setValue([...newRange]);
      } else {
        const rangeSize = value[1] - value[0];
        const newRange = [max - rangeSize, max];
        setValue([...newRange]);
      }
    } else {
      setValue(max);
    }
  };

  const goBackStep = () => {
    if (rangeMode) {
      if (isDateType && unit) {
        const minDateObj = new Date(
          parseDateMath({ value: min, type: "date-hour" })
        );
        const currentRange = value.map(
          (v) => new Date(parseDateMath({ value: v, type: "date-hour" }))
        );
        const startIndex = dateToIndex(currentRange[0], minDateObj, unit);
        const endIndex = dateToIndex(currentRange[1], minDateObj, unit);

        const newStartIndex = Math.max(0, startIndex - Number(step));
        const newEndIndex = newStartIndex + (endIndex - startIndex);

        const newRange = [
          toLocalISOString(indexToDate(newStartIndex, minDateObj, unit)),
          toLocalISOString(indexToDate(newEndIndex, minDateObj, unit)),
        ];
        setValue([...newRange]);
      } else {
        const rangeSize = value[1] - value[0];
        const newStart = Math.max(min, value[0] - Number(step));
        const newRange = [newStart, newStart + rangeSize];
        setValue([...newRange]);
      }
    } else {
      if (isDateType && unit) {
        const currentDate = new Date(
          parseDateMath({ value, type: "date-hour" })
        );
        const minDateObj = new Date(
          parseDateMath({ value: min, type: "date-hour" })
        );
        const currentIndex = dateToIndex(currentDate, minDateObj, unit);
        const newIndex = Math.max(0, currentIndex - Number(step));

        const resultDate = indexToDate(newIndex, minDateObj, unit);
        setValue(toLocalISOString(resultDate));
      } else {
        const newVal = Math.max(min, value - Number(step));
        setValue(newVal);
      }
    }
  };

  const goForwardStep = () => {
    if (rangeMode) {
      if (isDateType && unit) {
        const minDateObj = new Date(
          parseDateMath({ value: min, type: "date-hour" })
        );
        const maxDateObj = new Date(
          parseDateMath({ value: max, type: "date-hour" })
        );
        const currentRange = value.map(
          (v) => new Date(parseDateMath({ value: v, type: "date-hour" }))
        );
        const startIndex = dateToIndex(currentRange[0], minDateObj, unit);
        const endIndex = dateToIndex(currentRange[1], minDateObj, unit);
        const maxIndex = dateToIndex(maxDateObj, minDateObj, unit);

        const newStartIndex = Math.min(
          maxIndex - (endIndex - startIndex),
          startIndex + Number(step)
        );
        const newEndIndex = Math.min(maxIndex, endIndex + Number(step));

        const newRange = [
          toLocalISOString(indexToDate(newStartIndex, minDateObj, unit)),
          toLocalISOString(indexToDate(newEndIndex, minDateObj, unit)),
        ];
        setValue([...newRange]);
      } else {
        const rangeSize = value[1] - value[0];
        const newStart = Math.min(max - rangeSize, value[0] + Number(step));
        const newRange = [newStart, newStart + rangeSize];
        setValue([...newRange]);
      }
    } else {
      if (isDateType && unit) {
        const currentDate = new Date(
          parseDateMath({ value, type: "date-hour" })
        );
        const minDateObj = new Date(
          parseDateMath({ value: min, type: "date-hour" })
        );
        const maxDateObj = new Date(
          parseDateMath({ value: max, type: "date-hour" })
        );
        const currentIndex = dateToIndex(currentDate, minDateObj, unit);
        const maxIndex = dateToIndex(maxDateObj, minDateObj, unit);
        const newIndex = Math.min(maxIndex, currentIndex + Number(step));

        const resultDate = indexToDate(newIndex, minDateObj, unit);
        setValue(toLocalISOString(resultDate));
      } else {
        const newVal = Math.min(max, value + Number(step));
        setValue(newVal);
      }
    }
  };

  if (rangeMode && !Array.isArray(value)) return null; // or a loading state
  if (!rangeMode && Array.isArray(value)) return null;

  const sliderValue = (() => {
    if (rangeMode) {
      return isDateType && unit
        ? value.map((v) =>
            dateToIndex(
              new Date(parseDateMath({ value: v, type: "date-hour" })),
              new Date(parseDateMath({ value: min, type: "date-hour" })),
              unit
            )
          )
        : value;
    }
    return isDateType && unit
      ? dateToIndex(
          new Date(parseDateMath({ value, type: "date-hour" })),
          new Date(parseDateMath({ value: min, type: "date-hour" })),
          unit
        )
      : value;
  })();

  const sliderMin = isDateType && unit ? 0 : min;
  const sliderMax =
    isDateType && unit
      ? dateToIndex(
          new Date(parseDateMath({ value: max, type: "date-hour" })),
          new Date(parseDateMath({ value: min, type: "date-hour" })),
          unit
        )
      : max;

  const displayValue = rangeMode
    ? value.map((v) => formatValue(v, outputFormat, isDateType)).join(" - ")
    : formatValue(value, outputFormat, isDateType);

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
            {/* Play/Stop button */}
            {!playing ? (
              <Button
                variant="primary"
                onClick={() => setPlaying(true)}
                title="Play"
                aria-label="play"
              >
                ▶️
              </Button>
            ) : (
              <Button
                variant="danger"
                onClick={() => setPlaying(false)}
                title="Stop"
                aria-label="stop"
              >
                ⏹️
              </Button>
            )}

            {/* Speed selector */}
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
              ⏮️
            </Button>
            <Button
              variant="primary"
              onClick={goBackStep}
              title="Previous step"
              aria-label="previous step"
              disabled={playing}
            >
              ⏪
            </Button>
          </Col>

          {/* Start value */}
          <Col xs="auto" className="text-center" aria-label="Min Value">
            <strong>{formatValue(min, outputFormat, isDateType)}</strong>
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
            <strong>{formatValue(max, outputFormat, isDateType)}</strong>
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
              ⏩
            </Button>
            <Button
              variant="primary"
              onClick={goToLast}
              title="Go to last"
              aria-label="go to last"
              disabled={playing}
            >
              ⏭️
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
    PropTypes.oneOfType([PropTypes.number, PropTypes.string])
  ),
  rangeMode: PropTypes.bool,
  outputFormat: PropTypes.string.isRequired,
  dataType: PropTypes.string.isRequired,
  dateTimeDelta: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  speeds: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.number.isRequired,
    })
  ),
};

export default memo(Slider);
