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
import { useContext, useEffect, useState } from 'react';
import appAPI from 'services/api/app';
import DashboardRow from 'components/modals/NewDashboardRow';
import styled from 'styled-components';

const RightButton= styled(Button)`
    float:right;
`;

const LeftButton= styled(Button)`
    float:left;
`;

function EditDashboardDimensionsModal() {
    const [showModal, setShowModal]  = useEditDashboardDimensionModalShowContext();
    const [dashboardContext, setDashboardContext] = useSelectedDashboardContext();
    const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useAvailableDashboardContext();
    const {csrf} = useContext(AppContext);
    const [hasError, setHasError]  = useState(false);
    const [errorMessage, setErrorMessage]  = useState(null);
    
    let dashboardRowData = JSON.parse(dashboardContext['rowData'])
    
    const [dashboardRowCount, setDashboardRowCount]  = useState(dashboardRowData.length);
    const [dashboardRows, setDashboardRows]  = useState(null);

    const handleModalClose = () => setShowModal(false);

    function handleSubmit(event) {
        event.preventDefault();
        setErrorMessage("")
        setHasError(false)
        let Name = dashboardContext['name']

        const rowData = [];
        if (dashboardRowData.length > dashboardRowCount) {
            dashboardRowData = dashboardRowData.slice(0, dashboardRowCount)
        } else if (dashboardRowData.length < dashboardRowCount) {
            dashboardRowData.push(...Array(dashboardRowCount-dashboardRowData.length).fill([]))
        }
        for (let i=1; i <= dashboardRowCount; i++) {
            const rowHeight = parseInt(event.currentTarget.querySelector('#row' + i + 'height').value)
            rowHeights.push(rowHeight)

            const rowColCount = parseInt(event.currentTarget.querySelector('#row' + i + 'colcount').value)
            const rowColWidths = []
            const totalColWidth = 0
            if (dashboardRowData[i-1].length > rowColCount) {
                dashboardRowData[i-1] = dashboardRowData[i-1].slice(0, rowColCount)
            } else if (dashboardRowData[i-1].length < rowColCount) {
                dashboardRowData[i-1].push(...Array(rowColCount-dashboardRowData[i-1].length).fill(""))
            }
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
        inputData['rowData'] = JSON.stringify(dashboardRowData)
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
        setDashboardRowCount(parseInt(value))
    }

    function addDashboardRows() {
        const Rows = []
        for (let i=0; i < dashboardRowCount; i++) {
            const initialRowData = dashboardRowData[i]
            const initialRowHeight = initialRowData["height"]
            const initialRowRowData = initialRowData["columns"]
            let key = parseInt(i.toString())
            Rows.push(<DashboardRow 
                key={key}
                initialRowHeight={initialRowHeight}
                initialRowRowData={initialRowRowData}
                rowNumber={i+1}
            />)
        }
        setDashboardRows(Rows)
    }

    useEffect(() => {
        addDashboardRows();
      }, [dashboardRowCount]);

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
                        <Col className="col-2 m-0">
                        </Col>
                        <Col className="col-10 m-0">
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
                        <Col className="col-2 m-0">
                            <Form.Group className="mb-1" controlId="formDashboardRows">
                                <Form.Label>Rows</Form.Label>
                                <Form.Control required type="number" min="1" onChange={onRowInput} value={dashboardRowCount} />
                            </Form.Group>
                        </Col>
                        <Col className="col-10 m-0">
                            {dashboardRows}
                        </Col>
                    </Row>
                </Container>
                <b>*Height refers to the percentage of the page height.</b>
                <br></br>
                <b>**Column widths added across each row must equal 12 exactly.</b>
            </Form>
        </Modal.Body>
        <Modal.Footer style={{"display": "inline"}}>
            <LeftButton variant="info" onClick={handleModalClose}>
            Add Row
            </LeftButton>
            <LeftButton variant="info" onClick={handleModalClose}>
            Reorder Rows
            </LeftButton>
            <RightButton variant="success" type="submit" form="dashboardUpdate">
            Update
            </RightButton>
            <RightButton variant="secondary" onClick={handleModalClose}>
            Close
            </RightButton>
        </Modal.Footer>
        </Modal>
    </>
    );
}

export default EditDashboardDimensionsModal;