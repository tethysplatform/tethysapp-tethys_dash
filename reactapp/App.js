import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/Loader";

import SelectedDashboardContextProvider from "components/contexts/SelectedDashboardContext";
import AvailableDashboardsContextProvider from "components/contexts/AvailableDashboardsContext";
import EditingContextProvider from "components/contexts/EditingContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import UserSettingsContextProvider from "components/contexts/UserSettingsContext";

import "App.scss";

function App() {
  return (
    <>
      <ErrorBoundary>
        <Loader>
          <UserSettingsContextProvider>
            <VariableInputsContextProvider>
              <SelectedDashboardContextProvider>
                <AvailableDashboardsContextProvider>
                  <EditingContextProvider>
                    <Layout />
                  </EditingContextProvider>
                </AvailableDashboardsContextProvider>
              </SelectedDashboardContextProvider>
            </VariableInputsContextProvider>
          </UserSettingsContextProvider>
        </Loader>
      </ErrorBoundary>
    </>
  );
}

export default App;
