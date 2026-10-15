import { act } from "react";
import { render, screen } from "@testing-library/react";
import { DataViewerContent } from "components/modals/DataViewer/DataViewer";
import MapContextProvider, {
  useMapContext,
} from "components/contexts/MapContext";
import { GridItemContext } from "components/contexts/Contexts";
import createLoadedComponent from "__tests__/utilities/customRender";
import { userDashboard } from "__tests__/utilities/constants";

beforeAll(() => {
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

let mapContext;
const ContextProbe = () => {
  mapContext = useMapContext();
  return null;
};

const gridItem = {
  i: "2",
  source: "Text",
  args_string: JSON.stringify({ text: "Some text" }),
  metadata_string: JSON.stringify({}),
};

const renderViewer = () =>
  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <ContextProbe />
          <GridItemContext.Provider
            value={{
              gridItemSource: gridItem.source,
              gridItemI: gridItem.i,
              gridItemMetadataString: gridItem.metadata_string,
              gridItemArgsString: gridItem.args_string,
              gridItemIndex: 0,
            }}
          >
            <DataViewerContent
              showModal={true}
              handleModalClose={jest.fn()}
              setGridItemMessage={jest.fn()}
              setShowGridItemMessage={jest.fn()}
            />
          </GridItemContext.Provider>
        </MapContextProvider>
      ),
      options: { initialDashboard: userDashboard },
    }),
  );

const expectNormalLayout = () => {
  expect(screen.getByText("Edit Visualization")).toBeInTheDocument();
  expect(screen.getByLabelText("dataviewer-save-button")).toBeInTheDocument();
  expect(screen.getByLabelText("dataviewer-close-button")).toBeInTheDocument();
  expect(screen.getByLabelText("Close")).toBeInTheDocument();
  expect(screen.getByTestId("dataviewer-inputs")).toBeVisible();
};

const expectMapOnlyLayout = () => {
  expect(screen.getByText(/Editing on the map/)).toBeInTheDocument();
  expect(
    screen.queryByLabelText("dataviewer-save-button"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("dataviewer-close-button"),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
  // Hidden, but still mounted: the layer editor inside keeps its draft.
  const inputs = screen.getByTestId("dataviewer-inputs");
  expect(inputs).toBeInTheDocument();
  expect(inputs).not.toBeVisible();
};

test.each([
  [
    "an annotation session",
    () =>
      mapContext.setAnnotationEditSession({
        layerName: "Callouts",
        defaults: {},
        items: [],
      }),
    () => mapContext.setAnnotationEditSession(null),
  ],
  [
    "a static image extent draw",
    () => mapContext.setExtentDrawMode({ imageUrl: "https://x/y.png" }),
    () => mapContext.setExtentDrawMode(null),
  ],
])(
  "shows only the map during %s, and restores the viewer after",
  async (_label, start, end) => {
    renderViewer();
    expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
    expectNormalLayout();

    act(() => start());
    expectMapOnlyLayout();

    act(() => end());
    expectNormalLayout();
  },
);
