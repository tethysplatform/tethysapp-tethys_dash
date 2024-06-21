import styled from 'styled-components';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Form from 'react-bootstrap/Form';
import BasePlot from 'components/plots/BasePlot';
import { memo, useState, useEffect } from 'react';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useRowHeightContext, useRowInfoContext } from 'components/dashboard/DashboardRow';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import { useLayoutWarningAlertContext } from 'components/contexts/LayoutAlertContext';
import { useColInfoContext } from 'components/dashboard/DashboardCol'; 
import DashboardItemButton from "components/buttons/DashboardItemButton";
import 'components/dashboard/noArrowDropdown.css';
import DashboardItemArrows from 'components/buttons/DashboardItemArrows'


const StyledFormGroup= styled(Form.Group)`
  width: auto;
  margin: auto;
  display: block;
  padding: 0 1rem;
`;

const StyledContainer= styled(Container)`
  position: relative;
  padding: 0;
`;

const StyledButtonDiv= styled.div`
  position: absolute;
  z-index: 1;
  margin: .5rem;
`;

const StyledCenterDiv= styled.div`
  width: auto;
  margin: auto;
  display: block;
`;

const StyledImg= styled.img`
  max-width: 100% !important;
  max-height: 100% !important;
  height: auto;
  width: auto;
  margin: auto;
  display: block;
`;

const StyledAbsDiv= styled.div`
  position: absolute;
  width: auto;
  padding: 0;
  left: ${(props) => 
    props.$x === 'left' ? "0"
    : props.$x === 'middle' && "50%"};
  right: ${(props) => 
    props.$x === 'right' && "0"};
  bottom: ${(props) => 
    props.$y === 'bottom' ? "0"
    : props.$y === 'middle' && "50%"};
  top: ${(props) => 
    props.$y === 'top' && "0"};
  margin-bottom: ${(props) => 
    props.$y === 'bottom' && ".5rem"};
  margin-top: ${(props) => 
    props.$y === 'top' && ".5rem"};
`;

