import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

  test("bold and then undo and then redo and then erase", async () => {
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

    const redoButton = screen.getByRole("button", { name: "Redo Menu Button" });
    fireEvent.click(redoButton);

    expect(onChangeMock).toHaveBeenCalledWith(
      "<p>Hello world<strong>h</strong></p>"
    );

    const eraserButton = screen.getByRole("button", {
      name: "Eraser Menu Button",
    });
    fireEvent.click(eraserButton);

    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world</p>");
  });

  test("italics", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const italicButton = screen.getByRole("button", {
      name: "Italic Menu Button",
    });
    fireEvent.click(italicButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world<em>h</em></p>");
  });

  test("underline", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const underlineButton = screen.getByRole("button", {
      name: "Underline Menu Button",
    });
    fireEvent.click(underlineButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world<u>h</u></p>");
  });

  test("strikethrough", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const strikethroughButton = screen.getByRole("button", {
      name: "Strikethrough Menu Button",
    });
    fireEvent.click(strikethroughButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world<s>h</s></p>");
  });

  test("superscript", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const superscriptButton = screen.getByRole("button", {
      name: "Superscript Menu Button",
    });
    fireEvent.click(superscriptButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world<sup>h</sup></p>");
  });

  test("subscript", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const subscriptButton = screen.getByRole("button", {
      name: "Subscript Menu Button",
    });
    fireEvent.click(subscriptButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world<sub>h</sub></p>");
  });

  test("code", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const codeButton = screen.getByRole("button", {
      name: "Code Menu Button",
    });
    fireEvent.click(codeButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      "<p>Hello world<code>h</code></p>"
    );
  });

  test("highlight", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const highlightButton = screen.getByRole("button", {
      name: "highlight Menu Button",
    });
    fireEvent.click(highlightButton);

    const tooltip = screen.getByRole("tooltip");
    // eslint-disable-next-line
    const buttons = tooltip.querySelectorAll("button");

    let blueButton = null;

    buttons.forEach((button) => {
      // eslint-disable-next-line
      const colorDiv = button.querySelector("div");
      if (!colorDiv) return;

      const style = getComputedStyle(colorDiv);
      if (style.backgroundColor === "blue") {
        // This matches standard blue — change to match your specific shade if needed
        blueButton = button;
      }
    });

    expect(blueButton).not.toBeNull();
    fireEvent.click(blueButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      '<p>Hello world<mark data-color="blue" style="background-color: blue; color: inherit">h</mark></p>'
    );
  });

  test("color", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const colorButton = screen.getByRole("button", {
      name: "color Menu Button",
    });
    fireEvent.click(colorButton);

    const tooltip = screen.getByRole("tooltip");
    // eslint-disable-next-line
    const buttons = tooltip.querySelectorAll("button");

    let blueButton = null;

    buttons.forEach((button) => {
      // eslint-disable-next-line
      const colorDiv = button.querySelector("div");
      if (!colorDiv) return;

      const style = getComputedStyle(colorDiv);
      if (style.backgroundColor === "blue") {
        // This matches standard blue — change to match your specific shade if needed
        blueButton = button;
      }
    });

    expect(blueButton).not.toBeNull();
    fireEvent.click(blueButton);

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      '<p>Hello world<span style="color: blue">h</span></p>'
    );
  });

  test("Align Left", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const formatButton = screen.getByRole("button", {
      name: "Align Left Menu Button",
    });
    fireEvent.click(formatButton);

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      '<p style="text-align: left">Hello world</p>'
    );
  });

  test("Align Center", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const formatButton = screen.getByRole("button", {
      name: "Align Center Menu Button",
    });
    fireEvent.click(formatButton);

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      '<p style="text-align: center">Hello world</p>'
    );
  });

  test("Align Right", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const formatButton = screen.getByRole("button", {
      name: "Align Right Menu Button",
    });
    fireEvent.click(formatButton);

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      '<p style="text-align: right">Hello world</p>'
    );
  });

  test("List", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const formatButton = screen.getByRole("button", {
      name: "List Menu Button",
    });
    fireEvent.click(formatButton);

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith(
      "<ul><li><p>Hello world</p></li></ul>"
    );
  });

  test("List Order and indent", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const indentIncreaseButton = screen.getByRole("button", {
      name: "Indent Increase Menu Button",
    });
    const indentDecreaseButton = screen.getByRole("button", {
      name: "Indent Decrease Menu Button",
    });
    expect(indentIncreaseButton.disabled).toBe(true);
    expect(indentDecreaseButton.disabled).toBe(true);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const formatButton = screen.getByRole("button", {
      name: "List Order Menu Button",
    });
    fireEvent.click(formatButton);

    await userEvent.keyboard("{Enter}n");

    // Should have triggered the onChange callback
    await waitFor(() => {
      expect(onChangeMock).toHaveBeenCalledWith(
        "<ol><li><p>Hello world</p></li><li><p>n</p></li></ol>"
      );
    });

    expect(indentIncreaseButton.disabled).toBe(false);
    expect(indentDecreaseButton.disabled).toBe(false);

    fireEvent.click(indentIncreaseButton);

    expect(onChangeMock.mock.calls[3][0]).toBe(
      "<ol><li><p>Hello world</p><ol><li><p>n</p></li></ol></li></ol>"
    );

    const secondListItemPos = editorInstance.state.doc.content.size - 5; // Adjust offset as needed
    editorInstance.chain().focus().setTextSelection(secondListItemPos).run();
    expect(indentIncreaseButton.disabled).toBe(true);
    expect(indentDecreaseButton.disabled).toBe(false);

    fireEvent.click(indentDecreaseButton);

    expect(onChangeMock.mock.calls[4][0]).toBe(
      "<ol><li><p>Hello world</p></li><li><p>n</p></li></ol>"
    );
  });

  test("Horizontal Line", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const formatButton = screen.getByRole("button", {
      name: "Horizontal Line Menu Button",
    });
    fireEvent.click(formatButton);

    // Should have triggered the onChange callback
    expect(onChangeMock).toHaveBeenCalledWith("<p>Hello world</p><hr><p></p>");
  });

  test("renders font select dropdown", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const fontSelect = screen.getByRole("combobox", { name: "Font Select" });
    await userEvent.selectOptions(fontSelect, "Courier New");

    const editor = screen.getByLabelText("textEditor");
    await userEvent.type(editor, "h");

    expect(onChangeMock).toHaveBeenCalledWith(
      '<p>Hello world<span style="font-family: &quot;Courier New&quot;, monospace">h</span></p>'
    );
  });

  test("can select a heading style", async () => {
    render(<TextEditor textValue={initialValue} onChange={onChangeMock} />);

    const editorInstance = (await screen.findByLabelText("textEditor")).editor;

    // Ensure cursor is at the end of the content
    editorInstance
      .chain()
      .focus()
      .setTextSelection(editorInstance.state.doc.content.size - 1)
      .run();

    const styleSelect = screen.getByRole("combobox", { name: "Style Select" });
    await userEvent.selectOptions(styleSelect, "H1");

    expect(onChangeMock).toHaveBeenCalledWith("<h1>Hello world</h1>");

    await userEvent.selectOptions(styleSelect, "Normal Text");

    expect(onChangeMock.mock.calls[1][0]).toBe("<p>Hello world</p>");
  });
});
