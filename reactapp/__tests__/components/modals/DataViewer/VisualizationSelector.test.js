import { render, screen, fireEvent } from "@testing-library/react";
import VisualizationSelector from "components/modals/DataViewer/VisualizationSelector";
import createLoadedComponent from "__tests__/utilities/customRender";
import userEvent from "@testing-library/user-event";

it("VisualizationSelector", async () => {
  const mockHandleModalClose = jest.fn();
  const mockSetSelectVizTypeOption = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <VisualizationSelector
          showModal={true}
          handleModalClose={mockHandleModalClose}
          setSelectVizTypeOption={mockSetSelectVizTypeOption}
        />
      ),
      options: {},
    })
  );

  expect(
    await screen.findByText("Available Visualizations")
  ).toBeInTheDocument();
  expect(
    (await screen.findByLabelText("Visualization Search Input")).placeholder
  ).toBe("Search by Name or Tags");

  const defaultSectionTitle = screen.getByText("Default");
  expect(defaultSectionTitle).toBeInTheDocument();

  await userEvent.click(defaultSectionTitle);

  const textOption = await screen.findByText("Text");
  expect(textOption).toBeInTheDocument();

  await userEvent.click(textOption);

  expect(mockSetSelectVizTypeOption).toHaveBeenCalledWith({
    args: { text: "text" },
    description: "A block of formattable text.",
    label: "Text",
    source: "Text",
    tags: ["text", "default"],
    type: "text",
    value: "Text",
  });
  expect(mockHandleModalClose).toHaveBeenCalledTimes(1);
});

it("VisualizationSelector search", async () => {
  const mockHandleModalClose = jest.fn();
  const mockSetSelectVizTypeOption = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <VisualizationSelector
          showModal={true}
          handleModalClose={mockHandleModalClose}
          setSelectVizTypeOption={mockSetSelectVizTypeOption}
        />
      ),
      options: {},
    })
  );

  expect(
    await screen.findByText("Available Visualizations")
  ).toBeInTheDocument();
  expect(
    (await screen.findByLabelText("Visualization Search Input")).placeholder
  ).toBe("Search by Name or Tags");

  const defaultSectionTitle = screen.getByText("Default");
  expect(defaultSectionTitle).toBeInTheDocument();

  await userEvent.click(defaultSectionTitle);

  expect(await screen.findByText("Text")).toBeInTheDocument();
  expect(screen.getByText("Map")).toBeInTheDocument();
  expect(screen.getByText("Visualization Group")).toBeInTheDocument();
  expect(screen.getByText("Visualization Group 2")).toBeInTheDocument();

  const searchInput = screen.getByRole("textbox");
  fireEvent.change(searchInput, { target: { value: "Tex" } });

  expect(await screen.findByText("Default")).toBeInTheDocument();
  expect(await screen.findByText("Text")).toBeInTheDocument();
  expect(screen.queryByText("Map")).not.toBeInTheDocument();
  expect(screen.queryByText("Visualization Group")).not.toBeInTheDocument();
  expect(screen.queryByText("Visualization Group 2")).not.toBeInTheDocument();
});
