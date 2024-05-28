import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import 'react-edit-text/dist/index.css';
import appAPI from '../../services/api/app';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useSelectedDashboardContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import { useSelectedOptionContext } from 'components/contexts/SelectedOptionContext';
import { useAvailableOptionsContext } from 'components/contexts/AvailableOptionsContext';
import { useState, useContext } from 'react';
import DashboardMetadataButton from "./DashboardMetadataButton"
import { AppContext } from 'components/contexts/AppContext';
import { confirm } from "components/dashboard/DeleteConfirmation";

function DashboardMetadata() {
    const [ dashboardContext, setDashboardContext ] = useSelectedDashboardContext();
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
    const [ selectedOption, setSelectedOption ] = useSelectedOptionContext();
    const [ selectOptions, setSelectOptions ] = useAvailableOptionsContext();
    const [ isEditing, setIsEditing ] = useEditingContext();
    const {csrf} = useContext(AppContext);
    const [ dashboardNotes, setDashboardNotes ] = useState(dashboardContext['notes'])

    function onNotesChange({target:{value}}) {
        setDashboardNotes(value)
    }

    async function onDelete(e) {
        const selectedOptionValue = selectedOption['value']

        if (await confirm("Are your sure you want to delete the " + selectedOptionValue + " dashboard?")) {
            const newdashboardLayoutConfigs = Object.fromEntries(
                Object.entries(dashboardLayoutConfigs).filter(([key]) => key != selectedOptionValue)
            );
            const newSelectOptions = selectOptions.filter((options)=>(JSON.stringify(options) != JSON.stringify(selectedOption)))
            appAPI.deleteDashboard({"name": selectedOptionValue}, csrf).then((response) => {
                setDashboardLayoutConfigs(newdashboardLayoutConfigs)
                setSelectOptions(newSelectOptions)
                setSelectedOption(null)
                setDashboardContext(null)
            })
        }
    }

    function onEdit(e) {
        setIsEditing(true)
    }

    function onSave(e) {
        setIsEditing(false)
    }


    return (
        <Container className="h-100">
            <Col className='h-100'>
                <Row className='h-10'>
                    <h2 style={{"paddingTop": "5%", "textAlign": "center"}}>{dashboardContext['label']}</h2>
                </Row>
                <Row className='h-10'>
                    {isEditing
                    ? <Col>
                        <DashboardMetadataButton type="save" buttonLocation="right" tooltipPlacement="left" tooltipText="Save Changes" onClick={onSave}/>
                    </Col>
                    : <Col>
                        <DashboardMetadataButton type="edit" buttonLocation="right" tooltipPlacement="left" tooltipText="Edit Dashboard" onClick={onEdit}/>
                    </Col>
                    }
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