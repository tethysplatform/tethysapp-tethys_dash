import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VisualizationPermissionsModal from "components/modals/VisualizationPermissions";
import createLoadedComponent from "__tests__/utilities/customRender";
import { mockVisualizationPermissions } from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

test("renders modal with title and content when showModal is true", async () => {
  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  expect(
    await screen.findByText("Manage Visualization Permissions")
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Manage which users and groups have access/)
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Save Changes/i })
  ).toBeInTheDocument();
});

test("does not render modal when showModal is false", () => {
  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={false}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  expect(
    screen.queryByText("Manage Visualization Permissions")
  ).not.toBeInTheDocument();
});

test("fetches and displays visualization permissions on modal open", async () => {
  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  // Wait for loading to complete and data to be fetched
  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Check that visualization accordions are rendered
  expect(await screen.findByText("Plugin Label")).toBeInTheDocument();
  expect(screen.getByText("Plugin Label 2")).toBeInTheDocument();
  expect(screen.getByText("Plugin Label 3")).toBeInTheDocument();

  // Check permission counts are displayed
  expect(screen.getByText("3 permission(s)")).toBeInTheDocument(); // plugin_label
  expect(screen.getByText("2 permission(s)")).toBeInTheDocument(); // plugin_label2
  expect(screen.getByText("0 permission(s)")).toBeInTheDocument(); // plugin_label3
});

test("expands accordion and shows visualization details", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Click to expand the first accordion item
  const firstAccordionHeader = await screen.findByText("Plugin Label");
  await user.click(firstAccordionHeader);

  // Check that description is shown
  expect(screen.getByText("A test plugin visualization")).toBeInTheDocument();

  // Check that input field and Add button are present
  expect(
    screen.getAllByPlaceholderText("Enter username or group name")
  ).toHaveLength(3);
  expect(screen.getAllByRole("button", { name: /Add/i })).toHaveLength(3);

  // Check that permissions table is displayed with users and groups
  const tables = screen.getAllByRole("table");
  expect(tables).toHaveLength(2);

  const table1rows = within(tables[0]).getAllByRole("row");
  expect(table1rows).toHaveLength(4); // header + 3 entries
  expect(table1rows[1].cells[0]).toHaveTextContent("admin (you)");
  expect(table1rows[1].cells[1]).toHaveTextContent("User");
  expect(table1rows[2].cells[0]).toHaveTextContent("testuser");
  expect(table1rows[2].cells[1]).toHaveTextContent("User");
  expect(table1rows[3].cells[0]).toHaveTextContent("all admin group (you)");
  expect(table1rows[3].cells[1]).toHaveTextContent("Group");

  const table2rows = within(tables[1]).getAllByRole("row");
  expect(table2rows).toHaveLength(3); // header + 3 entries
  expect(table2rows[1].cells[0]).toHaveTextContent("admin (you)");
  expect(table2rows[1].cells[1]).toHaveTextContent("User");
  expect(table2rows[2].cells[0]).toHaveTextContent("mixed group (you)");
  expect(table2rows[2].cells[1]).toHaveTextContent("Group");
});

test("adds a new user to visualization permissions", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand the third accordion (no permissions)
  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  // Find input field and Add dropdown
  const inputFields = screen.getAllByPlaceholderText(
    "Enter username or group name"
  );
  const inputField = inputFields[2]; // Third accordion input
  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[2]; // Third accordion Add button

  // Type a username
  await user.type(inputField, "newuser");

  // Click Add dropdown and select "Add User"
  await user.click(addDropdown);
  const addUserOption = screen.getByText("Add User");
  await user.click(addUserOption);

  // Check that user was added to the table
  const tables = screen.getAllByRole("table");
  const table3rows = within(tables[2]).getAllByRole("row");
  expect(table3rows).toHaveLength(2); // header + 1 entries
  expect(table3rows[1].cells[0]).toHaveTextContent("newuser");
  expect(table3rows[1].cells[1]).toHaveTextContent("User");

  // Input should be cleared
  expect(inputField.value).toBe("");
});

test("adds a new group to visualization permissions", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand the third accordion (no permissions)
  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  // Find input field and Add dropdown
  const inputFields = screen.getAllByPlaceholderText(
    "Enter username or group name"
  );
  const inputField = inputFields[2]; // Third accordion input
  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[2]; // Third accordion Add button

  // Type a group name
  await user.type(inputField, "testgroup");

  // Click Add dropdown and select "Add Group"
  await user.click(addDropdown);
  const addGroupOption = screen.getByText("Add Group");
  await user.click(addGroupOption);

  // Check that group was added to the table
  const tables = screen.getAllByRole("table");
  const table3rows = within(tables[2]).getAllByRole("row");
  expect(table3rows).toHaveLength(2); // header + 1 entries
  expect(table3rows[1].cells[0]).toHaveTextContent("testgroup");
  expect(table3rows[1].cells[1]).toHaveTextContent("Group");
});

