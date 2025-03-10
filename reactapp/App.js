import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/AppLoader";
import AppTour from "components/appTour/AppTour";

import "App.scss";

function App() {
  return (
    <>
      <ErrorBoundary>
        <Loader>
          <AppTour />
          <Layout />
        </Loader>
      </ErrorBoundary>
    </>
  );
}

export default App;
