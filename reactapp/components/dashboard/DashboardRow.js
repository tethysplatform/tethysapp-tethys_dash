import PropTypes from 'prop-types';
import Row from 'react-bootstrap/Row';
import DashboardCol from 'components/dashboard/DashboardCol'
import styled from 'styled-components';
import { createContext, useContext, useState, useEffect } from 'react';
import { useLayoutRowDataContext } from 'components/contexts/SelectedDashboardContext';

const RowHeightContext = createContext();
const RowInfoContext = createContext();

const StyledDashboardRow= styled(Row)`
    height: ${(props) => props.$rowHeight}% !important;
`;

function DashboardRow({rowNumber, rowID, rowHeight, rowColumns}) {
    const [height, setHeight] = useState(rowHeight)
    const rowData = useLayoutRowDataContext()[0];
    
    useEffect(() => {
        setHeight(rowHeight)
    }, [rowHeight]);
    
    useEffect(() => {
        setHeight(rowData[rowNumber]['height'])
    }, [rowData, rowNumber]);

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

DashboardRow.propTypes = {
    rowNumber: PropTypes.number,
    rowID: PropTypes.number,
    rowHeight: PropTypes.number,
    rowColumns: PropTypes.arrayOf(
        PropTypes.object
    )
};

export default DashboardRow;

export const useRowHeightContext = () => {
  return useContext(RowHeightContext);
};

export const useRowInfoContext = () => {
  return useContext(RowInfoContext);
};