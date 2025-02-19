import { render, screen, fireEvent } from "@testing-library/react";
import DraggableList from "components/inputs/DraggableList";

const draggableItems = [
  <p key={1} data-testid={"item-1"}>
    Item 1
  </p>,
  <p key={2} data-testid={"item-2"}>
    Item 2
  </p>,
  <p key={3} data-testid={"item-3"}>
    Item 3
  </p>,
];

it("DraggableList with components", async () => {
  const onOrderUpdate = jest.fn();
  render(
    <DraggableList items={draggableItems} onOrderUpdate={onOrderUpdate} />
  );

  const item1 = screen.getByTestId("item-1");
  const item2 = screen.getByTestId("item-2");

  // Simulate dragging Item 1
  fireEvent.dragStart(item1, {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });

  // Simulate dragging over Item 2
  fireEvent.dragOver(item2);

  // Simulate dropping Item 1 onto Item 2
  fireEvent.drop(item2);

  const updatedItems = screen
    .queryAllByTestId(/^item-/)
    .map((el) => el.textContent);

  // The order should now be: ["Item 2", "Item 1", "Item 3"]
  expect(updatedItems).toEqual(["Item 2", "Item 1", "Item 3"]);
  expect(onOrderUpdate).toHaveBeenCalledWith([
    <p key={2} data-testid={"item-2"}>
      Item 2
    </p>,
    <p key={1} data-testid={"item-1"}>
      Item 1
    </p>,
    <p key={3} data-testid={"item-3"}>
      Item 3
    </p>,
  ]);
});

it("DraggableList with components, drag to self", async () => {
  const onOrderUpdate = jest.fn();
  render(
    <DraggableList items={draggableItems} onOrderUpdate={onOrderUpdate} />
  );

  const item1 = screen.getByTestId("item-1");

  // Simulate dragging Item 1
  fireEvent.dragStart(item1, {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });

  // Simulate dragging over Item 1
  fireEvent.dragOver(item1);

  // Simulate dropping Item 1 onto Item 1
  fireEvent.drop(item1);

  const updatedItems = screen
    .queryAllByTestId(/^item-/)
    .map((el) => el.textContent);

  expect(updatedItems).toEqual(["Item 1", "Item 2", "Item 3"]);
  expect(onOrderUpdate).toHaveBeenCalledTimes(0);
});

it("DraggableList with components and no onOrderUpdate", async () => {
  render(<DraggableList items={draggableItems} />);

  const item1 = screen.getByTestId("item-1");
  const item2 = screen.getByTestId("item-2");

  // Simulate dragging Item 1
  fireEvent.dragStart(item1, {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });

  // Simulate dragging over Item 2
  fireEvent.dragOver(item2);

  // Simulate dropping Item 1 onto Item 2
  fireEvent.drop(item2);

  const updatedItems = screen
    .queryAllByTestId(/^item-/)
    .map((el) => el.textContent);

  // The order should now be: ["Item 2", "Item 1", "Item 3"]
  expect(updatedItems).toEqual(["Item 2", "Item 1", "Item 3"]);
});

it("DraggableList with ItemTemplate", async () => {
  // eslint-disable-next-line
  const ItemTemplate = ({ value, draggingProps }) => {
    // eslint-disable-next-line
    const { textValue, testID } = value;
    return (
      <p data-testid={testID} {...draggingProps}>
        {textValue}
      </p>
    );
  };

  const items = [
    { textValue: "Item 1", testID: "item-1" },
    { textValue: "Item 2", testID: "item-2" },
    { textValue: "Item 3", testID: "item-3" },
  ];
  render(<DraggableList items={items} ItemTemplate={ItemTemplate} />);

  const item1 = screen.getByTestId("item-1");
  const item2 = screen.getByTestId("item-2");

  // Simulate dragging Item 1
  fireEvent.dragStart(item1, {
    dataTransfer: {
      items: [{ type: "text/plain" }],
    },
  });

  // Simulate dragging over Item 2
  fireEvent.dragOver(item2);

  // Simulate dropping Item 1 onto Item 2
  fireEvent.drop(item2);

  const updatedItems = screen
    .queryAllByTestId(/^item-/)
    .map((el) => el.textContent);

  // The order should now be: ["Item 2", "Item 1", "Item 3"]
  expect(updatedItems).toEqual(["Item 2", "Item 1", "Item 3"]);
});
