import PropTypes from "prop-types";
import styled from "styled-components";
import Form from "react-bootstrap/Form";

const StyledDiv = styled.div`
  padding-bottom: 1rem;
  width: 100%;
`;

const DataRadioSelect = ({
  label,
  selectedRadio,
  radioOptions,
  onChange,
  blockedRadio,
}) => {
  let RadioButtons = [];
  const groupName = label?.replace(" ", "-") ?? "radios";
  for (let i = 0; i < radioOptions.length; i++) {
    RadioButtons.push(
      <Form.Check
        inline={blockedRadio ? false : true}
        key={i}
        label={radioOptions[i]["label"]}
        aria-label={radioOptions[i]["label"]}
        name={groupName}
        type="radio"
        onChange={onChange}
        value={radioOptions[i]["value"]}
        checked={selectedRadio === radioOptions[i]["value"]}
      />
    );
  }

  return (
    <StyledDiv>
      {label && (
        <>
          <b>{label}</b>:
        </>
      )}
      <br />
      {RadioButtons}
    </StyledDiv>
  );
};

DataRadioSelect.propTypes = {
  label: PropTypes.string,
  onChange: PropTypes.func,
  selectedRadio: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  radioOptions: PropTypes.array,
  blockedRadio: PropTypes.bool,
};

export default DataRadioSelect;
