import styled from 'styled-components';
import Plot from 'react-plotly.js';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import DataPlot from '../plots/DataPlot';
import { useContext, memo } from 'react';
import { 
  EditingContext
} from 'components/context';
import DashboardItemButton from "./DashboardItemButton"


const StyledPlot= styled(Plot)`
`;

const DashboardItem = ({type}) => {
  const isEditing = useContext(EditingContext)[0];

  return (
    <Container fluid className="h-100" style={{"position": "relative"}}>
      <div style={{"position": "absolute", "zIndex": "1"}}>
      <DashboardItemButton type="edit" hidden={!isEditing}/>
      <DashboardItemButton type="delete" hidden={!isEditing}/>
      </div>
      <Row>
        {type === "plot" && <DataPlot />}
      </Row>
    </Container>
  )
}


export default memo(DashboardItem)