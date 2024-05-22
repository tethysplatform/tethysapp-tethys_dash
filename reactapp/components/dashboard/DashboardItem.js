import styled from 'styled-components';
import Plot from 'react-plotly.js';
import DataPlot from '../plots/DataPlot';


const StyledPlot= styled(Plot)`
  padding: 10px;
`;


const DashboardItem = ({type, dashboardName}) => {    
  if (type === "plot") {
    return <DataPlot dashboardName={dashboardName}/>
  }
}


export default DashboardItem