import DashboardLayout from "../../components/dashboard/DashboardLayout";
import DashboardLayoutAlerts from "../../components/dashboard/DashboardLayoutAlerts";
import { useLayoutNameContext } from "components/contexts/SelectedDashboardContext";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

function DashboardView() {
  const name = useLayoutNameContext()[0];

  return (
    <>
      {name && (
        <LayoutAlertContextProvider>
          <DashboardLayoutAlerts />
          <DashboardLayout />
        </LayoutAlertContextProvider>
      )}
    </>
  );
}

export default DashboardView;
