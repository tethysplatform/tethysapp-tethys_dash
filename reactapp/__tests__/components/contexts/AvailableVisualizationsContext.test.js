import { render, screen } from "@testing-library/react";
import AvailableVisualizationsContextProvider, {
  useAvailableVisualizationsContext,
} from "components/contexts/AvailableVisualizationsContext";

const TestingComponent = () => {
  const { availableVisualizations, availableVizArgs } =
    useAvailableVisualizationsContext();

  return (
    <>
      <ul>
        {availableVisualizations.map((item) => {
          function joinLabels(arrayItem) {
            return item.label + "-" + arrayItem.label;
          }
          return item.options.map((arrayItem, index) => {
            const newLabel = joinLabels(arrayItem);
            return <li key={index}>{newLabel}</li>;
          });
        })}
      </ul>
      <ul>
        {availableVizArgs.map((item, index) => {
          return <li key={index}>{item.label}</li>;
        })}
      </ul>
    </>
  );
};

test("available visualization context", async () => {
  render(
    <AvailableVisualizationsContextProvider>
      <TestingComponent />
    </AvailableVisualizationsContextProvider>
  );

  expect(
    await screen.findByText("Visualization Group-plugin_label")
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Visualization Group-plugin_label2")
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Visualization Group 2-plugin_label3")
  ).toBeInTheDocument();

  expect(
    await screen.findByText("Visualization Group: plugin_label - Plugin Arg")
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Visualization Group: plugin_label2 - Plugin Arg")
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      "Visualization Group 2: plugin_label3 - Plugin Arg3"
    )
  ).toBeInTheDocument();
});
