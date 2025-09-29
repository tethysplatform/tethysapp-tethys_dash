import PermissionsModal from "components/modals/Permissions";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { userDashboard, adminDashboard } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import userEvent from "@testing-library/user-event";
import appAPI from "services/api/app";

test("Permissions Modal", async () => {
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={mockSetShowModal}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  expect(await screen.findByText("Manage Permissions")).toBeInTheDocument();

  expect(screen.getByLabelText("Username Input")).toBeInTheDocument();
  const toggle = screen.getByRole("button", { name: /add/i });
  await userEvent.click(toggle);

  expect(screen.getByRole("button", { name: /user/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /group/i })).toBeInTheDocument();

  expect(screen.getByRole("table")).toBeInTheDocument();
  const rows = screen.getAllByRole("row");
  expect(rows.length).toBe(2);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  const permissionLevelInput = within(rows[1].cells[1]).queryByRole("combobox");
  expect(permissionLevelInput).not.toBeInTheDocument();
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  expect(screen.getByText("URL")).toBeInTheDocument();
  expect(screen.getByLabelText("Copy Clipboard Button")).toBeInTheDocument();
  expect(
    screen.getByText(
      `http://api.test/apps/tethysdash/dashboard/${userDashboard.uuid}`
    )
  ).toBeInTheDocument();

  const closeModalButton = screen.getByLabelText("Close Modal Button");
  expect(closeModalButton).toBeInTheDocument();
  expect(screen.getByLabelText("Save Permissions Button")).toBeInTheDocument();

  fireEvent.click(closeModalButton);
  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});

test("Permissions Modal add user and update", async () => {
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const newPermissions = [
    { username: "admin", permission: "admin" },
    { username: "newuser", permission: "editor" },
  ];
  updatedDashboard.permissions = newPermissions;

  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  let rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(2);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  const usernameInput = screen.getByLabelText("Username Input");
  fireEvent.change(usernameInput, { target: { value: "newuser" } });

  const toggle = screen.getByRole("button", { name: /add/i });
  await userEvent.click(toggle);

  const userItem = screen.getByRole("button", { name: /user/i });
  await userEvent.click(userItem);

  rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(3);
  expect(rows[2].cells[0]).toHaveTextContent("newuser");
  const permissionLevelDropdown = screen.getByLabelText(
    "Permission level for newuser user"
  );
  expect(permissionLevelDropdown.value).toBe("viewer");

  await userEvent.selectOptions(permissionLevelDropdown, "Editor");
  expect(permissionLevelDropdown.value).toBe("editor");

  const saveButton = screen.getByLabelText("Save Permissions Button");
  fireEvent.click(saveButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: userDashboard.id,
      permissions: newPermissions,
      public: userDashboard.publicDashboard,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(
    await screen.findByText("Successfully updated dashboard settings")
  ).toBeInTheDocument();

  const closeAlert = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlert);

  expect(
    screen.queryByText("Successfully updated dashboard settings")
  ).not.toBeInTheDocument();
});

test("Permissions Modal add group and update", async () => {
  const updatedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const newPermissions = [
    { username: "admin", permission: "admin" },
    { group: "newgroup", permission: "editor" },
  ];
  updatedDashboard.permissions = newPermissions;

  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  let rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(2);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  const usernameInput = screen.getByLabelText("Username Input");
  fireEvent.change(usernameInput, { target: { value: "newgroup" } });

  const toggle = screen.getByRole("button", { name: /add/i });
  await userEvent.click(toggle);

  const groupItem = screen.getByRole("button", { name: /group/i });
  await userEvent.click(groupItem);

  rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(3);
  expect(rows[2].cells[0]).toHaveTextContent("newgroup");
  const permissionLevelDropdown = screen.getByLabelText(
    "Permission level for newgroup group"
  );
  expect(permissionLevelDropdown.value).toBe("viewer");

  await userEvent.selectOptions(permissionLevelDropdown, "Editor");
  expect(permissionLevelDropdown.value).toBe("editor");

  const saveButton = screen.getByLabelText("Save Permissions Button");
  fireEvent.click(saveButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: userDashboard.id,
      permissions: newPermissions,
      public: userDashboard.publicDashboard,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );

  expect(
    await screen.findByText("Successfully updated dashboard settings")
  ).toBeInTheDocument();

  const closeAlert = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlert);

  expect(
    screen.queryByText("Successfully updated dashboard settings")
  ).not.toBeInTheDocument();
});

