import { useState, useEffect } from "react";
import MultiInput from "components/inputs/MultiInput";
import PropTypes from "prop-types";

const CSVUploaderMetadata = ({ onChange, values }) => {
  const [headers, setHeaders] = useState(values?.headers ?? []);

  useEffect(() => {
    onChange({ ...values, headers: headers });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  function handleHeadersChange(newValues) {
    setHeaders(newValues);
  }

  return (
    <MultiInput
      label="CSV Columns"
      onChange={handleHeadersChange}
      values={headers}
    />
  );
};

CSVUploaderMetadata.propTypes = {
  onChange: PropTypes.func.isRequired,
  values: PropTypes.shape({
    headers: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default CSVUploaderMetadata;
