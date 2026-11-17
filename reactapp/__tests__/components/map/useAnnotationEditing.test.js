import { act, renderHook } from "@testing-library/react";
import useAnnotationEditing from "components/map/useAnnotationEditing";
import {
  EditingContext,
  GridItemContext,
  TabContext,
} from "components/contexts/Contexts";
import { POPUP_TAB_ID } from "components/map/viewGroup";

const groups = [{ name: "Flood notes", defaults: {}, items: [] }];

// One tab holding a text tile and then this map tile, at index 1.
const makeTab = (metadata = { refreshRate: 0, annotations: groups }) => ({
  id: "tab-1",
  gridItems: [
    { uuid: "text-uuid", source: "Text", metadata_string: "{}" },
    {
      uuid: "map-uuid",
      source: "Map",
      metadata_string: JSON.stringify(metadata),
    },
  ],
});

let tab;
let updateGridItem;
let ctx;

const wrapper = ({ children }) => (
  <EditingContext.Provider value={{ isEditing: ctx.isEditing }}>
    <TabContext.Provider
      value={{
        activeTabId: ctx.activeTabId,
        updateGridItem: ctx.withUpdateGridItem ? updateGridItem : undefined,
      }}
    >
      <GridItemContext.Provider
        value={{
          gridItemUUID: ctx.gridItemUUID,
          gridItemMetadataString: tab.gridItems[1].metadata_string,
        }}
      >
        {children}
      </GridItemContext.Provider>
    </TabContext.Provider>
  </EditingContext.Provider>
);

const renderEditing = (options = {}) =>
  renderHook((props) => useAnnotationEditing(props), {
    wrapper,
    initialProps: { dataviewerViz: false, ...options },
  });

beforeEach(() => {
  tab = makeTab();
  updateGridItem = jest.fn();
  ctx = {
    isEditing: true,
    activeTabId: "tab-1",
    gridItemUUID: "map-uuid",
    withUpdateGridItem: true,
  };
});

describe("when the button is offered", () => {
  it("is offered on a dashboard tile in edit mode, with the saved groups", () => {
    const { result } = renderEditing();
    expect(result.current.annotationControl.groups).toEqual(groups);
    expect(result.current.sessionOpen).toBe(false);
  });

  it.each([
    ["outside edit mode", () => (ctx.isEditing = false), {}],
    ["in the data viewer", () => {}, { dataviewerViz: true }],
    ["inside a popup layout", () => (ctx.activeTabId = POPUP_TAB_ID), {}],
    ["to a tile with no uuid", () => (ctx.gridItemUUID = undefined), {}],
    [
      "where tiles cannot be written (a popup's own tab context)",
      () => (ctx.withUpdateGridItem = false),
      {},
    ],
  ])("is not offered %s", (_label, arrange, options) => {
    arrange();
    const { result } = renderEditing(options);
    expect(result.current.annotationControl).toBeNull();
  });

  it("offers an empty list for settings with no groups or unreadable ones", () => {
    tab = makeTab({ refreshRate: 0 });
    expect(renderEditing().result.current.annotationControl.groups).toEqual([]);
    tab.gridItems[1].metadata_string = "{oops";
    expect(renderEditing().result.current.annotationControl.groups).toEqual([]);
  });
});

describe("writing groups", () => {
  const added = [...groups, { name: "Annotations 2", defaults: {}, items: [] }];
  const mapItem = () => tab.gridItems[1];

  // The change handed to updateGridItem, applied to an item.
  const applyWrite = (item) => updateGridItem.mock.calls[0][2](item);

  it("asks for this tile, by uuid on the tab on screen, to be changed", () => {
    const { result } = renderEditing();
    act(() => result.current.annotationControl.onGroupsChange(added));

    expect(updateGridItem).toHaveBeenCalledTimes(1);
    const [tabId, uuid] = updateGridItem.mock.calls[0];
    expect(tabId).toBe("tab-1");
    expect(uuid).toBe("map-uuid");
  });

  it("changes only the groups in the tile's settings", () => {
    const { result } = renderEditing();
    act(() => result.current.annotationControl.onGroupsChange(added));

    const written = applyWrite(mapItem());
    expect(written).not.toBe(mapItem());
    expect(written.uuid).toBe("map-uuid");
    expect(JSON.parse(written.metadata_string)).toEqual({
      refreshRate: 0,
      annotations: added,
    });
  });

  it("applies to the item as it is when the write lands, not as it rendered", () => {
    const { result } = renderEditing();
    act(() => result.current.annotationControl.onGroupsChange(added));

    // Another write got there first and changed a different setting.
    const latest = {
      ...mapItem(),
      metadata_string: JSON.stringify({ refreshRate: 5, annotations: groups }),
    };
    expect(JSON.parse(applyWrite(latest).metadata_string)).toEqual({
      refreshRate: 5,
      annotations: added,
    });
  });

  it("leaves the item alone when nothing changed or its settings cannot be read", () => {
    const { result } = renderEditing();
    act(() => result.current.annotationControl.onGroupsChange(groups));
    expect(applyWrite(mapItem())).toBe(mapItem());

    const unreadable = { ...mapItem(), metadata_string: "{oops" };
    expect(applyWrite(unreadable)).toBe(unreadable);
  });
});

describe("the drawing session", () => {
  const session = { groupName: "Flood notes", layerName: "x", items: [] };

  it("is held until it ends", () => {
    const { result } = renderEditing();
    act(() => result.current.annotationControl.onSessionChange(session));
    expect(result.current.annotationControl.session).toBe(session);
    expect(result.current.sessionOpen).toBe(true);

    act(() => result.current.annotationControl.onSessionChange(null));
    expect(result.current.sessionOpen).toBe(false);
  });

  it("ends when the dashboard leaves edit mode", () => {
    const { result, rerender } = renderEditing();
    act(() => result.current.annotationControl.onSessionChange(session));

    ctx.isEditing = false;
    rerender({ dataviewerViz: false });
    expect(result.current.sessionOpen).toBe(false);

    // Back in edit mode, the old session does not come back with it.
    ctx.isEditing = true;
    rerender({ dataviewerViz: false });
    expect(result.current.annotationControl.session).toBeNull();
  });

  it("ends when another tab is shown", () => {
    const { result, rerender } = renderEditing();
    act(() => result.current.annotationControl.onSessionChange(session));

    ctx.activeTabId = "tab-2";
    rerender({ dataviewerViz: false });
    ctx.activeTabId = "tab-1";
    rerender({ dataviewerViz: false });
    expect(result.current.annotationControl.session).toBeNull();
  });
});
