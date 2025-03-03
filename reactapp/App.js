import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/AppLoader";

import "App.scss";

function App() {
  return (
    <>
      <ErrorBoundary>
        <Loader>
          <Layout />
        </Loader>
      </ErrorBoundary>
    </>
  );
}

export default App;
