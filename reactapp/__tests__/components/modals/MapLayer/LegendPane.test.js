import { useState, useEffect, act, useRef } from "react";
import {
  render,
  screen,
  within,
  waitFor,
  findAllByAltText,
  fireEvent,
} from "@testing-library/react";
import LegendPane from "components/modals/MapLayer/LegendPane";
import Target from "ol/events/Target";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = ({ initialLegend }) => {
  const [legend, setLegend] = useState(initialLegend);
  const containerRef = useRef();

  return (
    <div ref={containerRef}>
      <LegendPane
        legend={legend}
        setLegend={setLegend}
        containerRef={containerRef}
      />
      <p data-testid="legend">{JSON.stringify(legend)}</p>
    </div>
  );
};

test("LegendPane no initial legend, add new row and delete", async () => {
  render(<TestingComponent />);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();

  const offRadio = screen.getByLabelText("Don't show legend for layer");
  const onRadio = screen.getByLabelText("Show legend for layer");

  expect(offRadio.checked).toBe(true);
  expect(onRadio.checked).toBe(false);
  expect(await screen.findByTestId("legend")).toHaveTextContent("");

  fireEvent.click(onRadio);
  expect(await screen.findByTestId("legend")).toHaveTextContent("{}");

  const addRowButton = await screen.findByLabelText("Add Legend Item Button");
  fireEvent.click(addRowButton);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "",
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    })
  );

  const [titleInput, labelInput] = screen.getAllByRole("textbox");
  fireEvent.change(titleInput, { target: { value: "Some Title" } });
  expect(titleInput.value).toBe("Some Title");
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "", color: "#ff0000", symbol: "square" }],
    })
  );

  fireEvent.change(labelInput, { target: { value: "Some Label" } });
  expect(labelInput.value).toBe("Some Label");
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "Some Label", color: "#ff0000", symbol: "square" }],
    })
  );

  const symbolButton = screen.getAllByRole("cell")[1].querySelector("svg");
  fireEvent.click(symbolButton);
  const symbolTooltip = await screen.findByRole("tooltip");
  expect(symbolTooltip).toBeInTheDocument();
  expect(within(symbolTooltip).getByText("Symbol")).toBeInTheDocument();
  expect(within(symbolTooltip).getByText("Color")).toBeInTheDocument();

  const newSymbol = symbolTooltip.querySelectorAll(".col")[1];
  fireEvent.click(newSymbol);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "Some Label", color: "#ff0000", symbol: "circle" }],
    })
  );

  const newColor = symbolTooltip.querySelectorAll(".rcp-field-input")[0];
  await act(async () => {
    fireEvent.change(newColor, { target: { value: "#2aff00" } });
  });
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [{ label: "Some Label", color: "#2aff00", symbol: "circle" }],
    })
  );

  const deleteButton = screen.getAllByRole("cell")[2].querySelector("svg");
  fireEvent.mouseOver(deleteButton);
  expect(deleteButton).toHaveStyle("cursor: pointer");
  fireEvent.mouseOut(deleteButton);
  expect(deleteButton).toHaveStyle("cursor: default");
  fireEvent.click(deleteButton);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify({
      title: "Some Title",
      items: [],
    })
  );

  fireEvent.click(offRadio);
  expect(await screen.findByTestId("legend")).toHaveTextContent("{}");
});

test("LegendPane initial legend", async () => {
  const initialLegend = {
    title: "Some Title",
    items: [
      { color: "yellow", labal: "Some Label", symbol: "square" },
      { color: "green", labal: "Another Label", symbol: "square" },
    ],
  };
  render(<TestingComponent initialLegend={initialLegend} />);

  expect(await screen.findByText("Legend Control")).toBeInTheDocument();

  const offRadio = screen.getByLabelText("Don't show legend for layer");
  const onRadio = screen.getByLabelText("Show legend for layer");

  expect(offRadio.checked).toBe(false);
  expect(onRadio.checked).toBe(true);
  expect(await screen.findByTestId("legend")).toHaveTextContent(
    JSON.stringify(initialLegend)
  );

  const textboxes = screen.getAllByRole("textbox");
  expect(textboxes[0].value).toBe("Some Title");
  waitFor(() => {
    expect(textboxes[1].value).toBe("Some Label");
  });
  waitFor(() => {
    expect(textboxes[2].value).toBe("Another Label");
  });

  const [row1SymbolCell, row2SymbolCell] = screen.getAllByRole("cell");

  waitFor(() => {
    expect(row1SymbolCell.querySelector("svg").getAttribute("color")).toBe(
      "yellow"
    );
  });
  waitFor(() => {
    expect(row2SymbolCell.querySelector("svg").getAttribute("color")).toBe(
      "green"
    );
  });

  // Simulate dragging row 1 to row 2
  fireEvent.dragStart(textboxes[0], {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });
  fireEvent.dragOver(textboxes[1]);
  fireEvent.drop(textboxes[1]);

  waitFor(() => {
    expect(textboxes[1].value).toBe("Another Label");
  });
  waitFor(() => {
    expect(textboxes[2].value).toBe("Some Label");
  });

  waitFor(() => {
    expect(row1SymbolCell.querySelector("svg").getAttribute("color")).toBe(
      "green"
    );
  });
  waitFor(() => {
    expect(row2SymbolCell.querySelector("svg").getAttribute("color")).toBe(
      "yellow"
    );
  });
});
