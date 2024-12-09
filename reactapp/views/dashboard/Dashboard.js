import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "../../components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import DataViewerModeContextProvider from "components/contexts/DataViewerModeContext";
import Header from "components/layout/Header";
import PropTypes from "prop-types";
import { useContext } from "react";
import { LayoutNameContext } from "components/contexts/Contexts";

function DashboardView({ initialDashboard }) {
  const { name } = useContext(LayoutNameContext);

  return (
    <>
      <DataViewerModeContextProvider>
        <Header initialDashboard={initialDashboard} />
        {name && (
          // {/* look at moving context here so that we can set name, griditems, etc? */}
          <LayoutAlertContextProvider>
            <DashboardLayoutAlerts />
            <DashboardLayout key={name} />
          </LayoutAlertContextProvider>
        )}
      </DataViewerModeContextProvider>
    </>
  );
}

DashboardView.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardView;
