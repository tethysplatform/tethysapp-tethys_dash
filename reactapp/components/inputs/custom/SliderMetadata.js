import { useState, useEffect } from "react";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";

export const SliderMetadata = ({ onChange, values, visualizationRef }) => {
  const [min, setMin] = useState(values.min ?? 0);
  const [max, setMax] = useState(values.max ?? 100);
  const [step, setStep] = useState(values.step ?? 1);

  const onMinChange = (e) => {
    const newValue = Number(e.target.value);
    setMin(newValue);
    onChange({ max, step, min: newValue });
  };

  const onMaxChange = (e) => {
    const newValue = Number(e.target.value);
    setMax(newValue);
    onChange({ min, step, max: newValue });
  };

  const onStepChange = (e) => {
    const newValue = Number(e.target.value);
    setStep(newValue);
    onChange({ min, max, step: newValue });
  };

  return (
    <>
      <NormalInput
        label="Minimum"
        value={min}
        type="number"
        onChange={onMinChange}
      />
      <NormalInput
        label="Maximum"
        value={max}
        type="number"
        onChange={onMaxChange}
      />
      <NormalInput
        label="Step"
        value={step}
        type="number"
        onChange={onStepChange}
      />
    </>
  );
};

SliderMetadata.propTypes = {
  onChange: PropTypes.func,
  values: PropTypes.shape({
    extent: PropTypes.string, // minX,minY,maxX,maxY or lon,lat,zoom
    variable: PropTypes.string,
  }),
  visualizationRef: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.any }),
  ]),
};
