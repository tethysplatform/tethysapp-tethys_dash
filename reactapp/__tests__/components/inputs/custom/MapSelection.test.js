import { render, screen, fireEvent } from "@testing-library/react";
import { MapSelection } from "components/inputs/custom/MapSelection";

const openSection = () => fireEvent.click(screen.getByText("Map Selection"));

const checkbox = (row, column) => screen.getByLabelText(`${row} ${column}`);

describe("MapSelection Component", () => {
  test("opens at the defaults: both on the map, neither in the legend", () => {
    render(<MapSelection onChange={jest.fn()} values={{}} />);

    expect(
      screen.queryByLabelText("Clicked location Show on map"),
    ).not.toBeInTheDocument();
    const header = screen.getByRole("button", { name: /Map Selection/ });
    expect(header).toHaveAttribute("aria-expanded", "false");
    openSection();
    expect(header).toHaveAttribute("aria-expanded", "true");

    expect(
      screen.getByRole("columnheader", { name: "Show on map" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Show in legend" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Show in layer control" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Clicked location" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("rowheader", { name: "Selected feature" }),
    ).toBeInTheDocument();

    for (const row of ["Clicked location", "Selected feature"]) {
      expect(checkbox(row, "Show on map")).toBeChecked();
      expect(checkbox(row, "Show in legend")).not.toBeChecked();
      expect(checkbox(row, "Show in legend")).toBeEnabled();
      expect(checkbox(row, "Show in layer control")).toBeChecked();
      expect(checkbox(row, "Show in layer control")).toBeEnabled();
    }
  });

  test("an absent value opens at the defaults too", () => {
    render(<MapSelection onChange={jest.fn()} />);
    openSection();

    expect(checkbox("Clicked location", "Show on map")).toBeChecked();
    expect(checkbox("Selected feature", "Show in legend")).not.toBeChecked();
  });

  test("checking the outline's legend box saves only that change", () => {
    const handleChange = jest.fn();
    render(<MapSelection onChange={handleChange} values={{}} />);
    openSection();

    fireEvent.click(checkbox("Selected feature", "Show in legend"));

    expect(handleChange).toHaveBeenLastCalledWith({
      selectedFeature: { legend: true },
    });
    expect(checkbox("Selected feature", "Show in legend")).toBeChecked();
  });

  test("turning a row off the map clears and disables its legend box", () => {
    const handleChange = jest.fn();
    render(
      <MapSelection
        onChange={handleChange}
        values={{ clickedLocation: { legend: true } }}
      />,
    );
    openSection();
    const legendBox = checkbox("Clicked location", "Show in legend");
    expect(legendBox).toBeChecked();
    expect(legendBox).not.toHaveAccessibleDescription();

    fireEvent.click(checkbox("Clicked location", "Show on map"));

    expect(handleChange).toHaveBeenLastCalledWith({
      clickedLocation: { map: false },
    });
    expect(legendBox).not.toBeChecked();
    expect(legendBox).toBeDisabled();
    expect(legendBox).toHaveAccessibleDescription("Turn on Show on map first");
    // The other row is untouched.
    expect(checkbox("Selected feature", "Show in legend")).toBeEnabled();

    // Back on the map, the legend box can be checked again but starts clear.
    fireEvent.click(checkbox("Clicked location", "Show on map"));
    expect(legendBox).toBeEnabled();
    expect(legendBox).not.toBeChecked();
  });

  test("unchecking the pin's layer-control box saves only that change", () => {
    const handleChange = jest.fn();
    render(<MapSelection onChange={handleChange} values={{}} />);
    openSection();

    fireEvent.click(checkbox("Clicked location", "Show in layer control"));

    expect(handleChange).toHaveBeenLastCalledWith({
      clickedLocation: { layerControl: false },
    });
    expect(
      checkbox("Clicked location", "Show in layer control"),
    ).not.toBeChecked();
    expect(checkbox("Selected feature", "Show in layer control")).toBeChecked();
  });

  test("turning a row off the map clears and disables its layer-control box, and turning it back on lists it again", () => {
    const handleChange = jest.fn();
    render(
      <MapSelection
        onChange={handleChange}
        values={{ selectedFeature: { layerControl: false } }}
      />,
    );
    openSection();
    const layerControlBox = checkbox(
      "Selected feature",
      "Show in layer control",
    );
    expect(layerControlBox).not.toBeChecked();

    fireEvent.click(checkbox("Selected feature", "Show on map"));
    expect(handleChange).toHaveBeenLastCalledWith({
      selectedFeature: { map: false },
    });
    expect(layerControlBox).toBeDisabled();
    expect(layerControlBox).not.toBeChecked();
    expect(layerControlBox).toHaveAccessibleDescription(
      "Turn on Show on map first",
    );

    fireEvent.click(checkbox("Selected feature", "Show on map"));
    expect(layerControlBox).toBeEnabled();
    expect(layerControlBox).toBeChecked();
    expect(handleChange).toHaveBeenLastCalledWith({});
  });

  test("returning to the defaults saves an empty object", () => {
    const handleChange = jest.fn();
    render(<MapSelection onChange={handleChange} values={{}} />);
    openSection();

    fireEvent.click(checkbox("Selected feature", "Show on map"));
    expect(handleChange).toHaveBeenLastCalledWith({
      selectedFeature: { map: false },
    });

    fireEvent.click(checkbox("Selected feature", "Show on map"));
    expect(handleChange).toHaveBeenLastCalledWith({});
  });

  test("a saved value loads, and edits keep the other row's changes", () => {
    const handleChange = jest.fn();
    render(
      <MapSelection
        onChange={handleChange}
        values={{
          clickedLocation: { map: false },
          selectedFeature: { legend: true },
        }}
      />,
    );
    openSection();

    expect(checkbox("Clicked location", "Show on map")).not.toBeChecked();
    expect(checkbox("Clicked location", "Show in legend")).toBeDisabled();
    expect(checkbox("Selected feature", "Show on map")).toBeChecked();
    expect(checkbox("Selected feature", "Show in legend")).toBeChecked();

    fireEvent.click(checkbox("Selected feature", "Show in legend"));
    expect(handleChange).toHaveBeenLastCalledWith({
      clickedLocation: { map: false },
    });
  });

  test("a saved legend entry for a mark hidden from the map loads as off", () => {
    render(
      <MapSelection
        onChange={jest.fn()}
        values={{ selectedFeature: { map: false, legend: true } }}
      />,
    );
    openSection();

    expect(checkbox("Selected feature", "Show in legend")).not.toBeChecked();
    expect(checkbox("Selected feature", "Show in legend")).toBeDisabled();
  });
});
