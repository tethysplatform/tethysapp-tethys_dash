import {
  PermissionGroupsSummaryModal,
  PermissionGroupsManageModal,
} from "components/modals/PermissionGroups";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { permissionGroups } from "__tests__/utilities/constants";
import createLoadedComponent from "__tests__/utilities/customRender";
import userEvent from "@testing-library/user-event";
import appAPI from "services/api/app";

test("Permission Groups Summary Modal", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();
  expect(screen.getByText("Existing Groups")).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();

  const userRows = await screen.findAllByRole("row");
  expect(userRows).toHaveLength(permissionGroups.length + 1); // Header row + 2 user rows

  expect(userRows[0].cells[0]).toHaveTextContent("Name");
  expect(userRows[0].cells[1]).toHaveTextContent("Description");
  expect(userRows[0].cells[2]).toHaveTextContent("Permission Level");

  // admin group 1
  expect(userRows[1].cells[0]).toHaveTextContent(permissionGroups[0].name);
  expect(userRows[1].cells[1]).toHaveTextContent(
    permissionGroups[0].description,
  );
  expect(userRows[1].cells[2]).toHaveTextContent(
    permissionGroups[0].user_permission,
  );
  expect(
    screen.getByLabelText(`Edit group ${permissionGroups[0].name}`),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText(`Delete group ${permissionGroups[0].name}`),
  ).toBeInTheDocument();

  // admin group 2
  expect(userRows[2].cells[0]).toHaveTextContent(permissionGroups[1].name);
  expect(userRows[2].cells[1]).toHaveTextContent(
    permissionGroups[1].description,
  );
  expect(userRows[2].cells[2]).toHaveTextContent(
    permissionGroups[1].user_permission,
  );
  expect(
    screen.getByLabelText(`Edit group ${permissionGroups[1].name}`),
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText(`Delete group ${permissionGroups[1].name}`),
  ).toBeInTheDocument();

  // viewer group
  expect(userRows[3].cells[0]).toHaveTextContent(permissionGroups[2].name);
  expect(userRows[3].cells[1]).toHaveTextContent(
    permissionGroups[2].description,
  );
  expect(userRows[3].cells[2]).toHaveTextContent(
    permissionGroups[2].user_permission,
  );
  expect(
    screen.queryByLabelText(`Edit group ${permissionGroups[2].name}`),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText(`Delete group ${permissionGroups[2].name}`),
  ).not.toBeInTheDocument();
  expect(
    screen.getByLabelText(`View group ${permissionGroups[2].name}`),
  ).toBeInTheDocument();
});

test("Permission Groups, delete success", async () => {
  const mockDeletePermissionGroup = jest.fn();
  mockDeletePermissionGroup.mockResolvedValue({
    success: true,
  });
  jest
    .spyOn(appAPI, "deletePermissionGroup")
    .mockImplementation(mockDeletePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();

  const deleteGroupButton = screen.getByLabelText(
    `Delete group ${permissionGroups[0].name}`,
  );
  await userEvent.click(deleteGroupButton);

  const successMessage = `Permission group "${permissionGroups[0].name}" deleted successfully.`;
  expect(await screen.findByText(successMessage)).toBeInTheDocument();

  const closeAlertButton = screen.getByLabelText("Close alert");
  await userEvent.click(closeAlertButton);

  expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
});

test("Permission Groups, delete fail", async () => {
  const mockDeletePermissionGroup = jest.fn();
  mockDeletePermissionGroup.mockResolvedValue({
    success: false,
    message: "Failed to delete permission group.",
  });
  jest
    .spyOn(appAPI, "deletePermissionGroup")
    .mockImplementation(mockDeletePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();

  const deleteGroupButton = screen.getByLabelText(
    `Delete group ${permissionGroups[0].name}`,
  );
  await userEvent.click(deleteGroupButton);

  const failMessage = "Failed to delete permission group.";
  expect(await screen.findByText(failMessage)).toBeInTheDocument();

  const closeAlertButton = screen.getByLabelText("Close alert");
  await userEvent.click(closeAlertButton);

  expect(screen.queryByText(failMessage)).not.toBeInTheDocument();
});

test("Permission Groups, create", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();
  const createGroupButton = screen.getByLabelText(
    "Create new permission group",
  );
  await userEvent.click(createGroupButton);

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();
  const nameInput = screen.getByLabelText("Name Input");
  expect(nameInput.value).toBe("");
});

test("Permission Groups, edit", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();
  const editGroupButton = screen.getByLabelText(
    `Edit group ${permissionGroups[0].name}`,
  );
  await userEvent.click(editGroupButton);

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();
  const nameInput = screen.getByLabelText("Name Input");
  expect(nameInput.value).toBe(permissionGroups[0].name);
});

test("Permission Groups, close", async () => {
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={mockSetShowModal}
        />
      ),
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();
  const closeButton = screen.getByLabelText("Close");
  await userEvent.click(closeButton);

  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});

