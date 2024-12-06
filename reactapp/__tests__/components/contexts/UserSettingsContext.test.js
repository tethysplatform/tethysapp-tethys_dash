import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AppContext } from "components/contexts/Contexts";
import UserSettingsContextProvider, {
  useUserSettingsContext,
} from "components/contexts/UserSettingsContext";
import appAPI from "services/api/app";

const TestingComponent = () => {
  const { userSettings, updateUserSettings } = useUserSettingsContext();

  function updateSettings() {
    updateUserSettings({ deselected_visualizations: [1, 2] });
  }

  return (
    <>
      <button
        data-testid="user-settings-button"
        onClick={updateSettings}
      ></button>
      <p data-testid="user-settings">{JSON.stringify(userSettings)}</p>
    </>
  );
};

test("user setting context update success", async () => {
  appAPI.updateUserSettings = () => {
    return Promise.resolve({
      success: true,
    });
  };

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <UserSettingsContextProvider>
        <TestingComponent />
      </UserSettingsContextProvider>
    </AppContext.Provider>
  );

  await waitFor(async () => {
    expect(await screen.findByTestId("user-settings")).toHaveTextContent(
      JSON.stringify({ deselected_visualizations: [] })
    );
  });

  const updateButton = await screen.findByRole("button");
  fireEvent.click(updateButton);

  await waitFor(async () => {
    expect(await screen.findByTestId("user-settings")).toHaveTextContent(
      JSON.stringify({ deselected_visualizations: [1, 2] })
    );
  });
});

test("user setting context update fail", async () => {
  appAPI.updateUserSettings = () => {
    return Promise.resolve({
      success: false,
    });
  };

  render(
    <AppContext.Provider value={{ csrf: "csrf" }}>
      <UserSettingsContextProvider>
        <TestingComponent />
      </UserSettingsContextProvider>
    </AppContext.Provider>
  );

  await waitFor(async () => {
    expect(await screen.findByTestId("user-settings")).toHaveTextContent(
      JSON.stringify({ deselected_visualizations: [] })
    );
  });

  const updateButton = await screen.findByRole("button");
  fireEvent.click(updateButton);

  await waitFor(async () => {
    expect(await screen.findByTestId("user-settings")).toHaveTextContent(
      JSON.stringify({ deselected_visualizations: [] })
    );
  });
});
