import styled from 'styled-components';
import Dropdown from 'react-bootstrap/Dropdown';
import { memo } from 'react';
import { BsArrowDownShort, BsArrowLeftShort, BsArrowRightShort, BsArrowUpShort } from "react-icons/bs";
import { useRowInfoContext } from 'components/dashboard/DashboardRow';
import { useColInfoContext } from 'components/dashboard/DashboardCol'; 
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import 'components/dashboard/noArrowDropdown.css'

const StyledDropdown= styled(Dropdown)`
  width: 1.5rem;
  height: 1.5rem;
  position: relative;
`;

const StyledLeftIcon= styled(BsArrowLeftShort)`
  top: 0;
  left: 0;
  position: absolute;
`;

const StyledRightIcon= styled(BsArrowRightShort)`
  top: 0;
  left: 0;
  position: absolute;
`;

const StyledUpIcon= styled(BsArrowUpShort)`
  top: 0;
  left: 0;
  position: absolute;
`;

const StyledDownIcon= styled(BsArrowDownShort)`
  top: 0;
  left: 0;
  position: absolute;
`;

const DashboardItemArrows = ({arrowDirection, tooltipPlacement, tooltipText}) => {
    const colNumber = useColInfoContext()[0];
    const [ dashboardContext, setDashboardContext ] = useSelectedDashboardContext();
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
    const [ rowNumber, rowHeight, rowID, allColWidths, setAllColWidths ] = useRowInfoContext();

    function addRow() {
        const newRow = {
            "id": null, 
            "order": rowNumber, 
            "height": 50, 
            "columns": [{
                "id": null,
                "order": 0,
                "width": 12,
                "type": '',
                "metadata": '{}'
            }]
        }
        const dashboardData = JSON.parse(dashboardContext['rowData'])
        let insertIndex = arrowDirection == "up" ? rowNumber : rowNumber+1
        let loopStartIndex = arrowDirection == "up" ? insertIndex+1 : insertIndex
        dashboardData.splice(insertIndex, 0, newRow)
        for (let i=loopStartIndex; i < dashboardData.length; i++) {
            dashboardData[i]['order'] += 1
        }
        const updatedDashboardContext = {...dashboardContext, rowData: JSON.stringify(dashboardData)}
        setDashboardContext(updatedDashboardContext)
            
        let CopiedLayouts = Object.assign({}, dashboardLayoutConfigs);
        CopiedLayouts[dashboardContext['name']] = updatedDashboardContext
        setDashboardLayoutConfigs(CopiedLayouts)
  }

    function addColumn() {
        let rowData = JSON.parse(dashboardContext['rowData'])
        const rowColumns = rowData[rowNumber]['columns']
        const selectedColumn = rowColumns[colNumber]
        let newColWidth;
        let reducedWidthCol;

        if (selectedColumn['width'] == 1) {
          newColWidth = 1
          reducedWidthCol = Object.keys(rowColumns).reduce((a, b) => rowColumns[a]['width'] > rowColumns[b]['width'] ? a : b);
        } else {
          const selectedColumnSplitWidth = Math.floor(selectedColumn['width']/2)
          newColWidth = selectedColumn['width'] - selectedColumnSplitWidth
          reducedWidthCol = colNumber
        }
        rowColumns[reducedWidthCol]['width'] -= newColWidth

        const newCol = {
            "id": null,
            "order": 0,
            "width": newColWidth,
            "type": '',
            "metadata": '{}'
        }

        let insertIndex = arrowDirection == "left" ? colNumber : colNumber+1
        let loopStartIndex = arrowDirection == "left" ? insertIndex+1 : insertIndex
        rowColumns.splice(insertIndex, 0, newCol)
        for (let i=loopStartIndex; i < rowColumns.length; i++) {
            rowColumns[i]['order'] += 1
        }

        const colWidths = {}
        for (let x=0; x < rowColumns.length; x++) {
            colWidths[x] = rowColumns[x]['width']
        }
        setAllColWidths(colWidths)
        
        const updatedDashboardContext = {...dashboardContext, rowData: JSON.stringify(rowData)}
        setDashboardContext(updatedDashboardContext)
            
        let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
        OGLayouts[dashboardContext['name']] = updatedDashboardContext
        setDashboardLayoutConfigs(OGLayouts)
    }

  const StyledDropdownButton = (
        <StyledDropdown>
            <StyledDropdown.Toggle variant="info" id="cellUpdateDropdown" style={{width: "100%", height: "100%"}}>
                {arrowDirection === "up" ? <StyledUpIcon size="1.5rem"/> 
                : arrowDirection === "right" ? <StyledRightIcon size="1.5rem"/>
                : arrowDirection === "down" ? <StyledDownIcon size="1.5rem"/>
                : arrowDirection === "left" && <StyledLeftIcon size="1.5rem"/>}
            </StyledDropdown.Toggle>
            <StyledDropdown.Menu>
                {(arrowDirection === "up" || arrowDirection === "down") ?
                <>
                    <StyledDropdown.Item onClick={addRow}>Add Row {arrowDirection === "up" ? "Above" : "Below"}</StyledDropdown.Item>
                    <StyledDropdown.Item>Move Row {arrowDirection === "up" ? "Above" : "Below"}</StyledDropdown.Item>
                </>
                :
                <>
                <StyledDropdown.Item onClick={addColumn}>Add Cell on {arrowDirection === "right" ? "Right" : "Left"}</StyledDropdown.Item>
                <StyledDropdown.Item>Move Cell {arrowDirection === "right" ? "Right" : "Left"}</StyledDropdown.Item>
                </>
                }
            </StyledDropdown.Menu>
        </StyledDropdown>
    )
    
    return (
        <OverlayTrigger
          key={tooltipPlacement}
          placement={tooltipPlacement}
          overlay={
            <Tooltip id={`tooltip-${tooltipPlacement}`}>
              {tooltipText}
            </Tooltip>
          }
        >
          {StyledDropdownButton}
        </OverlayTrigger>
    )
}


export default memo(DashboardItemArrows)