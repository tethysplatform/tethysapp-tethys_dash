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
  expect(await screen.findByText("upTriangle")).toBeInTheDocument();
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
  expect(await screen.findByText("legend item 1")).toBeInTheDocument();

  const closeLegendButton = await screen.findByLabelText(
    "Close Legend Control"
  );
  fireEvent.click(closeLegendButton);
  expect(screen.queryByText("Some New Title")).not.toBeInTheDocument();
  expect(screen.queryByText("legend item 1")).not.toBeInTheDocument();
});
