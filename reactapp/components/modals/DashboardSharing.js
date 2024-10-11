import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { AppContext } from "components/contexts/AppContext";
import { useContext, useState, useEffect } from "react";
import appAPI from "services/api/app";
import DataRadioSelect from "components/inputs/DataRadioSelect";
import PropTypes from "prop-types";

function DashboardSharingModal({ showModal, setShowModal }) {
  const getLayoutContext = useLayoutContext()[2];
  const setLayoutContext = useLayoutContext()[0];
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const { csrf } = useContext(AppContext);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [selectedRadio, setSelectedRadio] = useState(false);

  const handleModalClose = () => setShowModal(false);

  function onChange(e) {
    setSelectedRadio(e.target.value);
  }

  const radioOptions = [
    { label: "Public", value: "public" },
    { label: "Private", value: "private" },
  ];

  useEffect(() => {
    const updatedLayoutContext = getLayoutContext();
    if (updatedLayoutContext["access_groups"].includes("public")) {
      setSelectedRadio("public");
    } else {
      setSelectedRadio("private");
    }
    // eslint-disable-next-line
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    const updatedLayoutContext = getLayoutContext();
    if (selectedRadio === "public") {
      updatedLayoutContext["access_groups"] = ["public"];
    } else {
      updatedLayoutContext["access_groups"] = [];
    }
    appAPI.updateDashboard(updatedLayoutContext, csrf).then((response) => {
      if (response["success"]) {
        const name = response["updated_dashboard"]["name"];
        let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
        OGLayouts[name] = response["updated_dashboard"];
        setDashboardLayoutConfigs(OGLayouts);
        setLayoutContext(response["updated_dashboard"]);
        setSuccessMessage("Successfully updated sharing status");
      } else {
        setErrorMessage("Failed to update sharing status. Check server logs.");
      }
    });
  }

  return (
    <>
      <Modal show={showModal} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Update Sharing Status</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorMessage && (
            <Alert key="danger" variant="danger">
              {errorMessage}
            </Alert>
          )}
          {successMessage && (
            <Alert key="success" variant="success">
              {successMessage}
            </Alert>
          )}
          <Form id="dashboardSharing" onSubmit={handleSubmit}>
            <DataRadioSelect
              label={"Sharing Status"}
              selectedRadio={selectedRadio}
              radioOptions={radioOptions}
              onChange={onChange}
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>
            Close
          </Button>
          <Button variant="success" type="submit" form="dashboardSharing">
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

DashboardSharingModal.propTypes = {
  showModal: PropTypes.func,
  setShowModal: PropTypes.func,
};

export default DashboardSharingModal;
