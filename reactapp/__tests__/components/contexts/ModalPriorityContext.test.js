import { render, screen, waitFor } from "@testing-library/react";
import {
  ModalPriorityProvider,
  useModalPriority,
} from "components/contexts/ModalPriorityContext";

function TestComponent() {
  const {
    showingPublicUserModal,
    setShowingPublicUserModal,
    publicUserModalChecked,
    setPublicUserModalChecked,
    showingIdleTimeoutModal,
    setShowingIdleTimeoutModal,
    appInfoModalWasOpen,
    setAppInfoModalWasOpen,
  } = useModalPriority();

  return (
    <div>
      <div data-testid="showingPublicUserModal">
        {String(showingPublicUserModal)}
      </div>
      <div data-testid="publicUserModalChecked">
        {String(publicUserModalChecked)}
      </div>
      <div data-testid="showingIdleTimeoutModal">
        {String(showingIdleTimeoutModal)}
      </div>
      <div data-testid="appInfoModalWasOpen">{String(appInfoModalWasOpen)}</div>
      <button onClick={() => setShowingPublicUserModal(true)}>
        Show Public User Modal
      </button>
      <button onClick={() => setPublicUserModalChecked(true)}>
        Check Public User Modal
      </button>
      <button onClick={() => setShowingIdleTimeoutModal(true)}>
        Show Idle Timeout Modal
      </button>
      <button onClick={() => setAppInfoModalWasOpen(true)}>
        Set AppInfo Modal Was Open
      </button>
    </div>
  );
}

describe("ModalPriorityContext", () => {
  it("provides default values", () => {
    render(
      <ModalPriorityProvider>
        <TestComponent />
      </ModalPriorityProvider>,
    );
    expect(screen.getByTestId("showingPublicUserModal").textContent).toBe(
      "false",
    );
    expect(screen.getByTestId("publicUserModalChecked").textContent).toBe(
      "false",
    );
    expect(screen.getByTestId("showingIdleTimeoutModal").textContent).toBe(
      "false",
    );
    expect(screen.getByTestId("appInfoModalWasOpen").textContent).toBe("false");
  });

  it("updates context values via setters", async () => {
    render(
      <ModalPriorityProvider>
        <TestComponent />
      </ModalPriorityProvider>,
    );
    screen.getByText("Show Public User Modal").click();
    screen.getByText("Check Public User Modal").click();
    screen.getByText("Show Idle Timeout Modal").click();
    screen.getByText("Set AppInfo Modal Was Open").click();
    await waitFor(() => {
      expect(screen.getByTestId("showingPublicUserModal").textContent).toBe(
        "true",
      );
    });
    expect(screen.getByTestId("publicUserModalChecked").textContent).toBe(
      "true",
    );
    expect(screen.getByTestId("showingIdleTimeoutModal").textContent).toBe(
      "true",
    );
    expect(screen.getByTestId("appInfoModalWasOpen").textContent).toBe("true");
  });

  it("throws error if used outside provider", () => {
    // Suppress error output for this test
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    function BadComponent() {
      useModalPriority();
      return null;
    }
    expect(() => render(<BadComponent />)).toThrow(
      /useModalPriority must be used within a ModalPriorityProvider/,
    );
    spy.mockRestore();
  });
});
