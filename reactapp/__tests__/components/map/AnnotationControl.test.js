import { render, screen, fireEvent, within } from "@testing-library/react";
import AnnotationControl from "components/map/AnnotationControl";

// The editor is exercised in AnnotationEditor.test.js. Here it stands in with
// buttons for its three callbacks, so the hand-off can be driven directly.
const editorProps = { current: null };
jest.mock("components/map/AnnotationEditor", () => {
  /* eslint-disable react/prop-types -- a test stand-in, not a component. */
  const MockEditor = (props) => {
    editorProps.current = props;
    return (
      <div data-testid="annotation-editor">
        <button type="button" onClick={() => props.onChange(["changed"])}>
          report change
        </button>
        <button type="button" onClick={() => props.onDone(["final"])}>
          done
        </button>
        <button type="button" onClick={() => props.onCancel()}>
          cancel
        </button>
      </div>
    );
  };
  /* eslint-enable react/prop-types */
  return MockEditor;
});

global.ResizeObserver = require("resize-observer-polyfill");

const line = {
  id: "a1",
  kind: "line",
  coordinates: [
    [0, 0],
    [1, 1],
  ],
};

const floodNotes = () => ({
  name: "Flood notes",
  defaults: { lineColor: "#0000ff" },
  items: [line],
});
const siteVisits = () => ({ name: "Site visits", defaults: {}, items: [] });

let onGroupsChange;
let onSessionChange;

const renderControl = ({
  groups = [floodNotes(), siteVisits()],
  session,
} = {}) =>
  render(
    <AnnotationControl
      visualizationRef={{ current: null }}
      groups={groups}
      onGroupsChange={onGroupsChange}
      session={session ?? null}
      onSessionChange={onSessionChange}
    />,
  );

const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Show Annotation Control" }),
  );

const lastWrite = () => onGroupsChange.mock.calls.at(-1)[0];

beforeEach(() => {
  onGroupsChange = jest.fn();
  onSessionChange = jest.fn();
  editorProps.current = null;
});

