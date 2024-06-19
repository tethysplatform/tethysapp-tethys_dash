import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardRow from 'components/dashboard/DashboardRow'
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useState, useEffect, useContext } from 'react';
import Form from 'react-bootstrap/Form';
import styled from 'styled-components';
import appAPI from 'services/api/app';
import { AppContext } from 'components/contexts/AppContext';
import Alert from 'react-bootstrap/Alert';

const StyledForm= styled(Form)`
  display: inline;
`;

const StyledContainer= styled(Container)`
  position: relative;
`;

const StyledAbsDiv= styled.div`
    position: absolute;
    z-index: 1;
    left: 0;
    right: 0;
`;

function DashboardLayout() {
    const [dashboardContext, setDashboardContext] = useSelectedDashboardContext();
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
    const setIsEditing = useEditingContext()[1];
    const {csrf} = useContext(AppContext);
    const [dashboardRowData, setDashboardRowData]  = useState(null);
    const [ showSaveMessage, setShowSaveMessage ] = useState(false)
    const [ showErrorMessage, setShowErrorMessage ] = useState(false)

    function getDashboardRows() {
        const dashboardRowData = JSON.parse(dashboardContext['rowData'])

        const dashboardRows = []
        for (let i=0; i < dashboardRowData.length; i++) {
            const dashboardRow = dashboardRowData[i]
            const rowID = dashboardRow['id']
            const rowHeight = dashboardRow['height']
            const rowColumns = dashboardRow['columns']
            dashboardRows.push(
                <DashboardRow key={i} rowID={rowID} rowHeight={rowHeight} rowColumns={rowColumns}/>
            )
        }
        return dashboardRows
    }
  
    function handleSubmit(event) {
        event.preventDefault();
        setShowSaveMessage(false)
        setShowErrorMessage(false)
        const cellDimensionsInputs = event.currentTarget.querySelectorAll('input')
        //   event.currentTarget.querySelectorAll('input')[0].dataset.id;
        let data = [];
        let currentRowID = null;
        let colData = [];
        let rowOrder = [];
        let colOrder = [];
        let rowDataID;
        let rowDataHeight;
        let rowDataOrder;
        for (let i=0; i < cellDimensionsInputs.length; i++) {
            const dimensionInput = cellDimensionsInputs[i]
            const inputType = dimensionInput.dataset['inputtype']
            const rowID= dimensionInput.dataset['rowid']
            const colID = dimensionInput.dataset['colid']

            if (currentRowID === null) {
                currentRowID = rowID
            } else if (currentRowID != rowID) {
                data.push({
                    'id': rowDataID,
                    'height': rowDataHeight,
                    'order': rowDataOrder,
                    'columns': colData
                })
                colData = [];
                colOrder = [];
                currentRowID = rowID
            }

            if (inputType === "height" && !rowOrder.includes(rowID)) {
                rowOrder.push(rowID)
                rowDataID = rowID
                rowDataHeight = dimensionInput.value
                rowDataOrder = rowOrder.indexOf(rowID)
            }

            if (inputType === "width") {
                colOrder.push(colID)
                colData.push({
                    'id': colID,
                    'width': dimensionInput.value,
                    'order': colOrder.indexOf(colID),
                    "type": dimensionInput.dataset['type'],
                    "metadata": dimensionInput.dataset['metadata']
                })
            }

            if (i === cellDimensionsInputs.length-1) {
                data.push({
                    'id': rowDataID,
                    'height': rowDataHeight,
                    'order': rowDataOrder,
                    'columns': colData
                })
            }

        }
        const updatedDashboardContext = {...dashboardContext, rowData: JSON.stringify(data)}
        appAPI.updateDashboard(updatedDashboardContext, csrf).then((response) => {
            if (response['success']) {
                setDashboardContext(updatedDashboardContext)
        
                let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
                OGLayouts[dashboardContext['name']] = updatedDashboardContext
                setDashboardLayoutConfigs(OGLayouts)
                setShowSaveMessage(true)
            } else {
                setShowErrorMessage(true)
            }
        })
        setIsEditing(false);
    }
    
    useEffect(() => {
        setDashboardRowData(getDashboardRows());
      }, [dashboardContext]);
    
    useEffect(() => {
        if (showSaveMessage == true) {
        window.setTimeout(()=>{
            setShowSaveMessage(false)
            },5000)
        }
    }, [showSaveMessage]);

    return (
        <StyledContainer fluid className="h-100">
            <StyledAbsDiv>
                {showErrorMessage &&
                    <Alert key="failure" variant="danger" dismissible={true}>
                        Failed to save changes. Check server logs for more information.
                    </Alert>
                }
                {showSaveMessage &&
                    <Alert key="success" variant="success" dismissible={true}>
                        Changes have been saved.
                    </Alert>
                }
            </StyledAbsDiv>
            <Row className="h-100">
                <Col>
                    <StyledForm id="rowUpdate" onSubmit={handleSubmit}>
                        {dashboardRowData}
                    </StyledForm>
                </Col>
            </Row>
        </StyledContainer>
    );
}



export default DashboardLayout;