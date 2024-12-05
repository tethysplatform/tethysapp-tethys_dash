import { useState, useEffect } from "react";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import PropTypes from "prop-types";
import styled from "styled-components";
import CustomAlert from "components/dashboard/CustomAlert";
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
  const { userSettings, updateUserSettings } = useUserSettingsContext();
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [successMessage, setSuccessMessage] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showErrorMessage, setShowErrorMessage] = useState(false);

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

  // TODO: Implement checking or unchecking group when all options are selected or deselected

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

  const saveSettings = () => {
    setShowSuccessMessage(false);
    setShowErrorMessage(false);
    const deselectedVisualizations = allOptions.filter((e) =>
      selectedOptions.every((val) => val !== e)
    );
    updateUserSettings({
      deselected_visualizations: deselectedVisualizations,
    }).then((response) => {
      if (response.success) {
        setSuccessMessage("Settings have been saved.");
        setShowSuccessMessage(true);
      } else {
        setErrorMessage(
          "Failed to save settings. Check server logs for more information."
        );
        setShowErrorMessage(true);
      }
    });
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
            <fieldset key={groupIndex}>
              <label>
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
                  <li key={optionIndex}>
                    <label>
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
          {errorMessage && (
            <CustomAlert
              alertType={"danger"}
              alertMessage={errorMessage}
              showAlert={showErrorMessage}
              setShowAlert={setShowErrorMessage}
            />
          )}
          {successMessage && (
            <CustomAlert
              alertType={"success"}
              alertMessage={successMessage}
              showAlert={showSuccessMessage}
              setShowAlert={setShowSuccessMessage}
            />
          )}
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
            onClick={saveSettings}
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
