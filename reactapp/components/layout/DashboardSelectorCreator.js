
import { useEffect } from 'react';
import SelectInput from 'components/inputs/SelectInput';
import HeaderButton from 'components/buttons/HeaderButton';
import NewDashboardModal from 'components/modals/NewDashboard';
import { useLayoutContext } from "components/contexts/SelectedDashboardContext";
import { useAvailableOptionsContext } from "components/contexts/AvailableOptionsContext";
import { useAvailableDashboardContext } from "components/contexts/AvailableDashboardContext";
import { useSelectedOptionContext } from "components/contexts/SelectedOptionContext";
import { useAddDashboardModalShowContext } from "components/contexts/AddDashboardModalShowContext";
import appAPI from 'services/api/app';
import { BsPlus } from "react-icons/bs";

function DashboardSelectorCreator() {
    const setLayoutContext = useLayoutContext()[0];
    const [selectOptions, setSelectOptions] = useAvailableOptionsContext();
    const [dashboardLayoutConfigs, setDashboardLayoutConfigs] = useAvailableDashboardContext();
    const [selectedOption, setSelectedOption] = useSelectedOptionContext();
    const [showModal, setShowModal] = useAddDashboardModalShowContext();
  
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
        setSelectedOption({"value": e.value, "label": selectedDashboard['label']})
        setLayoutContext(selectedDashboard)
    }
    
    function createDashboard(e) {
      setShowModal(true)
    }
  
    return (
      <>
        <SelectInput options={selectOptions} value={selectedOption} onChange={updateLayout}></SelectInput>
        <HeaderButton tooltipPlacement="bottom" tooltipText="Create a new dashboard" variant="info" onClick={createDashboard}  className="me-2"><BsPlus size="1.5rem"/></HeaderButton>
        {showModal && <NewDashboardModal />}
      </>
    )
  }

  export default DashboardSelectorCreator;