const DashboardItem = ({type, metadata}) => {
  const isEditing = useEditingContext()[0];
  const [ height, setHeight ] = useRowHeightContext();
  const [ rowNumber, rowHeight, rowID, allColWidths, setAllColWidths ] = useRowInfoContext();
  const [ colNumber, colWidth, colID ] = useColInfoContext();
  const [ dashboardContext, setDashboardContext ] = useSelectedDashboardContext();
  const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
  const [ warningMessage, setWarningMessage, showWarningMessage, setShowWarningMessage ] = useLayoutWarningAlertContext();
  const itemData = {"type": type, "metadata": metadata}
  const [ width, setWidth ] = useState(allColWidths[colNumber])
  const [ maxWidth, setMaxWidth ] = useState((12 - (allColWidths.length-1)).toString())
  const rowData = JSON.parse(dashboardContext['rowData'])
  const rowColumns = rowData[rowNumber]['columns']

  function onRowHeightInput({target:{value}}) {
    setHeight(value)
  }

  function onColWidthInput({target:{value}}) {
    setWarningMessage("")
    setShowWarningMessage(false)
    let copiedAllColWidths = JSON.parse(JSON.stringify(allColWidths));
    copiedAllColWidths[colNumber] = parseInt(value)

    if (copiedAllColWidths.length == 2) {
      const otherIndex = colNumber==0 ? 1 : 0
      copiedAllColWidths[otherIndex] = 12-value
    }

    const totalRowWidths = copiedAllColWidths.reduce((partialSum, a) => partialSum + a, 0)
    if (totalRowWidths > 12) {
      setWarningMessage("Total cell widths in the row cannot exceed 12.")
      setShowWarningMessage(true)
      return
    }
    setAllColWidths(copiedAllColWidths)
  }
    
  useEffect(() => {
    setWidth(allColWidths[colNumber])
    setMaxWidth((12 - (allColWidths.length-1)).toString())
  }, [allColWidths]);

  function deleteCell(e) {
    const rowData = JSON.parse(dashboardContext['rowData'])
    const rowColumns = rowData[rowNumber]['columns']

    if (rowColumns.length === 1){
      rowData.splice(rowNumber, 1)
      updateOrder(rowData)
    } else {
      const deletedColWidth = rowColumns[colNumber]['width']
      rowColumns.splice(colNumber, 1)
      updateOrder(rowColumns)

      const smallestWidthCol = Object.keys(rowColumns).reduce((a, b) => rowColumns[a]['width'] < rowColumns[b]['width'] ? a : b);
      rowColumns[smallestWidthCol]['width'] += deletedColWidth

      updateAllColWidths(rowColumns)
    }
    updateDashboardContext(rowData)
  }

  function updateOrder(arr) {
    for (let i=0; i < arr.length; i++) {
      arr[i]['order'] = i
    }
  }

  function updateDashboardContext(rowData) {
    const updatedDashboardContext = {...dashboardContext, rowData: JSON.stringify(rowData)}
    setDashboardContext(updatedDashboardContext)
        
    let OGLayouts = Object.assign({}, dashboardLayoutConfigs);
    OGLayouts[dashboardContext['name']] = updatedDashboardContext
    setDashboardLayoutConfigs(OGLayouts)
  }

  function updateAllColWidths(rowColumns) {
    setAllColWidths(rowColumns.map(a => a.width))
  }

  return (
    <StyledContainer fluid className="h-100">
      <StyledButtonDiv >
        <DashboardItemButton tooltipText="Edit Content" type="edit" hidden={!isEditing}/>
        <DashboardItemButton tooltipText="Delete Cell" type="delete" hidden={!isEditing} onClick={deleteCell}/>
      </StyledButtonDiv>
      <Row style={{height: "100%"}} hidden={isEditing}>
        {!isEditing &&
          <>
            {type.includes("Plot") && <BasePlot rowHeight={rowHeight} colWidth={colWidth} itemData={itemData}/>}
            {type === "Image" && <StyledImg src={metadata['uri']}/>}
          </>
        }
      </Row>
      <Row className="h-100" hidden={!isEditing}>
        <StyledCenterDiv >
          <StyledFormGroup className="mb-1">
              <Form.Label>Row Height</Form.Label>
              <Form.Control 
                required type="number" min="1" max="100" onChange={onRowHeightInput} value={height} 
                data-inputtype="height" data-newrow={colNumber==0 ? true : false} data-rowid={rowID}
                data-colid={colID}/>
          </StyledFormGroup>
          <StyledFormGroup className="mb-1">
              <Form.Label>Column Width</Form.Label>
              <Form.Control 
                required type="number" min="1" max={maxWidth} onChange={onColWidthInput} value={width} 
                data-inputtype="width" data-type={type} data-metadata={JSON.stringify(metadata)} 
                data-rowid={rowID} data-colid={colID}/>
          </StyledFormGroup>
        </StyledCenterDiv>
        <StyledAbsDiv  $x="middle" $y="top">
          <DashboardItemArrows arrowDirection="up" tooltipPlacement="left" tooltipText={rowNumber === 0 ? "Add Row Above" : "Add/Move Row Above"}/>
        </StyledAbsDiv>
        <StyledAbsDiv  $x="left" $y="middle">
          <DashboardItemArrows arrowDirection="left" tooltipPlacement="right" tooltipText={colNumber === 0 ? "Add Row on Left" : "Add/Move Column on Left"}/>
        </StyledAbsDiv>
        <StyledAbsDiv  $x="middle" $y="bottom">
          <DashboardItemArrows arrowDirection="down" tooltipPlacement="left" tooltipText={rowNumber === rowData.length-1 ? "Add Row Below" : "Add/Move Row Below"}/>
        </StyledAbsDiv>
        <StyledAbsDiv $x="right" $y="middle">
          <DashboardItemArrows arrowDirection="right" tooltipPlacement="left" tooltipText={colNumber === rowColumns.length-1 ? "Add Row on Right" : "Add/Move Column on Right"}/>
        </StyledAbsDiv>
      </Row>
    </StyledContainer>
  )
}


export default memo(DashboardItem)