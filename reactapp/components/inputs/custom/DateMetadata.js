import DateFormat from "components/inputs/DateFormat";
import CheckboxInput from "components/inputs/CheckboxInput";
import PropTypes from "prop-types";

const DateMetadata = ({ onChange, values }) => {
  const updateFormat = (newFormat) => {
    onChange({ ...values, format: newFormat });
  };

  const updateShowTimeInput = (showTimeInput) => {
    onChange({ ...values, showTimeInput: showTimeInput });
  };

  return (
    <>
      <CheckboxInput
        label="Show Time Input"
        onChange={updateShowTimeInput}
        value={values?.showTimeInput ?? true}
        divProps={{ style: { marginBottom: "1rem" } }}
      />
      <DateFormat onChange={updateFormat} value={values?.format} />
    </>
  );
};

DateMetadata.propTypes = {
  onChange: PropTypes.func.isRequired,
  values: PropTypes.shape({
    format: PropTypes.string,
    showTimeInput: PropTypes.bool,
  }),
};

export default DateMetadata;