test("Permissions Modal add user but empty", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  let rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(2);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  const usernameInput = screen.getByLabelText("Username Input");
  fireEvent.change(usernameInput, { target: { value: "" } });

  const toggle = screen.getByRole("button", { name: /add/i });
  await userEvent.click(toggle);

  const userItem = screen.getByRole("button", { name: /user/i });
  await userEvent.click(userItem);

  expect(
    await screen.findByText("Username cannot be empty.")
  ).toBeInTheDocument();
});

test("Permissions Modal, add user but already exists", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={adminDashboard.uuid}
          publicDashboard={adminDashboard.publicDashboard}
          userPermission={adminDashboard.userPermission}
          permissions={adminDashboard.permissions}
          id={adminDashboard.id}
          owner={adminDashboard.owner}
        />
      ),
      options: {
        initialDashboard: adminDashboard,
        user: { username: "admin" },
      },
    })
  );

  let rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(3);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  expect(rows[2].cells[0]).toHaveTextContent("jsmith");
  expect(rows[2].cells[1]).toHaveTextContent("User");
  expect(rows[2].cells[2]).toHaveTextContent("Admin");

  expect(
    screen.getByLabelText("Permission level for jsmith user")
  ).toBeInTheDocument();

  const usernameInput = screen.getByLabelText("Username Input");
  fireEvent.change(usernameInput, { target: { value: "jsmith" } });

  const toggle = screen.getByRole("button", { name: /add/i });
  await userEvent.click(toggle);

  const userItem = screen.getAllByRole("button", { name: /user/i });
  await userEvent.click(userItem[0]);

  expect(
    await screen.findByText("This user is already in the list.")
  ).toBeInTheDocument();

  const closeAlert = await screen.findByLabelText("Close alert");
  fireEvent.click(closeAlert);

  expect(
    screen.queryByText("This user is already in the list.")
  ).not.toBeInTheDocument();
});

test("Permissions Modal, delete user", async () => {
  const updatedDashboard = JSON.parse(JSON.stringify(adminDashboard));
  const newPermissions = [{ username: "admin", permission: "admin" }];
  updatedDashboard.permissions = newPermissions;

  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: true,
    updated_dashboard: updatedDashboard,
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={adminDashboard.uuid}
          publicDashboard={adminDashboard.publicDashboard}
          userPermission={adminDashboard.userPermission}
          permissions={adminDashboard.permissions}
          id={adminDashboard.id}
          owner={adminDashboard.owner}
        />
      ),
      options: {
        initialDashboard: adminDashboard,
        user: { username: "admin" },
      },
    })
  );

  let rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(3);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  expect(rows[2].cells[0]).toHaveTextContent("jsmith");
  expect(rows[2].cells[1]).toHaveTextContent("User");
  expect(rows[2].cells[2]).toHaveTextContent("Admin");

  const deleteButton = screen.getByLabelText(
    "Delete permission for jsmith user"
  );
  await userEvent.click(deleteButton);

  rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(2);

  const saveButton = screen.getByLabelText("Save Permissions Button");
  fireEvent.click(saveButton);

  expect(mockUpdateDashboard).toHaveBeenCalledWith(
    {
      id: adminDashboard.id,
      permissions: newPermissions,
      public: adminDashboard.publicDashboard,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy"
  );
});

test("Permissions Modal, admin permission, not owner", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={adminDashboard.uuid}
          publicDashboard={adminDashboard.publicDashboard}
          userPermission={adminDashboard.userPermission}
          permissions={adminDashboard.permissions}
          id={adminDashboard.id}
          owner={adminDashboard.owner}
        />
      ),
      options: {
        initialDashboard: adminDashboard,
        user: { username: "jsmith" },
      },
    })
  );

  let rows = await screen.findAllByRole("row");
  expect(rows.length).toBe(3);
  expect(rows[1].cells[0]).toHaveTextContent("admin");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  expect(rows[2].cells[0]).toHaveTextContent("jsmith");
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[2].cells[2]).toHaveTextContent("Admin");

  const permissionDropdowns = screen.queryAllByRole("combobox");
  expect(permissionDropdowns).toHaveLength(0);
});

test("Permissions Modal, change public status", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  expect(await screen.findByText("Public")).toBeInTheDocument();
  expect(await screen.findByText("Private")).toBeInTheDocument();

  const publicRadioButton = screen.getByLabelText("Public");
  const privateRadioButton = screen.getByLabelText("Private");
  expect(publicRadioButton).toBeInTheDocument();
  expect(privateRadioButton).toBeInTheDocument();

  expect(publicRadioButton).not.toBeChecked();
  expect(privateRadioButton).toBeChecked();

  fireEvent.click(publicRadioButton);

  expect(publicRadioButton).toBeChecked();
  expect(privateRadioButton).not.toBeChecked();
  expect(await screen.findByText("URL")).toBeInTheDocument();
  expect(
    await screen.findByText(
      `http://api.test/apps/tethysdash/dashboard/${userDashboard.uuid}`
    )
  ).toBeInTheDocument();
});

