import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { EditText } from 'react-edit-text';
import 'react-edit-text/dist/index.css';
import appAPI from '../../services/api/app';
import { DashboardContext } from 'components/context';
import { useContext, useState } from 'react';
import Button from 'react-bootstrap/Button';
import DashboardMetadataButton from "./DashboardMetadataButton"

function DashboardMetadata() {
    const selectedDashboard = useContext(DashboardContext);
    const [dashboardNotes, setDashboardNotes] = useState(selectedDashboard['notes'])

    function onNotesChange({target:{value}}) {
        console.log(value)
        setDashboardNotes(value)
    }

    return (
        <Container className="h-100">
            <Col className='h-100'>
                <Row className='h-10'>
                    <h2 style={{"paddingTop": "5%", "textAlign": "center"}}>{selectedDashboard['label']}</h2>
                </Row>
                <Row className='h-10'>
                    <Col>
                        <DashboardMetadataButton type="edit" buttonLocation="right" tooltipPlacement="left" tooltipText="Edit Dashboard"/>
                    </Col>
                    <Col>
                        <DashboardMetadataButton type="delete" buttonLocation="left" tooltipPlacement="right" tooltipText="Delete Dashboard"/>
                    </Col>
                </Row>
                <Row className='h-30' style={{"paddingTop": "10px"}}>
                    <img src={selectedDashboard['image']}></img>
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