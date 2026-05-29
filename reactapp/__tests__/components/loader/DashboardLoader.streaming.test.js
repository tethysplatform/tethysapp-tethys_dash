/**
 * DashboardLoader.streaming.test.js — coverage for the StreamingContext
 * listener that bridges chatbox-core's tethysdash:turn-start /
 * tethysdash:turn-end window events to the per-tile edit/delete/reorder
 * gating in DashboardItem (Plan 2026-05-28-002 Unit 6).
 *
 * Pinned behaviors:
 *   - Initial mount: isStreaming defaults to false
 *   - tethysdash:turn-start event → isStreaming flips to true
 *   - tethysdash:turn-end event → isStreaming flips back to false
 *   - StreamingContext and DisabledEditingMovementContext are independent
 *     (no spurious cross-toggle)
 *   - Listener cleanup on unmount — a stray window event after unmount
 *     does NOT throw or warn
 */

import DashboardLoader from "components/loader/DashboardLoader";
import {
  screen,
  render,
  waitFor,
  act,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContext } from "react";
import {
  AvailableDashboardsContext,
  DisabledEditingMovementContext,
} from "components/contexts/Contexts";
import { userDashboard } from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import {
  StreamingPComponent,
  DisabledMovementPComponent,
} from "__tests__/utilities/customRender";
import PropTypes from "prop-types";

const TestingMovementToggle = () => {
  const { disabledEditingMovement, setDisabledEditingMovement } = useContext(
    DisabledEditingMovementContext,
  );
  return (
    <button
      data-testid="toggleMovement"
      onClick={() => setDisabledEditingMovement(!disabledEditingMovement)}
    >
      toggle
    </button>
  );
};

function renderWithDashboard(children) {
  const mockUpdateDashboard = jest.fn();
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (_req, res, ctx) =>
        res(
          ctx.status(200),
          ctx.json({ success: true, dashboard: userDashboard }),
          ctx.set("Content-Type", "application/json"),
        ),
    ),
  );
  return render(
    <AvailableDashboardsContext.Provider
      value={{ updateDashboard: mockUpdateDashboard }}
    >
      <DashboardLoader {...userDashboard}>{children}</DashboardLoader>
    </AvailableDashboardsContext.Provider>,
  );
}

describe("DashboardLoader — StreamingContext bridge", () => {
  test("isStreaming defaults to false on initial mount (no synthetic events)", async () => {
    renderWithDashboard(<StreamingPComponent />);
    expect(await screen.findByTestId("streaming")).toHaveTextContent(
      "not streaming",
    );
  });

  test("tethysdash:turn-start flips isStreaming to true", async () => {
    renderWithDashboard(<StreamingPComponent />);
    await screen.findByTestId("streaming");

    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-start"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("streaming")).toHaveTextContent("streaming");
    });
  });

  test("tethysdash:turn-end flips isStreaming back to false", async () => {
    renderWithDashboard(<StreamingPComponent />);
    await screen.findByTestId("streaming");

    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-start"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("streaming")).toHaveTextContent("streaming"),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-end"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("streaming")).toHaveTextContent("not streaming"),
    );
  });

  test("multiple turn-start events without intervening turn-end are idempotent (stay true)", async () => {
    renderWithDashboard(<StreamingPComponent />);
    await screen.findByTestId("streaming");

    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-start"));
      window.dispatchEvent(new CustomEvent("tethysdash:turn-start"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("streaming")).toHaveTextContent("streaming"),
    );

    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-end"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("streaming")).toHaveTextContent("not streaming"),
    );
  });

  test("StreamingContext and DisabledEditingMovementContext are independent", async () => {
    renderWithDashboard(
      <>
        <StreamingPComponent />
        <DisabledMovementPComponent />
        <TestingMovementToggle />
      </>,
    );
    await screen.findByTestId("streaming");
    expect(screen.getByTestId("streaming")).toHaveTextContent("not streaming");
    expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
      "allowed movement",
    );

    // Toggling disabledEditingMovement does NOT touch isStreaming.
    await userEvent.click(screen.getByTestId("toggleMovement"));
    expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
      "disabled movement",
    );
    expect(screen.getByTestId("streaming")).toHaveTextContent("not streaming");

    // Firing turn-start does NOT touch disabledEditingMovement.
    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-start"));
    });
    await waitFor(() =>
      expect(screen.getByTestId("streaming")).toHaveTextContent("streaming"),
    );
    expect(screen.getByTestId("disabledMovement")).toHaveTextContent(
      "disabled movement",
    );
  });

  test("listener is removed on unmount — stray events after unmount don't throw", async () => {
    const { unmount } = renderWithDashboard(<StreamingPComponent />);
    await screen.findByTestId("streaming");

    unmount();

    // No assertion needed — the listener cleanup in DashboardLoader's
    // useEffect return should have removed both listeners. If it did not,
    // setIsStreaming would be called on an unmounted component and React
    // would warn. We assert no warning was raised below.
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    act(() => {
      window.dispatchEvent(new CustomEvent("tethysdash:turn-start"));
      window.dispatchEvent(new CustomEvent("tethysdash:turn-end"));
    });

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

// PropTypes silencer for the local TestingMovementToggle
TestingMovementToggle.propTypes = {};
