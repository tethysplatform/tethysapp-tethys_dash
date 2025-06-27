import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import selectEvent from "react-select-event";
import DataInput from "components/inputs/DataInput";
import createLoadedComponent from "__tests__/utilities/customRender";
import {
  mockedTextVariable,
  mockedDashboards,
  layerConfigImageArcGISRest,
} from "__tests__/utilities/constants";

describe("DataInput Component", () => {
  const mockOnChange = jest.fn();

  test("renders DataSelect dropdown and handles selection", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    render(
      createLoadedComponent({
        children: (
          <DataInput
            label={"Test Dropdown"}
            type={options}
            value={""}
            onChange={mockOnChange}
          />
        ),
      })
    );

    const dropdown = await screen.findByLabelText("Test Dropdown Input");

    // Verify dropdown rendering
    expect(dropdown).toBeInTheDocument();

    // Use react-select-event to select an option
    await selectEvent.select(dropdown, "Option 1");

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith({
      label: "Option 1",
      value: "option1",
    });
  });

  test("renders DataSelect dropdown in dataviewer mode and no variable inputs as options", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];

    render(
      createLoadedComponent({
        children: (
          <DataInput
            label={"Test Dropdown"}
            type={options}
            value={""}
            onChange={mockOnChange}
          />
        ),
        options: {
          inDataViewerMode: true,
        },
      })
    );

    const dropdown = await screen.findByLabelText("Test Dropdown Input");

    // Open the dropdown
    await selectEvent.openMenu(dropdown);

    // Check if the options are rendered
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    expect(screen.queryByText("Variable Inputs")).not.toBeInTheDocument();
    expect(screen.queryByText("Test Variable")).not.toBeInTheDocument();
  });

  test("renders DataSelect dropdown in dataviewer mode and has variable inputs as options", async () => {
    const options = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];
    const dashboards = JSON.parse(JSON.stringify(mockedDashboards));
    dashboards.user[0].gridItems = [mockedTextVariable];

    render(
      createLoadedComponent({
        children: (
          <DataInput
            label={"Test Dropdown"}
            type={options}
            value={""}
            onChange={mockOnChange}
          />
        ),
        options: {
          dashboards: dashboards,
          inDataViewerMode: true,
          initialDashboard: dashboards.user[0],
        },
      })
    );

    const dropdown = await screen.findByLabelText("Test Dropdown Input");

    // Open the dropdown
    await selectEvent.openMenu(dropdown);

    // Check if the options are rendered
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Variable Inputs")).toBeInTheDocument();
    });
    expect(screen.getByText("Test Variable")).toBeInTheDocument();
  });

  test("renders checkbox and handles change", async () => {
    render(
      createLoadedComponent({
        children: (
          <DataInput
            label={"Test Checkbox"}
            type={"checkbox"}
            value={true}
            onChange={mockOnChange}
          />
        ),
      })
    );

    const checkbox = await screen.findByLabelText("Test Checkbox Input");

    // Verify checkbox rendering
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toBeChecked();

    // Simulate a change
    fireEvent.click(checkbox);

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith(false);
  });

  test("renders radio buttons and handles selection", async () => {
    const valueOptions = [
      { label: "Option 1", value: "option1" },
      { label: "Option 2", value: "option2" },
    ];
    render(
      createLoadedComponent({
        children: (
          <DataInput
            label={"Test Radio"}
            type={"radio"}
            value={"option1"}
            valueOptions={valueOptions}
            onChange={mockOnChange}
          />
        ),
      })
    );

    const option1 = await screen.findByLabelText("Option 1");
    const option2 = screen.getByLabelText("Option 2");

    // Verify radio buttons rendering
    expect(option1).toBeChecked();
    expect(option2).not.toBeChecked();

    // Simulate selecting another option
    fireEvent.click(option2);

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith("option2");
  });

  test("renders text input and handles typing. make sure enter does not submit form", async () => {
    const user = userEvent.setup();
    const mockHandleSubmit = jest.fn();

    render(
      createLoadedComponent({
        children: (
          <form onSubmit={mockHandleSubmit}>
            <DataInput
              label={"Test Text"}
              type={"text"}
              value={"initial"}
              onChange={mockOnChange}
            />
          </form>
        ),
      })
    );

    const textInput = await screen.findByLabelText("Test Text Input");

    // Verify text input rendering
    expect(textInput).toBeInTheDocument();
    expect(textInput).toHaveValue("initial");
    await user.type(textInput, "M");

    // Ensure onChange is triggered with the correct value
    expect(mockOnChange).toHaveBeenCalledWith("initialM");

    // Ensure Enter does not submit a form
    await userEvent.keyboard("{Enter}");
    expect(mockHandleSubmit).toHaveBeenCalledTimes(0);
  });
});

test("renders multiinput", async () => {
  const mockOnChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DataInput
          label={"Test Multi Input"}
          type={"multiinput"}
          value={[]}
          onChange={mockOnChange}
        />
      ),
    })
  );

  expect(await screen.findByText("Test Multi Input")).toBeInTheDocument();

  const textbox = screen.getByRole("textbox");
  await userEvent.type(textbox, "Some Input Value{enter}");

  expect(mockOnChange).toHaveBeenCalledWith(["Some Input Value"]);
});

test("renders inputtable", async () => {
  const mockOnChange = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DataInput
          label={"Test Input Table"}
          type={"inputtable"}
          value={[{ "field 1": true, "field 2": "" }]}
          onChange={mockOnChange}
        />
      ),
    })
  );

  expect(await screen.findByText("Test Input Table")).toBeInTheDocument();

  const checkbox = await screen.findByRole("checkbox");
  expect(checkbox).toBeInTheDocument();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();

  expect(mockOnChange).toHaveBeenCalledWith({
    field: "field 1",
    newValue: false,
    rowIndex: 0,
  });

  const textbox = screen.getByRole("textbox");
  fireEvent.change(textbox, { target: { value: "Some Input Value" } });

  expect(mockOnChange).toHaveBeenCalledWith({
    field: "field 2",
    newValue: "Some Input Value",
    rowIndex: 0,
  });
});

test("renders custom-AddMapLayer", async () => {
  const mockOnChange = jest.fn();
  const setShowingSubModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DataInput
          label={"Test Add Map Layer"}
          type={"custom-AddMapLayer"}
          value={[layerConfigImageArcGISRest]}
          onChange={mockOnChange}
          inputProps={{ setShowingSubModal }}
        />
      ),
    })
  );

  expect(await screen.findByText("Test Add Map Layer")).toBeInTheDocument();

  expect(screen.getByText("Add Layer")).toBeInTheDocument();
  expect(screen.getByText("Layer Name")).toBeInTheDocument();
  expect(screen.getByText("Legend")).toBeInTheDocument();

  expect(screen.getAllByRole("row").length).toBe(2);
  expect(screen.getByText("ImageArcGISRest Layer")).toBeInTheDocument();
  expect(screen.getByText("Off")).toBeInTheDocument();

  const editMapLayerButton = screen.getByTestId("editMapLayer");
  fireEvent.click(editMapLayerButton);

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  const nameInput = await screen.findByLabelText("Name Input");
  fireEvent.change(nameInput, { target: { value: "New Layer Name" } });

  const createLayerButton = await screen.findByLabelText("Create Layer Button");
  fireEvent.click(createLayerButton);

  expect(mockOnChange).toHaveBeenCalledWith([
    {
      configuration: {
        props: {
          name: "New Layer Name",
          source: {
            props: {
              url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
            },
            type: "ESRI Image and Map Service",
          },
          zIndex: 1,
        },
        type: "ImageLayer",
      },
    },
  ]);
});
