import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "../../components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import Header from "components/layout/Header";
import PropTypes from "prop-types";
import { useContext } from "react";
import { LayoutContext } from "components/contexts/Contexts";

function DashboardView({ initialDashboard }) {
  const { getLayoutContext } = useContext(LayoutContext);
  const { name } = getLayoutContext();

  return (
    <>
      <Header initialDashboard={initialDashboard} />
      {name && (
        // {/* look at moving context here so that we can set name, griditems, etc? */}
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
