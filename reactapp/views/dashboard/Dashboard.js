import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import DashboardButton from '../../components/buttons/DashboardButton';
import SelectInput from '../../components/inputs/SelectInput';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import DashboardMetadata from '../../components/dashboard/DashboardMetadata';
import NewDashboardModal from '../../components/modals/NewDashboard';
import React, { useState, useEffect } from 'react';
import appAPI from '../../services/api/app';
import { DashboardContext, DashboardModalShowContext } from 'components/context';

function DashboardView() {
  const [dashboardContext, setDashboardContext] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [selectOptions, setSelectOptions] = useState(null)
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useState(null)

  useEffect(() => {
    appAPI.getDashboards().then((data) => {
      let options = []
      for (const [name, details] of Object.entries(data)) {
        options.push({value: name, label: details.label})
      }
      setSelectOptions(options)
      setDashboardLayoutConfigs(data)
    })
  }, [])

  function updateLayout(e) {
      let selectedDashboard = dashboardLayoutConfigs[e.value]
      selectedDashboard['name'] = e.value
      setDashboardContext(selectedDashboard)
  }

  
  function createDashboard(e) {
    setShowModal(true)
  }

  return (
    <>
      <DashboardContext.Provider value={dashboardContext}>
        <div className="h-100 w-100">
          <Container fluid className="h-100">
            <Row className="h-100">
              <Col className="col-3 h-100">
                <Row style={{"height": "5%"}}>
                  <Col className="col-10">
                    <SelectInput options={selectOptions} onChange={updateLayout}></SelectInput>
                  </Col>
                  <Col className="col-2" style={{"position": "relative"}}>
                    <DashboardButton tooltipPlacement="bottom" tooltipText="Create a new dashboard" onClick={createDashboard}></DashboardButton>
                  </Col>
                </Row>
                <Row style={{"height": "95%"}}>
                  {dashboardContext && 
                    <DashboardMetadata />
                  }
                </Row>
              </Col>
              <Col className="col-9">
              {dashboardContext &&
                <DashboardLayout />
              }
              </Col>
            </Row>
          </Container>
        </div>
        <DashboardModalShowContext.Provider value={[showModal, setShowModal]}>
          {showModal && <NewDashboardModal />}
        </DashboardModalShowContext.Provider>
      </DashboardContext.Provider>
    </>
  );
}

export default DashboardView;