test("Permissions Modal fail save, default message", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  const saveButton = await screen.findByLabelText("Save Permissions Button");
  fireEvent.click(saveButton);

  expect(
    await screen.findByText(
      "Failed to update dashboard settings. Check server logs."
    )
  ).toBeInTheDocument();
  expect(mockUpdateDashboard).toHaveBeenCalledTimes(1);
});

test("Permissions Modal fail save, custom message", async () => {
  const mockUpdateDashboard = jest.fn();
  mockUpdateDashboard.mockResolvedValue({
    success: false,
    message: "Custom error message",
  });

  jest.spyOn(appAPI, "updateDashboard").mockImplementation(mockUpdateDashboard);

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  const saveButton = await screen.findByLabelText("Save Permissions Button");
  fireEvent.click(saveButton);

  expect(await screen.findByText("Custom error message")).toBeInTheDocument();
  expect(mockUpdateDashboard).toHaveBeenCalledTimes(1);
});

test("Permissions Modal URL copy fail", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  const copyClipboardButton = await screen.findByLabelText(
    "Copy Clipboard Button"
  );
  await userEvent.hover(copyClipboardButton);

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Copy to clipboard");
  expect(copyClipboardButton).toBeInTheDocument();
  fireEvent.click(copyClipboardButton);
  await userEvent.hover(copyClipboardButton);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "Failed to Copy"
  );
});

test("Permissions Modal URL copy", async () => {
  const mockWriteText = jest.fn();
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
    },
  });

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
          uuid={userDashboard.uuid}
          publicDashboard={userDashboard.publicDashboard}
          userPermission={userDashboard.userPermission}
          permissions={userDashboard.permissions}
          id={userDashboard.id}
          owner={userDashboard.owner}
        />
      ),
    })
  );

  const copyClipboardButton = await screen.findByLabelText(
    "Copy Clipboard Button"
  );
  await userEvent.hover(copyClipboardButton);

  const tooltip = screen.getByRole("tooltip");
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent("Copy to clipboard");
  expect(copyClipboardButton).toBeInTheDocument();
  fireEvent.click(copyClipboardButton);
  expect(mockWriteText).toHaveBeenCalledWith(
    `http://api.test/apps/tethysdash/dashboard/${userDashboard.uuid}`
  );
  await userEvent.hover(copyClipboardButton);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Copied");
});

test("Permissions Modal group member access", async () => {
  const mockSetShowModal = jest.fn();
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  mockedDashboard.userPermission = "viewer";
  mockedDashboard.permissions = [
    { username: "admin", permission: "admin" },
    { group: "mixed group", permission: "viewer" },
  ];

  render(
    createLoadedComponent({
      children: (
        <PermissionsModal
          showModal={true}
          setShowModal={mockSetShowModal}
          uuid={mockedDashboard.uuid}
          publicDashboard={mockedDashboard.public}
          userPermission={mockedDashboard.userPermission}
          permissions={mockedDashboard.permissions}
          id={mockedDashboard.id}
          owner={mockedDashboard.owner}
        />
      ),
      options: {
        dashboards: { dashboards: [mockedDashboard] },
      },
    })
  );

  expect(await screen.findByText("Manage Permissions")).toBeInTheDocument();

  expect(screen.queryByLabelText("Username Input")).not.toBeInTheDocument();

  expect(screen.getByRole("table")).toBeInTheDocument();
  const rows = screen.getAllByRole("row");
  expect(rows.length).toBe(3); // header, admin, mixed group

  expect(rows[1].cells[0]).toHaveTextContent("admin");
  let permissionLevelInput = within(rows[1].cells[1]).queryByRole("combobox");
  expect(permissionLevelInput).not.toBeInTheDocument();
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[1].cells[2]).toHaveTextContent("Owner");

  expect(rows[2].cells[0]).toHaveTextContent("mixed group (you)");
  permissionLevelInput = within(rows[2].cells[1]).queryByRole("combobox");
  expect(permissionLevelInput).not.toBeInTheDocument();
  expect(rows[1].cells[1]).toHaveTextContent("User");
  expect(rows[2].cells[2]).toHaveTextContent("Viewer");
});
