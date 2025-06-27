import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AvailableDashboardsContext } from "components/contexts/Contexts";
import DashboardCard, {
  NewDashboardCard,
} from "components/landingPage/DashboardCard";
import createLoadedComponent from "__tests__/utilities/customRender";
import { MemoryRouter } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import appAPI from "services/api/app";
import { confirm } from "components/inputs/DeleteConfirmation";
import AppTour from "components/appTour/AppTour";
import { mockedDashboards } from "__tests__/utilities/constants";
import * as utils from "components/visualizations/utilities";
import { useContext } from "react";
import PropTypes from "prop-types";

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: jest.fn(),
}));

jest.mock("components/inputs/DeleteConfirmation", () => {
  return {
    confirm: jest.fn(),
  };
});
const mockedConfirm = jest.mocked(confirm);

const TestingComponent = ({ children }) => {
  const { availableDashboards } = useContext(AvailableDashboardsContext);

  return (
    <>
      {children}
      <p data-testid="availableDashboards">
        {JSON.stringify(availableDashboards)}
      </p>
    </>
  );
};

test("DashboardCard editable, open and edit name", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard updated",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();

  const image = await screen.findByLabelText("Dashboard Card Image");
  expect(image.src).toBe("http://localhost/some_image.png");

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const openOption = await screen.findByText("Open");
  expect(openOption).toBeInTheDocument();
  const renameOption = await screen.findByText("Rename");
  expect(renameOption).toBeInTheDocument();
  expect(await screen.findByText("Update Description")).toBeInTheDocument();
  expect(await screen.findByText("Update Thumbnail")).toBeInTheDocument();
  expect(await screen.findByText("Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();
  expect(await screen.findByText("Share")).toBeInTheDocument();

  // open with context menu
  await userEvent.click(openOption);
  expect(navigateMock).toHaveBeenCalledWith("/dashboard/user/some dashboard");
  navigateMock.mockClear();
  expect(navigateMock).toHaveBeenCalledTimes(0);

  // open with double click
  const card = screen.getByLabelText("Dashboard Card");
  await userEvent.dblClick(card);
  expect(navigateMock).toHaveBeenCalledWith("/dashboard/user/some dashboard");
  navigateMock.mockClear();

  // make title an input for renaming
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();
  await userEvent.click(renameOption);
  const titleInput = await screen.findByLabelText("Title Input");
  expect(screen.queryByText("some dashboard")).not.toBeInTheDocument();

  // double click shouldnt work when editing
  await userEvent.dblClick(titleInput);
  expect(navigateMock).toHaveBeenCalledTimes(0);

  userEvent.type(titleInput, " updated{enter}");
  expect(await screen.findByText("some dashboard updated")).toBeInTheDocument();
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: 1,
      name: "some dashboard updated",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("DashboardCard editable, edit name with blur", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard updated",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();

  const image = await screen.findByLabelText("Dashboard Card Image");
  expect(image.src).toBe("http://localhost/some_image.png");

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const renameOption = await screen.findByText("Rename");
  expect(renameOption).toBeInTheDocument();

  // make title an input for renaming
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();
  await userEvent.click(renameOption);
  const titleInput = await screen.findByLabelText("Title Input");

  await userEvent.click(titleInput);
  await userEvent.type(titleInput, " updated");
  titleInput.blur();

  expect(await screen.findByText("some dashboard updated")).toBeInTheDocument();
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: 1,
      name: "some dashboard updated",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("DashboardCard editable, edit name but cancel", async () => {
  const mockUpdateDashboard = jest.fn();
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();

  const image = await screen.findByLabelText("Dashboard Card Image");
  expect(image.src).toBe("http://localhost/some_image.png");

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const renameOption = await screen.findByText("Rename");
  expect(renameOption).toBeInTheDocument();

  // make title an input for renaming
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();
  await userEvent.click(renameOption);
  const titleInput = await screen.findByLabelText("Title Input");
  expect(screen.queryByText("some dashboard")).not.toBeInTheDocument();

  userEvent.type(titleInput, " updated{Escape}");

  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();

  expect(mockUpdateDashboard).toHaveBeenCalledTimes(0);
});

test("DashboardCard editable, edit name and no change", async () => {
  const mockUpdateDashboard = jest.fn();
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();

  const image = await screen.findByLabelText("Dashboard Card Image");
  expect(image.src).toBe("http://localhost/some_image.png");

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const renameOption = await screen.findByText("Rename");
  expect(renameOption).toBeInTheDocument();

  // make title an input for renaming
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();
  await userEvent.click(renameOption);
  const titleInput = await screen.findByLabelText("Title Input");
  expect(screen.queryByText("some dashboard")).not.toBeInTheDocument();

  userEvent.type(titleInput, "{enter}");
  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(screen.queryByLabelText("Title Input")).not.toBeInTheDocument();

  expect(mockUpdateDashboard).toHaveBeenCalledTimes(0);
});

test("DashboardCard not editable, open", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={false}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some dashboard")).toBeInTheDocument();
  expect(screen.queryByLabelText("Owner Icon")).not.toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const openOption = await screen.findByText("Open");
  expect(openOption).toBeInTheDocument();

  expect(screen.queryByText("Rename")).not.toBeInTheDocument();
  expect(screen.queryByText("Update Description")).not.toBeInTheDocument();
  expect(screen.queryByText("Update Thumbnail")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  expect(await screen.findByText("Copy")).toBeInTheDocument();
  expect(await screen.findByText("Share")).toBeInTheDocument();

  // open with context menu
  await userEvent.click(openOption);
  expect(navigateMock).toHaveBeenCalledWith("/dashboard/public/some dashboard");
  navigateMock.mockClear();
  expect(navigateMock).toHaveBeenCalledTimes(0);

  // open with double click
  const card = screen.getByLabelText("Dashboard Card");
  await userEvent.dblClick(card);
  expect(navigateMock).toHaveBeenCalledWith("/dashboard/public/some dashboard");
});

test("DashboardCard editable, dont open in app tour", async () => {
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <AppTour />
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={[]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
      options: { inAppTour: true, appTourStep: 3 },
    })
  );

  // open with double click doesnt work in app tour mode
  const card = await screen.findByLabelText("Dashboard Card");
  await userEvent.dblClick(card);
  expect(navigateMock).toHaveBeenCalledTimes(0);
});

test("DashboardCard editable, edit description", async () => {
  const mockUpdateDashboard = jest.fn();
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description updated",
      accessGroups: ["public"],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some description")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();

  // make description an input for updating
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  const descriptionInput = await screen.findByLabelText("Description Input");

  // double click shouldnt work when editing
  await userEvent.dblClick(descriptionInput);
  expect(navigateMock).toHaveBeenCalledTimes(0);

  userEvent.type(descriptionInput, " updated{enter}");
  expect(
    await screen.findByText("some description updated")
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Description Input")
    ).not.toBeInTheDocument();
  });

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: 1,
      description: "some description updated",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("DashboardCard editable, edit description with blur", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description updated",
      accessGroups: ["public"],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some description")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();

  // make description an input for updating
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  const descriptionInput = await screen.findByLabelText("Description Input");

  await userEvent.click(descriptionInput);
  await userEvent.type(descriptionInput, " updated");
  descriptionInput.blur();

  expect(
    await screen.findByText("some description updated")
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Description Input")
    ).not.toBeInTheDocument();
  });

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: 1,
      description: "some description updated",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("DashboardCard editable, edit description new line", async () => {
  const mockUpdateDashboard = jest.fn();
  const navigateMock = jest.fn();
  useNavigate.mockReturnValue(navigateMock);

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description updated",
      accessGroups: ["public"],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some description")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();

  // make description an input for updating
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  const descriptionInput = await screen.findByLabelText("Description Input");

  // double click shouldnt work when editing
  await userEvent.dblClick(descriptionInput);
  expect(navigateMock).toHaveBeenCalledTimes(0);

  userEvent.type(
    descriptionInput,
    " updated{Shift>}{enter}{/Shift}Another Line{enter}"
  );
  expect(
    await screen.findByText("some description updated")
  ).toBeInTheDocument();
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Description Input")
    ).not.toBeInTheDocument();
  });

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: 1,
      description: "some description updated\nAnother Line",
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("DashboardCard editable, edit description but cancel", async () => {
  const mockUpdateDashboard = jest.fn();
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some description")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();

  // make description an input for updating
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  const descriptionInput = await screen.findByLabelText("Description Input");

  userEvent.type(descriptionInput, " updated{Escape}");
  await waitFor(() => {
    expect(
      screen.queryByLabelText("Description Input")
    ).not.toBeInTheDocument();
  });
  expect(await screen.findByText("some description")).toBeInTheDocument();

  expect(mockUpdateDashboard).toHaveBeenCalledTimes(0);
});

