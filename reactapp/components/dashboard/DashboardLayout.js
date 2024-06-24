import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardRow from 'components/dashboard/DashboardRow'
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import { useLayoutSuccessAlertContext, useLayoutErrorAlertContext, useLayoutWarningAlertContext } from 'components/contexts/LayoutAlertContext';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useContext } from 'react';
import Form from 'react-bootstrap/Form';
import styled from 'styled-components';
import appAPI from 'services/api/app';
import { AppContext } from 'components/contexts/AppContext';

const StyledForm= styled(Form)`
  display: inline;
`;

function DashboardLayout() {
    const [dashboardContext, setDashboardContext] = useSelectedDashboardContext();
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
    const [ successMessage, setSuccessMessage, showSuccessMessage, setShowSuccessMessage ] = useLayoutSuccessAlertContext();
    const [ errorMessage, setErrorMessage, showErrorMessage, setShowErrorMessage ] = useLayoutErrorAlertContext();
    const setIsEditing = useEditingContext()[1];
    const {csrf} = useContext(AppContext);
  
    function handleSubmit(event) {
        event.preventDefault();
        setShowSuccessMessage(false)
        setShowErrorMessage(false)
        const cellDimensionsInputs = event.currentTarget.querySelectorAll('input')
        let data = [];
        let currentRowID = null;
        let colData = [];
        let rowCount = 0;
        let colCount = 0;
        let totalColWidth = 0;
        let rowDataID;
        let rowDataHeight;
        for (let i=0; i < cellDimensionsInputs.length; i++) {
            const dimensionInput = cellDimensionsInputs[i]
            const inputType = dimensionInput.dataset['inputtype']
            const rowID= dimensionInput.dataset['rowid']
            const colID = dimensionInput.dataset['colid']
            const newrow = dimensionInput.dataset['newrow']

            if (currentRowID === null) {
                currentRowID = rowID
            } else if (newrow == "true") {
                if (totalColWidth != 12) {
                    setErrorMessage("Total width for row " + (rowCount+1).toString() + " equals " + totalColWidth.toString() + ". The total width must equal 12.")
                    setShowErrorMessage(true)
                    return
                }

                data.push({
                    'id': rowDataID,
                    'height': rowDataHeight,
                    'order': rowCount,
                    'columns': colData
                })
                colData = [];
                colCount = 0;
                totalColWidth = 0
                currentRowID = rowID
                rowCount += 1
            }

            if (inputType === "height") {
                rowDataID = rowID
                rowDataHeight = dimensionInput.value
            }

            if (inputType === "width") {
                colData.push({
                    'id': colID,
                    'width': dimensionInput.value,
                    'order': colCount,
                    "type": dimensionInput.dataset['type'],
                    "metadata": dimensionInput.dataset['metadata']
                })
                colCount += 1
                totalColWidth += parseInt(dimensionInput.value)
            }

            if (i === cellDimensionsInputs.length-1) {
                if (totalColWidth != 12) {
                    setErrorMessage("Total width for row " + (rowCount+1).toString() + " equals " + totalColWidth.toString() + ". The total width must equal 12.")
                    setShowErrorMessage(true)
                    return
                }
                data.push({
                    'id': rowDataID,
                    'height': rowDataHeight,
                    'order': rowCount,
                    'columns': colData
                })
            }

        }
        dashboardContext['rowData'] = JSON.stringify(data)
        appAPI.updateDashboard(dashboardContext, csrf).then((response) => {
            if (response['success']) {
                setDashboardContext(response['updated_dashboard'])
        
                let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
                OGLayouts[dashboardContext['name']] = response['updated_dashboard']
                setDashboardLayoutConfigs(OGLayouts)
                setSuccessMessage("Change have been saved.")
                setShowSuccessMessage(true)
            } else {
                setErrorMessage("Failed to save changes. Check server logs for more information.")
                setShowErrorMessage(true)
            }
        })
        setIsEditing(false);
    }

    const rowData = JSON.parse(dashboardContext['rowData'])

    const dashboardRows = []
    for (let i=0; i < rowData.length; i++) {
        const dashboardRow = rowData[i]
        const rowID = dashboardRow['id']
        const rowHeight = dashboardRow['height']
        const rowColumns = dashboardRow['columns']
        const key = i.toString() + rowHeight.toString()
        dashboardRows.push(
            <DashboardRow key={key} rowNumber={i} rowID={rowID} rowHeight={rowHeight} rowColumns={rowColumns}/>
        )
    }

    return (
        <Row className="h-100">
            <Col>
                <StyledForm id="rowUpdate" onSubmit={handleSubmit}>
                    {dashboardRows}
                </StyledForm>
            </Col>
        </Row>
    );
}



export default DashboardLayout;