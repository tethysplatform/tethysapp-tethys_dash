import styled from 'styled-components';
import Dropdown from 'react-bootstrap/Dropdown';
import { memo } from 'react';
import { BsArrowDownShort, BsArrowLeftShort, BsArrowRightShort, BsArrowUpShort } from "react-icons/bs";
import { useRowInfoContext } from 'components/dashboard/DashboardRow';
import { useColInfoContext } from 'components/dashboard/DashboardCol';
import { useLayoutRowDataContext } from 'components/contexts/SelectedDashboardContext';
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
  const rowNumber = useRowInfoContext()[0];
  const [ rowData, setRowData ] = useLayoutRowDataContext();

  function addRow() {
    const updatedRowData = JSON.parse(JSON.stringify(rowData))
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
    let insertIndex = arrowDirection == "up" ? rowNumber : rowNumber+1
    updatedRowData.splice(insertIndex, 0, newRow)
    updateOrder(updatedRowData)
    setRowData(updatedRowData)
  }

  function moveRow() {
    const updatedRowData = JSON.parse(JSON.stringify(rowData))
    let newIndex = arrowDirection == "up" ? rowNumber-1 : rowNumber+1
    array_move(updatedRowData, rowNumber, newIndex)
    updateOrder(updatedRowData)
    setRowData(updatedRowData)
  }

  function addColumn() {
    const updatedRowData = JSON.parse(JSON.stringify(rowData))
    const rowColumns = updatedRowData[rowNumber]['columns']
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
    rowColumns.splice(insertIndex, 0, newCol)
    updateOrder(updatedRowData)
    setRowData(updatedRowData)
  }

  function moveColumn() {
    const updatedRowData = JSON.parse(JSON.stringify(rowData))
    const rowColumns = updatedRowData[rowNumber]['columns']
    let newIndex = arrowDirection == "left" ? colNumber-1 : colNumber+1
    array_move(rowColumns, colNumber, newIndex)
    updateOrder(updatedRowData)
    setRowData(updatedRowData)
  }

  function updateOrder(arr) {
    for (let i=0; i < arr.length; i++) {
      arr[i]['order'] = i
    }
  }

  function array_move(arr, old_index, new_index) {
    if (new_index >= arr.length) {
        var k = new_index - arr.length + 1;
        while (k--) {
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
    return arr;
  };

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
                  {((arrowDirection === "up" && rowNumber != 0) || (arrowDirection === "down" && rowNumber != rowData.length-1)) && 
                    <StyledDropdown.Item onClick={moveRow}>Move Row {arrowDirection === "up" ? "Above" : "Below"}</StyledDropdown.Item>
                  }
                </>
                :
                <>
                  <StyledDropdown.Item onClick={addColumn}>Add Cell on {arrowDirection === "right" ? "Right" : "Left"}</StyledDropdown.Item>
                  {((arrowDirection === "left" && colNumber != 0) || (arrowDirection === "right" && colNumber != rowData[rowNumber]['columns'].length-1)) && 
                    <StyledDropdown.Item onClick={moveColumn}>Move Cell {arrowDirection === "right" ? "Right" : "Left"}</StyledDropdown.Item>
                  }
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