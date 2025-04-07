import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CustomMessaging from "components/modals/DataViewer/CustomMessaging";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({
  vizInputsValues = {},
  initialCustomMessaging = {},
}) => {
  const [customMessaging, setCustomMessaging] = useState(
    initialCustomMessaging
  );

  return (
    <>
      <CustomMessaging
        vizInputsValues={vizInputsValues}
        customMessaging={customMessaging}
        setCustomMessaging={setCustomMessaging}
      />
      <p data-testid="customMessaging">{JSON.stringify(customMessaging)}</p>
    </>
  );
};

it("CustomMessaging", async () => {
  render(<TestingComponent />);

  expect(screen.getByText("Custom Messaging")).toBeInTheDocument();
  expect(screen.getByText("Error -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("error Custom Message Input")
  ).toBeInTheDocument();
  expect(screen.getAllByRole("textbox").length).toBe(1);
});

it("CustomMessaging with no dependent variable inputs", async () => {
  render(
    <TestingComponent
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
    />
  );

  expect(screen.getByText("Custom Messaging")).toBeInTheDocument();
  expect(screen.getByText("Error -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("error Custom Message Input")
  ).toBeInTheDocument();
  expect(screen.getAllByRole("textbox").length).toBe(1);
});

it("CustomMessaging with dependent variable inputs", async () => {
  render(
    <TestingComponent
      vizInputsValues={{
        // eslint-disable-next-line
        text: "${Location} ${Time}",
        include_rain_melt_plot: {
          label: "Checkbox",
          // eslint-disable-next-line
          value: "${Checkbox}",
        },
      }}
    />
  );

  expect(screen.getByText("Custom Messaging")).toBeInTheDocument();
  expect(screen.getByText("Error -")).toBeInTheDocument();
  const errorMessageInput = screen.getByLabelText("error Custom Message Input");
  expect(errorMessageInput).toBeInTheDocument();
  expect(screen.getByText("Empty Location Variable -")).toBeInTheDocument();
  const locationMessageInput = screen.getByLabelText(
    "Location Custom Message Input"
  );
  expect(locationMessageInput).toBeInTheDocument();
  expect(screen.getByText("Empty Time Variable -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Time Custom Message Input")
  ).toBeInTheDocument();
  expect(screen.getByText("Empty Checkbox Variable -")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Checkbox Custom Message Input")
  ).toBeInTheDocument();
  expect(screen.getAllByRole("textbox").length).toBe(4);

  expect(await screen.findByTestId("customMessaging")).toHaveTextContent(
    JSON.stringify({})
  );

  fireEvent.change(errorMessageInput, {
    target: { value: "a custom message" },
  });

  expect(await screen.findByTestId("customMessaging")).toHaveTextContent(
    JSON.stringify({ error: "a custom message" })
  );

  fireEvent.change(locationMessageInput, {
    target: { value: "a custom location message" },
  });

  expect(await screen.findByTestId("customMessaging")).toHaveTextContent(
    JSON.stringify({
      error: "a custom message",
      Location: "a custom location message",
    })
  );
});

TestingComponent.propTypes = {
  vizInputsValues: PropTypes.object,
  initialCustomMessaging: PropTypes.object,
};
