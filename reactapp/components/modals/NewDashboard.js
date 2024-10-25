import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardsContext } from "components/contexts/AvailableDashboardsContext";
import { useSelectedOptionContext } from "components/contexts/SelectedOptionContext";
import { useAvailableOptionsContext } from "components/contexts/AvailableOptionsContext";
import { useEditingContext } from "components/contexts/EditingContext";
import { AppContext } from "components/contexts/AppContext";
import { useContext, useState } from "react";
import appAPI from "services/api/app";

function NewDashboardModal() {
  const [dashboardName, setDashboardName] = useState("");

  const [showModal, setShowModal] = useAddDashboardModalShowContext();
  const setLayoutContext = useLayoutContext()[0];
  const [availableDashboards, setAvailableDashboards] =
    useAvailableDashboardsContext();
  const setSelectedOption = useSelectedOptionContext()[1];
  const [selectOptions, setSelectOptions] = useAvailableOptionsContext();
  const { csrf } = useContext(AppContext);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const setIsEditing = useEditingContext()[1];
  const setShowSaveMessage = useState(false)[1];
  const setShowErrorMessage = useState(false)[1];

  const handleModalClose = () => setShowModal(false);

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setHasError(false);
    let Name = dashboardName.replace(" ", "_").toLowerCase();
    let Label = dashboardName;
    if (dashboardName in availableDashboards) {
      setErrorMessage(
        "Dashboard with the Name " + dashboardName + " already exists."
      );
      setHasError(true);
      return;
    }

    const inputData = {
      name: Name,
      label: Label,
      notes: "",
    };
    appAPI.addDashboard(inputData, csrf).then((response) => {
      if (response["success"]) {
        let OGLayouts = Object.assign({}, availableDashboards);
        OGLayouts[Name] = response["new_dashboard"];
        setAvailableDashboards(OGLayouts);
        const userOptions = selectOptions.find(({ label }) => label === "User");
        const userOptionsIndex = selectOptions.indexOf(userOptions);
        userOptions["options"].push({ value: Name, label: Label });
        const updatedSelectOptions = selectOptions.toSpliced(
          userOptionsIndex,
          1,
          userOptions
        );
        setSelectOptions(updatedSelectOptions);
        setLayoutContext(response["new_dashboard"]);
        setSelectedOption({ value: Name, label: Label });
        setShowModal(false);
        setShowSaveMessage(true);
        setIsEditing(true);
      } else {
        setShowErrorMessage(true);
      }
    });
  }

  function onNameInput({ target: { value } }) {
    setDashboardName(value);
  }

  return (
    <>
      <Modal show={showModal} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Create a new dashboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hasError && (
            <Alert key="danger" variant="danger">
              {errorMessage}
            </Alert>
          )}
          <Form id="dashboardCreation" onSubmit={handleSubmit}>
            <Container fluid className="h-100">
              <Row className="h-100">
                <Form.Group className="mb-3" controlId="formDashboardName">
                  <Form.Label>Dashboard Name</Form.Label>
                  <Form.Control
                    required
                    type="text"
                    placeholder="Enter dashboard name"
                    onChange={onNameInput}
                    value={dashboardName}
                  />
                  <Form.Text className="text-muted"></Form.Text>
                </Form.Group>
              </Row>
            </Container>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>
            Close
          </Button>
          <Button variant="success" type="submit" form="dashboardCreation">
            Create
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default NewDashboardModal;
