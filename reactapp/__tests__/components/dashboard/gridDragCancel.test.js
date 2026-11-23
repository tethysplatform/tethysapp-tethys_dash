import { render, screen, fireEvent } from "@testing-library/react";
import DashboardLayout from "components/dashboard/DashboardLayout";
import { GRID_DRAG_CANCEL_CLASS } from "components/dashboard/gridDragCancel";
import { userDashboard } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";

// A tile with an ordinary area and a control that opts out of tile dragging,
// as the map's annotation button does in dashboard edit mode.
// eslint-disable-next-line
jest.mock("components/dashboard/DashboardItem", () => () => (
  <div>
    <p>Tile body</p>
    <button type="button" className="grid-drag-cancel">
      Tile control
    </button>
  </div>
));

// react-grid-layout measures a drag against the item's offsetParent and drops
// the drag when there is none, which is always the case in jsdom, which does no
// layout. Every element gets its parent as one for the duration of this file.
let offsetParentDescriptor;
beforeAll(() => {
  offsetParentDescriptor = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "offsetParent",
  );
  Object.defineProperty(HTMLElement.prototype, "offsetParent", {
    configurable: true,
    get() {
      // eslint-disable-next-line testing-library/no-node-access
      return this.parentNode;
    },
  });
});
afterAll(() => {
  Object.defineProperty(
    HTMLElement.prototype,
    "offsetParent",
    offsetParentDescriptor,
  );
});

const item = {
  id: 1,
  uuid: "some-uuid-1",
  i: "1",
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "",
  args_string: "{}",
  metadata_string: "{}",
};

const renderEditingLayout = () => {
  const dashboard = JSON.parse(JSON.stringify(userDashboard));
  dashboard.tabs[0].gridItems = [item];
  return render(
    createLoadedComponent({
      children: (
        <LayoutAlertContextProvider>
          <DashboardLayout tabId={dashboard.tabs[0].id} gridItems={[item]} />
        </LayoutAlertContextProvider>
      ),
      options: { initialDashboard: dashboard, inEditing: true },
    }),
  );
};

/* react-grid-layout renders its placeholder -- the red box that flashes over a
   tile -- once a drag has started, and it has no accessible role to query by. */
const dragStarted = (container) =>
  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
  container.querySelector(".react-grid-placeholder") !== null;

test("the class name the layout cancels drags on is the shared one", () => {
  expect(GRID_DRAG_CANCEL_CLASS).toBe("grid-drag-cancel");
});

test("a press on the tile body starts moving the tile", async () => {
  const { container } = renderEditingLayout();
  fireEvent.mouseDown(await screen.findByText("Tile body"));
  expect(dragStarted(container)).toBe(true);
});

test("a press on a drag-cancelled control does not move the tile", async () => {
  const { container } = renderEditingLayout();
  fireEvent.mouseDown(
    await screen.findByRole("button", { name: "Tile control" }),
  );
  expect(dragStarted(container)).toBe(false);
});
