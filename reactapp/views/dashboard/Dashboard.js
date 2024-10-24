import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "../../components/dashboard/DashboardLayoutAlerts";
import { useLayoutNameContext } from "components/contexts/SelectedDashboardContext";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import Header from "components/layout/Header";

function DashboardView({ initialDashboard }) {
  const name = useLayoutNameContext()[0];

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

export default DashboardView;
