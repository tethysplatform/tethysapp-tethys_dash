import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import { useEditDashboardDimensionModalShowContext } from 'components/contexts/EditDashboardDimensionModalShowContext';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
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

function EditDashboardDimensionsModal() {
    const [showModal, setShowModal]  = useEditDashboardDimensionModalShowContext();
    const [dashboardContext, setDashboardContext] = useSelectedDashboardContext();
    const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useAvailableDashboardContext();
    const {csrf} = useContext(AppContext);
    const [hasError, setHasError]  = useState(false);
    const [errorMessage, setErrorMessage]  = useState(null);
    
    const dashboardRowHeights = JSON.parse(dashboardContext['rowHeights'])
    const dashboardColWidths = JSON.parse(dashboardContext['colWidths'])
    const dashboardColData = JSON.parse(dashboardContext['colData'])
    const dashboardRows = dashboardRowHeights.length

    const handleModalClose = () => setShowModal(false);

    function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage("")
        setHasError(false)
        let Name = dashboardContext['name']

        const rowHeights = []
        const colWidths = []
        for (let i=1; i <= dashboardRows; i++) {
            const rowHeight = parseInt(event.currentTarget.querySelector('#row' + i + 'height').value)
            rowHeights.push(rowHeight)

            const rowColCount = parseInt(event.currentTarget.querySelector('#row' + i + 'colcount').value)
            const rowColWidths = []
            const totalColWidth = 0
            for (let x=1; x <= rowColCount; x++) {
                const colWidth = parseInt(event.currentTarget.querySelector('#row' + i + 'col' + x).value)
                totalColWidth += colWidth
                rowColWidths.push(colWidth)
            }
            colWidths.push(rowColWidths)

            if (totalColWidth != 12) {
                setErrorMessage("Row " + i + " total width is " + totalColWidth + ". It must equal 12.")
                setHasError(true)
                return
            }
        }

        let inputData = Object.assign({}, dashboardContext);
        inputData['rowHeights'] = JSON.stringify(rowHeights)
        inputData['colWidths'] = JSON.stringify(colWidths)
        appAPI.updateDashboard(inputData, csrf).then((response) => {
            let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
            OGLayouts[Name] = inputData
            setDashboardLayoutConfigs(OGLayouts)
            setDashboardContext(inputData)
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
        for (let i=0; i < dashboardRows; i++) {
            const initialRowHeight = dashboardRowHeights[i]
            const initialRowColWidths = dashboardColWidths[i]
            const initialRowColData = dashboardColData[i]
            let key = parseInt(i.toString())
            Rows.push(<DashboardRow 
                key={key}
                initialRowHeight={initialRowHeight} 
                initialRowColWidths={initialRowColWidths}
                initialRowColData={initialRowColData}
                rowNumber={i+1}
            />)
        }
        return Rows
    }

    return (
    <>
        <Modal show={showModal} onHide={handleModalClose}>
        <Modal.Header closeButton>
            <Modal.Title>Updated dashboard cell dimensions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            {hasError &&
                <Alert key="danger" variant="danger">
                    {errorMessage}
                </Alert>
            }
            <Form id="dashboardUpdate" onSubmit={handleSubmit}>
                <Container fluid className="h-100">
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
            <Button variant="success" type="submit" form="dashboardUpdate">
            Update
            </Button>
        </Modal.Footer>
        </Modal>
    </>
    );
}

export default EditDashboardDimensionsModal;