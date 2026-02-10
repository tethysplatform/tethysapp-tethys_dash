import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";
import DateFormat from "components/inputs/DateFormat";

const DateRangeMetadata = ({ onChange, values }) => {
  return (
    <>
      <NormalInput
        label="Start Date Variable Name"
        onChange={(e) =>
          onChange({ ...values, startDateVariable: e.target.value })
        }
        value={values?.startDateVariable || ""}
        type="text"
        ariaLabel="Start Date Variable Name Input"
        placeholder="e.g., start_date"
        divProps={{ style: { marginBottom: "1rem" } }}
      />
      <NormalInput
        label="End Date Variable Name"
        onChange={(e) =>
          onChange({ ...values, endDateVariable: e.target.value })
        }
        value={values?.endDateVariable || ""}
        type="text"
        ariaLabel="End Date Variable Name Input"
        placeholder="e.g., end_date"
        divProps={{ style: { marginBottom: "1rem" } }}
      />
      <DateFormat
        onChange={(newValue) => onChange({ ...values, format: newValue })}
        value={values?.format}
      />
    </>
  );
};

DateRangeMetadata.propTypes = {
  onChange: PropTypes.func.isRequired,
  values: PropTypes.shape({
    startDateVariable: PropTypes.string,
    endDateVariable: PropTypes.string,
    format: PropTypes.string,
  }),
};

export default DateRangeMetadata;
