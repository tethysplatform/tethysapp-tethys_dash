import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardItem from '../../components/dashboard/DashboardItem';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import styled from 'styled-components';
import { useState, useEffect } from 'react';

const StyledDashboardCol= styled(Col)`
    border: black solid 1px;
`;

const StyledDashboardRow= styled(Row)`
    height: ${(props) => props.$rowHeight}% !important;
`;

function DashboardLayout() {
    const dashboardContext = useSelectedDashboardContext()[0];
    const [dashboardRowData, setDashboardRowData]  = useState(null);

    function getDashboardRows() {
        const dashboardRowHeights = JSON.parse(dashboardContext['rowHeights'])
        const dashboardColWidths = JSON.parse(dashboardContext['colWidths'])
        const dashboardColData = JSON.parse(dashboardContext['colData'])
        const dashboardRowCount = dashboardRowHeights.length 

        const dashboardRows = []
        for (let i=0; i <= dashboardRowCount-1; i++) {
            const colCount = dashboardColWidths[i].length
            const rowHeight = dashboardRowHeights[i]
            const dashboardColumns = []
            for (let x=0; x <= colCount-1; x++) {
                let itemData = dashboardColData[i][x]
                let colWidth = dashboardColWidths[i][x]
                let key = parseInt(i.toString() + x.toString())
                dashboardColumns.push(<StyledDashboardCol key={key} className={"justify-content-center col-"+colWidth}><DashboardItem rowHeight={rowHeight} colWidth={colWidth} itemData={itemData}></DashboardItem></StyledDashboardCol>)
            }
            dashboardRows.push(<StyledDashboardRow key={i} $rowHeight={rowHeight}>{dashboardColumns}</StyledDashboardRow>)
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