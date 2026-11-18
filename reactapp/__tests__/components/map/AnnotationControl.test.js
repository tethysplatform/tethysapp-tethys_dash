import { useRef } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, within } from "@testing-library/react";
import AnnotationControl from "components/map/AnnotationControl";
import { GRID_DRAG_CANCEL_CLASS } from "components/dashboard/gridDragCancel";

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
// The groups the control was last rendered with, which an updater write is
// applied to.
let currentGroups;

// The map div the control sits in, as map/Map.js renders it.
const MapDiv = ({ children }) => {
  const mapDivRef = useRef(null);
  return (
    <div data-testid="map-div" ref={mapDivRef}>
      {children(mapDivRef)}
    </div>
  );
};
MapDiv.propTypes = { children: PropTypes.func.isRequired };

const renderControl = ({
  groups = [floodNotes(), siteVisits()],
  session,
} = {}) => {
  currentGroups = groups;
  return render(
    <MapDiv>
      {(mapDivRef) => (
        <AnnotationControl
          visualizationRef={{ current: null }}
          mapDivRef={mapDivRef}
          groups={groups}
          onGroupsChange={onGroupsChange}
          session={session ?? null}
          onSessionChange={onSessionChange}
        />
      )}
    </MapDiv>,
  );
};

const open = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Show Annotation Control" }),
  );

// A write is a list or an updater; either way, the groups it leaves.
const resolve = (write) =>
  typeof write === "function" ? write(currentGroups) : write;
const lastWrite = () => resolve(onGroupsChange.mock.calls.at(-1)[0]);
const resolveFrom = (groups, write) =>
  typeof write === "function" ? write(groups) : write;

beforeEach(() => {
  onGroupsChange = jest.fn();
  onSessionChange = jest.fn();
  editorProps.current = null;
});