test("shows error when trying to add empty username", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[2]; // Third accordion Add button

  // Try to add without entering anything
  await user.click(addDropdown);
  const addUserOption = screen.getByText("Add User");
  await user.click(addUserOption);

  // Should show error message
  expect(screen.getByText("Username cannot be empty.")).toBeInTheDocument();
});

test("shows error when trying to add empty group", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[2]; // Third accordion Add button

  // Try to add without entering anything
  await user.click(addDropdown);
  const addGroupOption = screen.getByText("Add Group");
  await user.click(addGroupOption);

  // Should show error message
  expect(screen.getByText("Group name cannot be empty.")).toBeInTheDocument();
});

test("shows error when trying to add duplicate user", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand first accordion which already has admin user
  const firstAccordionHeader = await screen.findByText("Plugin Label");
  await user.click(firstAccordionHeader);

  // Find input field and Add dropdown
  const inputFields = screen.getAllByPlaceholderText(
    "Enter username or group name"
  );
  const inputField = inputFields[0]; // First accordion input
  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[0]; // First accordion Add button

  // Try to add admin user again
  await user.type(inputField, "admin");
  await user.click(addDropdown);
  const addUserOption = screen.getByText("Add User");
  await user.click(addUserOption);

  // Should show error message
  expect(
    screen.getByText("This user already has access to this visualization.")
  ).toBeInTheDocument();
});

test("shows error when trying to add duplicate group", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand first accordion which already has admin user
  const firstAccordionHeader = await screen.findByText("Plugin Label");
  await user.click(firstAccordionHeader);

  // Find input field and Add dropdown
  const inputFields = screen.getAllByPlaceholderText(
    "Enter username or group name"
  );
  const inputField = inputFields[0]; // First accordion input
  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[0]; // First accordion Add button

  // Try to add admin user again
  await user.type(inputField, "all admin group");
  await user.click(addDropdown);
  const addUserOption = screen.getByText("Add Group");
  await user.click(addUserOption);

  // Should show error message
  expect(
    screen.getByText("This group already has access to this visualization.")
  ).toBeInTheDocument();
});

test("removes user from visualization permissions", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand first accordion
  const firstAccordionHeader = await screen.findByText("Plugin Label");
  await user.click(firstAccordionHeader);

  // Find the delete button for testuser row
  const tables = screen.getAllByRole("table");
  const table = tables[0];
  const tableBody = within(table)
    .getAllByRole("row")
    .find((row) => within(row).queryByText("testuser"));
  const deleteButton = within(tableBody).getByRole("button");

  // Click delete button
  await user.click(deleteButton);

  // User should be removed
  expect(screen.queryByText("testuser")).not.toBeInTheDocument();
});

test("removes group from visualization permissions", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand first accordion
  const firstAccordionHeader = await screen.findByText("Plugin Label");
  await user.click(firstAccordionHeader);

  // Find the delete button for all admin group row
  const tables = screen.getAllByRole("table");
  const table = tables[0];
  const tableBody = within(table)
    .getAllByRole("row")
    .find((row) => within(row).queryByText("all admin group (you)"));
  const deleteButton = within(tableBody).getByRole("button");

  // Click delete button
  await user.click(deleteButton);

  // Group should be removed
  expect(screen.queryByText("all admin group (you)")).not.toBeInTheDocument();
});

test("shows message when no permissions are set", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Expand third accordion (no permissions)
  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  // Should show no permissions message
  expect(
    screen.getByText("No permissions set for this visualization.")
  ).toBeInTheDocument();
});

