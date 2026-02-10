import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import NormalInput from "components/inputs/NormalInput";

const DateFormat = ({ value, onChange, divProps }) => {
  const [outputFormat, setOutputFormat] = useState(
    value || "MM/dd/yyyy'T'HH:mm",
  );

  useEffect(() => {
    onChange(outputFormat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputFormat]);

  return (
    <NormalInput
      label="Output Format"
      value={outputFormat}
      type="text"
      onChange={(e) => setOutputFormat(e.target.value)}
      placeholder="date-fns format tokens; e.g., MM/dd/yyyy, MM/dd/yyyy'T'HH:mm"
      divProps={divProps}
    />
  );
};

DateFormat.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  divProps: PropTypes.object,
};

export default DateFormat;
