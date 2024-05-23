import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'react-edit-text/dist/index.css';
import appAPI from '../../services/api/app';
import { DashboardContext } from 'components/context';
import { useContext, useState } from 'react';
import DashboardMetadataButton from "./DashboardMetadataButton"

function DashboardMetadata() {
    const { selectedDashboard, availableDashboards, SelectedOption, availableOptions } = useContext(DashboardContext);
    const [ dashboardContext, setDashboardContext ] = selectedDashboard;
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = availableDashboards;
    const [ selectedOption, setSelectedOption ] = SelectedOption;
    const [ selectOptions, setSelectOptions ] = availableOptions;
    const [ dashboardNotes, setDashboardNotes ] = useState(dashboardContext['notes'])

    function onNotesChange({target:{value}}) {
        setDashboardNotes(value)
    }

    function onDelete(e) {
        const selectedOptionValue = selectedOption['value']
        const newdashboardLayoutConfigs = Object.fromEntries(
            Object.entries(dashboardLayoutConfigs).filter(([key]) => key != selectedOptionValue)
        );
        const newSelectOptions = selectOptions.filter((options)=>(JSON.stringify(options) != JSON.stringify(selectedOption)))
        setDashboardLayoutConfigs(newdashboardLayoutConfigs)
        setSelectOptions(newSelectOptions)
        setSelectedOption(null)
        setDashboardContext(null)
    }


    return (
        <Container className="h-100">
            <Col className='h-100'>
                <Row className='h-10'>
                    <h2 style={{"paddingTop": "5%", "textAlign": "center"}}>{dashboardContext['label']}</h2>
                </Row>
                <Row className='h-10'>
                    <Col>
                        <DashboardMetadataButton type="edit" buttonLocation="right" tooltipPlacement="left" tooltipText="Edit Dashboard"/>
                    </Col>
                    <Col>
                        <DashboardMetadataButton type="delete" buttonLocation="left" tooltipPlacement="right" tooltipText="Delete Dashboard" onClick={onDelete}/>
                    </Col>
                </Row>
                <Row className='h-30' style={{"paddingTop": "10px"}}>
                    <img src={dashboardContext['image']}></img>
                </Row>
                <Row style={{"height": "40%"}}>
                    <h3>Notes:</h3>
                    <textarea 
                        name='dashboardNotes'
                        value={dashboardNotes}
                        onChange={onNotesChange}
                        style={{"resize": "none", "width": "100%", "height": "100%", "margin": "0 10px"}}
                        disabled={true}/>
                </Row>
            </Col>
        </Container>
    );
}

function saveNotes(e) {
  appAPI.updateDashboard()
}

export default DashboardMetadata;