test("DashboardCard editable, edit description fail", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some description")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();

  // make description an input for updating
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  const descriptionInput = await screen.findByLabelText("Description Input");
  expect(descriptionInput).toBeInTheDocument();

  userEvent.type(descriptionInput, " updated{enter}");
  expect(
    await screen.findByText("some description updated")
  ).toBeInTheDocument();
  expect(descriptionInput).toBeInTheDocument();

  await waitFor(() => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        description: "some description updated",
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(
    await screen.findByText("Failed to update dashboard")
  ).toBeInTheDocument();

  const closeAlert = screen.getByLabelText("Close alert");
  fireEvent.click(closeAlert);

  expect(
    screen.queryByText("Failed to update dashboard")
  ).not.toBeInTheDocument();
});

test("DashboardCard editable, edit description fail with message", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
    message: "some failure message",
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("some description")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateDescriptionOption = await screen.findByText("Update Description");
  expect(updateDescriptionOption).toBeInTheDocument();

  // make description an input for updating
  expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
  await userEvent.click(updateDescriptionOption);
  const descriptionInput = await screen.findByLabelText("Description Input");
  expect(descriptionInput).toBeInTheDocument();

  userEvent.type(descriptionInput, " updated{enter}");
  expect(
    await screen.findByText("some description updated")
  ).toBeInTheDocument();
  expect(descriptionInput).toBeInTheDocument();

  await waitFor(() => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        description: "some description updated",
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(await screen.findByText("some failure message")).toBeInTheDocument();
});

