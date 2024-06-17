import Row from 'react-bootstrap/Row';
import DashboardCol from 'components/dashboard/DashboardCol'
import styled from 'styled-components';
import { createContext, useContext, useState } from 'react';

const RowHeightContext = createContext();

const StyledDashboardRow= styled(Row)`
    height: ${(props) => props.$rowHeight}% !important;
`;

function DashboardRow({rowNumber, rowHeight, rowColumns}) {
    const [height, setHeight] = useState(rowHeight)

    const dashboardRows = []
    const dashboardColumns = []
    for (let x=0; x < rowColumns.length; x++) {
        let colWidth = rowColumns[x]['width']
        let key = parseInt(rowNumber.toString() + x.toString())
        dashboardColumns.push(
            <RowHeightContext.Provider value={[height, setHeight]}>
                <DashboardCol key={key} colWidth={colWidth} colDataType={rowColumns[x]['type']} colDataMetadata={rowColumns[x]['metadata']}/>
            </RowHeightContext.Provider>
        )
    }
    dashboardRows.push(
        <StyledDashboardRow key={rowNumber} $rowHeight={rowHeight}>
            {dashboardColumns}
        </StyledDashboardRow>
    )

    return dashboardRows
}

export default DashboardRow;

export const useRowHeightContext = () => {
  return useContext(RowHeightContext);
};