import { render, screen, within } from "@testing-library/react";
import HoverTooltip, {
  HOVER_TOOLTIP_OFFSET,
  hoverTooltipPlacement,
} from "components/map/HoverTooltip";
import { hoverAttributeRows } from "components/map/popupAttributes";

// Each field row's label and value cell text, in order. The header row has
// column headers rather than cells, so it is left out.
const renderedRows = () =>
  within(screen.getByRole("tooltip"))
    .getAllByRole("row")
    .map((row) =>
      within(row)
        .queryAllByRole("cell")
        .map((cell) => cell.textContent),
    )
    .filter((cells) => cells.length > 0);

describe("HoverTooltip", () => {
  it("is a tooltip", () => {
    render(<HoverTooltip rows={[{ key: "a", label: "a", value: 1 }]} />);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("renders a feature's hover rows with their aliases, in the saved order", () => {
    const rows = hoverAttributeRows({
      layerName: "Gauges",
      attributes: { STATUS: "up", GAUGE_ID: "G1", NAME: "Creek", SECRET: "x" },
      __wrapperLayer: {
        tablePopupType: "hover",
        hoverPopupAttributes: { Gauges: ["NAME", "STATUS", "GAUGE_ID"] },
        attributeAliases: { Gauges: { NAME: "Station", GAUGE_ID: "Gauge" } },
        attributeOrder: { Gauges: ["NAME", "STATUS"] },
      },
    });

    render(<HoverTooltip rows={rows} />);

    expect(renderedRows()).toEqual([
      ["Station", "Creek"],
      ["STATUS", "up"],
      ["Gauge", "G1"],
    ]);
  });

  it("renders values the way the click table does", () => {
    render(
      <HoverTooltip
        rows={[
          { key: "site", label: "site", value: "https://example.com" },
          { key: "home", label: "home", value: "www.example.org" },
          { key: "flow", label: "flow", value: 0 },
          { key: "active", label: "active", value: true },
          { key: "seen", label: "seen", value: new Date(Date.UTC(2026, 0, 2)) },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "https://example.com" }),
    ).toHaveAttribute("href", "https://example.com");
    // A bare www. link gets a protocol, as it does in the click table.
    expect(
      screen.getByRole("link", { name: "www.example.org" }),
    ).toHaveAttribute("href", "https://www.example.org");
    expect(renderedRows().slice(2)).toEqual([
      ["flow", "0"],
      ["active", "true"],
      ["seen", "2026-01-02T00:00:00.000Z"],
    ]);
  });

  it("names the layer above Field and Value headers, like the click table", () => {
    render(
      <HoverTooltip
        layerName="Gauges"
        rows={[{ key: "a", label: "a", value: 1 }]}
      />,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("Gauges")).toBeInTheDocument();
    expect(
      within(tooltip)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Field", "Value"]);
    expect(renderedRows()).toEqual([["a", "1"]]);
  });

  it("has no pager or close button", () => {
    render(
      <HoverTooltip
        layerName="Gauges"
        rows={[{ key: "a", label: "a", value: 1 }]}
      />,
    );
    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).queryByRole("button")).not.toBeInTheDocument();
    expect(within(tooltip).queryByRole("heading")).not.toBeInTheDocument();
  });

  it("leaves the layer line out when it has no layer name", () => {
    render(<HoverTooltip rows={[{ key: "a", label: "a", value: 1 }]} />);
    // The table's headers come first: nothing names a layer above them.
    expect(screen.getByRole("tooltip")).toHaveTextContent(/^FieldValue/);
  });
});

describe("hoverTooltipPlacement", () => {
  const size = [400, 300];
  const away = HOVER_TOOLTIP_OFFSET;

  it("opens below and to the right of a cursor in the top-left quarter", () => {
    expect(hoverTooltipPlacement([10, 10], size)).toEqual({
      positioning: "top-left",
      offset: [away, away],
    });
  });

  it("flips left in the right half and up in the bottom half", () => {
    expect(hoverTooltipPlacement([390, 10], size)).toEqual({
      positioning: "top-right",
      offset: [-away, away],
    });
    expect(hoverTooltipPlacement([10, 290], size)).toEqual({
      positioning: "bottom-left",
      offset: [away, -away],
    });
    expect(hoverTooltipPlacement([390, 290], size)).toEqual({
      positioning: "bottom-right",
      offset: [-away, -away],
    });
  });

  it("takes the default corner without a pixel or a map size", () => {
    const fallback = { positioning: "top-left", offset: [away, away] };
    expect(hoverTooltipPlacement(null, size)).toEqual(fallback);
    expect(hoverTooltipPlacement([390, 290], undefined)).toEqual(fallback);
  });
});