test("Permission Groups, no groups", async () => {
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsSummaryModal
          showModal={true}
          setShowModal={mockSetShowModal}
        />
      ),
      options: {
        permissionGroups: [],
      },
    }),
  );

  expect(await screen.findByText("Permission Groups")).toBeInTheDocument();

  expect(screen.getByText("No groups found.")).toBeInTheDocument();
});

test("Permission Groups Manage Modal, new Group and save New User", async () => {
  const mockSetShowModal = jest.fn();
  const mockSetSuccessMessage = jest.fn();
  const mockUpdatePermissionGroup = jest.fn();
  const expectedPermissionGroup = {
    name: "New Group",
    description: "New Description",
    members: [
      { username: "jsmith", permission: "admin" },
      { username: "newuser", permission: "admin" },
    ],
  };
  mockUpdatePermissionGroup.mockResolvedValue({
    success: true,
    updated_permission_group: {
      ...expectedPermissionGroup,
      owner: "jsmith",
      id: 1,
    },
  });
  jest
    .spyOn(appAPI, "updatePermissionGroup")
    .mockImplementation(mockUpdatePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={mockSetShowModal}
          selectedGroup={null}
          setSuccessMessage={mockSetSuccessMessage}
        />
      ),
      options: { user: { username: "jsmith" } },
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const nameInput = screen.getByLabelText("Name Input");
  expect(nameInput.value).toBe("");
  fireEvent.change(nameInput, { target: { value: "New Group" } });

  const descriptionInput = screen.getByLabelText("Description Input");
  expect(descriptionInput.value).toBe("");
  fireEvent.change(descriptionInput, { target: { value: "New Description" } });

  const usernameInput = screen.getByLabelText("Username Input");
  const userButton = screen.getByLabelText("Add User Button");
  expect(usernameInput.value).toBe("");

  // check user table
  let userRows = await screen.findAllByRole("row");
  expect(userRows).toHaveLength(2); // Header row + creating user

  expect(userRows[0].cells[0]).toHaveTextContent("Username");
  expect(userRows[0].cells[1]).toHaveTextContent("Permission Level");
  expect(userRows[1].cells[0]).toHaveTextContent("jsmith (you)");
  expect(userRows[1].cells[1]).toHaveTextContent("Owner");

  expect(screen.queryByLabelText("Delete Group")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Save Group")).not.toBeInTheDocument();

  const createGroup = screen.getByLabelText("Create Group");
  expect(createGroup).toBeInTheDocument();

  fireEvent.change(usernameInput, { target: { value: "newuser" } });
  expect(usernameInput.value).toBe("newuser");

  fireEvent.click(userButton);

  // check user table
  userRows = await screen.findAllByRole("row");
  expect(userRows).toHaveLength(3); // Header row + creating user + new user

  expect(userRows[2].cells[0]).toHaveTextContent("newuser");
  const newuserPermissinDropdown = within(userRows[2]).getByLabelText(
    "Permission level for newuser",
  );
  expect(newuserPermissinDropdown.value).toBe("member");
  fireEvent.change(newuserPermissinDropdown, { target: { value: "admin" } });

  await userEvent.click(createGroup);

  expect(mockUpdatePermissionGroup).toHaveBeenCalledWith(
    {
      ...expectedPermissionGroup,
      id: null,
    },
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy",
  );

  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    'Permission group "New Group" created successfully.',
  );
});

test("Permission Groups Manage, admin and edit group", async () => {
  const mockSetShowModal = jest.fn();
  const mockSetSuccessMessage = jest.fn();
  const mockUpdatePermissionGroup = jest.fn();
  const expectedPermissionGroup = JSON.parse(
    JSON.stringify(permissionGroups[1]),
  );
  expectedPermissionGroup.members = [
    {
      username: "jsmith",
      permission: "admin",
    },
  ];
  delete expectedPermissionGroup.owner;
  delete expectedPermissionGroup.user_permission;
  mockUpdatePermissionGroup.mockResolvedValue({
    success: true,
    updated_permission_group: expectedPermissionGroup,
  });
  jest
    .spyOn(appAPI, "updatePermissionGroup")
    .mockImplementation(mockUpdatePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={mockSetShowModal}
          selectedGroup={permissionGroups[1]}
          setSuccessMessage={mockSetSuccessMessage}
        />
      ),
      options: { user: { username: "jsmith" } },
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const nameInput = screen.getByLabelText("Name Input");
  expect(nameInput.value).toBe(permissionGroups[1].name);

  const descriptionInput = screen.getByLabelText("Description Input");
  expect(descriptionInput.value).toBe(permissionGroups[1].description);

  const saveChangesButton = screen.getByLabelText("Save Changes");
  expect(saveChangesButton).toBeInTheDocument();

  const deleteGroupButton = screen.getByLabelText("Delete Group");
  expect(deleteGroupButton).toBeInTheDocument();

  const deleteUserButton = screen.getByLabelText("Delete permission for admin");
  expect(deleteUserButton).toBeInTheDocument();

  await userEvent.click(deleteUserButton);
  await userEvent.click(saveChangesButton);

  expect(mockUpdatePermissionGroup).toHaveBeenCalledWith(
    expectedPermissionGroup,
    "SxICmOkFldX4o4YVaySdZq9sgn0eRd3Ih6uFtY8BgU5tMyZc7n90oJ4M2My5i7cy",
  );

  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    `Permission group "${permissionGroups[1].name}" updated successfully.`,
  );
});

