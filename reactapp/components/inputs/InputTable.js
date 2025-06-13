import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";

const FullInput = styled.input`
  width: 100%;
`;

const FullLabel = styled.label`
  width: 100%;
`;

const CenteredTD = styled.td`
  text-align: center;
  vertical-align: middle;
`;

const InputTable = ({
  label,
  onChange,
  values,
  disabledFields,
  hiddenFields = [],
  allowRowCreation,
  headers,
  placeholders,
  show_placeholder_on_hover,
  types,
}) => {
  const [tableRows, setTableRows] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [inputPlaceholders, setInputPlaceholders] = useState([]);
  const inputRefs = useRef([]);

  // get a new row with empty values that will be appended to table
  const getEmptyRow = () => {
    return Object.keys(tableRows[0]).reduce((acc, field) => {
      acc[field] = typeof tableRows[0][field] === "boolean" ? true : ""; // Initialize empty row with empty strings
      return acc;
    }, {});
  };

  useEffect(() => {
    setTableHeaders(headers);
  }, [headers]);

  useEffect(() => {
    setInputPlaceholders(placeholders);
  }, [placeholders]);

  useEffect(() => {
    setTableRows(values);
    if (!headers) {
      setTableHeaders(Object.keys(values[0]));
    }
    // eslint-disable-next-line
  }, [values]);

  // check to see if all the field in a row are either a boolean or have empty strings as values
  const isRowEmpty = (row) =>
    Object.keys(tableRows[0]).every(
      (field) => typeof row[field] === "boolean" || row[field] === ""
    );

  const handleKeyDown = (e, rowIndex, fieldIndex) => {
    // create a new row if allowRowCreation is true and tab is pressed on the last row and last field
    if (
      e.key === "Tab" &&
      allowRowCreation &&
      rowIndex === tableRows.length - 1 && // Only trigger on the last row
      fieldIndex === Object.keys(tableRows[0]).length - 1 // Only trigger on the last field in the row
    ) {
      e.preventDefault(); // Prevent default tab behavior

      // Add a new row
      const newTableRows = [...tableRows, getEmptyRow()];
      setTableRows(newTableRows);
      onChange({ fullChange: newTableRows });

      // Focus the first input of the new row
      setTimeout(() => {
        const newRowStartIndex =
          newTableRows.length * Object.keys(tableRows[0]).length -
          Object.keys(tableRows[0]).length;
        const firstFieldRef = inputRefs.current[newRowStartIndex];
        firstFieldRef.focus();
      }, 0); // Delay to ensure DOM updates
    } else if (
      // deletes row if allowRowCreation is true and backspace is pressed on a row that has all empty values
      e.key === "Backspace" &&
      allowRowCreation &&
      tableRows.length > 1 &&
      isRowEmpty(tableRows[rowIndex])
    ) {
      e.preventDefault(); // Prevent default backspace behavior
      const newTableRows = tableRows.filter((_, index) => index !== rowIndex);
      setTableRows(newTableRows);
      onChange({ fullChange: newTableRows });

      // Focus the previous row's first input
      const prevRowIndex = rowIndex - 1;
      const prevInputIndex = prevRowIndex * Object.keys(tableRows[0]).length;
      const prevInput = inputRefs.current[prevInputIndex];
      prevInput.focus();
    }
  };

  const handleChange = (newValue, rowIndex, field) => {
    const newTableRows = [...tableRows];
    newTableRows[rowIndex][field] = newValue;
    setTableRows(newTableRows);

    onChange({ newValue, rowIndex, field });
  };

  return (
    <FullLabel>
      <b>{label}</b>:{" "}
      {tableRows.length > 0 && (
        <Table striped bordered hover size="sm">
          <thead>
            <tr>
              {tableHeaders.map((colHeader, index) => {
                if (hiddenFields.includes(colHeader)) return null;

                return (
                  <th key={index} className="text-center">
                    {colHeader}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Object.keys(row).map((field, fieldIndex) => {
                  if (hiddenFields.includes(field)) return null;

                  if (disabledFields && disabledFields.includes(field)) {
                    return (
                      <CenteredTD key={fieldIndex}>
                        {typeof row[field] === "string"
                          ? row[field]
                          : JSON.stringify(row[field])}
                      </CenteredTD>
                    );
                  } else {
                    if (
                      typeof row[field] === "boolean" ||
                      types?.[rowIndex] === "checkbox"
                    ) {
                      return (
                        <CenteredTD key={fieldIndex}>
                          <input
                            type="checkbox"
                            checked={row[field]}
                            onChange={(e) =>
                              handleChange(e.target.checked, rowIndex, field)
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, rowIndex, fieldIndex)
                            }
                            aria-label={`${field} Input ${rowIndex}`}
                          />
                        </CenteredTD>
                      );
                    } else {
                      return (
                        <td key={fieldIndex}>
                          <FullInput
                            aria-label={`${field} Input ${rowIndex}`}
                            type={types?.[rowIndex] ?? "text"}
                            value={row[field]}
                            ref={(el) =>
                              (inputRefs.current[
                                rowIndex * Object.keys(row).length + fieldIndex
                              ] = el)
                            }
                            onChange={(e) =>
                              handleChange(e.target.value, rowIndex, field)
                            }
                            onKeyDown={(e) =>
                              handleKeyDown(e, rowIndex, fieldIndex)
                            }
                            placeholder={
                              inputPlaceholders &&
                              inputPlaceholders[rowIndex][field]
                            }
                            title={
                              show_placeholder_on_hover &&
                              inputPlaceholders &&
                              inputPlaceholders[rowIndex][field]
                            }
                          />
                        </td>
                      );
                    }
                  }
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </FullLabel>
  );
};

InputTable.propTypes = {
  label: PropTypes.string.isRequired, // label for the table
  onChange: PropTypes.func.isRequired, // callback function for when table values change
  values: PropTypes.arrayOf(
    PropTypes.objectOf(
      PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.bool,
        PropTypes.shape({
          value: PropTypes.string.isRequired,
          placeholder: PropTypes.string.isRequired,
        }),
      ])
    )
  ).isRequired, // array of objects (rows) that contain colum keys and values
  disabledFields: PropTypes.arrayOf(PropTypes.string), // array of fields to not have an input
  hiddenFields: PropTypes.arrayOf(PropTypes.string), // array of fields to hide
  allowRowCreation: PropTypes.bool, // determines if the table rows can be added
  headers: PropTypes.arrayOf(PropTypes.string), // array of strings to use for table headers
  placeholders: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string)), // object with key as field and value as placeholder
  show_placeholder_on_hover: PropTypes.bool, // makes the input title the same as the placeholder so it can be seen on hover
  types: PropTypes.arrayOf(PropTypes.string), // determines the type for each input. index matches the placeholders
};

export default InputTable;
