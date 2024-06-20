import Row from 'react-bootstrap/Row';
import DashboardCol from 'components/dashboard/DashboardCol'
import styled from 'styled-components';
import { createContext, useContext, useState, useEffect } from 'react';

const RowHeightContext = createContext();
const RowInfoContext = createContext();

const StyledDashboardRow= styled(Row)`
    height: ${(props) => props.$rowHeight}% !important;
`;

function DashboardRow({rowNumber, rowID, rowHeight, rowColumns}) {
    const [height, setHeight] = useState(rowHeight)
    const [allColWidths, setAllColWidths] = useState(() => {
        const colWidths = {}
        for (let x=0; x < rowColumns.length; x++) {
            colWidths[x] = rowColumns[x]['width']
        }
        return colWidths
    });

    const dashboardColumns = []
    for (let x=0; x < rowColumns.length; x++) {
        let colWidth = rowColumns[x]['width']
        let colID = rowColumns[x]['id']
        let key = parseInt(rowNumber.toString() + x.toString())
        dashboardColumns.push(
            <RowHeightContext.Provider key={key} value={[height, setHeight]}>
                <RowInfoContext.Provider key={key} value={[rowNumber, rowHeight, rowID, allColWidths, setAllColWidths]}>
                    <DashboardCol colNumber={x} colID={colID} colWidth={colWidth} colDataType={rowColumns[x]['type']} colDataMetadata={rowColumns[x]['metadata']}/>
                </RowInfoContext.Provider>
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

export const useRowInfoContext = () => {
  return useContext(RowInfoContext);
};