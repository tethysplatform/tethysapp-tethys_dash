import Col from 'react-bootstrap/Col';
import DashboardItem from 'components/dashboard/DashboardItem';
import styled from 'styled-components';
import { createContext, useContext } from 'react';

const StyledDashboardCol= styled(Col)`
    border: black solid 1px;
`;
const ColInfoContext = createContext();


function DashboardCol({colNumber, colID, colWidth, colDataType, colDataMetadata}) {
    if (typeof colDataMetadata == "string") {
        colDataMetadata = JSON.parse(colDataMetadata)
    }
    return (
        <StyledDashboardCol className={"justify-content-center h-100 col-"+colWidth}>
            <ColInfoContext.Provider value={[colNumber, colWidth, colID]}>
                <DashboardItem type={colDataType} metadata={colDataMetadata}></DashboardItem>
            </ColInfoContext.Provider>
        </StyledDashboardCol>
    )
}

export default DashboardCol;

export const useColInfoContext = () => {
  return useContext(ColInfoContext);
};