test("DashboardCard editable, edit thumbnail and cancel", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image_updated.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  global.FileReader = class {
    readAsDataURL() {
      this.onloadend();
    }
    onloadend = jest.fn();
    result = "data:image/png;base64,testImage"; // Mocked image data URL
  };

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateThumbnailOption = await screen.findByText("Update Thumbnail");
  expect(updateThumbnailOption).toBeInTheDocument();

  await userEvent.click(updateThumbnailOption);
  expect(
    await screen.findByText("Update Dashboard Thumbnail")
  ).toBeInTheDocument();
  const updateThumbnailButton = screen.getByLabelText(
    "Update Thumbnail Button"
  );
  await userEvent.click(updateThumbnailButton);

  expect(mockUpdateDashboard).toHaveBeenCalledTimes(0);
});

test("DashboardCard editable, edit thumbnail", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image_updated.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  global.FileReader = class {
    readAsDataURL() {
      this.onloadend();
    }
    onloadend = jest.fn();
    result = "data:image/png;base64,testImage"; // Mocked image data URL
  };

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateThumbnailOption = await screen.findByText("Update Thumbnail");
  expect(updateThumbnailOption).toBeInTheDocument();

  await userEvent.click(updateThumbnailOption);
  expect(
    await screen.findByText("Update Dashboard Thumbnail")
  ).toBeInTheDocument();
  const updateThumbnailButton = screen.getByLabelText(
    "Update Thumbnail Button"
  );

  const file = new File(["dummy content"], "test-image.png", {
    type: "image/png",
  });
  const input = screen.getByTestId("file-input");
  await userEvent.upload(input, file);

  await waitFor(() => {
    expect(screen.getByAltText("Uploaded")).toBeInTheDocument();
  });
  await userEvent.click(updateThumbnailButton);

  await waitFor(async () => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        image: "data:image/png;base64,testImage",
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
});

