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

describe("LegendControl height cap", () => {
  // jsdom does no layout, so these pin the DECLARED max-height. That the
  // control visually clips inside a short map, and does not paint over
  // neighbouring grid items, is browser-verified.
  const makeMapDiv = (height) => {
    const element = document.createElement("div");
    element.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      width: 300,
      height,
      bottom: height,
      right: 300,
      toJSON: () => ({}),
    });
    document.body.appendChild(element);
    return element;
  };

  const expand = async () => {
    fireEvent.click(await screen.findByLabelText("Show Legend Control"));
    return screen.findByLabelText("Legend Control");
  };

  test("caps an expanded legend at three quarters of the map div", async () => {
    render(
      <LegendControl
        legendItems={[legendItems]}
        mapDivRef={{ current: makeMapDiv(800) }}
      />,
    );
    expect(await expand()).toHaveStyle({ maxHeight: "600px" });
  });

  test("scales the cap down with a shorter map", async () => {
    render(
      <LegendControl
        legendItems={[legendItems]}
        mapDivRef={{ current: makeMapDiv(300) }}
      />,
    );
    expect(await expand()).toHaveStyle({ maxHeight: "225px" });
  });

  test("falls back to the viewport cap with no map div to measure", async () => {
    render(<LegendControl legendItems={[legendItems]} />);
    expect(await expand()).toHaveStyle({ maxHeight: "35vh" });
  });

  test("never caps below the collapsed control's own size", async () => {
    render(
      <LegendControl
        legendItems={[legendItems]}
        mapDivRef={{ current: makeMapDiv(40) }}
      />,
    );
    expect(await expand()).toHaveStyle({ maxHeight: "40px" });
  });

  test("leaves the collapsed control uncapped at its fixed size", async () => {
    render(
      <LegendControl
        legendItems={[legendItems]}
        mapDivRef={{ current: makeMapDiv(300) }}
      />,
    );
    const container = await screen.findByLabelText("Legend Control");
    expect(container).toHaveStyle({ maxHeight: "none", height: "40px" });
  });
});
