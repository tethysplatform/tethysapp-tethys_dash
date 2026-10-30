import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "react-bootstrap/Modal";
import DashboardLayout, {
  MENU_OPEN_Z_INDEX,
} from "components/dashboard/DashboardLayout";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import { GridItemContext } from "components/contexts/Contexts";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import createLoadedComponent from "__tests__/utilities/customRender";
import { userDashboard } from "__tests__/utilities/constants";

// Each tile renders only what these tests need: a menu, plus a marker
// carrying the tile's index so a test can find its grid item wrapper.
jest.mock("components/dashboard/DashboardItem", () => {
  const MockItem = () => {
    const { gridItemIndex } = jest
      .requireActual("react")
      .useContext(
        jest.requireActual("components/contexts/Contexts").GridItemContext,
      );
    const Dropdown = jest.requireActual(
      "components/dashboard/DashboardItemDropdown",
    ).default;
    return (
      <div data-testid={`tile-${gridItemIndex}`}>
        <Dropdown
          gridItemIndex={gridItemIndex}
          deleteGridItem={() => {}}
          editGridItem={() => {}}
          exportGridItem={() => {}}
          copyGridItem={() => {}}
          bringGridItemtoFront={() => {}}
          bringGridItemForward={() => {}}
          sendGridItemtoBack={() => {}}
          sendGridItembackward={() => {}}
        />
      </div>
    );
  };
  return MockItem;
});

const makeItem = (i, metadata = {}) => ({
  i,
  uuid: `uuid-${i}`,
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "",
  args_string: "{}",
  metadata_string: JSON.stringify(metadata),
});

const renderLayout = (items, wrap = (layout) => layout) => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = items;
  return render(
    createLoadedComponent({
      children: wrap(
        <LayoutAlertContextProvider>
          <DashboardLayout tabId={userDashboard.tabs[0].id} gridItems={items} />
        </LayoutAlertContextProvider>,
      ),
      options: { initialDashboard: dashboard, inEditing: true },
    }),
  );
};

/* The z-index sits on react-grid-layout's own wrapper, which has no role or
   label to query by -- reading the wrapper is the point of these tests. */
const wrapperOf = (index) =>
  // eslint-disable-next-line testing-library/no-node-access
  screen.getByTestId(`tile-${index}`).closest(".react-grid-item");

const toggleOf = (index) =>
  within(screen.getByTestId(`tile-${index}`)).getByLabelText(
    "dashboard-item-dropdown-toggle",
  );

test("opening a tile's menu lifts that tile, and closing it drops it back", async () => {
  renderLayout([makeItem("1"), makeItem("2")]);
  await screen.findByTestId("tile-1");
  expect(wrapperOf(0).style.zIndex).toBe("");

  await userEvent.click(toggleOf(0));
  expect(await screen.findByText("Edit")).toBeInTheDocument();
  expect(wrapperOf(0).style.zIndex).toBe(String(MENU_OPEN_Z_INDEX));
  expect(wrapperOf(1).style.zIndex).toBe("");

  // Clicking away closes the menu.
  fireEvent.mouseDown(document.body);
  await waitFor(() => expect(wrapperOf(0).style.zIndex).toBe(""));
});

test("a tile after a fill-viewport tile returns to its own lift on close", async () => {
  renderLayout([makeItem("1", { fillViewport: true }), makeItem("2")]);
  await screen.findByTestId("tile-1");
  expect(wrapperOf(1).style.zIndex).toBe("1");

  await userEvent.click(toggleOf(1));
  expect(wrapperOf(1).style.zIndex).toBe(String(MENU_OPEN_Z_INDEX));

  fireEvent.mouseDown(document.body);
  await waitFor(() => expect(wrapperOf(1).style.zIndex).toBe("1"));
});

test("the menu renders at the page root, outside its tile", async () => {
  renderLayout([makeItem("1")]);
  await screen.findByTestId("tile-0");

  await userEvent.click(toggleOf(0));
  const edit = await screen.findByText("Edit");

  expect(screen.getByTestId("tile-0")).not.toContainElement(edit);
  // eslint-disable-next-line testing-library/no-node-access
  expect(edit.closest(".dropdown-menu").parentElement).toBe(document.body);
});

test("inside a modal, the menu renders in that modal, outside its tile", async () => {
  // As in the popup layout editor: a menu at the page root would sit under
  // the modal and never be seen.
  renderLayout([makeItem("1")], (layout) => (
    <Modal show onHide={() => {}}>
      <Modal.Body>{layout}</Modal.Body>
    </Modal>
  ));
  await screen.findByTestId("tile-0");

  await userEvent.click(toggleOf(0));
  const edit = await screen.findByText("Edit");

  expect(screen.getByTestId("tile-0")).not.toContainElement(edit);
  // eslint-disable-next-line testing-library/no-node-access
  expect(edit.closest(".dropdown-menu").parentElement).toBe(
    screen.getByRole("dialog"),
  );
});

test("a menu outside any grid item still opens", async () => {
  render(
    createLoadedComponent({
      children: (
        <GridItemContext.Provider value={undefined}>
          <DashboardItemDropdown
            gridItemIndex={0}
            deleteGridItem={() => {}}
            editGridItem={() => {}}
            exportGridItem={() => {}}
            copyGridItem={() => {}}
            bringGridItemtoFront={() => {}}
            bringGridItemForward={() => {}}
            sendGridItemtoBack={() => {}}
            sendGridItembackward={() => {}}
          />
        </GridItemContext.Provider>
      ),
    }),
  );

  await userEvent.click(
    await screen.findByLabelText("dashboard-item-dropdown-toggle"),
  );
  expect(await screen.findByText("Edit")).toBeInTheDocument();
});

test("a tile with no uuid is lifted by its layout key", async () => {
  renderLayout([{ ...makeItem("1"), uuid: undefined }, makeItem("2")]);
  await screen.findByTestId("tile-0");

  await userEvent.click(toggleOf(0));
  expect(wrapperOf(0).style.zIndex).toBe(String(MENU_OPEN_Z_INDEX));
  expect(wrapperOf(1).style.zIndex).toBe("");

  fireEvent.mouseDown(document.body);
  await waitFor(() => expect(wrapperOf(0).style.zIndex).toBe(""));
});

test("opening a second menu moves the lift to it and the first close leaves it there", async () => {
  renderLayout([makeItem("1"), makeItem("2")]);
  await screen.findByTestId("tile-1");

  await userEvent.click(toggleOf(0));
  expect(wrapperOf(0).style.zIndex).toBe(String(MENU_OPEN_Z_INDEX));

  await userEvent.click(toggleOf(1));
  await waitFor(() =>
    expect(wrapperOf(1).style.zIndex).toBe(String(MENU_OPEN_Z_INDEX)),
  );
  expect(wrapperOf(0).style.zIndex).toBe("");
});
