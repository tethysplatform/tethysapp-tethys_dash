import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatSettings from "components/chat/ChatSettings";
import { AppContext } from "components/contexts/Contexts";
import appAPI from "services/api/app";

jest.mock("services/api/app", () => ({
  getChatSettings: jest.fn(),
  saveChatSettings: jest.fn(),
}));

const renderSettings = (props = {}) =>
  render(
    <AppContext.Provider value={{ csrf: "csrf-token" }}>
      <ChatSettings onClose={jest.fn()} {...props} />
    </AppContext.Provider>,
  );

describe("ChatSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads current settings and never receives or shows the API key", async () => {
    // Backend contract: the key is WRITE-ONLY - GET returns has_key only.
    appAPI.getChatSettings.mockResolvedValue({
      provider: "anthropic",
      model_name: "claude-sonnet-4-6",
      has_key: true,
    });

    renderSettings();

    expect(
      await screen.findByDisplayValue("claude-sonnet-4-6"),
    ).toBeInTheDocument();
    // saved-key state is signalled by a masked placeholder, value stays empty
    const keyInput = screen.getByPlaceholderText(/a key is saved/);
    expect(keyInput).toHaveValue("");
    expect(keyInput).toHaveAttribute("type", "password");
  });

  it("saves settings and clears the key from component state after POST", async () => {
    appAPI.getChatSettings.mockResolvedValue({
      provider: "local",
      model_name: "",
      has_key: false,
    });
    appAPI.saveChatSettings.mockResolvedValue({
      provider: "openai",
      model_name: "",
      has_key: true,
    });

    renderSettings();
    const user = userEvent.setup();

    await user.selectOptions(screen.getByRole("combobox"), "openai");
    const keyInput = await screen.findByPlaceholderText("paste your key");
    await user.type(keyInput, "sk-super-secret");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(appAPI.saveChatSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "openai",
          apiKey: "sk-super-secret",
          csrf: "csrf-token",
        }),
      ),
    );
    // key must not linger in the input after a successful save
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/a key is saved/)).toHaveValue(""),
    );
  });

  it("hides the key field entirely for the local provider", async () => {
    appAPI.getChatSettings.mockResolvedValue({
      provider: "local",
      model_name: "",
      has_key: false,
    });

    renderSettings();

    await waitFor(() => expect(appAPI.getChatSettings).toHaveBeenCalled());
    expect(screen.queryByText("API key")).not.toBeInTheDocument();
  });
});
