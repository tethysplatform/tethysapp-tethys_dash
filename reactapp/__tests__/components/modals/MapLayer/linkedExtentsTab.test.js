import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import selectEvent from "react-select-event";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";
import { POPUP_TAB_ID } from "components/map/viewGroup";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
    getStyleFields: jest.fn().mockResolvedValue([]),
  };
});

const linkedLayerInfo = (linkedExtentStyle) => ({
  sourceProps: { type: "Linked Extents", props: {} },
  layerProps: { name: "Inset" },
  ...(linkedExtentStyle ? { linkedExtentStyle } : {}),
});

const mountModal = ({
  layerInfo = {},
  mapExtent,
  activeTabId = "tab-1",
} = {}) => {
  const addMapLayer = jest.fn();
  render(
    <AppContext.Provider
      value={{ csrf: "csrf", mapLayerTemplates: [], dynamicMapLayers: [] }}
    >
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <TabContext.Provider value={{ activeTabId }}>
          <VariableInputsContext.Provider
            value={{ variableInputValues: {}, variableInputDateFormats: {} }}
          >
            <MapLayerModal
              showModal={true}
              handleModalClose={jest.fn()}
              addMapLayer={addMapLayer}
              layerInfo={layerInfo}
              mapExtent={mapExtent}
            />
          </VariableInputsContext.Provider>
        </TabContext.Provider>
      </LayoutContext.Provider>
    </AppContext.Provider>,
  );
  return addMapLayer;
};

const savedConfig = async (addMapLayer) => {
  fireEvent.click(screen.getByLabelText("Create Layer Button"));
  await waitFor(() => expect(addMapLayer).toHaveBeenCalled());
  return addMapLayer.mock.calls[0][0];
};

test("a Linked Extents layer shows the Layer, Source and Outline tabs only", async () => {
  mountModal({ layerInfo: linkedLayerInfo() });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  for (const tab of ["Layer", "Source", "Outline"]) {
    expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
  }
  for (const tab of ["Style", "Labels", "Legend", "Annotations"]) {
    expect(screen.queryByRole("tab", { name: tab })).not.toBeInTheDocument();
  }
});

test("saving writes the outline style beside the props", async () => {
  const addMapLayer = mountModal({
    layerInfo: linkedLayerInfo({ color: "#0000ff", width: 3 }),
  });

  expect(await savedConfig(addMapLayer)).toEqual({
    configuration: {
      type: "VectorLayer",
      props: { name: "Inset", source: { type: "Linked Extents", props: {} } },
      linkedExtentStyle: { color: "#0000ff", width: 3 },
    },
    tablePopupType: "none",
  });
});

test("an untouched outline style saves no style key", async () => {
  const addMapLayer = mountModal({ layerInfo: linkedLayerInfo() });

  const saved = await savedConfig(addMapLayer);
  expect(saved.configuration).not.toHaveProperty("linkedExtentStyle");
});

test("editing the outline width stores a number, and clearing it removes it", async () => {
  const addMapLayer = mountModal({ layerInfo: linkedLayerInfo() });
  fireEvent.click(screen.getByRole("tab", { name: "Outline" }));

  const width = await screen.findByLabelText("Outline Width");
  fireEvent.change(width, { target: { value: "5" } });
  fireEvent.change(width, { target: { value: "" } });
  fireEvent.change(width, { target: { value: "6" } });

  const saved = await savedConfig(addMapLayer);
  expect(saved.configuration.linkedExtentStyle).toEqual({ width: 6 });
});

test("the Outline tab says when the map is in no linked extent group (AE6)", async () => {
  mountModal({
    layerInfo: linkedLayerInfo(),
    mapExtent: { extent: "1,2,3", viewGroup: "Valley" },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Outline" }));

  expect(
    await screen.findByText(/not in a linked extent group/),
  ).toBeInTheDocument();
});

test("the Outline tab names the group when the map has one", async () => {
  mountModal({
    layerInfo: linkedLayerInfo(),
    mapExtent: { extent: "1,2,3", linkedExtentGroup: "Basin" },
  });
  fireEvent.click(screen.getByRole("tab", { name: "Outline" }));

  expect(await screen.findByText("Basin")).toBeInTheDocument();
  expect(
    screen.queryByText(/not in a linked extent group/),
  ).not.toBeInTheDocument();
});

const sourceOptions = async () => {
  fireEvent.click(screen.getByRole("tab", { name: "Source" }));
  const select = await screen.findByLabelText("Source Type Input");
  selectEvent.openMenu(within(select).queryByRole("combobox") ?? select);
  // Annotations is offered everywhere, so its option marks the menu as open.
  await screen.findByText("Annotations");
  return screen.queryAllByText(/^(Linked Extents|Annotations)$/);
};

test("Linked Extents is offered when adding a layer to a dashboard map", async () => {
  mountModal();
  const options = (await sourceOptions()).map((o) => o.textContent);
  expect(options).toEqual(
    expect.arrayContaining(["Linked Extents", "Annotations"]),
  );
});

test("Linked Extents is not offered inside a popup layout", async () => {
  mountModal({ activeTabId: POPUP_TAB_ID });
  const options = (await sourceOptions()).map((o) => o.textContent);
  expect(options).toContain("Annotations");
  expect(options).not.toContain("Linked Extents");
});
