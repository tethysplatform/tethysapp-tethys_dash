import DashboardLayout from "components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "components/dashboard/DashboardLayoutAlerts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import { DashboardHeader } from "components/layout/Header";
import PropTypes from "prop-types";
import AppTour from "components/dashboard/AppTour";
import DashboardLoader from "components/loader/DashboardLoader";

function DashboardView({
  id,
  name,
  description,
  notes,
  editable,
  accessGroups,
  gridItems,
}) {
  return (
    <DashboardLoader
      id={id}
      dashboardName={name}
      dashboardDescription={description}
      dashboardNotes={notes}
      dashboardEditable={editable}
      dashboardAccessGroups={accessGroups}
      dashboardGridItems={gridItems}
    >
      {/* <AppTour /> */}
      <LayoutAlertContextProvider>
        <DashboardHeader />
        <DashboardLayoutAlerts />
        <DashboardLayout />
      </LayoutAlertContextProvider>
    </DashboardLoader>
  );
}

DashboardView.propTypes = {
  id: PropTypes.number,
  name: PropTypes.string,
  description: PropTypes.string,
  notes: PropTypes.string,
  editable: PropTypes.bool,
  accessGroups: PropTypes.arrayOf(PropTypes.string),
  gridItems: PropTypes.shape({
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
};

export default DashboardView;
