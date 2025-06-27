import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardItemDropdown from "components/dashboard/DashboardItemDropdown";
import createLoadedComponent from "__tests__/utilities/customRender";
import { mockedDashboards } from "__tests__/utilities/constants";

it("DashboardItemDropdown", async () => {
  const deleteGridItem = jest.fn();
  const editGridItem = jest.fn();
  const exportGridItem = jest.fn();
  const copyGridItem = jest.fn();
  const bringGridItemtoFront = jest.fn();
  const bringGridItemForward = jest.fn();
  const sendGridItemtoBack = jest.fn();
  const sendGridItembackward = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          gridItemIndex={0}
          deleteGridItem={deleteGridItem}
          editGridItem={editGridItem}
          exportGridItem={exportGridItem}
          copyGridItem={copyGridItem}
          bringGridItemtoFront={bringGridItemtoFront}
          bringGridItemForward={bringGridItemForward}
          sendGridItemtoBack={sendGridItemtoBack}
          sendGridItembackward={sendGridItembackward}
        />
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const editOption = await screen.findByText("Edit");
  expect(editOption).toBeInTheDocument();
  await userEvent.click(editOption);
  expect(editGridItem).toHaveBeenCalled();

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();
  await userEvent.click(copyOption);
  expect(copyGridItem).toHaveBeenCalled();

  expect(screen.queryByText("Order")).not.toBeInTheDocument();

  const exportOption = await screen.findByText("Export");
  expect(exportOption).toBeInTheDocument();
  await userEvent.click(exportOption);
  expect(exportGridItem).toHaveBeenCalled();

  const deleteOption = await screen.findByText("Delete");
  expect(deleteOption).toBeInTheDocument();
  await userEvent.click(deleteOption);
  expect(deleteGridItem).toHaveBeenCalled();
});

it("DashboardItemDropdown order not overflowing submenu", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.unrestrictedPlacement = true;

  const deleteGridItem = jest.fn();
  const editGridItem = jest.fn();
  const exportGridItem = jest.fn();
  const copyGridItem = jest.fn();
  const bringGridItemtoFront = jest.fn();
  const bringGridItemForward = jest.fn();
  const sendGridItemtoBack = jest.fn();
  const sendGridItembackward = jest.fn();

  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    right: window.innerWidth - 100, // Simulate element fitting within viewport
  }));

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          gridItemIndex={0}
          deleteGridItem={deleteGridItem}
          editGridItem={editGridItem}
          exportGridItem={exportGridItem}
          copyGridItem={copyGridItem}
          bringGridItemtoFront={bringGridItemtoFront}
          bringGridItemForward={bringGridItemForward}
          sendGridItemtoBack={sendGridItemtoBack}
          sendGridItembackward={sendGridItembackward}
        />
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  const subMenu = screen.getByLabelText("Context Menu Submenu");
  fireEvent.mouseEnter(orderOption);

  expect(window.getComputedStyle(subMenu).display).toBe("block");
  expect(window.getComputedStyle(subMenu).left).toBe("100%");
  expect(window.getComputedStyle(subMenu).right).toBe("");
});

it("ContextMenu overflowing submenu", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = updatedMockedDashboards.user[0];
  mockedDashboard.unrestrictedPlacement = true;

  const deleteGridItem = jest.fn();
  const editGridItem = jest.fn();
  const exportGridItem = jest.fn();
  const copyGridItem = jest.fn();
  const bringGridItemtoFront = jest.fn();
  const bringGridItemForward = jest.fn();
  const sendGridItemtoBack = jest.fn();
  const sendGridItembackward = jest.fn();

  Element.prototype.getBoundingClientRect = jest.fn(() => ({
    right: window.innerWidth + 10, // Simulate overflow (element extends past window width)
  }));

  render(
    createLoadedComponent({
      children: (
        <DashboardItemDropdown
          gridItemIndex={0}
          deleteGridItem={deleteGridItem}
          editGridItem={editGridItem}
          exportGridItem={exportGridItem}
          copyGridItem={copyGridItem}
          bringGridItemtoFront={bringGridItemtoFront}
          bringGridItemForward={bringGridItemForward}
          sendGridItemtoBack={sendGridItemtoBack}
          sendGridItembackward={sendGridItembackward}
        />
      ),
      options: {
        editableDashboard: true,
        dashboards: updatedMockedDashboards,
      },
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const orderOption = await screen.findByText("Order");
  expect(orderOption).toBeInTheDocument();
  const subMenu = screen.getByLabelText("Context Menu Submenu");
  expect(window.getComputedStyle(subMenu).display).toBe("none");
  fireEvent.mouseEnter(orderOption);

  expect(window.getComputedStyle(subMenu).display).toBe("block");
  expect(window.getComputedStyle(subMenu).left).toBe("");
  expect(window.getComputedStyle(subMenu).right).toBe("100%");

  fireEvent.mouseLeave(orderOption);
  expect(window.getComputedStyle(subMenu).display).toBe("none");
});
