import { useState } from "react";
import PropTypes from "prop-types";
import { BsTrash } from "react-icons/bs";
import styled from "styled-components";

const RedTrashIcon = styled(BsTrash)`
  color: red;
`;

const DropdownMetadata = ({ onChange, values }) => {
  const choices = values?.choices ?? [];
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const updateChoices = (updatedChoices) => {
    onChange({
      ...(values ?? {}),
      choices: updatedChoices,
    });
  };

  const handleAddChoice = () => {
    const label = newLabel.trim();
    const value = newValue.trim();

    updateChoices([...choices, { label, value }]);
    setNewLabel("");
    setNewValue("");
  };

  const handleEditChoice = (index, field, fieldValue) => {
    const updatedChoices = choices.map((choice, choiceIndex) =>
      choiceIndex === index
        ? {
            ...choice,
            [field]: fieldValue,
          }
        : choice,
    );

    updateChoices(updatedChoices);
  };

  const handleRemoveChoice = (index) => {
    const updatedChoices = choices.filter(
      (_, choiceIndex) => choiceIndex !== index,
    );
    updateChoices(updatedChoices);
  };

  const handleMoveChoice = (index, direction) => {
    const targetIndex = index + direction;

    const updatedChoices = [...choices];
    const [movedChoice] = updatedChoices.splice(index, 1);
    updatedChoices.splice(targetIndex, 0, movedChoice);

    updateChoices(updatedChoices);
  };

  return (
    <div>
      <div className="mb-3">
        <b>Choices</b>
      </div>

      <div className="row g-2 align-items-end mb-3">
        <div className="col-12 col-md-5">
          <label className="form-label mb-1">Label</label>
          <input
            type="text"
            className="form-control"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g., United States"
            aria-label="New choice label"
          />
        </div>
        <div className="col-12 col-md-5">
          <label className="form-label mb-1">Value</label>
          <input
            type="text"
            className="form-control"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="e.g., us"
            aria-label="New choice value"
          />
        </div>
        <div className="col-12 col-md-2 d-grid">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAddChoice}
            disabled={!newLabel.trim() || !newValue.trim()}
            aria-label="Add choice"
          >
            Add
          </button>
        </div>
      </div>

      {choices.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: "35%" }}>Label</th>
                <th style={{ width: "35%" }}>Value</th>
                <th style={{ width: "15%" }}>Order</th>
                <th style={{ width: "15%" }}></th>
              </tr>
            </thead>
            <tbody>
              {choices.map((choice, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={choice.label}
                      onChange={(e) =>
                        handleEditChoice(index, "label", e.target.value)
                      }
                      aria-label={`Choice ${index + 1} label`}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={choice.value}
                      onChange={(e) =>
                        handleEditChoice(index, "value", e.target.value)
                      }
                      aria-label={`Choice ${index + 1} value`}
                    />
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => handleMoveChoice(index, -1)}
                        disabled={index === 0}
                        aria-label={`Move choice ${index + 1} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => handleMoveChoice(index, 1)}
                        disabled={index === choices.length - 1}
                        aria-label={`Move choice ${index + 1} down`}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline-danger"
                      onClick={() => handleRemoveChoice(index)}
                      aria-label={`Remove choice ${index + 1}`}
                    >
                      <RedTrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

DropdownMetadata.propTypes = {
  onChange: PropTypes.func.isRequired,
  values: PropTypes.shape({
    choices: PropTypes.arrayOf(
      PropTypes.shape({
        label: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
      }),
    ),
  }),
};

export default DropdownMetadata;
