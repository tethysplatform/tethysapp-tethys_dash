import React, { useState, useRef } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";

const FullInput = styled.input`
  width: 100%;
`;
const FullLabel = styled.label`
  width: 100%;
`;

function InputTable({ label, onChange, values, disabledFields }) {
  const [userInputs, setUserInputs] = useState(values || []);
  const inputRefs = useRef([]);
  const fields = values.length > 0 ? Object.keys(values[0]) : [];
  const emptyRow = fields.reduce((acc, field) => {
    acc[field] = ""; // Initialize empty row with empty strings
    return acc;
  }, {});

  const isRowEmpty = (row) => fields.every((field) => row[field] === "");

  const handleKeyDown = (e, rowIndex, fieldIndex) => {
    if (
      e.key === "Tab" &&
      rowIndex === userInputs.length - 1 && // Only trigger on the last row
      fieldIndex === fields.length - 1 // Only trigger on the last field in the row
    ) {
      e.preventDefault(); // Prevent default tab behavior

      // Add a new row
      const newUserInputs = [...userInputs, emptyRow];
      setUserInputs(newUserInputs);
      onChange(newUserInputs);

      // Focus the first input of the new row
      setTimeout(() => {
        const newRowStartIndex =
          newUserInputs.length * fields.length - fields.length;
        const firstFieldRef = inputRefs.current[newRowStartIndex];
        if (firstFieldRef) {
          firstFieldRef.focus();
        }
      }, 0); // Delay to ensure DOM updates
    } else if (
      e.key === "Backspace" &&
      userInputs[rowIndex][fields[fieldIndex]] === "" &&
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
          const prevInputIndex = prevRowIndex * fields.length;
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
            {fields.map((colHeader, index) => (
              <th key={index} className="text-center">
                {colHeader}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {userInputs.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {fields.map((field, fieldIndex) => (
                <td key={fieldIndex}>
                  <FullInput
                    type="text"
                    value={row[field]}
                    ref={(el) =>
                      (inputRefs.current[
                        rowIndex * fields.length + fieldIndex
                      ] = el)
                    }
                    onChange={(e) => handleChange(e, rowIndex, field)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, fieldIndex)}
                    disabled={
                      disabledFields ? disabledFields.includes(field) : false
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </FullLabel>
  );
}

export default InputTable;
