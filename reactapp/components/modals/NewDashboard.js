import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useSelectedOptionContext } from "components/contexts/SelectedOptionContext";
import { useAvailableOptionsContext } from "components/contexts/AvailableOptionsContext";
import { AppContext } from "components/contexts/AppContext";
import { useContext, useState } from "react";
import appAPI from "services/api/app";
import DashboardRow from "components/modals/NewDashboardRow";

function NewDashboardModal() {
  const [dashboardName, setDashboardName] = useState("");
  const [dashboardRows, setDashboardRows] = useState(3);

  const [showModal, setShowModal] = useAddDashboardModalShowContext();
  const setLayoutContext = useLayoutContext()[0];
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] =
    useAvailableDashboardContext();
  const setSelectedOption = useSelectedOptionContext()[1];
  const [selectOptions, setSelectOptions] = useAvailableOptionsContext();
  const { csrf } = useContext(AppContext);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const setShowSaveMessage = useState(false)[1];
  const setShowErrorMessage = useState(false)[1];

  const handleModalClose = () => setShowModal(false);

  function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setHasError(false);
    let Name = dashboardName.replace(" ", "_").toLowerCase();
    let Label = dashboardName;
    if (dashboardName in dashboardLayoutConfigs) {
      setErrorMessage(
        "Dashboard with the Name " + dashboardName + " already exists."
      );
      setHasError(true);
      return;
    }

    const rowData = [];
    for (let i = 1; i <= dashboardRows; i++) {
      let data = {};
      const rowHeight = parseInt(
        event.currentTarget.querySelector("#row" + i + "height").value
      );
      data["height"] = rowHeight;

      const rowColCount = parseInt(
        event.currentTarget.querySelector("#row" + i + "colcount").value
      );
      const Cols = [];
      let totalColWidth = 0;
      for (let x = 1; x <= rowColCount; x++) {
        let colData = {};
        colData["type"] = "";
        colData["metadata"] = {};

        const colWidth = parseInt(
          event.currentTarget.querySelector("#row" + i + "col" + x).value
        );
        colData["width"] = colWidth;
        totalColWidth += colWidth;

        Cols.push(colData);
      }
      data["columns"] = Cols;

      if (totalColWidth !== 12) {
        setErrorMessage(
          "Row " +
            i +
            " total width is " +
            totalColWidth +
            ". It must equal 12."
        );
        setHasError(true);
        return;
      }
      rowData.push(data);
    }

    const inputData = {
      name: Name,
      label: Label,
      notes: "",
      rowData: JSON.stringify(rowData),
    };
    appAPI.addDashboard(inputData, csrf).then((response) => {
      if (response["success"]) {
        let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
        OGLayouts[Name] = response["new_dashboard"];
        setDashboardLayoutConfigs(OGLayouts);
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
      } else {
        setShowErrorMessage(true);
      }
    });
  }

  function onNameInput({ target: { value } }) {
    setDashboardName(value);
  }

  function onRowInput({ target: { value } }) {
    setDashboardRows(parseInt(value));
  }

  function addDashboardRows() {
    const Rows = [];
    for (let i = 1; i <= dashboardRows; i++) {
      Rows.push(<DashboardRow key={i} rowNumber={i} />);
    }
    return Rows;
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
              <Row className="h-100">
                <Col className="col-2 m-0"></Col>
                <Col className="col-10 m-0">
                  <Row>
                    <Col
                      className="col-2 m-0 px-1"
                      style={{ textAlign: "center" }}
                    >
                      Height*
                    </Col>
                    <Col
                      className="col-2 m-0 px-1"
                      style={{ textAlign: "center" }}
                    >
                      Columns
                    </Col>
                    <Col className="col-8 m-0" style={{ textAlign: "center" }}>
                      Column Width**
                    </Col>
                  </Row>
                </Col>
              </Row>
              <Row className="h-100">
                <Col className="col-2 m-0">
                  <Form.Group className="mb-1" controlId="formDashboardRows">
                    <Form.Label>Rows</Form.Label>
                    <Form.Control
                      required
                      type="number"
                      min="1"
                      onChange={onRowInput}
                      value={dashboardRows}
                    />
                  </Form.Group>
                </Col>
                <Col className="col-10 m-0">{addDashboardRows()}</Col>
              </Row>
            </Container>
            <b>*Height refers to the percentage of the page height.</b>
            <br></br>
            <b>**Column widths added across each row must equal 12 exactly.</b>
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