test("saves permissions successfully", async () => {
  const user = userEvent.setup();

  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/permissions/update/",
      async (req, res, ctx) => {
        const request = await req.json();
        expect(request).toEqual({ permissions: mockVisualizationPermissions });
        return res(
          ctx.status(200),
          ctx.json({ success: true }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Click Save Changes button
  const saveButtons = await screen.findAllByRole("button", {
    name: /Save Changes/i,
  });
  await user.click(saveButtons[0]);

  // Should show success message
  await waitFor(() => {
    expect(
      screen.getByText("Successfully updated visualization permissions")
    ).toBeInTheDocument();
  });

  // Find and click the dismiss button on the error alert
  const dismissButtons = screen.getAllByRole("button", { name: /close/i });
  await user.click(dismissButtons[1]);

  // Error should be dismissed
  expect(
    screen.queryByText("Successfully updated visualization permissions")
  ).not.toBeInTheDocument();
});

test("handles save error", async () => {
  const user = userEvent.setup();

  // Mock API to return error
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/permissions/update/",
      (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: "Internal server error" }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  const saveButtons = await screen.findAllByRole("button", {
    name: /Save Changes/i,
  });
  await user.click(saveButtons[0]);

  // Should show error message
  await waitFor(() => {
    expect(
      screen.getByText("Failed to update visualization permissions")
    ).toBeInTheDocument();
  });
});

test("handles save failed with custom message", async () => {
  const user = userEvent.setup();

  // Mock API to return error
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/permissions/update/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
            message: "Failed to update permissions",
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  const saveButtons = await screen.findAllByRole("button", {
    name: /Save Changes/i,
  });
  await user.click(saveButtons[0]);

  // Should show error message
  await waitFor(() => {
    expect(
      screen.getByText("Failed to update permissions")
    ).toBeInTheDocument();
  });
});

test("handles save failed", async () => {
  const user = userEvent.setup();

  // Mock API to return error
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/permissions/update/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: false,
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  const saveButtons = await screen.findAllByRole("button", {
    name: /Save Changes/i,
  });
  await user.click(saveButtons[0]);

  // Should show error message
  await waitFor(() => {
    expect(
      screen.getByText("Failed to update visualization permissions")
    ).toBeInTheDocument();
  });
});

test("handles fetch permissions error", async () => {
  // Mock API to return error on fetch
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/permissions/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(500),
          ctx.json({ error: "Internal server error" }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  // Should show error message
  await waitFor(() => {
    expect(
      screen.getByText("Failed to load visualization permissions")
    ).toBeInTheDocument();
  });
});

test("handles fetch permissions failed with custom message", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/permissions/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: false, message: "custom fail message" }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  // Should show error message
  await waitFor(() => {
    expect(screen.getByText("custom fail message")).toBeInTheDocument();
  });
});

test("handles fetch permissions failed", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/permissions/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({ success: false }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  // Should show error message
  await waitFor(() => {
    expect(
      screen.getByText("Failed to fetch visualization permissions")
    ).toBeInTheDocument();
  });
});

test("closes modal and resets state when Cancel is clicked", async () => {
  const user = userEvent.setup();
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={mockSetShowModal}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Add an error message first
  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[2]; // Third accordion Add button
  await user.click(addDropdown);
  const addUserOption = screen.getByText("Add User");
  await user.click(addUserOption);

  // Should show error
  expect(screen.getByText("Username cannot be empty.")).toBeInTheDocument();

  // Click Cancel
  const cancelButton = screen.getByRole("button", { name: /Cancel/i });
  await user.click(cancelButton);

  // Should call setShowModal with false
  expect(mockSetShowModal).toHaveBeenCalledWith(false);
}, 10000);

test("closes modal when close button (X) is clicked", async () => {
  const user = userEvent.setup();
  const mockSetShowModal = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={mockSetShowModal}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Click the close button (X) in the modal header
  const closeButton = await screen.findByLabelText("Close");
  await user.click(closeButton);

  // Should call setShowModal with false
  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});

test("dismisses error and success alerts", async () => {
  const user = userEvent.setup();

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  // Trigger an error
  const thirdAccordionHeader = await screen.findByText("Plugin Label 3");
  await user.click(thirdAccordionHeader);

  const addDropdowns = screen.getAllByRole("button", { name: /Add/i });
  const addDropdown = addDropdowns[2]; // Third accordion Add button
  await user.click(addDropdown);
  const addUserOption = screen.getByText("Add User");
  await user.click(addUserOption);

  // Error should be visible
  const errorAlert = screen.getByText("Username cannot be empty.");
  expect(errorAlert).toBeInTheDocument();

  // Find and click the dismiss button on the error alert
  const dismissButtons = screen.getAllByRole("button", { name: /close/i });
  await user.click(dismissButtons[1]);

  // Error should be dismissed
  expect(
    screen.queryByText("Username cannot be empty.")
  ).not.toBeInTheDocument();
});

test("shows loading state while saving", async () => {
  const user = userEvent.setup();

  // Mock API with delay
  server.use(
    rest.post(
      "http://api.test/apps/tethysdash/visualizations/permissions/update/",
      (req, res, ctx) => {
        return res(
          ctx.delay(100),
          ctx.status(200),
          ctx.json({ success: true }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  render(
    createLoadedComponent({
      children: (
        <VisualizationPermissionsModal
          showModal={true}
          setShowModal={jest.fn()}
        />
      ),
    })
  );

  await waitFor(() => {
    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  const saveButton = await screen.findByRole("button", {
    name: /Save Changes/i,
  });
  await user.click(saveButton);

  // Should show saving state
  expect(screen.getByText("Saving...")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Saving.../i })).toBeDisabled();

  // Wait for save to complete
  await waitFor(() => {
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });
});
