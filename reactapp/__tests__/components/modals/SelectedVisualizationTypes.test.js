import { act, useState } from "react";
import userEvent from "@testing-library/user-event";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SelectedVisualizationTypesModal from "components/modals/SelectedVisualizationTypes";
import { UserSettingsContext } from "components/contexts/UserSettingsContext";
import { AppContext } from "components/contexts/AppContext";
import { mockedVisualizationsWithDefaults } from "__tests__/utilities/constants";

const TestingComponent = () => {
  const [showModal, setShowmodal] = useState(true);

  return (
    <SelectedVisualizationTypesModal
      showModal={showModal}
      setShowModal={setShowmodal}
    />
  );
};

test("selected visualization type modal save success and then close", async () => {
  const mockUpdateUserSettings = jest.fn();
  mockUpdateUserSettings.mockResolvedValue({ success: true });

  render(
    <AppContext.Provider
      value={{ csrf: "csrf", visualizations: mockedVisualizationsWithDefaults }}
    >
      <UserSettingsContext.Provider
        value={{
          userSettings: { deselected_visualizations: [] },
          updateUserSettings: mockUpdateUserSettings,
        }}
      >
        <TestingComponent />
      </UserSettingsContext.Provider>
    </AppContext.Provider>
  );

  expect(
    await screen.findByText(
      "Select/Deselect the options that will appear in the Visualization Type selector."
    )
  ).toBeInTheDocument();
  const allCheckboxes = await screen.findAllByRole("checkbox");
  expect(allCheckboxes.length).toBe(9);
  allCheckboxes.forEach((checkbox) => {
    expect(checkbox).toBeChecked();
  });

  const visualizationGroup1Checkbox = await screen.findByRole("checkbox", {
    name: "Visualization Group",
  });

  const visualizationGroup2Checkbox = await screen.findByRole("checkbox", {
    name: "Visualization Group 2",
  });
  const pluginLabelCheckbox = await screen.findByRole("checkbox", {
    name: "plugin_label",
  });
  const pluginLabel2Checkbox = await screen.findByRole("checkbox", {
    name: "plugin_label2",
  });
  const pluginLabel3Checkbox = await screen.findByRole("checkbox", {
    name: "plugin_label3",
  });

  fireEvent.click(visualizationGroup1Checkbox);
  expect(visualizationGroup1Checkbox).not.toBeChecked();
  expect(pluginLabelCheckbox).not.toBeChecked();
  expect(pluginLabel2Checkbox).not.toBeChecked();

  fireEvent.click(visualizationGroup1Checkbox);
  expect(visualizationGroup1Checkbox).toBeChecked();
  expect(pluginLabelCheckbox).toBeChecked();
  expect(pluginLabel2Checkbox).toBeChecked();

  fireEvent.click(pluginLabelCheckbox);
  expect(pluginLabelCheckbox).not.toBeChecked();
  expect(visualizationGroup1Checkbox).toBeChecked();

  fireEvent.click(pluginLabel2Checkbox);
  expect(pluginLabel2Checkbox).not.toBeChecked();
  expect(visualizationGroup1Checkbox).not.toBeChecked();

  fireEvent.click(pluginLabel2Checkbox);
  expect(pluginLabel2Checkbox).toBeChecked();
  expect(visualizationGroup1Checkbox).toBeChecked();

  fireEvent.click(pluginLabelCheckbox);
  expect(pluginLabelCheckbox).toBeChecked();

  fireEvent.click(pluginLabel3Checkbox);
  expect(pluginLabel3Checkbox).not.toBeChecked();
  expect(visualizationGroup2Checkbox).not.toBeChecked();

  fireEvent.click(pluginLabel3Checkbox);
  expect(pluginLabel3Checkbox).toBeChecked();
  expect(visualizationGroup2Checkbox).toBeChecked();

  fireEvent.click(visualizationGroup2Checkbox);

  const saveSettingsButton = await screen.findByLabelText(
    "Save Settings Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(saveSettingsButton);
  });
  expect(
    await screen.findByText("Settings have been saved.")
  ).toBeInTheDocument();
  expect(mockUpdateUserSettings).toHaveBeenCalledWith({
    deselected_visualizations: ["Visualization Group 2", "plugin_label3"],
  });

  const closeModalButton = await screen.findByLabelText("Close Modal Button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(closeModalButton);
  });
  await waitFor(async () => {
    expect(
      screen.queryByText(
        "Select/Deselect the options that will appear in the Visualization Type selector."
      )
    ).not.toBeInTheDocument();
  });
});

test("selected visualization type modal save failed and then escape", async () => {
  const mockUpdateUserSettings = jest.fn();
  mockUpdateUserSettings.mockResolvedValue({ success: false });

  render(
    <AppContext.Provider
      value={{ csrf: "csrf", visualizations: mockedVisualizationsWithDefaults }}
    >
      <UserSettingsContext.Provider
        value={{
          userSettings: { deselected_visualizations: [] },
          updateUserSettings: mockUpdateUserSettings,
        }}
      >
        <TestingComponent />
      </UserSettingsContext.Provider>
    </AppContext.Provider>
  );

  const saveSettingsButton = await screen.findByLabelText(
    "Save Settings Button"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(saveSettingsButton);
  });
  expect(
    await screen.findByText(
      "Failed to save settings. Check server logs for more information."
    )
  ).toBeInTheDocument();
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.keyboard("{Escape}");
  });
  await waitFor(async () => {
    expect(
      screen.queryByText(
        "Select/Deselect the options that will appear in the Visualization Type selector."
      )
    ).not.toBeInTheDocument();
  });
});
