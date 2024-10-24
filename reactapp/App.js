import { Route } from "react-router-dom";

import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/Loader";

import SelectedDashboardContextProvider from "components/contexts/SelectedDashboardContext";
import AvailableDashboardContextProvider from "components/contexts/AvailableDashboardContext";
import SelectedOptionContextProvider from "components/contexts/SelectedOptionContext";
import AvailableOptionsContextProvider from "components/contexts/AvailableOptionsContext";
import AvailableVisualizationsContextProvider from "components/contexts/AvailableVisualizationsContext";
import EditingContextProvider from "components/contexts/EditingContext";
import DashboardNotesModalShowContextProvider from "components/contexts/DashboardNotesModalShowContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import RoutesContextProvider from "components/contexts/RoutesContext";

import "App.scss";

function App() {
  return (
    <>
      <ErrorBoundary>
        <Loader>
          <RoutesContextProvider>
            <AvailableVisualizationsContextProvider>
              <AvailableDashboardContextProvider>
                <AvailableOptionsContextProvider>
                  <SelectedOptionContextProvider>
                    <VariableInputsContextProvider>
                      <SelectedDashboardContextProvider>
                        <EditingContextProvider>
                          <DashboardNotesModalShowContextProvider>
                            <Layout />
                          </DashboardNotesModalShowContextProvider>
                        </EditingContextProvider>
                      </SelectedDashboardContextProvider>
                    </VariableInputsContextProvider>
                  </SelectedOptionContextProvider>
                </AvailableOptionsContextProvider>
              </AvailableDashboardContextProvider>
            </AvailableVisualizationsContextProvider>
          </RoutesContextProvider>
        </Loader>
      </ErrorBoundary>
    </>
  );
}

export default App;
