import styled from 'styled-components';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import USACEPlot from 'components/plots/USACEPlot';
import CDECPlot from 'components/plots/CDECPlot';
import { memo } from 'react';
import { useEditingContext } from 'components/contexts/EditingContext';
import DashboardItemButton from "./DashboardItemButton"


const StyledContainer= styled(Container)`
  position: relative;
  padding: 0;
`;

const StyledDiv= styled.div`
  position: absolute;
  z-index: 1;
  margin: .5rem;
`;

const StyledImg= styled.img`
  width: auto;
  margin: auto;
  display: block;
`;

const DashboardItem = ({rowHeight, colWidth, itemData}) => {
  const isEditing = useEditingContext()[0];

  return (
    <StyledContainer fluid className="h-100">
      <StyledDiv >
        <DashboardItemButton tooltipText="Edit Content" type="edit" hidden={!isEditing}/>
        <DashboardItemButton tooltipText="Delete Cell" type="delete" hidden={!isEditing}/>
      </StyledDiv>
      <Row className="h-100">
        {itemData['type'] === "USACEPlot" && <USACEPlot rowHeight={rowHeight} colWidth={colWidth} itemData={itemData}/>}
        {itemData['type'] === "CDECPlot" && <CDECPlot rowHeight={rowHeight} colWidth={colWidth} itemData={itemData}/>}
        {itemData['type'] === "Image" && <StyledImg src={itemData['metadata']['uri']}/>}
      </Row>
    </StyledContainer>
  )
}


export default memo(DashboardItem)