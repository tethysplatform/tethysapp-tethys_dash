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

it("Omits the header entirely when a plugin returns neither title nor description", async () => {
  // Both are optional in the `card` return shape. Rendering them unguarded left
  // an empty heading, an empty paragraph and Header's 1.5rem margin above the
  // stats for any plugin that returns only `data`.
  const { data } = mockedCardData;
  initAndRender({ data });

  // The stats render behind Suspense, so wait for them before concluding the
  // header is absent rather than merely not painted yet.
  expect(await screen.findByText("Total Sales")).toBeInTheDocument();
  expect(screen.getByText("1,500")).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  // Not merely empty: the wrapper itself must go, or its 1.5rem margin stays.
  expect(screen.queryByTestId("card-header")).not.toBeInTheDocument();
});

it("Renders only the title when no description is given", () => {
  initAndRender({ title: "Fake Title", data: [] });

  expect(
    screen.getByRole("heading", { name: "Fake Title" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("Fake Description")).not.toBeInTheDocument();
});

it("Renders only the description when no title is given", () => {
  // The case the inner title guard exists for: the header is rendered because a
  // description is present, so without the guard an empty <h3> comes with it.
  initAndRender({ description: "Fake Description", data: [] });

  expect(screen.getByText("Fake Description")).toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
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
