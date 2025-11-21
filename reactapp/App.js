import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/AppLoader";
import AppTour from "components/appTour/AppTour";
import { ModalPriorityProvider } from "components/contexts/ModalPriorityContext";

import "App.scss";

function App() {
  return (
    <>
      <ErrorBoundary>
        <ModalPriorityProvider>
          <Loader>
            <AppTour />
            <Layout />
          </Loader>
        </ModalPriorityProvider>
      </ErrorBoundary>
    </>
  );
}

export default App;
