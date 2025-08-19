// test("Dashboard Editor Canvas editable dashboard change sharing status", async () => {
//   render(
//     createLoadedComponent({
//       children: <TestingComponent />,
//       options: {
//         initialDashboard: userDashboard,
//         editableDashboard: true,
//       },
//     })
//   );

//   expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
//   expect(await screen.findByText("Name")).toBeInTheDocument();
//   expect(await screen.findByLabelText("Name Input")).toBeInTheDocument();
//   expect(await screen.findByText("Description")).toBeInTheDocument();
//   expect(await screen.findByLabelText("Description Input")).toBeInTheDocument();
//   expect(await screen.findByText("Sharing Status")).toBeInTheDocument();
//   expect(await screen.findByText("Notes")).toBeInTheDocument();
//   expect(await screen.findByLabelText("textEditor")).toBeInTheDocument();
//   expect(await screen.findByText("Close")).toBeInTheDocument();
//   expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
//   expect(await screen.findByText("Delete dashboard")).toBeInTheDocument();
//   expect(await screen.findByText("Save changes")).toBeInTheDocument();

//   const publicRadioButton = screen.getByLabelText("Public");
//   const privateRadioButton = screen.getByLabelText("Private");
//   expect(publicRadioButton).toBeInTheDocument();
//   expect(privateRadioButton).toBeInTheDocument();

//   expect(publicRadioButton).not.toBeChecked();
//   expect(privateRadioButton).toBeChecked();
//   expect(screen.queryByText("Public URL")).not.toBeInTheDocument();

//   fireEvent.click(publicRadioButton);

//   expect(publicRadioButton).toBeChecked();
//   expect(privateRadioButton).not.toBeChecked();
//   expect(await screen.findByText("Public URL")).toBeInTheDocument();
//   expect(
//     await screen.findByText(
//       "http://api.test/apps/tethysdash/dashboard/public/editable"
//     )
//   ).toBeInTheDocument();
// });test("Dashboard Editor Canvas copy public url failed", async () => {
//   render(
//     createLoadedComponent({
//       children: <TestingComponent />,
//       options: {
//         initialDashboard: publicDashboard,
//       },
//     })
//   );

//   expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
//   expect(await screen.findByText("Name")).toBeInTheDocument();
//   expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
//   expect(await screen.findByText("Description")).toBeInTheDocument();
//   expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
//   expect(screen.queryByText("Sharing Status")).not.toBeInTheDocument();
//   expect(await screen.findByText("Notes")).toBeInTheDocument();
//   expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();
//   expect(await screen.findByText("Close")).toBeInTheDocument();
//   expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
//   expect(screen.queryByText("Delete dashboard")).not.toBeInTheDocument();
//   expect(screen.queryByText("Save changes")).not.toBeInTheDocument();

//   expect(screen.queryByLabelText("Public")).not.toBeInTheDocument();
//   expect(screen.queryByLabelText("Private")).not.toBeInTheDocument();
//   expect(await screen.findByText("Public URL")).toBeInTheDocument();
//   expect(
//     await screen.findByText(
//       "http://api.test/apps/tethysdash/dashboard/public/noneditable"
//     )
//   ).toBeInTheDocument();

//   const copyClipboardButton = await screen.findByLabelText(
//     "Copy Clipboard Button"
//   );
//   expect(copyClipboardButton).toBeInTheDocument();
//   fireEvent.click(copyClipboardButton);
//   await userEvent.hover(copyClipboardButton);
//   expect(await screen.findByRole("tooltip")).toHaveTextContent(
//     "Failed to Copy"
//   );
// });

// test("Dashboard Editor Canvas noneditable and copy public url", async () => {
//   const mockWriteText = jest.fn();
//   Object.defineProperty(navigator, "clipboard", {
//     value: {
//       writeText: mockWriteText,
//     },
//   });

//   render(
//     createLoadedComponent({
//       children: <TestingComponent />,
//       options: {
//         initialDashboard: publicDashboard,
//       },
//     })
//   );

//   expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
//   expect(await screen.findByText("Name")).toBeInTheDocument();
//   expect(screen.queryByLabelText("Name Input")).not.toBeInTheDocument();
//   expect(await screen.findByText("Description")).toBeInTheDocument();
//   expect(screen.queryByLabelText("Description Input")).not.toBeInTheDocument();
//   expect(screen.queryByText("Sharing Status")).not.toBeInTheDocument();
//   expect(await screen.findByText("Notes")).toBeInTheDocument();
//   expect(screen.queryByLabelText("textEditor")).not.toBeInTheDocument();
//   expect(await screen.findByText("Close")).toBeInTheDocument();
//   expect(await screen.findByText("Copy dashboard")).toBeInTheDocument();
//   expect(screen.queryByText("Delete dashboard")).not.toBeInTheDocument();
//   expect(screen.queryByText("Save changes")).not.toBeInTheDocument();

//   expect(screen.queryByLabelText("Public")).not.toBeInTheDocument();
//   expect(screen.queryByLabelText("Private")).not.toBeInTheDocument();
//   expect(await screen.findByText("Public URL")).toBeInTheDocument();
//   expect(
//     await screen.findByText(
//       "http://api.test/apps/tethysdash/dashboard/public/noneditable"
//     )
//   ).toBeInTheDocument();

//   const copyClipboardButton = await screen.findByLabelText(
//     "Copy Clipboard Button"
//   );
//   await userEvent.hover(copyClipboardButton);

//   const tooltip = screen.getByRole("tooltip");
//   expect(tooltip).toBeInTheDocument();
//   expect(tooltip).toHaveTextContent("Copy to clipboard");
//   expect(copyClipboardButton).toBeInTheDocument();
//   fireEvent.click(copyClipboardButton);
//   expect(mockWriteText).toHaveBeenCalledWith(
//     "http://api.test/apps/tethysdash/dashboard/public/noneditable"
//   );
//   await userEvent.hover(copyClipboardButton);
//   expect(screen.getByRole("tooltip")).toHaveTextContent("Copied");
// });
