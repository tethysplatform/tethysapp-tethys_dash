import styled from 'styled-components';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Form from 'react-bootstrap/Form';
import Dropdown from 'react-bootstrap/Dropdown';
import BasePlot from 'components/plots/BasePlot';
import { memo, useState } from 'react';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useRowHeightContext } from 'components/dashboard/DashboardRow';
import DashboardItemButton from "components/buttons/DashboardItemButton";
import { BsArrowDownShort, BsArrowLeftShort, BsArrowRightShort, BsArrowUpShort } from "react-icons/bs";
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import 'components/dashboard/noArrowDropdown.css'


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

const DashboardItem = ({rowHeight, rowID, colID, colWidth, type, metadata}) => {
  const isEditing = useEditingContext()[0];
  const [ height, setHeight ] = useRowHeightContext();
  const itemData = {"type": type, "metadata": metadata}
  const [ width, setWidth ] = useState(colWidth)

  function onRowHeightInput({target:{value}}) {
    setHeight(value)
  }

  function onColWidthInput({target:{value}}) {
    setWidth(value)
  }

  const StyledButtonWithTooltip = ({arrowDirection, tooltipPlacement, tooltipText}) => {
    const styledButton = StyledDropdownButton(arrowDirection)
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
        {styledButton}
      </OverlayTrigger>
    )
  };

  function StyledDropdownButton(arrowDirection) {
    return (
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
                  <StyledDropdown.Item>Add Row {arrowDirection === "up" ? "Above" : "Below"}</StyledDropdown.Item>
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
  }

  return (
    <StyledContainer fluid className="h-100">
      <StyledButtonDiv >
        <DashboardItemButton tooltipText="Edit Content" type="edit" hidden={!isEditing}/>
        <DashboardItemButton tooltipText="Delete Cell" type="delete" hidden={!isEditing}/>
      </StyledButtonDiv>
      <Row style={{height: "100%"}} hidden={isEditing}>
        {type.includes("Plot") && <BasePlot rowHeight={rowHeight} colWidth={colWidth} itemData={itemData}/>}
        {type === "Image" && <StyledImg src={metadata['uri']}/>}
      </Row>
      <Row className="h-100" hidden={!isEditing}>
        <StyledCenterDiv >
          <Form.Group className="mb-1">
              <Form.Label>Row Height</Form.Label>
              <Form.Control 
                required type="number" min="1" max="100" onChange={onRowHeightInput} value={height} 
                data-inputtype="height" data-rowid={rowID} data-colid={colID}/>
          </Form.Group>
          <Form.Group className="mb-1">
              <Form.Label>Column Width</Form.Label>
              <Form.Control 
                required type="number" min="1" max="12" onChange={onColWidthInput} value={width} 
                data-inputtype="width" data-type={type} data-metadata={JSON.stringify(metadata)} 
                data-rowid={rowID} data-colid={colID}/>
          </Form.Group>
        </StyledCenterDiv>
        <StyledAbsDiv  $x="middle" $y="top">
          <StyledButtonWithTooltip arrowDirection="up" tooltipPlacement="left" tooltipText="Add/Move Row Above"/>
        </StyledAbsDiv>
        <StyledAbsDiv  $x="left" $y="middle">
          <StyledButtonWithTooltip arrowDirection="left" tooltipPlacement="right" tooltipText="Add/Move Column on Left"/>
        </StyledAbsDiv>
        <StyledAbsDiv  $x="middle" $y="bottom">
          <StyledButtonWithTooltip arrowDirection="down" tooltipPlacement="left" tooltipText="Add/Move Row Below"/>
        </StyledAbsDiv>
        <StyledAbsDiv $x="right" $y="middle">
          <StyledButtonWithTooltip arrowDirection="right" tooltipPlacement="left" tooltipText="Add/Move Column on Right"/>
        </StyledAbsDiv>
      </Row>
    </StyledContainer>
  )
}


export default memo(DashboardItem)