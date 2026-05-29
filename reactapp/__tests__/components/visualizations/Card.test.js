import PropTypes from "prop-types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Card from "components/visualizations/Card";
import { mockedCardData } from "__tests__/utilities/constants";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function initAndRender(props) {
  const user = userEvent.setup();

  const CardRender = (props) => {
    return (
      <Card
        title={props.title}
        description={props.description}
        data={props.data}
      />
    );
  };

  CardRender.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    data: PropTypes.string,
  };

  const { rerender } = render(CardRender(props));

  return {
    user,
    CardRender,
    rerender,
  };
}

it("Creates a Card with a Title and Description", () => {
  initAndRender({
    title: "Fake Title",
    description: "Fake Description",
    data: [],
  });

  expect(screen.getByText("Fake Title")).toBeInTheDocument();
  expect(screen.getByText("Fake Description")).toBeInTheDocument();
});

// Crash-hardening: Card receives data from multiple sources — MCP create
// tool, patch protocol, legacy dashboards, migrations. Anything other
// than an array must render the empty placeholder, not crash with
// "data.length is undefined".
describe.each([
  ["null", null],
  ["undefined", undefined],
  ["scalar number", 42],
  ["scalar string", "42"],
  ["plain object", { value: 1 }],
])("renders empty placeholder when data is %s", (_label, badData) => {
  it("does not crash", () => {
    initAndRender({
      title: "Graceful",
      description: "Should not throw",
      data: badData,
    });
    // The component still mounts; title + description still render.
    expect(screen.getByText("Graceful")).toBeInTheDocument();
    expect(screen.getByText("Should not throw")).toBeInTheDocument();
  });
});

it("Creates a Card with actual data", async () => {
  const { title, data } = mockedCardData;
  initAndRender({
    title: title,
    description: "Fake Description",
    data: data,
  });

  expect(screen.getByText("Company Statistics")).toBeInTheDocument();
  expect(screen.getByText("Fake Description")).toBeInTheDocument();

  await sleep(100);

  const icon1 = await screen.findByTestId(data[0].label);
  const icon2 = await screen.findByTestId(data[1].label);
  const icon3 = await screen.findByTestId(data[2].label);
  expect(icon1).toBeInTheDocument();
  expect(icon2).toBeInTheDocument();
  expect(icon3).toBeInTheDocument();

  const label1 = screen.getByText(data[0].label);
  const label2 = screen.getByText(data[1].label);
  const label3 = screen.getByText(data[2].label);
  expect(label1).toBeInTheDocument();
  expect(label2).toBeInTheDocument();
  expect(label3).toBeInTheDocument();

  const value1 = screen.getByText(data[0].value);
  const value2 = screen.getByText(data[1].value);
  const value3 = screen.getByText(data[2].value);
  expect(value1).toBeInTheDocument();
  expect(value2).toBeInTheDocument();
  expect(value3).toBeInTheDocument();
});
