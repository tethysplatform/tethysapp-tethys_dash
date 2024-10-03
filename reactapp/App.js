import { Route } from "react-router-dom";

import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/Loader";

import Dashboard from "views/dashboard/Dashboard";
import Explorer from "views/explorer/Explorer";
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
    PATH_DASHBOARD = "/dashboard",
    PATH_EXPLORER = "/explorer";

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
                            navLinks={[
                              {
                                title: "Dashboard",
                                to: PATH_DASHBOARD,
                                eventKey: "link-dashboard",
                              },
                              {
                                title: "Explorer",
                                to: PATH_EXPLORER,
                                eventKey: "link-explorer",
                              },
                            ]}
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
                              <Route
                                path={PATH_EXPLORER}
                                element={<Explorer />}
                                key="route-explorer"
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
