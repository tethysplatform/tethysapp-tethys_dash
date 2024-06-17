import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardRow from 'components/dashboard/DashboardRow'
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useState, useEffect } from 'react';

function DashboardLayout() {
    const dashboardContext = useSelectedDashboardContext()[0];
    const [dashboardRowData, setDashboardRowData]  = useState(null);

    function getDashboardRows() {
        console.log(dashboardContext)
        const dashboardRowData = JSON.parse(dashboardContext['rowData'])

        const dashboardRows = []
        for (let i=0; i < dashboardRowData.length; i++) {
            const dashboardRow = dashboardRowData[i]
            const rowHeight = dashboardRow['height']
            const rowColumns = dashboardRow['columns']
            dashboardRows.push(
                <DashboardRow key={i} rowNumber={i} rowHeight={rowHeight} rowColumns={rowColumns}/>
            )
        }
        return dashboardRows
    }
    
    useEffect(() => {
        setDashboardRowData(getDashboardRows());
      }, [dashboardContext]);

    return (
        <Container fluid className="h-100">
            <Row className="h-100">
                <Col>
                    {dashboardRowData}
                </Col>
            </Row>
        </Container>
    );
}



export default DashboardLayout;