test("Permission Groups Manage, member and cant edit group", async () => {
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={mockSetShowModal}
          selectedGroup={permissionGroups[2]}
          setSuccessMessage={jest.fn()}
        />
      ),
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  expect(await screen.findByText(/Name:/i)).toBeInTheDocument();
  expect(await screen.findByText(/mixed group/i)).toBeInTheDocument();

  expect(await screen.findByText(/Description:/i)).toBeInTheDocument();
  expect(await screen.findByText(/some description/i)).toBeInTheDocument();

  expect(screen.queryByLabelText("Save Changes")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Delete Group")).not.toBeInTheDocument();
});

test("Permission Groups Manage Modal, save fail", async () => {
  const mockSetShowModal = jest.fn();
  const mockUpdatePermissionGroup = jest.fn();
  mockUpdatePermissionGroup.mockResolvedValue({
    success: false,
    message: "some error",
  });
  jest
    .spyOn(appAPI, "updatePermissionGroup")
    .mockImplementation(mockUpdatePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={mockSetShowModal}
          selectedGroup={null}
          setSuccessMessage={jest.fn()}
        />
      ),
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const createGroup = screen.getByLabelText("Create Group");
  expect(createGroup).toBeInTheDocument();

  await userEvent.click(createGroup);

  expect(await screen.findByText("some error")).toBeInTheDocument();
});

test("Permission Groups Manage Modal, delete", async () => {
  const mockSetSuccessMessage = jest.fn();
  const mockDeletePermissionGroup = jest.fn();
  mockDeletePermissionGroup.mockResolvedValue({
    success: true,
  });
  jest
    .spyOn(appAPI, "deletePermissionGroup")
    .mockImplementation(mockDeletePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={jest.fn()}
          selectedGroup={permissionGroups[1]}
          setSuccessMessage={mockSetSuccessMessage}
        />
      ),
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const deleteGroup = screen.getByLabelText("Delete Group");
  expect(deleteGroup).toBeInTheDocument();

  await userEvent.click(deleteGroup);

  expect(mockSetSuccessMessage).toHaveBeenCalledWith(
    `Permission group "${permissionGroups[1].name}" deleted successfully.`,
  );
});

test("Permission Groups Manage Modal, delete fail", async () => {
  const mockDeletePermissionGroup = jest.fn();
  mockDeletePermissionGroup.mockResolvedValue({
    success: false,
    message: "some error",
  });
  jest
    .spyOn(appAPI, "deletePermissionGroup")
    .mockImplementation(mockDeletePermissionGroup);

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={jest.fn()}
          selectedGroup={permissionGroups[1]}
          setSuccessMessage={jest.fn()}
        />
      ),
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const deleteGroup = screen.getByLabelText("Delete Group");
  expect(deleteGroup).toBeInTheDocument();

  await userEvent.click(deleteGroup);

  expect(await screen.findByText("some error")).toBeInTheDocument();
});

test("Permission Groups Manage Modal, add user fail", async () => {
  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={jest.fn()}
          selectedGroup={permissionGroups[1]}
          setSuccessMessage={jest.fn()}
        />
      ),
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const usernameInput = screen.getByLabelText("Username Input");
  const userButton = screen.getByLabelText("Add User Button");

  fireEvent.click(userButton);

  expect(
    await screen.findByText("Username cannot be empty."),
  ).toBeInTheDocument();

  const closeAlertButton = screen.getByLabelText("Close alert");
  fireEvent.click(closeAlertButton);

  fireEvent.change(usernameInput, { target: { value: "admin" } });

  fireEvent.click(userButton);

  expect(
    await screen.findByText("This user is already in the list."),
  ).toBeInTheDocument();
});

test("Permission Groups Manage Modal, close", async () => {
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <PermissionGroupsManageModal
          showModal={true}
          setShowModal={mockSetShowModal}
          selectedGroup={permissionGroups[1]}
          setSuccessMessage={jest.fn()}
        />
      ),
    }),
  );

  expect(
    await screen.findByText("Manage Permission Groups"),
  ).toBeInTheDocument();

  const closeButton = screen.getByLabelText("Close");
  await userEvent.click(closeButton);

  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});
