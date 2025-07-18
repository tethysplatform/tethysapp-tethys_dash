import { useState, useEffect, useRef } from "react";
import { Button, Form, Row, Col } from "react-bootstrap";
import NormalInput from "components/inputs/NormalInput";
import { parse } from "date-fns";

const Slider = ({
  step = 1,
  min,
  max,
  initialValue = 50,
  speeds = [
    { label: "Slow", value: 1000 },
    { label: "Medium", value: 500 },
    { label: "Fast", value: 200 },
  ],
}) => {
  const [value, setValue] = useState(initialValue);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(speeds[1].value);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setValue((v) => {
          const next = v + Number(step);
          return next > max ? min : next;
        });
      }, speed);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, step, min, max]);

  const onRangeChange = (e) => setValue(Number(e.target.value));
  const onPlayClick = () => setPlaying(true);
  const onStopClick = () => setPlaying(false);

  return (
    <Form>
      <Row className="align-items-center">
        {/* Start value */}
        <Col xs="auto" className="text-center">
          <strong>{min}</strong>
        </Col>

        {/* Slider */}
        <Col>
          <Form.Range
            min={min}
            max={max}
            step={Number(step)}
            value={value}
            onChange={onRangeChange}
            disabled={playing}
          />
          <div className="text-center fw-bold mt-2">{value}</div>
        </Col>

        {/* End value */}
        <Col xs="auto" className="text-center">
          <strong>{max}</strong>
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
  );
};

export default Slider;
