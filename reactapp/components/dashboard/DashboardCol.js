import Col from 'react-bootstrap/Col';
import DashboardItem from 'components/dashboard/DashboardItem';
import styled from 'styled-components';

const StyledDashboardCol= styled(Col)`
    border: black solid 1px;
`;


function DashboardCol({colWidth, colDataType, colDataMetadata}) {
    return (
        <StyledDashboardCol className={"justify-content-center col-"+colWidth}>
            <DashboardItem colWidth={colWidth} type={colDataType} metadata={colDataMetadata}></DashboardItem>
        </StyledDashboardCol>
    )
}

export default DashboardCol;