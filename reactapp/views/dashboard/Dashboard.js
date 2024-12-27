import DashboardLayout from "components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import Header from "components/layout/Header";
import PropTypes from "prop-types";
import { useContext } from "react";
import { LayoutContext } from "components/contexts/Contexts";
import AppTour from "components/dashboard/AppTour";

function DashboardView({ initialDashboard }) {
  const { getLayoutContext } = useContext(LayoutContext);
  const { name } = getLayoutContext();

  return (
    <>
      <AppTour />
      <Header initialDashboard={initialDashboard} />
      {name && (
        <LayoutAlertContextProvider>
          <DashboardLayoutAlerts />
          <DashboardLayout key={name} />
        </LayoutAlertContextProvider>
      )}
    </>
  );
}

DashboardView.propTypes = {
  initialDashboard: PropTypes.string,
};

export default DashboardView;
