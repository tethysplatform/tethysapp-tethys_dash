import { render, screen, fireEvent } from "@testing-library/react";
import { legendItems } from "__tests__/utilities/constants";
import LegendControl from "components/map/LegendControl";

test("LegendControl", async () => {
  const { rerender } = render(<LegendControl legendItems={[]} />);
  const mapLayersDiv = await screen.findByLabelText("Map Legend");
  // eslint-disable-next-line
  expect(mapLayersDiv.children.length).toBe(0);

  rerender(<LegendControl legendItems={[legendItems]} />);
  expect(screen.queryByText("Some Title")).not.toBeInTheDocument();
  expect(screen.queryByText("square")).not.toBeInTheDocument();

  const showLegendButton = await screen.findByLabelText("Show Legend Control");
  fireEvent.click(showLegendButton);
  expect(await screen.findByText("Some Title")).toBeInTheDocument();
  expect(await screen.findByText("square")).toBeInTheDocument();
  expect(await screen.findByText("circle")).toBeInTheDocument();
  expect(await screen.findByText("triangle")).toBeInTheDocument();
  expect(await screen.findByText("rightTriangle")).toBeInTheDocument();
  expect(await screen.findByText("downTriangle")).toBeInTheDocument();
  expect(await screen.findByText("leftTriangle")).toBeInTheDocument();
  expect(await screen.findByText("rectangle")).toBeInTheDocument();
  expect(await screen.findByText("line")).toBeInTheDocument();

  const newLegendItems = {
    title: "Some New Title",
    items: [
      {
        label: "legend item 1",
        color: "#4935d0",
        symbol: "downTriangle",
      },
    ],
  };
  rerender(<LegendControl legendItems={[newLegendItems]} />);
  expect(screen.queryByText("Some Title")).not.toBeInTheDocument();
  expect(await screen.findByText("Some New Title")).toBeInTheDocument();

  const closeLegendButton = await screen.findByLabelText(
    "Close Legend Control",
  );
  fireEvent.click(closeLegendButton);
  expect(screen.queryByText("Some New Title")).not.toBeInTheDocument();
});

test("LegendControl flags itself only while expanded", async () => {
  // The flag is what DashboardItem's fill-viewport rule keys off to raise the
  // whole tile. Raising the tile is the only lever available: position:fixed
  // makes it a stacking context, so no z-index on the control can escape it.
  render(<LegendControl legendItems={[legendItems]} />);

  fireEvent.click(await screen.findByLabelText("Show Legend Control"));
  expect(await screen.findByLabelText("Legend Control")).toHaveAttribute(
    "data-map-control-open",
    "true",
  );

  fireEvent.click(await screen.findByLabelText("Close Legend Control"));
  expect(screen.getByLabelText("Legend Control")).not.toHaveAttribute(
    "data-map-control-open",
  );
});
