import { useState, useEffect, memo } from "react";
import MultiInput from "components/inputs/MultiInput";

const CSVUploaderMetadata = ({ onChange, values }) => {
  const [headers, setHeaders] = useState(values?.headers ?? []);

  useEffect(() => {
    onChange({ ...values, headers: headers });
  }, [headers]);

  function handleHeadersChange(newValues) {
    console.log("Metadata changed:", newValues);
    setHeaders(newValues);
  }

  return <MultiInput label="CSV Columns" onChange={handleHeadersChange} values={headers}/>;
};

export default CSVUploaderMetadata;
