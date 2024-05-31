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
import DashboardRow from 'components/modals/NewDashboardRow';
import styled from 'styled-components';

const StyledVerticalCol= styled(Col)`
    writing-mode: vertical-rl;
    transform: scale(-1);
    text-align: center;
`;

function NewDashboardModal() {
    const [dashboardName, setDashboardName] = useState("")
    const [dashboardRows, setDashboardRows] = useState(3)

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
            setErrorMessage("Dashboard with the Name " + dashboardName + " already exists.")
            setHasError(true)
            return
        }

        const rowHeights = []
        const colWidths = []
        const colDataValues = []
        for (let i=1; i <= dashboardRows; i++) {
            const rowHeight = parseInt(document.getElementById('row' + i + 'height').value)
            rowHeights.push(rowHeight)

            const rowColCount = parseInt(document.getElementById('row' + i + 'colcount').value)
            const rowColWidths = []
            const rowColDataValues = []
            const totalColWidth = 0
            for (let x=1; x <= rowColCount; x++) {
                const colDataValue = ""
                rowColDataValues.push(colDataValue)

                const colWidth = parseInt(document.getElementById('row' + i + 'col' + x).value)
                totalColWidth += colWidth
                rowColWidths.push(colWidth)
            }
            colWidths.push(rowColWidths)
            colDataValues.push(rowColDataValues)

            if (totalColWidth != 12) {
                setErrorMessage("Row " + i + " total width is " + totalColWidth + ". It must equal 12.")
                setHasError(true)
                return
            }
        }

        const inputData = {
            "name": Name,
            "label": Label,
            "image": "https://brightspotcdn.byu.edu/dims4/default/155e62f/2147483647/strip/true/crop/1067x1067+0+0/resize/840x840!/quality/90/?url=https%3A%2F%2Fbrigham-young-brightspot.s3.amazonaws.com%2Fde%2F07%2Fb07feaf34df89f6781045bc56de7%2Ftethys-logo.png",
            "notes": "",
            "rowHeights": JSON.stringify(rowHeights),
            "colWidths": JSON.stringify(colWidths),
            "colData": JSON.stringify(colDataValues),
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

    function addDashboardRows() {
        const Rows = []
        for (let i =1; i <= dashboardRows; i++) {
            Rows.push(<DashboardRow rowNumber={i}/>)
        }
        return Rows
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
                        <Col>
                            <Form.Group className="mb-3" controlId="formDashboardName">
                                <Form.Label>Dashboard Name</Form.Label>
                                <Form.Control required type="text" placeholder="Enter dashboard name" onChange={onNameInput} value={dashboardName}/>
                                <Form.Text className="text-muted">
                                </Form.Text>
                            </Form.Group>
                        </Col>
                        <Col>
                            <Form.Group className="mb-1" controlId="formDashboardRows">
                                <Form.Label>Rows</Form.Label>
                                <Form.Control required type="number" onChange={onRowInput} value={dashboardRows} />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="h-100">
                        <Col className="col-1 m-0">
                        </Col>
                        <Col className="col-11 m-0">
                            <Row>
                                <Col className="col-2 m-0 px-1" style={{textAlign: "center"}}>
                                    Height*
                                </Col>
                                <Col className="col-2 m-0 px-1" style={{textAlign: "center"}}>
                                    Columns
                                </Col>
                                <Col className="col-8 m-0" style={{textAlign: "center"}}>
                                    Column Width**
                                </Col>
                            </Row>
                        </Col>
                    </Row>
                    <Row className="h-100">
                        <StyledVerticalCol className="col-1 m-0">
                            Rows
                        </StyledVerticalCol>
                        <Col className="col-11 m-0">
                            {addDashboardRows()}
                        </Col>
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