test("DashboardCard editable, edit thumbnail fail", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  global.FileReader = class {
    readAsDataURL() {
      this.onloadend();
    }
    onloadend = jest.fn();
    result = "data:image/png;base64,testImage"; // Mocked image data URL
  };

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const updateThumbnailOption = await screen.findByText("Update Thumbnail");
  expect(updateThumbnailOption).toBeInTheDocument();

  await userEvent.click(updateThumbnailOption);
  expect(
    await screen.findByText("Update Dashboard Thumbnail")
  ).toBeInTheDocument();
  const updateThumbnailButton = screen.getByLabelText(
    "Update Thumbnail Button"
  );

  const file = new File(["dummy content"], "test-image.png", {
    type: "image/png",
  });
  const input = screen.getByTestId("file-input");
  await userEvent.upload(input, file);

  await waitFor(() => {
    expect(screen.getByAltText("Uploaded")).toBeInTheDocument();
  });
  await userEvent.click(updateThumbnailButton);

  await waitFor(async () => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        image: "data:image/png;base64,testImage",
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(
    await screen.findByText("Failed to update dashboard")
  ).toBeInTheDocument();
});

test("DashboardCard editable, copy", async () => {
  const mockCopyDashboard = jest.fn();

  mockCopyDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "some dashboard_Copy",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image_updated.png",
    },
  });
  appAPI.copyDashboard = mockCopyDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name={mockedDashboards.user[0].name}
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();

  await userEvent.click(copyOption);

  await waitFor(async () => {
    expect(mockCopyDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        newName: `${mockedDashboards.user[0].name} - Copy`,
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
});

test("DashboardCard editable, copy (2)", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = JSON.parse(
    JSON.stringify(updatedMockedDashboards.user[0])
  );
  updatedMockedDashboards.user.unshift(mockedDashboard);
  updatedMockedDashboards.user[1].name = `${mockedDashboard.name} - Copy`;
  const mockCopyDashboard = jest.fn();

  mockCopyDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "some dashboard_Copy",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image_updated.png",
    },
  });
  appAPI.copyDashboard = mockCopyDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name={mockedDashboards.user[0].name}
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
      },
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();

  await userEvent.click(copyOption);

  await waitFor(async () => {
    expect(mockCopyDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        newName: `${mockedDashboards.user[0].name} - Copy (2)`,
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
});

test("DashboardCard editable, copy fail", async () => {
  const mockCopyDashboard = jest.fn();
  mockCopyDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.copyDashboard = mockCopyDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name={mockedDashboards.user[0].name}
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const copyOption = await screen.findByText("Copy");
  expect(copyOption).toBeInTheDocument();

  await userEvent.click(copyOption);

  await waitFor(async () => {
    expect(mockCopyDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        newName: `${mockedDashboards.user[0].name} - Copy`,
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(
    await screen.findByText("Failed to copy dashboard")
  ).toBeInTheDocument();
});

test("DashboardCard editable, export", async () => {
  const spyDownloadJSONFile = jest
    .spyOn(utils, "downloadJSONFile")
    .mockImplementation(jest.fn());

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name={mockedDashboards.user[0].name}
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const exportOption = await screen.findByText("Export");
  expect(exportOption).toBeInTheDocument();

  await userEvent.click(exportOption);

  expect(spyDownloadJSONFile).toHaveBeenCalledWith(
    {
      accessGroups: [],
      description: "test_description",
      gridItems: [
        {
          args_string: {},
          h: 20,
          i: "1",
          metadata_string: {
            refreshRate: 0,
          },
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      image: "my_image.png",
      name: "editable",
      notes: "test_notes",
      unrestrictedPlacement: false,
    },
    "editable.json"
  );
});

test("DashboardCard editable, export fail to get dashboard", async () => {
  jest
    .spyOn(appAPI, "getDashboard")
    .mockResolvedValueOnce({
      success: true,
      dashboard: mockedDashboards.user[0],
    })
    .mockResolvedValueOnce({
      success: false,
      message: "Failed to get dashboard",
    });

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name={mockedDashboards.user[0].name}
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const exportOption = await screen.findByText("Export");
  expect(exportOption).toBeInTheDocument();

  await userEvent.click(exportOption);

  expect(
    await screen.findByText("Failed to get dashboard")
  ).toBeInTheDocument();
});

test("DashboardCard editable, export fail", async () => {
  const spyDownloadJSONFile = jest
    .spyOn(utils, "downloadJSONFile")
    .mockImplementation(() => {
      throw new Error();
    });

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name={mockedDashboards.user[0].name}
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const exportOption = await screen.findByText("Export");
  expect(exportOption).toBeInTheDocument();

  await userEvent.click(exportOption);

  expect(spyDownloadJSONFile).toHaveBeenCalledWith(
    {
      accessGroups: [],
      description: "test_description",
      gridItems: [
        {
          args_string: {},
          h: 20,
          i: "1",
          metadata_string: {
            refreshRate: 0,
          },
          source: "",
          w: 20,
          x: 0,
          y: 0,
        },
      ],
      image: "my_image.png",
      name: "editable",
      notes: "test_notes",
      unrestrictedPlacement: false,
    },
    "editable.json"
  );

  expect(
    await screen.findByText("Failed to export dashboard")
  ).toBeInTheDocument();
});

test("DashboardCard editable, share", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description",
      accessGroups: ["public"],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={[]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(screen.queryByLabelText("Public Icon")).not.toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  fireEvent.mouseEnter(shareOption);

  const makePublicOption = await screen.findByText("Make Public");
  expect(makePublicOption).toBeInTheDocument();
  await userEvent.click(makePublicOption);

  await waitFor(async () => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        accessGroups: ["public"],
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();
});

test("DashboardCard editable, make private", async () => {
  const mockUpdateDashboard = jest.fn();

  mockUpdateDashboard.mockResolvedValue({
    success: true,
    new_dashboard: {
      id: 1,
      name: "some dashboard",
      description: "some description",
      accessGroups: [],
      image: "some_image.png",
    },
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(await screen.findByLabelText("Public Icon")).toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  fireEvent.mouseEnter(shareOption);

  const makePublicOption = await screen.findByText("Make Private");
  expect(makePublicOption).toBeInTheDocument();
  await userEvent.click(makePublicOption);

  await waitFor(async () => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        accessGroups: [],
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(screen.queryByLabelText("Public Icon")).not.toBeInTheDocument();
});

test("DashboardCard editable, share fail", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={[]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(screen.queryByLabelText("Public Icon")).not.toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  fireEvent.mouseEnter(shareOption);

  const makePublicOption = await screen.findByText("Make Public");
  expect(makePublicOption).toBeInTheDocument();
  await userEvent.click(makePublicOption);

  await waitFor(async () => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        accessGroups: ["public"],
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(screen.queryByLabelText("Public Icon")).not.toBeInTheDocument();

  expect(
    await screen.findByText("Failed to share dashboard")
  ).toBeInTheDocument();
});

test("DashboardCard editable, share fail with message", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
    message: "some failure message",
  });
  appAPI.updateDashboard = mockUpdateDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={[]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(screen.queryByLabelText("Public Icon")).not.toBeInTheDocument();

  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  fireEvent.mouseEnter(shareOption);

  const makePublicOption = await screen.findByText("Make Public");
  expect(makePublicOption).toBeInTheDocument();
  await userEvent.click(makePublicOption);

  await waitFor(async () => {
    expect(mockUpdateDashboard).toHaveBeenCalledWith(
      {
        id: 1,
        accessGroups: ["public"],
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });
  expect(await screen.findByLabelText("Owner Icon")).toBeInTheDocument();
  expect(screen.queryByLabelText("Public Icon")).not.toBeInTheDocument();

  expect(await screen.findByText("some failure message")).toBeInTheDocument();
});

test("DashboardCard editable, copy public link fail", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  fireEvent.mouseEnter(shareOption);

  const copyPublicURLOption = await screen.findByText("Copy Public URL");
  expect(copyPublicURLOption).toBeInTheDocument();
  await userEvent.click(copyPublicURLOption);

  expect(
    await screen.findByText("Failed to copy public link")
  ).toBeInTheDocument();
});

test("DashboardCard editable, copy public link", async () => {
  const mockWriteText = jest.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
    },
  });

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={["public"]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const shareOption = await screen.findByText("Share");
  expect(shareOption).toBeInTheDocument();
  fireEvent.mouseEnter(shareOption);

  const copyPublicURLOption = await screen.findByText("Copy Public URL");
  expect(copyPublicURLOption).toBeInTheDocument();
  await userEvent.click(copyPublicURLOption);

  expect(mockWriteText).toHaveBeenCalledWith(
    "http://api.test/apps/tethysdash/dashboard/public/some%20dashboard"
  );
});

test("DashboardCard editable, delete and confirm", async () => {
  const updatedMockedDashboards = JSON.parse(JSON.stringify(mockedDashboards));
  const mockedDashboard = JSON.parse(
    JSON.stringify(updatedMockedDashboards.user[0])
  );
  updatedMockedDashboards.user.unshift(mockedDashboard);
  updatedMockedDashboards.user[1].name = `${mockedDashboard.name} - Copy`;
  updatedMockedDashboards.user[1].id = 2;

  const mockDeleteDashboard = jest.fn();
  mockedConfirm.mockResolvedValueOnce(true);

  mockDeleteDashboard.mockResolvedValue({
    success: true,
  });
  appAPI.deleteDashboard = mockDeleteDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <TestingComponent>
            <DashboardCard
              id={2}
              name="some dashboard"
              editable={true}
              description="some description"
              accessGroups={[]}
              image="some_image.png"
            />
          </TestingComponent>
        </MemoryRouter>
      ),
      options: {
        dashboards: updatedMockedDashboards,
        initialDashboard: mockedDashboard,
      },
    })
  );
  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const deleteOption = await screen.findByText("Delete");
  expect(deleteOption).toBeInTheDocument();
  await userEvent.click(deleteOption);

  await waitFor(async () => {
    expect(mockDeleteDashboard).toHaveBeenCalledWith(
      {
        id: 2,
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(await screen.findByTestId("availableDashboards")).toHaveTextContent(
    JSON.stringify({
      user: [mockedDashboard],
      public: [
        {
          id: 2,
          uuid: "acde070d-8c4c-4f0d-9d8a-162843c10333",
          name: "noneditable",
          description: "test_description2",
          accessGroups: ["public"],
          image: "public_image.png",
          notes: "test_notes2",
          gridItems: [
            {
              i: "1",
              x: 0,
              y: 0,
              w: 20,
              h: 20,
              source: "",
              args_string: "{}",
              metadata_string: '{"refreshRate":0}',
            },
          ],
        },
      ],
    })
  );
});

test("DashboardCard editable, delete and not confirm", async () => {
  const mockDeleteDashboard = jest.fn();
  mockedConfirm.mockResolvedValueOnce(false);
  appAPI.deleteDashboard = mockDeleteDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={[]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const deleteOption = await screen.findByText("Delete");
  expect(deleteOption).toBeInTheDocument();
  await userEvent.click(deleteOption);
  expect(mockDeleteDashboard).toHaveBeenCalledTimes(0);
});

test("DashboardCard editable, delete and fail", async () => {
  const mockDeleteDashboard = jest.fn();
  mockDeleteDashboard.mockResolvedValue({ success: false });
  mockedConfirm.mockResolvedValueOnce(true);
  appAPI.deleteDashboard = mockDeleteDashboard;

  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <DashboardCard
            id={1}
            name="some dashboard"
            editable={true}
            description="some description"
            accessGroups={[]}
            image="some_image.png"
          />
        </MemoryRouter>
      ),
    })
  );
  const contextMenuButton = await screen.findByLabelText(
    "dashboard-item-dropdown-toggle"
  );
  await userEvent.click(contextMenuButton);

  const deleteOption = await screen.findByText("Delete");
  expect(deleteOption).toBeInTheDocument();
  await userEvent.click(deleteOption);

  await waitFor(async () => {
    expect(mockDeleteDashboard).toHaveBeenCalledWith(
      {
        id: 1,
      },
      "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
    );
  });

  expect(
    await screen.findByText("Failed to delete dashboard")
  ).toBeInTheDocument();
});

test("NewDashboardCard", async () => {
  render(
    createLoadedComponent({
      children: (
        <MemoryRouter initialEntries={["/"]}>
          <NewDashboardCard />
        </MemoryRouter>
      ),
    })
  );

  expect(await screen.findByText("Create a New Dashboard")).toBeInTheDocument();

  const card = screen.getByLabelText("Create New Card");
  fireEvent.mouseOver(card);
  expect(card).toHaveStyle("cursor: pointer");
  fireEvent.mouseOut(card);
  expect(card).toHaveStyle("cursor: default");
  fireEvent.click(card);

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Create a new dashboard")).toBeInTheDocument();
});

TestingComponent.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.element),
    PropTypes.element,
  ]),
};
