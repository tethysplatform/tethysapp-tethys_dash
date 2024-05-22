import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardItem from '../../components/dashboard/DashboardItem';
import { DashboardContext } from 'components/context';
import { useContext } from 'react';

function DashboardLayout() {
    const selectedDashboard = useContext(DashboardContext);

    const dashboardRowMetadata = JSON.parse(selectedDashboard['rows'])
    const dashboardRowCount = Object.keys(dashboardRowMetadata).length 
    const row_height = Math.round(100/dashboardRowCount)
    let dashboardColumns = []
    let dashboardRows = []
    for (const [_, rowColumns] of Object.entries(dashboardRowMetadata)) {
        dashboardColumns = []
        for (const [_, colProperties] of Object.entries(rowColumns)) {
            let item_type = colProperties['type']
            let col_width = Math.round(colProperties['width']/100*12)
            dashboardColumns.push(<Col className={"m-0 justify-content-center col-"+col_width}><DashboardItem type={item_type} dashboardName={selectedDashboard['name']}></DashboardItem></Col>)
        }
        dashboardRows.push(<Row className={"h-"+row_height}>{dashboardColumns}</Row>)
    }

    return (
        <Container fluid className="m-2 h-100">
            {dashboardRows}
        </Container>
    );
}



export default DashboardLayout;