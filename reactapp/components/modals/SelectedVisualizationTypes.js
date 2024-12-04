import { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import { useUserSettingsContext } from "components/contexts/UserSettingsContext";

const StyledList = styled.ul`
  list-style: none;
`;
const StyledInput = styled.input`
  margin-right: 0.5rem;
`;
const StyledModalBody = styled(Modal.Body)`
  height: 75vh;
  max-height: 75vh;
  overflow-y: auto;
`;

function SelectedVisualizationTypesModal({
  showModal,
  setShowModal,
  vizOptions,
}) {
  const { userSettings } = useUserSettingsContext();
  const [selectedOptions, setSelectedOptions] = useState([]);

  let allOptions = [];
  const vizOptionsGroups = {};
  for (const vizOptionGroup of vizOptions) {
    const vizOptionGroupOptions = [vizOptionGroup.label];
    for (const vizOptionGroupOption of vizOptionGroup.options) {
      vizOptionGroupOptions.push(vizOptionGroupOption.label);
    }
    vizOptionsGroups[vizOptionGroup.label] = vizOptionGroupOptions;
    allOptions = [...allOptions, ...vizOptionGroupOptions];
  }

  useEffect(() => {
    const deselectedVisualizations = userSettings.deselected_visualizations;
    setSelectedOptions(
      allOptions.filter((option) => !deselectedVisualizations.includes(option))
    );
  }, []);

  const handleCheckboxChange = (event) => {
    const value = event.target.value;
    const isChecked = event.target.checked;

    if (isChecked) {
      if (value in vizOptionsGroups) {
        setSelectedOptions([...selectedOptions, ...vizOptionsGroups[value]]);
      } else {
        setSelectedOptions([...selectedOptions, value]);
      }
    } else {
      if (value in vizOptionsGroups) {
        setSelectedOptions(
          selectedOptions.filter(
            (option) => !vizOptionsGroups[value].includes(option)
          )
        );
      } else {
        setSelectedOptions(
          selectedOptions.filter((option) => option !== value)
        );
      }
    }
  };

  return (
    <>
      <Modal
        className="visualization-type-settings"
        show={showModal}
        onHide={() => setShowModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Available Visualization Types</Modal.Title>
        </Modal.Header>
        <StyledModalBody>
          <p>
            Select/Deselect the options that will appear in the "Visualization
            Type" selector.
          </p>
          <br></br>
          {vizOptions.map((group, groupIndex) => (
            <fieldset>
              <label key={groupIndex}>
                <StyledInput
                  type="checkbox"
                  value={group.label}
                  checked={selectedOptions.includes(group.label)}
                  onChange={handleCheckboxChange}
                />
                {group.label}
              </label>
              <StyledList>
                {group.options.map((option, optionIndex) => (
                  <li>
                    <label key={optionIndex}>
                      <StyledInput
                        type="checkbox"
                        value={option.label}
                        checked={selectedOptions.includes(option.label)}
                        onChange={handleCheckboxChange}
                      />
                      {option.label}
                    </label>
                  </li>
                ))}
              </StyledList>
            </fieldset>
          ))}
        </StyledModalBody>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowModal(false)}
            aria-label={"Close Modal Button"}
          >
            Close
          </Button>
          <Button
            variant="success"
            type="submit"
            form="dashboardCreation"
            aria-label={"Create Dashboard Button"}
          >
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

SelectedVisualizationTypesModal.propTypes = {
  showModal: PropTypes.bool,
  setShowModal: PropTypes.func,
};

export default SelectedVisualizationTypesModal;