describe("the button", () => {
  // Shown only in dashboard edit mode, where a press anywhere else in the tile
  // starts moving the tile; see gridDragCancel.test.js for the layout's side.
  it("is left out of tile dragging, closed and open", () => {
    renderControl();
    const button = screen.getByRole("button", {
      name: "Show Annotation Control",
    });
    // eslint-disable-next-line testing-library/no-node-access
    expect(button.closest(`.${GRID_DRAG_CANCEL_CLASS}`)).not.toBeNull();

    open();
    expect(
      screen
        .getByRole("button", { name: "Add group" })
        // eslint-disable-next-line testing-library/no-node-access
        .closest(`.${GRID_DRAG_CANCEL_CLASS}`),
    ).not.toBeNull();
  });

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

  // The panel scrolls and is too narrow for a picker beside a swatch; one
  // opened inside it widened the panel into a sideways scroll. One opened in
  // the map was painted over by any tile later on the page, since a map is
  // sealed into its tile -- so it opens on the page itself.
  it("opens a default's color picker on the page, outside the map", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    fireEvent.click(
      screen.getByLabelText("Default Line Color color popover square"),
    );
    const picker = screen.getByRole("tooltip");
    expect(picker).toBeInTheDocument();
    expect(screen.getByTestId("map-div")).not.toContainElement(picker);
  });

  it("writes a changed default once the edit is finished, and clearing removes it", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    const defaults = screen.getByRole("group", {
      name: "Site visits default style settings",
    });
    const width = within(defaults).getByLabelText("Default Line Width");
    fireEvent.change(width, { target: { value: "4" } });
    // Shown at once, written only when the field is left.
    expect(width).toHaveValue("4");
    expect(onGroupsChange).not.toHaveBeenCalled();
    fireEvent.blur(width);
    expect(onGroupsChange).toHaveBeenCalledTimes(1);
    expect(lastWrite()).toEqual([
      floodNotes(),
      { ...siteVisits(), defaults: { lineWidth: 4 } },
    ]);
  });

  it("writes a cleared default as removed", () => {
    renderControl({
      groups: [floodNotes(), { ...siteVisits(), defaults: { lineWidth: 4 } }],
    });
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    const width = screen.getByLabelText("Default Line Width");
    fireEvent.change(width, { target: { value: "" } });
    fireEvent.blur(width);
    expect(lastWrite()).toEqual([floodNotes(), siteVisits()]);
  });

  it("writes a pending default before the next press anywhere", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    fireEvent.change(screen.getByLabelText("Default Line Width"), {
      target: { value: "4" },
    });
    expect(onGroupsChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(lastWrite()[1].defaults).toEqual({ lineWidth: 4 });
  });

  it("writes a pending default when focus moves on, as a keyboard exit does", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    fireEvent.change(screen.getByLabelText("Default Line Width"), {
      target: { value: "4" },
    });
    // Tabbing on to the dashboard's Save button, say.
    const save = document.createElement("button");
    document.body.appendChild(save);
    fireEvent.focusIn(save);
    expect(lastWrite()[1].defaults).toEqual({ lineWidth: 4 });
    save.remove();
  });

  it("writes a pending default under the old name before a rename", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    fireEvent.change(screen.getByLabelText("Default Line Width"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename Site visits" }));
    fireEvent.change(screen.getByLabelText("New name for Site visits"), {
      target: { value: "Visits" },
    });
    fireEvent.keyDown(screen.getByLabelText("New name for Site visits"), {
      key: "Enter",
    });

    // Applied in order to the groups as they are, both writes land.
    const [draftWrite, renameWrite] = onGroupsChange.mock.calls
      .slice(-2)
      .map(([write]) => write);
    expect(renameWrite(draftWrite(currentGroups))).toEqual([
      floodNotes(),
      { name: "Visits", defaults: { lineWidth: 4 }, items: [] },
    ]);
  });

  it("finishes one group's pending default when another group's is started", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    fireEvent.change(screen.getByLabelText("Default Line Width"), {
      target: { value: "4" },
    });
    // Starting on the other group's defaults (without a press or focus move
    // in between, which would have written the first one already).
    fireEvent.click(
      screen.getByRole("button", { name: "Flood notes default styles" }),
    );
    expect(onGroupsChange).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Default Line Width"), {
      target: { value: "9" },
    });
    // Starting the second draft wrote the first, and holds the second.
    expect(onGroupsChange).toHaveBeenCalledTimes(1);
    expect(lastWrite()[1].defaults).toEqual({ lineWidth: 4 });

    fireEvent.blur(screen.getByLabelText("Default Line Width"));
    expect(onGroupsChange).toHaveBeenCalledTimes(2);
    const final = onGroupsChange.mock.calls
      .map(([write]) => write)
      .reduce(resolveFrom, currentGroups);
    expect(final).toEqual([
      { ...floodNotes(), defaults: { lineColor: "#0000ff", lineWidth: 9 } },
      { ...siteVisits(), defaults: { lineWidth: 4 } },
    ]);
  });

  it("writes a choice from a list at once", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    fireEvent.change(screen.getByLabelText("Default Arrowheads"), {
      target: { value: "both" },
    });
    expect(lastWrite()[1].defaults).toEqual({ arrowheads: "both" });

    fireEvent.change(screen.getByLabelText("Default Text Placement"), {
      target: { value: "n" },
    });
    expect(lastWrite()[1].defaults).toEqual({ textAnchor: "n" });
  });

  it("never offers no arrowheads as a default: a line with none is a line", () => {
    renderControl();
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Site visits default styles" }),
    );
    const options = within(screen.getByLabelText("Default Arrowheads"))
      .getAllByRole("option")
      .map((option) => option.value);
    expect(options).not.toContain("none");
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
    currentGroups = lastWrite();
    rerender(
      <MapDiv>
        {(mapDivRef) => (
          <AnnotationControl
            visualizationRef={{ current: null }}
            mapDivRef={mapDivRef}
            groups={currentGroups}
            onGroupsChange={onGroupsChange}
            session={null}
            onSessionChange={onSessionChange}
          />
        )}
      </MapDiv>,
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
