import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TextEditor from "components/inputs/TextEditor";

function getBoundingClientRect() {
  const rec = {
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
  };
  return { ...rec, toJSON: () => rec };
}

class FakeDOMRectList extends Array {
  item(index) {
    return this[index] || null;
  }
}

beforeEach(() => {
  document.elementFromPoint = () => null;

  HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
  HTMLElement.prototype.getClientRects = () => new FakeDOMRectList();

  Range.prototype.getBoundingClientRect = getBoundingClientRect;
  Range.prototype.getClientRects = () => new FakeDOMRectList();
});

describe("TextEditor", () => {
  const initialValue = "<p>Hello world</p>";
  let onChangeMock;

  beforeEach(() => {
    onChangeMock = jest.fn();
  });

  test("renders without crashing", () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);
    expect(screen.getByLabelText("textEditor")).toBeInTheDocument();
  });

  test("bold and then undo", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const boldButton = screen.getByRole("button", { name: "Bold Menu Button" });
    fireEvent.click(boldButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      "<p>Hello world<strong>h</strong></p>"
    );

    const undoButton = screen.getByRole("button", { name: "Undo Menu Button" });
    fireEvent.click(undoButton);

    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world</p>");
  });

  test("renders font select dropdown", () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);
    const fontSelect = screen.getByRole("combobox", { name: "Font Select" });
    expect(fontSelect).toBeInTheDocument();
  });

  test("can select a heading style", () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);
    const styleSelect = screen.getByDisplayValue("Normal Text");

    fireEvent.change(styleSelect, { target: { value: 1 } });
    expect(onChangeMock).toHaveBeenCalled();
  });
});
