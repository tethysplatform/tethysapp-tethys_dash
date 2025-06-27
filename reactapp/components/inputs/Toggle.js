import { useState, useEffect } from "react";
import styled from "styled-components";
import { Form } from "react-bootstrap";
import PropTypes from "prop-types";

const CenteredForm = styled(Form)`
  align-content: center;
`;

const Toggle = ({ checked, label, uncheckedLabel, checkedLabel, onChange }) => {
  const [toggleValue, setToggleValue] = useState(checked);

  useEffect(() => {
    setToggleValue(checked);
  }, [checked]);

  function onToggleChange(e) {
    setToggleValue(e.target.checked);
    onChange(e.target.checked);
  }

  return (
    <CenteredForm>
      <Form.Group>
        <Form.Label className="fw-bold text-center w-100 m-0">
          {label}
        </Form.Label>
        <div className="d-flex justify-content-center align-items-center gap-3">
          <span>{uncheckedLabel}</span>
          <Form.Check
            type="switch"
            id="toggle-switch"
            checked={toggleValue}
            onChange={onToggleChange}
            aria-label={`${label} Toggle`}
          />
          <span>{checkedLabel}</span>
        </div>
      </Form.Group>
    </CenteredForm>
  );
};

Toggle.propTypes = {
  checked: PropTypes.bool,
  label: PropTypes.string,
  uncheckedLabel: PropTypes.string,
  checkedLabel: PropTypes.string,
  onChange: PropTypes.func,
};

export default Toggle;
