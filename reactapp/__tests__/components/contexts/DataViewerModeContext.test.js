import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import DataViewerModeContextProvider, {
  useDataViewerModeContext,
} from "components/contexts/DataViewerModeContext";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TestingComponent = () => {
  const { inDataViewerMode, setInDataViewerMode } = useDataViewerModeContext();
  useEffect(() => {
    sleep(1).then(() => {
      setInDataViewerMode(true);
    });
    // eslint-disable-next-line
  }, []);

  return <p>{inDataViewerMode ? "yes" : "no"}</p>;
};

test("dataviewer mode context", async () => {
  render(
    <DataViewerModeContextProvider>
      <TestingComponent />
    </DataViewerModeContextProvider>
  );

  expect(await screen.findByText("no")).toBeInTheDocument();
  expect(await screen.findByText("yes")).toBeInTheDocument();
});
