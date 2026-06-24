import DashboardTabs from "components/dashboard/DashboardTabs";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import { DashboardHeader } from "components/layout/Header";
import PropTypes from "prop-types";
import DashboardLoader from "components/loader/DashboardLoader";

function DashboardView(dashboardProps) {
  return (
    <div className="h-100" style={{ display: "flex", flexDirection: "column" }}>
      <DashboardLoader {...dashboardProps}>
        <LayoutAlertContextProvider>
          <DashboardHeader />
          <DashboardLayoutAlerts />
          <DashboardTabs />
        </LayoutAlertContextProvider>
      </DashboardLoader>
    </div>
  );
}

DashboardView.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  description: PropTypes.string,
  notes: PropTypes.string,
  editable: PropTypes.bool,
  publicDashboard: PropTypes.bool,
  gridItems: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
      i: PropTypes.string,
      x: PropTypes.number,
      y: PropTypes.number,
      w: PropTypes.number,
      h: PropTypes.number,
      source: PropTypes.string,
      args_string: PropTypes.string,
      metadata_string: PropTypes.string,
    }),
  ),
};

export default DashboardView;
