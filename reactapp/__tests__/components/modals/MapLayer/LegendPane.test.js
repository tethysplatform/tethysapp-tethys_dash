import { useState, useRef, useEffect } from "react";
import PropTypes from "prop-types";
import {
  render,
  screen,
  within,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { sourcePropType } from "components/map/utilities";
import LegendPane from "components/modals/MapLayer/LegendPane";

global.ResizeObserver = require("resize-observer-polyfill");

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

const TestingComponent = ({ initialLegend, sourceProps }) => {
  const [legend, setLegend] = useState(initialLegend);
  const containerRef = useRef();

  useEffect(() => {
    setLegend(initialLegend);
  }, [initialLegend]);

  return (
    <div ref={containerRef}>
      <LegendPane
        legend={legend}
        setLegend={setLegend}
        sourceProps={sourceProps ?? {}}
        containerRef={containerRef}
      />
      <p data-testid="legend">{JSON.stringify(legend)}</p>
    </div>
  );
};

test("LegendPane no initial legend, add new row and delete", async () => {
  const { rerender } = render(<TestingComponent />);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();

  const offRadio = screen.getByLabelText("No Legend");
  const defaultRadio = screen.getByLabelText("Default Legend");
  const customRadio = screen.getByLabelText("Custom Legend");

  expect(offRadio.checked).toBe(true);
  expect(defaultRadio.checked).toBe(false);
  expect(customRadio.checked).toBe(false);
  expect(await screen.findByTestId("legend")).toHaveTextContent("");

  fireEvent.click(customRadio);
  expect(screen.getByTestId("legend").textContent?.trim()).toBe(
    JSON.stringify({
      title: "",
      items: [],
    }),
  );

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "",
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    }),
  );

  const [titleInput, labelInput] = screen.getAllByRole("textbox");
  fireEvent.change(titleInput, { target: { value: "Some Title" } });
  expect(titleInput.value).toBe("Some Title");
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    }),
  );

  fireEvent.change(labelInput, { target: { value: "Some Label" } });
  expect(labelInput.value).toBe("Some Label");
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "Some Label", color: "#ff0000", symbol: "square" }],
    }),
  );

  fireEvent.click(addRowButton);
  await waitFor(async () => {
    expect(await screen.findByTestId("legend")).toHaveTextContent(
      JSON.stringify({
        title: "Some Title",
        items: [
          { label: "Some Label", color: "#ff0000", symbol: "square" },
          { label: "", color: "#ff0000", symbol: "square" },
        ],
      }),
    );
  });

  const textboxes = screen.getAllByRole("textbox");
  const newLabelInput = textboxes[2];
  fireEvent.change(newLabelInput, { target: { value: "Another Label" } });
  await waitFor(async () => {
    expect(await screen.findByTestId("legend")).toHaveTextContent(
      JSON.stringify({
        title: "Some Title",
        items: [
          { label: "Some Label", color: "#ff0000", symbol: "square" },
          { label: "Another Label", color: "#ff0000", symbol: "square" },
        ],
      }),
    );
  });

  // eslint-disable-next-line
  const symbolButton = screen.getAllByRole("cell")[1].querySelector("svg");
  fireEvent.click(symbolButton);
  const symbolTooltip = await screen.findByRole("tooltip");
  expect(symbolTooltip).toBeInTheDocument();
  expect(within(symbolTooltip).getByText("Symbol")).toBeInTheDocument();
  expect(within(symbolTooltip).getByText("Color")).toBeInTheDocument();

  // eslint-disable-next-line
  const newSymbol = symbolTooltip.querySelectorAll(".col-auto")[1];
  fireEvent.click(newSymbol);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [
        { label: "Some Label", color: "#ff0000", symbol: "circle" },
        { label: "Another Label", color: "#ff0000", symbol: "square" },
      ],
    }),
  );

  // eslint-disable-next-line
  const newColor = symbolTooltip.querySelectorAll(".rcp-field-input")[0];
  fireEvent.change(newColor, { target: { value: "#2aff00" } });
  await waitFor(async () => {
    expect(await screen.findByTestId("legend")).toHaveTextContent(
      JSON.stringify({
        title: "Some Title",
        items: [
          { label: "Some Label", color: "#2aff00", symbol: "circle" },
          { label: "Another Label", color: "#ff0000", symbol: "square" },
        ],
      }),
    );
  });

  // eslint-disable-next-line
  const deleteButton = screen.getAllByRole("cell")[2].querySelector("svg");
  fireEvent.mouseOver(deleteButton);
  expect(deleteButton).toHaveStyle("cursor: pointer");
  fireEvent.mouseOut(deleteButton);
  expect(deleteButton).toHaveStyle("cursor: default");
  fireEvent.click(deleteButton);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "Another Label", color: "#ff0000", symbol: "square" }],
    }),
  );

  fireEvent.click(offRadio);
  expect(await screen.findByTestId("legend")).toHaveTextContent("{}");

  rerender(<TestingComponent initialLegend={{ title: "some title" }} />);

  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({ title: "some title" }),
  );

  rerender(
    <TestingComponent
      initialLegend={{
        items: [{ color: "yellow", label: "Some Label", symbol: "square" }],
      }}
    />,
  );

  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      items: [{ color: "yellow", label: "Some Label", symbol: "square" }],
    }),
  );
});

