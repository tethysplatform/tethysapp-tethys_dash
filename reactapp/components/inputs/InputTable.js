import React, { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";

const FullInput = styled.input`
  width: 100%;
`;
const FullLabel = styled.label`
  width: 100%;
`;

function InputTable({
  label,
  onChange,
  values,
  disabledFields,
  hiddenFields,
  staticRows,
  placeholders,
}) {
  const [userInputs, setUserInputs] = useState(values);
  const inputRefs = useRef([]);
  const placeholderRefs = useRef(placeholders);

  const getEmptyRow = () => {
    return Object.keys(userInputs[0]).current.reduce((acc, field) => {
      acc[field] = ""; // Initialize empty row with empty strings
      return acc;
    }, {});
  };

  useEffect(() => {
    setUserInputs(values);
  }, [values]);

  useEffect(() => {
    placeholderRefs.current = placeholders;
  }, [placeholders]);

  const isRowEmpty = (row) =>
    Object.keys(userInputs[0]).every((field) => row[field] === "");

  const handleKeyDown = (e, rowIndex, fieldIndex) => {
    if (
      e.key === "Tab" &&
      !staticRows &&
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
        if (firstFieldRef) {
          firstFieldRef.focus();
        }
      }, 0); // Delay to ensure DOM updates
    } else if (
      e.key === "Backspace" &&
      !staticRows &&
      userInputs[rowIndex][Object.keys(userInputs[0])[fieldIndex]] === "" &&
      userInputs.length > 1
    ) {
      // If the current input is empty, check if the whole row is empty
      if (isRowEmpty(userInputs[rowIndex])) {
        e.preventDefault(); // Prevent default backspace behavior
        const newUserInputs = userInputs.filter(
          (_, index) => index !== rowIndex
        );
        setUserInputs(newUserInputs);
        onChange(newUserInputs);

        // Focus the previous row's first input if it exists
        const prevRowIndex = rowIndex - 1;
        if (prevRowIndex >= 0) {
          const prevInputIndex =
            prevRowIndex * Object.keys(userInputs[0]).length;
          const prevInput = inputRefs.current[prevInputIndex];
          if (prevInput) {
            prevInput.focus();
          }
        }
      }
    }
  };

  const handleChange = (e, rowIndex, field) => {
    const newUserInputs = [...userInputs];
    newUserInputs[rowIndex][field] = e.target.value;
    setUserInputs(newUserInputs);
    onChange(newUserInputs);
  };

  return (
    <FullLabel>
      <b>{label}</b>:{" "}
      <Table striped bordered hover size="sm">
        <thead>
          <tr>
            {Object.keys(userInputs[0]).map((colHeader, index) => {
              if (
                !hiddenFields ||
                (hiddenFields && !hiddenFields.includes(colHeader))
              ) {
                return (
                  <th key={index} className="text-center">
                    {colHeader}
                  </th>
                );
              }
            })}
          </tr>
        </thead>
        <tbody>
          {userInputs.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {Object.keys(row).map((field, fieldIndex) => {
                if (
                  !hiddenFields ||
                  (hiddenFields && !hiddenFields.includes(field))
                ) {
                  if (disabledFields && disabledFields.includes(field)) {
                    return (
                      <td key={fieldIndex}>
                        {typeof row[field] === "string"
                          ? row[field]
                          : JSON.stringify(row[field])}
                      </td>
                    );
                  } else {
                    return (
                      <td key={fieldIndex}>
                        <FullInput
                          type="text"
                          value={row[field]}
                          ref={(el) =>
                            (inputRefs.current[
                              rowIndex * Object.keys(row).length + fieldIndex
                            ] = el)
                          }
                          onChange={(e) => handleChange(e, rowIndex, field)}
                          onKeyDown={(e) =>
                            handleKeyDown(e, rowIndex, fieldIndex)
                          }
                          placeholder={
                            placeholderRefs.current &&
                            placeholderRefs.current[rowIndex][fieldIndex]
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
    </FullLabel>
  );
}

export default InputTable;
