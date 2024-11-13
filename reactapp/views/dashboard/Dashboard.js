import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "../../components/dashboard/DashboardLayoutAlerts";
import { useLayoutNameContext } from "components/contexts/SelectedDashboardContext";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import DataViewerModeContextProvider from "components/contexts/DataViewerModeContext";
import Header from "components/layout/Header";
import PropTypes from "prop-types";

function DashboardView({ initialDashboard }) {
  const name = useLayoutNameContext()[0];

  return (
    <>
      <Header initialDashboard={initialDashboard} />
      {name && (
        // {/* look at moving context here so that we can set name, griditems, etc? */}
        <LayoutAlertContextProvider>
          <DataViewerModeContextProvider>
            <DashboardLayoutAlerts />
            <DashboardLayout key={name} />
          </DataViewerModeContextProvider>
        </LayoutAlertContextProvider>
      )}
    </>
  );
}

DashboardView.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardView;
