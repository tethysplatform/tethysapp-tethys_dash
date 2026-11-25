import { render, screen, fireEvent } from "@testing-library/react";
import CustomMessaging from "components/modals/DataViewer/CustomMessaging";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({
  vizInputsValues = {},
  optionalArgs,
  initialCustomMessaging = {},
  onChange,
}) => {
  return (
    <CustomMessaging
      vizInputsValues={vizInputsValues}
      optionalArgs={optionalArgs}
      initialCustomMessaging={initialCustomMessaging}
      onChange={onChange}
    />
  );
};

it("CustomMessaging", async () => {
  render(<TestingComponent onChange={jest.fn()} />);

  expect(screen.getByText("Custom Messaging")).toBeInTheDocument();
  expect(screen.getByText("On Error -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("error Custom Message Input"),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("textbox").length).toBe(1);
});

it("CustomMessaging with no dependent variable inputs", async () => {
  render(
    <TestingComponent
      onChange={jest.fn()}
      vizInputsValues={[
        {
          label: "Text",
          name: "text",
          type: "text",
          value: "Location",
        },
        {
          label: "Include Rain Melt Plot",
          name: "include_rain_melt_plot",
          type: [
            {
              label: "True",
              value: true,
            },
            {
              label: "False",
              value: false,
            },
          ],
          value: {
            label: "False",
            value: false,
          },
        },
      ]}
    />,
  );

  expect(screen.getByText("Custom Messaging")).toBeInTheDocument();
  expect(screen.getByText("On Error -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("error Custom Message Input"),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("textbox").length).toBe(1);
});

it("CustomMessaging with dependent variable inputs", async () => {
  const mockOnChange = jest.fn();
  render(
    <TestingComponent
      onChange={mockOnChange}
      vizInputsValues={{
        // eslint-disable-next-line
        text: "${Location} ${Time}",
        include_rain_melt_plot: {
          label: "Checkbox",
          // eslint-disable-next-line
          value: "${Checkbox}",
        },
      }}
    />,
  );

  expect(screen.getByText("Custom Messaging")).toBeInTheDocument();
  expect(screen.getByText("On Error -")).toBeInTheDocument();
  const errorMessageInput = screen.getByLabelText("error Custom Message Input");
  expect(errorMessageInput).toBeInTheDocument();
  expect(screen.getByText("On Any Empty Variable -")).toBeInTheDocument();
  const anyEmptyVariableMessageInput = screen.getByLabelText(
    "anyEmptyVariable Custom Message Input",
  );
  expect(anyEmptyVariableMessageInput).toBeInTheDocument();
  expect(screen.getByText("On Empty Location Variable -")).toBeInTheDocument();
  const locationMessageInput = screen.getByLabelText(
    "Location Custom Message Input",
  );
  expect(locationMessageInput).toBeInTheDocument();
  expect(screen.getByText("On Empty Time Variable -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Time Custom Message Input"),
  ).toBeInTheDocument();
  expect(screen.getByText("On Empty Checkbox Variable -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Checkbox Custom Message Input"),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("textbox").length).toBe(5);

  fireEvent.change(errorMessageInput, {
    target: { value: "a custom message" },
  });

  expect(mockOnChange).toHaveBeenCalledWith({ error: "a custom message" });

  fireEvent.change(locationMessageInput, {
    target: { value: "a custom location message" },
  });

  expect(mockOnChange).toHaveBeenCalledWith({
    error: "a custom message",
    Location: "a custom location message",
  });

  fireEvent.change(anyEmptyVariableMessageInput, {
    target: { value: "a general variable message" },
  });

  expect(mockOnChange).toHaveBeenCalledWith({
    error: "a custom message",
    Location: "a custom location message",
    anyEmptyVariable: "a general variable message",
  });
});

/* eslint-disable no-template-curly-in-string */
describe("which variables get a message", () => {
  const listed = () =>
    screen
      .queryAllByText(/^On Empty .* Variable -$/)
      .map((label) => label.textContent);

  it("leaves out a variable used only as an optional arg, and offers no On Any Empty Variable for it", () => {
    render(
      <TestingComponent
        onChange={jest.fn()}
        optionalArgs={["area"]}
        vizInputsValues={{ area: "${Area}" }}
      />,
    );

    expect(listed()).toEqual([]);
    expect(
      screen.queryByText("On Any Empty Variable -"),
    ).not.toBeInTheDocument();
  });

  it("lists a variable that is also used in a required arg", () => {
    render(
      <TestingComponent
        onChange={jest.fn()}
        optionalArgs={["area"]}
        vizInputsValues={{ area: "${Area}", title: "Stations in ${Area}" }}
      />,
    );

    expect(listed()).toEqual(["On Empty Area Variable -"]);
  });

  it("reads a selected option by its value, as the save does", () => {
    render(
      <TestingComponent
        onChange={jest.fn()}
        optionalArgs={["area"]}
        vizInputsValues={{
          area: { label: "Area", value: "${Area}" },
          network: "${Network}",
        }}
      />,
    );

    expect(listed()).toEqual(["On Empty Network Variable -"]);
  });

  it("leaves out feature, popup-only and label-template variables, whose messages never show", () => {
    render(
      <TestingComponent
        onChange={jest.fn()}
        vizInputsValues={{
          station: "${feature.id}",
          layers: [
            {
              configuration: { labels: { template: "${Label Field}" } },
              popupConfig: { title: "${Popup Only}" },
            },
          ],
          network: "${Network}",
        }}
      />,
    );

    expect(listed()).toEqual(["On Empty Network Variable -"]);
  });

  it("keeps a saved message for a variable it no longer lists", () => {
    const onChange = jest.fn();
    render(
      <TestingComponent
        onChange={onChange}
        optionalArgs={["area"]}
        vizInputsValues={{ area: "${Area}" }}
        initialCustomMessaging={{ Area: "Draw an area" }}
      />,
    );

    fireEvent.change(screen.getByLabelText("error Custom Message Input"), {
      target: { value: "Could not load" },
    });

    expect(onChange).toHaveBeenLastCalledWith({
      Area: "Draw an area",
      error: "Could not load",
    });
  });
});
/* eslint-enable no-template-curly-in-string */

TestingComponent.propTypes = {
  vizInputsValues: PropTypes.object,
  optionalArgs: PropTypes.arrayOf(PropTypes.string),
  initialCustomMessaging: PropTypes.object,
  onChange: PropTypes.func,
};
