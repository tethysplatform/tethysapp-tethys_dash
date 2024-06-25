import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import appAPI from '../../services/api/app';
import { useEditingContext } from 'components/contexts/EditingContext';
import { useLayoutContext, useLayoutImageContext, useLayoutLabelContext } from 'components/contexts/SelectedDashboardContext';
import { useAvailableDashboardContext } from 'components/contexts/AvailableDashboardContext';
import { useSelectedOptionContext } from 'components/contexts/SelectedOptionContext';
import { useAvailableOptionsContext } from 'components/contexts/AvailableOptionsContext';
import { useDashboardNotesModalShowContext } from 'components/contexts/DashboardNotesModalShowContext';
import { useContext } from 'react';
import DashboardMetadataButton from "components/buttons/DashboardMetadataButton"
import { AppContext } from 'components/contexts/AppContext';
import { confirm } from "components/dashboard/DeleteConfirmation";
import DashboardNotesModal from 'components/modals/DashboardNotes';

function DashboardMetadata() {
    const resetLayoutContext = useLayoutContext()[1];
    const image = useLayoutImageContext()[0];
    const label = useLayoutLabelContext()[0];
    const [ dashboardLayoutConfigs, setDashboardLayoutConfigs ] = useAvailableDashboardContext();
    const [ selectedOption, setSelectedOption ] = useSelectedOptionContext();
    const [ selectOptions, setSelectOptions ] = useAvailableOptionsContext();
    const [ isEditing, setIsEditing ] = useEditingContext();
    const [ showModal, setShowModal ] = useDashboardNotesModalShowContext();
    const {csrf} = useContext(AppContext);

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
                resetLayoutContext()
            })
        }
    }

    function onEdit(e) {
        setIsEditing(true)
    }

    function onNotes(e) {
        setShowModal(true)
    }


    return (
        <>
            <Container className="h-100">
                <Col className='h-100'>
                    <Row className='h-10'>
                        <h2 style={{"paddingTop": "5%", "textAlign": "center"}}>{label}</h2>
                    </Row>
                    <Row className='h-10'>
                        <Form inline="true" style={{textAlign: "center"}}>
                            {isEditing && <DashboardMetadataButton type="save" tooltipPlacement="top" tooltipText="Save Changes" form="rowUpdate"/>}
                            {!isEditing && <DashboardMetadataButton type="edit" tooltipPlacement="top" tooltipText="Edit Dashboard" onClick={onEdit}/>}
                            <DashboardMetadataButton type="notes" tooltipPlacement="top" tooltipText="Open Notes" onClick={onNotes}/>
                            <DashboardMetadataButton type="delete" tooltipPlacement="top" tooltipText="Delete Dashboard" onClick={onDelete}/>
                        </Form>
                    </Row>
                    <Row className='h-30' style={{"paddingTop": "10px"}}>
                        <img src={image}></img>
                    </Row>
                </Col>
            </Container>
            {showModal && <DashboardNotesModal />}
        </>
    );
}

export default DashboardMetadata;