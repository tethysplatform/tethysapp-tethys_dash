import Row from 'react-bootstrap/Row';
import DashboardCol from 'components/dashboard/DashboardCol'
import styled from 'styled-components';
import { createContext, useContext, useState } from 'react';

const RowHeightContext = createContext();

const StyledDashboardRow= styled(Row)`
    height: ${(props) => props.$rowHeight}% !important;
`;

function DashboardRow({rowID, rowHeight, rowColumns}) {
    const [height, setHeight] = useState(rowHeight)

    const dashboardColumns = []
    for (let x=0; x < rowColumns.length; x++) {
        let colWidth = rowColumns[x]['width']
        let colID = rowColumns[x]['id']
        let key = parseInt(rowID.toString() + x.toString())
        dashboardColumns.push(
            <RowHeightContext.Provider key={key} value={[height, setHeight]}>
                <DashboardCol rowHeight={rowHeight} rowID={rowID} colID={colID} colWidth={colWidth} colDataType={rowColumns[x]['type']} colDataMetadata={rowColumns[x]['metadata']}/>
            </RowHeightContext.Provider>
        )
    }
    return (
        <StyledDashboardRow key={rowID} $rowHeight={rowHeight}>
            {dashboardColumns}
        </StyledDashboardRow>
    )
}

export default DashboardRow;

export const useRowHeightContext = () => {
  return useContext(RowHeightContext);
};