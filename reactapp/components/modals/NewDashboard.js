import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import { useAddDashboardModalShowContext } from 'components/contexts/AddDashboardModalShowContext';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import { useSelectedOptionContext } from 'components/contexts/SelectedOptionContext';
import { useAvailableOptionsContext } from 'components/contexts/AvailableOptionsContext';
import { AppContext } from 'components/contexts/AppContext';
import { useContext, useState } from 'react';
import appAPI from 'services/api/app';

function NewDashboardModal() {
    const [dashboardName, setDashboardName] = useState("")
    const [dashboardRows, setDashboardRows] = useState(3)
    const [dashboardCols, setDashboardCols] = useState(3)

    const [showModal, setShowModal]  = useAddDashboardModalShowContext();
    const setDashboardContext = useSelectedDashboardContext()[1];
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
    const setSelectedOption = useSelectedOptionContext()[1];
    const [ selectOptions, setSelectOptions ] = useAvailableOptionsContext();
    const {csrf} = useContext(AppContext);
    const [hasError, setHasError]  = useState(false);
    const [errorMessage, setErrorMessage]  = useState(null);
    
    const handleModalClose = () => setShowModal(false);

    function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage("")
        setHasError(false)
        let Name = dashboardName.replace(" ","_").toLowerCase()
        let Label = dashboardName
        if (dashboardName in dashboardLayoutConfigs) {
            setErrorMessage("Dashboard with the Name " + dashboardName + "already exists.")
            setHasError(true)
            return
        }
        const inputData = {
            "name": Name,
            "label": Label,
            "image": "",
            "notes": "",
            "rows": dashboardRows,
            "cols": dashboardCols,
        }
        appAPI.addDashboard(inputData, csrf).then((response) => {
            let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
            OGLayouts[Name] = inputData
            setDashboardLayoutConfigs(OGLayouts)
            setSelectOptions([ ...selectOptions, {value: Name, label: Label} ])
            setDashboardContext(inputData)
            setSelectedOption({value: Name, label: Label})
            setShowModal(false)
        })
    }

    function onNameInput({target:{value}}) {
        setDashboardName(value)
    }

    function onRowInput({target:{value}}) {
        setDashboardRows(parseInt(value))
    }

    function onColInput({target:{value}}) {
        setDashboardCols(parseInt(value))
    }

    return (
    <>
        <Modal show={showModal} onHide={handleModalClose}>
        <Modal.Header closeButton>
            <Modal.Title>Create a new dashboard</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {hasError &&
                <Alert key="danger" variant="danger">
                    {errorMessage}
                </Alert>
            }
            <Form id="dashboardCreation" onSubmit={handleSubmit}>
                <Container fluid className="h-100">
                    <Row className="h-100">
                        <Form.Group className="mb-3" controlId="formDashboardName">
                            <Form.Label>Dashboard Name</Form.Label>
                            <Form.Control required type="text" placeholder="Enter dashboard name" onChange={onNameInput} value={dashboardName}/>
                            <Form.Text className="text-muted">
                            </Form.Text>
                        </Form.Group>
                    </Row>
                    <Row className="h-100">
                        <Col className="col-6 m-0">
                            <Form.Group className="mb-1" controlId="formDashboardRows">
                                <Form.Label>Rows</Form.Label>
                                <Form.Control required type="number" onChange={onRowInput} value={dashboardRows} />
                            </Form.Group>
                        </Col>
                        <Col className="col-6 m-0">
                            <Form.Group className="mb-1" controlId="formDashboardCols">
                                <Form.Label>Columns</Form.Label>
                                <Form.Control required type="number" onChange={onColInput} value={dashboardCols} />
                            </Form.Group>
                        </Col>
                    </Row>
                </Container>
                The rows and columns for the dashboard can be editted after creation.
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