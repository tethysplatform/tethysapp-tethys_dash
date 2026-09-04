import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import DataSelect from "components/inputs/DataSelect";

const FullInput = styled.input`
  width: 100%;
`;

// Deliberately not a <label>. It used to be, wrapping the whole table -- and a
// label with no `for` implicitly labels its first labelable descendant, so
// clicking anything inside it that is not itself a control forwarded the
// activation to the first input. Every cell was a plain text input until a
// select arrived, and react-select renders its control as a div: clicking it
// focused the first input instead and the dropdown shut on mouseup, which is
// when a label's activation behavior fires.
const FullLabel = styled.div`
  width: 100%;
`;

const CenteredTD = styled.td`
  text-align: center;
  vertical-align: middle;
`;

// Row types that render as a dropdown instead of an <input>. Multiplicity is
// declared here, never inferred from whether a stored value happens to contain
// the separator -- a single-valued argument whose value legitimately contains a
// comma would otherwise silently split into several selections.
const SELECT_TYPES = ["select", "multiselect"];

// The separator a multiselect joins its selections back into. Comma matches the
// only multi-valued source argument today (GeoParquet columns); callers that
// need another pass it on the row's select config.
const DEFAULT_SELECT_SEPARATOR = ",";

// Pair a stored string with the option that produced it so an option whose
// label differs from its value still displays as the label. A value with no
// matching option is shown as itself rather than dropped: a saved value the
// source no longer offers -- or one typed while the read failed -- has to stay
// selected and editable, which is the whole point of the creatable variant.
const optionForValue = (value, options) =>
  options?.find((option) => option?.value === value) ?? {
    value,
    label: value,
  };

// react-select hands back {value, label} (plus __isNew__ on a typed entry).
// Every other row type in this table stores a plain string, and both
// isRowEmpty and getEmptyRow test rows for "" -- so unwrapping here is what
// keeps a select row indistinguishable from a text row everywhere downstream.
const optionToValue = (option) => option?.value ?? "";

// Seed a multiselect from its stored string. Whitespace after the separator is
// normal in a hand-typed list ("elev, depth"), and the GeoParquet reader's own
// column parsing trims before matching -- an untrimmed seed would show entries
// that match no fetched option and read as absent from the source.
const splitSelectValue = (value, separator) =>
  String(value ?? "")
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);

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
  selectConfigs,
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
    if (!headers && values.length > 0) {
      setTableHeaders(Object.keys(values[0]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  // check to see if all the field in a row are either a boolean or have empty strings as values
  const isRowEmpty = (row) =>
    Object.keys(tableRows[0]).every(
      (field) => typeof row[field] === "boolean" || row[field] === "",
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
                    if (SELECT_TYPES.includes(types?.[rowIndex])) {
                      // Checked ahead of the fallback branch on purpose: that
                      // branch feeds types[rowIndex] straight to <input
                      // type=...>, so a "select" row falling through would
                      // render an input of an unknown type and swallow the
                      // dropdown entirely.
                      const isMulti = types[rowIndex] === "multiselect";
                      const {
                        options,
                        isLoading,
                        onMenuOpen,
                        separator = DEFAULT_SELECT_SEPARATOR,
                        content,
                      } = selectConfigs?.[rowIndex] ?? {};

                      const selectedOption = isMulti
                        ? splitSelectValue(row[field], separator).map((entry) =>
                            optionForValue(entry, options),
                          )
                        : row[field] === "" || row[field] == null
                          ? null
                          : optionForValue(row[field], options);

                      return (
                        <td key={fieldIndex}>
                          <DataSelect
                            // The table's own accessible-name convention --
                            // existing tests and the source pane both query
                            // rows by it, so a select row has to answer to the
                            // same name a text row would.
                            aria-label={`${field} Input ${rowIndex}`}
                            selectedOption={selectedOption}
                            options={options ?? []}
                            isMulti={isMulti}
                            isLoading={isLoading}
                            onMenuOpen={onMenuOpen}
                            // react-select suppresses its create option while
                            // isLoading, which would lock out exactly the
                            // author this control is for: the one who already
                            // knows the name and does not want to wait on a
                            // read that may be slow or about to fail.
                            allowCreateWhileLoading
                            isClearable
                            onChange={(selection) =>
                              handleChange(
                                isMulti
                                  ? (selection ?? [])
                                      .map(optionToValue)
                                      .join(separator)
                                  : optionToValue(selection),
                                rowIndex,
                                field,
                              )
                            }
                            // The closed select shows its placeholder already,
                            // so there is no hover-only case to cover here the
                            // way there is for a text input.
                            placeholder={inputPlaceholders?.[rowIndex]?.[field]}
                            divProps={{ style: { marginBottom: 0 } }}
                          />
                          {/* The table owns the row markup, so per-row status
                              -- a failed read's reason, a re-read control --
                              has nowhere to live but a slot the caller fills.
                              Without it the caller has to render outside the
                              table, detached from the row it describes. */}
                          {content}
                        </td>
                      );
                    } else if (
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
      ]),
    ),
  ).isRequired, // array of objects (rows) that contain colum keys and values
  disabledFields: PropTypes.arrayOf(PropTypes.string), // array of fields to not have an input
  hiddenFields: PropTypes.arrayOf(PropTypes.string), // array of fields to hide
  allowRowCreation: PropTypes.bool, // determines if the table rows can be added
  headers: PropTypes.arrayOf(PropTypes.string), // array of strings to use for table headers
  placeholders: PropTypes.arrayOf(PropTypes.objectOf(PropTypes.string)), // object with key as field and value as placeholder
  show_placeholder_on_hover: PropTypes.bool, // makes the input title the same as the placeholder so it can be seen on hover
  types: PropTypes.arrayOf(PropTypes.string), // determines the type for each input. index matches the placeholders
  // per-row configuration for "select"/"multiselect" rows, indexed the same way
  // as types and placeholders. `content` renders beneath that row's select and
  // is where a caller puts per-row status it cannot otherwise place, since the
  // table owns the row markup.
  selectConfigs: PropTypes.arrayOf(
    PropTypes.shape({
      options: PropTypes.array,
      isLoading: PropTypes.bool,
      onMenuOpen: PropTypes.func,
      separator: PropTypes.string,
      content: PropTypes.node,
    }),
  ),
};

export default InputTable;
