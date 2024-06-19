import Col from 'react-bootstrap/Col';
import DashboardItem from 'components/dashboard/DashboardItem';
import styled from 'styled-components';

const StyledDashboardCol= styled(Col)`
    border: black solid 1px;
`;


function DashboardCol({rowHeight, rowID, colID, colWidth, colDataType, colDataMetadata}) {
    const parsedMetadata = JSON.parse(colDataMetadata)
    return (
        <StyledDashboardCol className={"justify-content-center h-100 col-"+colWidth}>
            <DashboardItem rowHeight={rowHeight} rowID={rowID} colID={colID} colWidth={colWidth} type={colDataType} metadata={parsedMetadata}></DashboardItem>
        </StyledDashboardCol>
    )
}

export default DashboardCol;