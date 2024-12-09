import ErrorBoundary from "components/error/ErrorBoundary";
import Layout from "components/layout/Layout";
import Loader from "components/loader/Loader";
import PostLoader from "components/loader/PostLoader";

import "App.scss";

function App() {
  return (
    <>
      <ErrorBoundary>
        <Loader>
          <PostLoader>
            <Layout />
          </PostLoader>
        </Loader>
      </ErrorBoundary>
    </>
  );
}

export default App;
