import { Route } from "react-router-dom";

import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/Loader";

import Dashboard from "views/dashboard/Dashboard";
import SelectedDashboardContextProvider from "components/contexts/SelectedDashboardContext";
import AvailableDashboardContextProvider from "components/contexts/AvailableDashboardContext";
import SelectedOptionContextProvider from "components/contexts/SelectedOptionContext";
import AvailableOptionsContextProvider from "components/contexts/AvailableOptionsContext";
import AvailableVisualizationsContextProvider from "components/contexts/AvailableVisualizationsContext";
import EditingContextProvider from "components/contexts/EditingContext";
import DashboardNotesModalShowContextProvider from "components/contexts/DashboardNotesModalShowContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";

import "App.scss";

function App() {
  const PATH_HOME = "/",
    PATH_DASHBOARD = "/dashboard";

  return (
    <>
      <ErrorBoundary>
        <Loader>
          <AvailableVisualizationsContextProvider>
            <AvailableDashboardContextProvider>
              <AvailableOptionsContextProvider>
                <SelectedOptionContextProvider>
                  <VariableInputsContextProvider>
                    <SelectedDashboardContextProvider>
                      <EditingContextProvider>
                        <DashboardNotesModalShowContextProvider>
                          <Layout
                            routes={[
                              <Route
                                path={PATH_HOME}
                                element={<Dashboard />}
                                key="route-home"
                              />,
                              <Route
                                path={PATH_DASHBOARD}
                                element={<Dashboard />}
                                key="route-dashboard"
                              />,
                            ]}
                          />
                        </DashboardNotesModalShowContextProvider>
                      </EditingContextProvider>
                    </SelectedDashboardContextProvider>
                  </VariableInputsContextProvider>
                </SelectedOptionContextProvider>
              </AvailableOptionsContextProvider>
            </AvailableDashboardContextProvider>
          </AvailableVisualizationsContextProvider>
        </Loader>
      </ErrorBoundary>
    </>
  );
}

export default App;
