import styled from 'styled-components';
import Plot from 'react-plotly.js';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import DataPlot from '../plots/DataPlot';
import { useContext, useEffect, useState } from 'react';
import { DashboardContext } from 'components/context';
import DashboardItemButton from "./DashboardItemButton"


const StyledPlot= styled(Plot)`
`;


const DashboardItem = ({type, dashboardName}) => {
  const { editing } = useContext(DashboardContext);
  const isEditing = editing[0];

  function Item() {
    return (
      <Row>
        {type === "plot" && <DataPlot dashboardName={dashboardName}/>}
      </Row>
    )
  }

  return (
    <Container fluid className="h-100" style={{"position": "relative"}}>
      <div style={{"position": "absolute", "z-index": "1"}}>
      <DashboardItemButton type="edit" hidden={!isEditing}/>
      <DashboardItemButton type="delete" hidden={!isEditing}/>
      </div>
      <Item />
    </Container>
  )
}


export default DashboardItem