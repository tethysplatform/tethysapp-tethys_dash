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

  useEffect(() => {
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
    // eslint-disable-next-line
  }, [rangeMode, isDateType, onChange, initialRange, initialValue, min, max]);

  useEffect(() => {
    if (rangeMode) {
      onChange(
        value.map((v) => formatValue(v, outputFormat, isDateType)).join(",")
      );
    } else {
      onChange(formatValue(value, outputFormat, isDateType));
    }
    // eslint-disable-next-line
  }, [value, outputFormat]);

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
                indexToDate(nextStart, minDateObj, unit).toISOString(),
                indexToDate(nextEnd, minDateObj, unit).toISOString(),
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
                : nextDate.toISOString();
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
          indexToDate(
            idx,
            parseDateMath({ value: min, type: "date-hour" }),
            unit
          ).toISOString()
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
          parseDateMath({ value: min, type: "date-hour" }),
          unit
        );
        setValue(newDate.toISOString());
      } else {
        setValue(snapped);
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
              parseDateMath({ value: v, type: "date-hour" }),
              parseDateMath({ value: min, type: "date-hour" }),
              unit
            )
          )
        : value;
    }
    return isDateType && unit
      ? dateToIndex(
          parseDateMath({ value, type: "date-hour" }),
          parseDateMath({ value: min, type: "date-hour" }),
          unit
        )
      : value;
  })();

  const sliderMin = isDateType && unit ? 0 : min;
  const sliderMax =
    isDateType && unit
      ? dateToIndex(
          parseDateMath({ value: max, type: "date-hour" }),
          parseDateMath({ value: min, type: "date-hour" }),
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
        <Row className="align-items-center">
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

          {/* Controls */}
          <Col xs="auto" className="d-flex flex-column gap-2">
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
            <Form.Select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={playing}
              aria-label="Speed select"
            >
              {speeds.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Form.Select>
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
