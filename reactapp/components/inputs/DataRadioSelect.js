import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";

const StyledDiv = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 1rem;
`;

const DataRadioSelect = ({
  label,
  selectedRadio,
  radioOptions,
  onChange,
  divProps,
  labelProps,
}) => {
  let RadioButtons = [];
  const groupName = label?.replace(" ", "-") ?? "radios";
  for (let i = 0; i < radioOptions.length; i++) {
    RadioButtons.push(
      <Form.Check
        key={i}
        label={radioOptions[i]["label"]}
        aria-label={radioOptions[i]["label"]}
        name={groupName}
        type="radio"
        onChange={() => onChange(radioOptions[i]["value"])}
        value={radioOptions[i]["value"]}
        checked={selectedRadio === radioOptions[i]["value"]}
        style={{ marginBottom: 0 }}
      />,
    );
  }

  return (
    <StyledDiv {...divProps}>
      {label && (
        <span {...labelProps}>
          <b>{label}</b>:
        </span>
      )}
      {RadioButtons}
    </StyledDiv>
  );
};

DataRadioSelect.propTypes = {
  label: PropTypes.string,
  onChange: PropTypes.func,
  selectedRadio: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  radioOptions: PropTypes.array,
  divProps: PropTypes.object,
  labelProps: PropTypes.object,
};

export default DataRadioSelect;