describe("the button", () => {
  it("opens to the map's groups and closes again", () => {
    renderControl();
    expect(screen.queryByText("Flood notes")).toBeNull();

    open();
    const list = screen.getByRole("list", { name: "Annotation groups" });
    expect(within(list).getByText("Flood notes")).toBeInTheDocument();
    expect(within(list).getByText("Site visits")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close Annotation Control" }),
    );
    expect(screen.queryByText("Flood notes")).toBeNull();
  });

  it("explains how to start on a map with no groups", () => {
    renderControl({ groups: [] });
    open();
    expect(
      screen.getByText(/This map has no annotations yet/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Annotation groups" }),
    ).toBeNull();
  });
});

describe("managing groups", () => {
  it("adds a group under the first free name", () => {
    renderControl({
      groups: [{ name: "Annotations 1", defaults: {}, items: [] }],
    });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Add group" }));
    expect(lastWrite()).toEqual([
      { name: "Annotations 1", defaults: {}, items: [] },
      { name: "Annotations 2", defaults: {}, items: [] },
    ]);
  });

  it("renames a group, trimming the name", () => {
    renderControl();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Flood notes" }));
    const input = screen.getByLabelText("New name for Flood notes");
    expect(input).toHaveValue("Flood notes");
    fireEvent.change(input, { target: { value: "  Gauge notes " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(lastWrite()).toEqual([
      { ...floodNotes(), name: "Gauge notes" },
      siteVisits(),
    ]);
    expect(screen.queryByLabelText("New name for Flood notes")).toBeNull();
  });

  it("refuses an empty or taken name and says why", () => {
    renderControl();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Flood notes" }));
    const input = screen.getByLabelText("New name for Flood notes");

    fireEvent.change(input, { target: { value: "Site visits" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      'This map already has a group named "Site visits".',
    );
    // The field says it is invalid, and points at the reason.
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      screen.getByRole("alert").id,
    );

    fireEvent.change(input, { target: { value: "  " } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a name for the group.",
    );
    expect(onGroupsChange).not.toHaveBeenCalled();
  });

  it("writes nothing when a group keeps its name, or renaming is abandoned", () => {
    renderControl();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Rename Flood notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(onGroupsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Rename Flood notes" }));
    fireEvent.change(screen.getByLabelText("New name for Flood notes"), {
      target: { value: "Other" },
    });
    fireEvent.keyDown(screen.getByLabelText("New name for Flood notes"), {
      key: "Escape",
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename Flood notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel renaming" }));
    expect(onGroupsChange).not.toHaveBeenCalled();
  });

  it("deletes an empty group at once", () => {
    renderControl();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Site visits" }));
    expect(lastWrite()).toEqual([floodNotes()]);
  });

  it("asks before deleting a group with annotations, and can keep it", () => {
    renderControl();
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Flood notes" }));
    const confirm = screen.getByRole("alertdialog", {
      name: "Delete Flood notes?",
    });
    expect(confirm).toHaveTextContent(
      'Delete "Flood notes" and its 1 annotation?',
    );
    expect(
      within(confirm).getByRole("button", { name: "Delete" }),
    ).toHaveFocus();
    expect(onGroupsChange).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(onGroupsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete Flood notes" }));
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Delete",
      }),
    );
    expect(lastWrite()).toEqual([siteVisits()]);
  });

  it("counts several annotations in the plural", () => {
    renderControl({
      groups: [{ ...floodNotes(), items: [line, { ...line, id: "a2" }] }],
    });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete Flood notes" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "its 2 annotations?",
    );
  });
});

describe("default styles", () => {
  it("shows one group's defaults at a time", () => {
    renderControl();
    open();
    const toggle = screen.getByRole("button", {
      name: "Flood notes default styles",
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("group", { name: "Flood notes default style settings" }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    expect(
      screen.queryByRole("group", {
        name: "Flood notes default style settings",
      }),
    ).toBeNull();
    expect(
      screen.getByRole("group", { name: "Site visits default style settings" }),
    ).toBeInTheDocument();
  });

  it("writes a changed default into its group, and a reset removes it", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    const defaults = screen.getByRole("group", {
      name: "Site visits default style settings",
    });
    fireEvent.change(within(defaults).getByLabelText("Default Line Width"), {
      target: { value: "4" },
    });
    expect(lastWrite()).toEqual([
      floodNotes(),
      { ...siteVisits(), defaults: { lineWidth: 4 } },
    ]);

    fireEvent.change(within(defaults).getByLabelText("Default Line Width"), {
      target: { value: "" },
    });
    expect(lastWrite()).toEqual([floodNotes(), siteVisits()]);
  });

  it("keeps a renamed group's defaults open", () => {
    const { rerender } = renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Flood notes default styles" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Rename Flood notes" }));
    fireEvent.change(screen.getByLabelText("New name for Flood notes"), {
      target: { value: "Gauge notes" },
    });
    fireEvent.keyDown(screen.getByLabelText("New name for Flood notes"), {
      key: "Enter",
    });
    expect(lastWrite()[0].name).toBe("Gauge notes");

    // The owner saves the write and renders the renamed group back.
    rerender(
      <AnnotationControl
        visualizationRef={{ current: null }}
        groups={lastWrite()}
        onGroupsChange={onGroupsChange}
        session={null}
        onSessionChange={onSessionChange}
      />,
    );
    expect(
      screen.getByRole("group", { name: "Gauge notes default style settings" }),
    ).toBeInTheDocument();
  });
});

describe("drawing", () => {
  it("starts a session on the chosen group", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Draw in Flood notes" }),
    );
    expect(onSessionChange).toHaveBeenCalledWith({
      groupName: "Flood notes",
      layerName: "annotation-group:Flood notes",
      title: "Flood notes",
      defaults: { lineColor: "#0000ff" },
      items: [line],
      startItems: [line],
    });
  });

  const session = {
    groupName: "Flood notes",
    layerName: "annotation-group:Flood notes",
    title: "Flood notes",
    defaults: {},
    items: [line],
    startItems: [line],
  };

  it("hands the open session to the editor in place of the panel", () => {
    renderControl({ session });
    expect(screen.getByTestId("annotation-editor")).toBeInTheDocument();
    expect(editorProps.current.session).toBe(session);
    expect(
      screen.queryByRole("button", { name: "Show Annotation Control" }),
    ).toBeNull();
  });

  it("writes each reported change into the group being edited", () => {
    renderControl({ session });
    fireEvent.click(screen.getByRole("button", { name: "report change" }));
    expect(lastWrite()).toEqual([
      { ...floodNotes(), items: ["changed"] },
      siteVisits(),
    ]);
    expect(onSessionChange).not.toHaveBeenCalled();
  });

  it("writes the final items and ends the session on Done", () => {
    renderControl({ session });
    fireEvent.click(screen.getByRole("button", { name: "done" }));
    expect(lastWrite()[0].items).toEqual(["final"]);
    expect(onSessionChange).toHaveBeenCalledWith(null);
  });

  it("puts the group back as the session found it on Cancel", () => {
    renderControl({
      session,
      groups: [{ ...floodNotes(), items: ["drawn since"] }, siteVisits()],
    });
    fireEvent.click(screen.getByRole("button", { name: "cancel" }));
    expect(lastWrite()).toEqual([floodNotes(), siteVisits()]);
    expect(onSessionChange).toHaveBeenCalledWith(null);
  });
});
