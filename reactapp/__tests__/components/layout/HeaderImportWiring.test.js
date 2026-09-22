/* eslint-disable react/prop-types -- a one-prop probe component, not production UI */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { DashboardHeader } from "components/layout/Header";
import LayoutAlertContextProvider from "components/contexts/LayoutAlertContext";
import createLoadedComponent from "__tests__/utilities/customRender";
import { mockedDashboards } from "__tests__/utilities/constants";

// Lives in its own file because `jest.mock` is hoisted and file-scoped: the
// import modal is mocked here to capture the prop the header computes, and
// Header.test.js needs the real one.
jest.mock("components/modals/DashboardImport", () => {
  const ImportModalProbe = (props) => (
    <p data-testid="import-modal-props">
      {JSON.stringify(props.targetGroupNames ?? null)}
    </p>
  );
  ImportModalProbe.displayName = "ImportModalProbe";
  return ImportModalProbe;
});

jest.mock("uuid", () => ({
  v4: () => "12345678",
}));

const mapGridItem = ({ id, uuid, i, mapExtent }) => ({
  id,
  uuid,
  i,
  x: 0,
  y: 0,
  w: 20,
  h: 20,
  source: "Map",
  args_string: JSON.stringify({ layers: [], map_extent: mapExtent }),
  metadata_string: JSON.stringify({ refreshRate: 0 }),
});

// This is the one line wiring live tab state into the import modal's
// collision guard. Every other targetGroupNames test hands the modal an array
// directly, so without this a regression in Header -- wrong source, wrong
// iterator, dropped prop -- would defeat the target half of the rule silently.
test("DashboardHeader passes the dashboard's claimed view groups to the import modal", async () => {
  const dashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const dashboard = dashboards.dashboards[0];
  dashboard.tabs[0].gridItems = [
    mapGridItem({
      id: 1,
      uuid: "seeded-map",
      i: "1",
      mapExtent: {
        extent: "-10686671.12,4721671.57,4.5",
        viewGroup: "Basin",
        isGroupInitialExtent: true,
      },
    }),
    mapGridItem({
      id: 2,
      uuid: "unflagged-map",
      i: "2",
      mapExtent: { extent: "1,2,3,4", viewGroup: "Rainfall" },
    }),
  ];

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/dashboard/user/editable"]}>
          <LayoutAlertContextProvider>
            <DashboardHeader />
          </LayoutAlertContextProvider>
        </MemoryRouter>
      ),
      options: {
        user: { isAuthenticated: true, isStaff: false },
        dashboards,
      },
    }),
  );

  await userEvent.click(await screen.findByLabelText("editButton"));
  await userEvent.click(
    await screen.findByLabelText("importDashboardItemButton"),
  );

  // Only a group with a flagged member is claimed. "Rainfall" has a member but
  // no seed, so an imported flag for it must still be allowed to survive.
  await waitFor(() => {
    expect(screen.getByTestId("import-modal-props")).toHaveTextContent(
      JSON.stringify(["Basin"]),
    );
  });
});
