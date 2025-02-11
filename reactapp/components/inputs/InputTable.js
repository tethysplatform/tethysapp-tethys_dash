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
  allowRowCreation,
}) => {
  const [userInputs, setUserInputs] = useState(values);
  const inputRefs = useRef([]);

  // get a new row with empty values that will be appended to table
  const getEmptyRow = () => {
    return Object.keys(userInputs[0]).reduce((acc, field) => {
      acc[field] = typeof userInputs[0][field] === "boolean" ? true : ""; // Initialize empty row with empty strings
      return acc;
    }, {});
  };

  useEffect(() => {
    setUserInputs(values);
  }, [values]);

  // check to see if all the field in a row are either a boolean or have empty strings as values
  const isRowEmpty = (row) =>
    Object.keys(userInputs[0]).every(
      (field) => typeof row[field] === "boolean" || row[field] === ""
    );

  const handleKeyDown = (e, rowIndex, fieldIndex) => {
    // create a new row if allowRowCreation is true and tab is pressed on the last row and last field
    if (
      e.key === "Tab" &&
      allowRowCreation &&
      rowIndex === userInputs.length - 1 && // Only trigger on the last row
      fieldIndex === Object.keys(userInputs[0]).length - 1 // Only trigger on the last field in the row
    ) {
      e.preventDefault(); // Prevent default tab behavior

      // Add a new row
      const newUserInputs = [...userInputs, getEmptyRow()];
      setUserInputs(newUserInputs);
      onChange(newUserInputs);

      // Focus the first input of the new row
      setTimeout(() => {
        const newRowStartIndex =
          newUserInputs.length * Object.keys(userInputs[0]).length -
          Object.keys(userInputs[0]).length;
        const firstFieldRef = inputRefs.current[newRowStartIndex];
        firstFieldRef.focus();
      }, 0); // Delay to ensure DOM updates
    } else if (
      // deletes row if allowRowCreation is true and backspace is pressed on a row that has all empty values
      e.key === "Backspace" &&
      allowRowCreation &&
      userInputs.length > 1 &&
      isRowEmpty(userInputs[rowIndex])
    ) {
      e.preventDefault(); // Prevent default backspace behavior
      const newUserInputs = userInputs.filter((_, index) => index !== rowIndex);
      setUserInputs(newUserInputs);
      onChange(newUserInputs);

      // Focus the previous row's first input
      const prevRowIndex = rowIndex - 1;
      const prevInputIndex = prevRowIndex * Object.keys(userInputs[0]).length;
      const prevInput = inputRefs.current[prevInputIndex];
      prevInput.focus();
    }
  };

  const handleChange = (newValue, rowIndex, field) => {
    const newUserInputs = [...userInputs];
    newUserInputs[rowIndex][field] = newValue;
    setUserInputs(newUserInputs);
    onChange(newUserInputs);
  };

  return (
    <FullLabel>
      <b>{label}</b>:{" "}
      {userInputs.length > 0 && (
        <Table striped bordered hover size="sm">
          {/* Create the headers from the keys of the user inputs object */}
          <thead>
            <tr>
              {Object.keys(userInputs[0]).map((colHeader, index) => {
                return (
                  <th key={index} className="text-center">
                    {colHeader}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* loop through inputs to create the rows and fields */}
            {userInputs.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {Object.keys(row).map((field, fieldIndex) => {
                  {
                    /* check for disabled fields which will be displayed as text */
                  }
                  if (disabledFields && disabledFields.includes(field)) {
                    return (
                      <CenteredTD key={fieldIndex}>
                        {typeof row[field] === "string"
                          ? row[field]
                          : JSON.stringify(row[field])}
                      </CenteredTD>
                    );
                  } else {
                    if (typeof row[field] === "boolean") {
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
                            type="text"
                            value={row[field]?.value ?? row[field]}
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
                            placeholder={row[field]?.placeholder}
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
  allowRowCreation: PropTypes.bool, // determines if the table rows can be added
  placeholders: PropTypes.objectOf([PropTypes.string]), // object with key as field and value as placeholder
};

export default InputTable;
