import { render } from "@testing-library/react";
import { Visualization } from "components/visualizations/Base";

// Only the hand-off is under test: what reaches the map visualization.
const receivedProps = { current: null };
jest.mock("components/visualizations/Map", () => {
  const MockMapVisualization = (props) => {
    receivedProps.current = props;
    return <div data-testid="mock-map-visualization" />;
  };
  return MockMapVisualization;
});

const groups = [{ name: "Flood notes", defaults: {}, items: [] }];

beforeEach(() => {
  receivedProps.current = null;
});

test("a map is given the annotation groups from its settings", () => {
  render(
    <Visualization
      vizType="map"
      vizData={{ layers: [], baseMap: "OpenStreetMap" }}
      vizMetadata={{ refreshRate: 0, annotations: groups }}
    />,
  );
  expect(receivedProps.current.annotationGroups).toBe(groups);
});

test("a map whose settings hold no annotations is given none", () => {
  render(<Visualization vizType="map" vizData={{ layers: [] }} />);
  expect(receivedProps.current.annotationGroups).toBeUndefined();
});
