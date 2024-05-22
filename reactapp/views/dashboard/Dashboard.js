import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import SelectInput from '../../components/inputs/SelectInput';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import DashboardMetadata from '../../components/dashboard/DashboardMetadata';
import React, { useState, useEffect } from 'react';
import appAPI from '../../services/api/app';
import { DashboardContext } from 'components/context';

function DashboardView() {
  const [dashboardContext, setDashboardContext] = useState(null);

  const [selectOptions, setSelectOptions] = useState(null)
  const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useState(null)

  useEffect(() => {
    appAPI.getDashboards().then((data) => {
      let options = []
      for (const [name, details] of Object.entries(data)) {
        options.push({value: name, label: name})
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

  return (
    <>
      <DashboardContext.Provider value={dashboardContext}>
        <div className="h-100 w-100">
          <Container fluid className="m-2 h-100">
            <Row className="h-100">
              <Col className="col-3 m-0">
                <Row className="h-10">
                  <SelectInput options={selectOptions} onChange={updateLayout}></SelectInput>
                </Row>
                {dashboardContext && 
                  <DashboardMetadata />
                }
              </Col>
              <Col className="col-9 m-0">
              {dashboardContext &&
                <DashboardLayout />
              }
              </Col>
            </Row>
          </Container>
        </div>
      </DashboardContext.Provider>
    </>
  );
}

export default DashboardView;