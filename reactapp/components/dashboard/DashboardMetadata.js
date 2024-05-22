import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { EditText } from 'react-edit-text';
import 'react-edit-text/dist/index.css';
import appAPI from '../../services/api/app';
import { DashboardContext } from 'components/context';
import { useContext } from 'react';

function DashboardMetadata() {
    const selectedDashboard = useContext(DashboardContext);

    return (
        <Container fluid className="m-2 h-100">
            <Row>
                <img src={selectedDashboard['image']}></img>
                <h1>Notes:</h1>
                <div style={{position: "relative", width: "100%"}}>
                <EditText
                    name='dashboardNotes'
                    defaultValue={selectedDashboard['notes']}
                    editButtonProps={{style: {position: "absolute",right: 0,top: 0 }}}
                    style={{"width": "95%", "wordBreak": "normal", "whiteSpace": "normal"}}
                    onSave={saveNotes}
                    showEditButton
                />
                </div>
            </Row>
        </Container>
    );
}

function saveNotes(e) {
  appAPI.updateDashboard()
}

export default DashboardMetadata;