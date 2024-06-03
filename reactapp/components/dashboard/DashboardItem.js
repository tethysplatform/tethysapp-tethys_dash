import styled from 'styled-components';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import DataPlot from 'components/plots/DataPlot';
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

const DashboardItem = ({type, rowHeight, colWidth}) => {
  const isEditing = useEditingContext()[0];

  return (
    <StyledContainer fluid className="h-100">
      <StyledDiv >
        <DashboardItemButton tooltipText="Edit Content" type="edit" hidden={!isEditing}/>
        <DashboardItemButton tooltipText="Delete Cell" type="delete" hidden={!isEditing}/>
      </StyledDiv>
      <Row className="h-100">
        {type === "plot" && <DataPlot rowHeight={rowHeight} colWidth={colWidth}/>}
      </Row>
    </StyledContainer>
  )
}


export default memo(DashboardItem)