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
    
    useEffect(() => {
        setHeight(rowHeight)
    }, [rowHeight]);

    const dashboardColumns = []
    for (let x=0; x < rowColumns.length; x++) {
        dashboardColumns.push(
            <DashboardCol key={x} colNumber={x} colData={rowColumns[x]}/>
        )
    }
    return (
        <StyledDashboardRow $rowHeight={height}>
            <RowHeightContext.Provider value={[height, setHeight]}>
                <RowInfoContext.Provider value={[rowNumber, rowHeight, rowID]}>
                    {dashboardColumns}
                </RowInfoContext.Provider>
            </RowHeightContext.Provider>
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