test("LegendPane initial legend", async () => {
  const initialLegend = {
    title: "Some Title",
    items: [
      { color: "yellow", label: "Some Label", symbol: "square" },
      { color: "green", label: "Another Label", symbol: "square" },
    ],
  };
  render(<TestingComponent initialLegend={initialLegend} />);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();

  const offRadio = screen.getByLabelText("No Legend");
  const onRadio = screen.getByLabelText("Custom Legend");

  expect(offRadio.checked).toBe(false);
  expect(onRadio.checked).toBe(true);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify(initialLegend),
  );

  const textboxes = screen.getAllByRole("textbox");
  expect(textboxes[0].value).toBe("Some Title");
  await waitFor(() => {
    expect(textboxes[1].value).toBe("Some Label");
  });
  await waitFor(() => {
    expect(textboxes[2].value).toBe("Another Label");
  });

  const tabelCells = screen.getAllByRole("cell");
  expect(
    within(tabelCells[1]).getByLabelText("yellow-square"),
  ).toBeInTheDocument();
  expect(
    within(tabelCells[4]).getByLabelText("green-square"),
  ).toBeInTheDocument();

  // Simulate dragging row 1 to row 2
  fireEvent.dragStart(tabelCells[0], {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });
  fireEvent.dragOver(tabelCells[3]);
  fireEvent.drop(tabelCells[3]);

  await waitFor(() => {
    expect(textboxes[1].value).toBe("Another Label");
  });
  await waitFor(() => {
    expect(textboxes[2].value).toBe("Some Label");
  });
  expect(
    within(tabelCells[1]).getByLabelText("green-square"),
  ).toBeInTheDocument();
  expect(
    within(tabelCells[4]).getByLabelText("yellow-square"),
  ).toBeInTheDocument();
});

test("LegendPane updated sourceProps", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
  });

  const { rerender } = render(
    <TestingComponent sourceProps={{ type: "ESRI Image and Map Service" }} />,
  );

  expect(screen.getByLabelText("No Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Default Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Custom Legend")).toBeInTheDocument();
  const customRadio = screen.getByLabelText("Custom Legend");
  expect(customRadio).toBeInTheDocument();

  fireEvent.click(customRadio);
  expect(screen.getByTestId("legend").textContent?.trim()).toBe(
    JSON.stringify({
      title: "",
      items: [],
    }),
  );

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "",
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    }),
  );

  rerender(<TestingComponent sourceProps={{ type: "Image Tile" }} />);

  expect(screen.getByLabelText("No Legend")).toBeInTheDocument();
  expect(screen.queryByLabelText("Default Legend")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Custom Legend")).toBeInTheDocument();
  expect(await screen.findByTestId("legend")).toHaveTextContent("{}");

  rerender(
    <TestingComponent
      initialLegend={"default"}
      sourceProps={{ type: "ESRI Feature Service", props: { url: "some/url" } }}
    />,
  );

  expect(screen.getByLabelText("No Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Default Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Custom Legend")).toBeInTheDocument();
  expect(await screen.findByTestId("legend")).toHaveTextContent("default");

  rerender(
    <TestingComponent
      initialLegend={"default"}
      sourceProps={{
        type: "ESRI Image and Map Service",
        props: { url: "some/url" },
      }}
    />,
  );

  expect(screen.getByLabelText("No Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Default Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Custom Legend")).toBeInTheDocument();
  expect(await screen.findByTestId("legend")).toHaveTextContent("default");
});

test("LegendPane set to default", async () => {
  global.fetch.mockResolvedValue({
    ok: false,
  });

  render(
    <TestingComponent
      sourceProps={{
        type: "ESRI Image and Map Service",
        props: { url: "some/url" },
      }}
    />,
  );

  expect(screen.getByLabelText("No Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Default Legend")).toBeInTheDocument();
  expect(screen.getByLabelText("Custom Legend")).toBeInTheDocument();
  const defaultRadio = screen.getByLabelText("Default Legend");
  expect(defaultRadio).toBeInTheDocument();

  fireEvent.click(defaultRadio);

  expect(await screen.findByTestId("legend")).toHaveTextContent("default");
});

test("LegendPane title partial initial legend", async () => {
  render(<TestingComponent initialLegend={{ title: "" }} />);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();

  expect(screen.getByTestId("legend").textContent?.trim()).toBe(
    JSON.stringify({
      title: "",
    }),
  );

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);

  expect(screen.getByTestId("legend").textContent?.trim()).toBe(
    JSON.stringify({
      title: "",
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    }),
  );
});

test("LegendPane items partial initial legend", async () => {
  render(<TestingComponent initialLegend={{ items: [] }} />);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();

  expect(screen.getByTestId("legend").textContent?.trim()).toBe(
    JSON.stringify({
      items: [],
    }),
  );

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);

  expect(screen.getByTestId("legend").textContent?.trim()).toBe(
    JSON.stringify({
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    }),
  );
});

TestingComponent.propTypes = {
  initialLegend: PropTypes.object,
  sourceProps: sourcePropType,
};
