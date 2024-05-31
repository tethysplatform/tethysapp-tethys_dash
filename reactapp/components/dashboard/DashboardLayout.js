import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardItem from '../../components/dashboard/DashboardItem';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import styled from 'styled-components';

const StyledDashboardCol= styled(Col)`
    border: black solid 1px;
`;

function DashboardLayout() {
    const dashboardContext = useSelectedDashboardContext()[0];

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
            let item_type = dashboardColData[i][x]
            let col_width = dashboardColWidths[i][x]
            dashboardColumns.push(<StyledDashboardCol className={"justify-content-center col-"+col_width}><DashboardItem type={item_type}></DashboardItem></StyledDashboardCol>)
        }
        dashboardRows.push(<Row className={"h-"+rowHeight}>{dashboardColumns}</Row>)
    }

    return (
        <Container fluid className="h-100">
            {dashboardRows}
        </Container>
    );
}



export default DashboardLayout;