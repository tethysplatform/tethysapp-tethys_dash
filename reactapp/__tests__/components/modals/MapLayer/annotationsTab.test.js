import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import MapLayerModal from "components/modals/MapLayer/MapLayer";
import {
  AppContext,
  LayoutContext,
  TabContext,
  VariableInputsContext,
} from "components/contexts/Contexts";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
    getStyleFields: jest.fn().mockResolvedValue([]),
  };
});

const line = {
  id: "a1",
  kind: "line",
  coordinates: [
    [-123.1, 44.05],
    [-123.0, 44.1],
  ],
};
const text = {
  id: "a2",
  kind: "text",
  coordinates: [-123.05, 44.0],
  text: "2026",
};

const annotationsLayerInfo = (annotations) => ({
  sourceProps: { type: "Annotations", props: {} },
  layerProps: { name: "Callouts" },
  annotations,
});

const mountModal = ({ layerInfo, addMapLayer = jest.fn() } = {}) => {
  render(
    <AppContext.Provider
      value={{ csrf: "csrf", mapLayerTemplates: [], dynamicMapLayers: [] }}
    >
      <LayoutContext.Provider value={{ uuid: "123" }}>
        <TabContext.Provider value={{ activeTabId: "tab-1" }}>
          <VariableInputsContext.Provider
            value={{ variableInputValues: {}, variableInputDateFormats: {} }}
          >
            <MapLayerModal
              showModal={true}
              handleModalClose={jest.fn()}
              addMapLayer={addMapLayer}
              layerInfo={layerInfo}
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

test("an Annotations layer shows only the Layer, Source and Annotations tabs", async () => {
  mountModal({ layerInfo: annotationsLayerInfo() });

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  for (const tab of ["Layer", "Source", "Annotations"]) {
    expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
  }
  for (const tab of [
    "Style",
    "Labels",
    "Legend",
    "Attributes/Table Popup",
    "Custom Modal Popup",
  ]) {
    expect(screen.queryByRole("tab", { name: tab })).not.toBeInTheDocument();
  }
});

test("saving writes the annotations beside the props, off every query", async () => {
  const addMapLayer = mountModal({
    layerInfo: annotationsLayerInfo({
      defaults: { lineColor: "#ff0000" },
      items: [line, text],
    }),
  });

  const saved = await savedConfig(addMapLayer);

  expect(saved).toEqual({
    configuration: {
      type: "VectorLayer",
      props: {
        name: "Callouts",
        source: { type: "Annotations", props: {} },
      },
      annotations: { defaults: { lineColor: "#ff0000" }, items: [line, text] },
    },
    tablePopupType: "none",
  });
  // Text that looks like a number stays text.
  expect(saved.configuration.annotations.items[1].text).toBe("2026");
  expect(saved.configuration).not.toHaveProperty("style");
});

test("an unchanged layer saves an identical config", async () => {
  const first = mountModal({
    layerInfo: annotationsLayerInfo({ defaults: {}, items: [line] }),
  });
  const config = await savedConfig(first);

  // Reopen from what was saved, the way AddMapLayer's edit path does.
  cleanup();
  const second = mountModal({
    layerInfo: annotationsLayerInfo(config.configuration.annotations),
  });
  expect(await savedConfig(second)).toEqual(config);
});

test("an empty Annotations layer saves, and the tab says it is empty", async () => {
  const addMapLayer = mountModal({ layerInfo: annotationsLayerInfo() });

  fireEvent.click(screen.getByRole("tab", { name: "Annotations" }));
  expect(
    await screen.findByText(/This layer has no annotations yet/),
  ).toBeInTheDocument();

  const saved = await savedConfig(addMapLayer);
  expect(saved.configuration.annotations).toEqual({ defaults: {}, items: [] });
});

test("the Source tab points to the Annotations tab", async () => {
  mountModal({ layerInfo: annotationsLayerInfo() });

  fireEvent.click(screen.getByRole("tab", { name: "Source" }));
  expect(
    await screen.findByText(/has no source to configure/),
  ).toBeInTheDocument();
});

test("a layer saved while hidden stays hidden", async () => {
  const addMapLayer = mountModal({
    layerInfo: {
      ...annotationsLayerInfo(),
      layerProps: { name: "Callouts", layerVisibility: false },
    },
  });

  const saved = await savedConfig(addMapLayer);
  expect(saved.configuration.layerVisibility).toBe(false);
  expect(saved.configuration.props).not.toHaveProperty("layerVisibility");
});
