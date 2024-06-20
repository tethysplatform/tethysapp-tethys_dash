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
    const rowNumber = useRowInfoContext()[0];
    const colNumber = useColInfoContext()[0];
    const [ dashboardContext, setDashboardContext ] = useSelectedDashboardContext();
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();

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
                <StyledDropdown.Item>Add Cell on {arrowDirection === "right" ? "Right" : "Left"}</StyledDropdown.Item>
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