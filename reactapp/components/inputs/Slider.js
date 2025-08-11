import { useState, useEffect, useRef } from "react";
import { Button, Form, Row, Col } from "react-bootstrap";
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
  return formatDate(date, template);
}

const formatValue = (val, outputFormat, isDateType) => {
  let formattedValue;
  if (isDateType) {
    formattedValue = formatDateValue(val, outputFormat);
  } else {
    formattedValue = formatNumber(val, outputFormat);
  }

  return formattedValue;
};

const Slider = ({
  label,
  step,
  min,
  max,
  initialValue,
  outputFormat,
  dataType,
  dateTimeDelta, // pass the unit like "Days", "Months", etc.
  onChange,
  speeds = [
    { label: "Slow", value: 1000 },
    { label: "Medium", value: 500 },
    { label: "Fast", value: 200 },
  ],
}) => {
  const isDateType = dataType === "Date";
  const unit = dateTimeDelta;
  const [value, setValue] = useState(initialValue);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(speeds[1].value);
  const intervalRef = useRef(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    let formattedValue = formatValue(value, outputFormat, isDateType);
    onChange(formattedValue);
  }, [value]);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setValue((v) => {
          if (isDateType && unit) {
            const currentDate = new Date(v);
            const nextDate = indexToDate(
              dateToIndex(currentDate, new Date(min), unit) + Number(step),
              new Date(min),
              unit
            );
            return nextDate > new Date(max) ? min : nextDate.toISOString();
          } else {
            const next = v + Number(step);
            return next > max ? min : next;
          }
        });
      }, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, step, min, max, isDateType, unit]);

  const onRangeChange = (e) => {
    let rawIndex = Number(e.target.value);

    // Snap to nearest multiple of step
    const snappedIndex = Math.round(rawIndex / step) * step;

    if (isDateType && unit) {
      const newDate = indexToDate(snappedIndex, new Date(min), unit);
      setValue(newDate.toISOString());
    } else {
      setValue(snappedIndex);
    }
  };

  const displayValue = formatValue(value, outputFormat, isDateType);

  const sliderValue =
    isDateType && unit
      ? dateToIndex(new Date(value), new Date(min), unit)
      : value;

  const sliderMin = isDateType && unit ? 0 : min;
  const sliderMax =
    isDateType && unit ? dateToIndex(new Date(max), new Date(min), unit) : max;

  const onPlayClick = () => setPlaying(true);
  const onStopClick = () => setPlaying(false);

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
          <Col xs="auto" className="text-center">
            <strong>{formatValue(min, outputFormat, isDateType)}</strong>
          </Col>

          {/* Slider */}
          <Col>
            <Form.Range
              min={sliderMin}
              max={sliderMax}
              step={1}
              value={sliderValue}
              onChange={onRangeChange}
              disabled={playing}
            />
            <div className="text-center fw-bold mt-2">{displayValue}</div>
          </Col>

          {/* End value */}
          <Col xs="auto" className="text-center">
            <strong>{formatValue(max, outputFormat, isDateType)}</strong>
          </Col>

          {/* Controls */}
          <Col xs="auto" className="d-flex flex-column gap-2">
            {!playing ? (
              <Button variant="primary" onClick={onPlayClick} title="Play">
                ▶️
              </Button>
            ) : (
              <Button variant="danger" onClick={onStopClick} title="Stop">
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

export default Slider;
