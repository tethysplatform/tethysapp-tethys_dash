import { screen, render, waitFor, fireEvent } from "@testing-library/react";
import { publicDashboard } from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";
import userEvent from "@testing-library/user-event";
import IdleTimerManager from "components/loader/IdleTimerManager";
import {
  useIdleClock,
  restoreIdleClock,
  pingApplied,
  advanceIdleClock,
} from "__tests__/utilities/idleClock";
import { ModalPriorityProvider } from "components/contexts/ModalPriorityContext";

afterEach(restoreIdleClock);

test("IdleTimerManager, user signed out", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: -2,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();

  await waitFor(() => {
    expect(window.location.assign).toHaveBeenCalledWith(
      "http://api.test/accounts/login?next=/",
    );
  });
});

test("IdleTimerManager, check if user signed in", async () => {
  const ping = useIdleClock();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: { plugin_arg: "checkbox" },
        },
      ],
    },
  ];
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            visualizations: availableVisualizations,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 1,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  const { rerender } = render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();

  // The ping above warns at 3 seconds idle and signs out at 10.
  await pingApplied(ping);
  advanceIdleClock(6000);

  rerender(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );
  expect(screen.getByText("Are you still here?")).toBeInTheDocument();

  const staySignedInButton = screen.getByRole("button", {
    name: "Stay Signed In",
  });
  expect(staySignedInButton).toBeInTheDocument();

  await user.click(staySignedInButton);

  rerender(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();
  advanceIdleClock(6000);

  expect(screen.getByText("Are you still here?")).toBeInTheDocument();
  advanceIdleClock(5000);

  // Signing out tells the server first, so the redirect follows a request.
  await waitFor(() => expect(window.location.assign).toHaveBeenCalledTimes(1));
});

test("IdleTimerManager, public session and continue", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
    rest.get("http://api.test/apps/tethysdash/dashboards/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({ dashboards: [publicDashboard] }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 2,
          EXPIRE_AFTER: 0,
          WARN_AFTER: 0,
        }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  delete window.location; // Remove existing location object
  window.location = { assign: jest.fn() }; // Mock location.assign

  render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  expect(
    await screen.findByText(
      "You are not signed in. Sign in to create and update dashboards.",
    ),
  ).toBeInTheDocument();

  expect(
    await screen.findByText(
      "If you'd like to continue, you will only have access to public dashboards",
    ),
  ).toBeInTheDocument();

  const continueButton = screen.getByRole("button", {
    name: "Proceed Without Signing in",
  });
  fireEvent.click(continueButton);

  // This component should only redirect when the user clicks the "Sign In" button
  expect(window.location.assign).toHaveBeenCalledTimes(0);
});

test("IdleTimerManager, failed ping", async () => {
  server.use(
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(500),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();
});

test("IdleTimerManager, delays signing out if activity is detected", async () => {
  const ping = useIdleClock();
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const availableVisualizations = [
    {
      label: "Other",
      options: [
        {
          source: "plugin_source_checkbox",
          value: "plugin_value_checkbox",
          label: "plugin_label_checkbox",
          args: { plugin_arg: "checkbox" },
        },
      ],
    },
  ];
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/visualizations/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            visualizations: availableVisualizations,
          }),
          ctx.set("Content-Type", "application/json"),
        );
      },
    ),
    // Without these the default ping switches the timer off, and nothing here
    // could ever show the prompt -- with or without the activity.
    rest.get("http://api.test/apps/tethysdash/ping/", (req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          status: 1,
          EXPIRE_AFTER: 10,
          WARN_AFTER: 3,
        }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  const { rerender } = render(
    <ModalPriorityProvider>
      <IdleTimerManager />
      <button>Click me</button>
    </ModalPriorityProvider>,
  );

  delete window.location; // Remove existing location object
  window.location = { assign: jest.fn() }; // Mock location.assign

  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();
  await pingApplied(ping);

  // Four seconds in all, past the 3-second warning -- but the click in the
  // middle restarts the idle clock, so only two of them count.
  advanceIdleClock(2000);
  // A real click, not a bare click event: the idle timer counts mousedown as
  // activity, and click alone is not in its list.
  await user.click(screen.getByText("Click me"));
  advanceIdleClock(2000);
  rerender(
    <ModalPriorityProvider>
      <IdleTimerManager />
      <button>Click me</button>
    </ModalPriorityProvider>,
  );
  expect(screen.queryByText("Are you still here?")).not.toBeInTheDocument();
});

test("IdleTimerManager, public session and no sign in prompt", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );
  const localStorageMock = (function () {
    let store = { dontShowPublicLoginOnStart: true };

    return {
      getItem(key) {
        return store[key] || null;
      },

      setItem(key, value) {
        store[key] = value.toString();
      },

      removeItem(key) {
        delete store[key];
      },

      clear() {
        store = {};
      },
    };
  })();

  Object.defineProperty(window, "localStorage", { value: localStorageMock });

  render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  expect(
    screen.queryByText(
      "You are not signed in. Sign in to create and update dashboards.",
    ),
  ).not.toBeInTheDocument();
  localStorage.clear();
});

test("IdleTimerManager, public session and sign in", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );
  const localStorageMock = (function () {
    let store = {};
    return {
      getItem(key) {
        return store[key] || null;
      },
      setItem(key, value) {
        store[key] = value.toString();
      },
      removeItem(key) {
        delete store[key];
      },
      clear() {
        store = {};
      },
    };
  })();
  Object.defineProperty(window, "localStorage", { value: localStorageMock });
  delete window.location;
  window.location = { assign: jest.fn() };

  render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  // Use reduced timeout for faster test
  expect(
    await screen.findByText(
      "You are not signed in. Sign in to create and update dashboards.",
    ),
  ).toBeInTheDocument();

  expect(
    await screen.findByText(
      "If you'd like to continue, you will only have access to public dashboards",
    ),
  ).toBeInTheDocument();

  expect(localStorage.getItem("dontShowPublicLoginOnStart")).toEqual(null);
  const dontShowOnStartupInput = screen.getByLabelText(
    "dont-show-public-user-on-startup",
  );
  fireEvent.click(dontShowOnStartupInput);
  expect(dontShowOnStartupInput).toBeChecked();
  expect(localStorage.getItem("dontShowPublicLoginOnStart")).toEqual("true");

  const signInButton = screen.getByRole("button", { name: "Sign in" });
  fireEvent.click(signInButton);

  expect(window.location.assign).toHaveBeenCalledWith(
    "http://api.test/accounts/login?next=undefined",
  );
  localStorage.clear();
});

test("IdleTimerManager, load session error", async () => {
  server.use(
    rest.get("http://api.test/api/session/", (req, res, ctx) => {
      return res(
        ctx.status(500),
        ctx.json({ error: "Internal Server Error" }),
        ctx.set("Content-Type", "application/json"),
      );
    }),
  );

  render(
    <ModalPriorityProvider>
      <IdleTimerManager />
    </ModalPriorityProvider>,
  );

  // no error handling because that is done in AppLoader
  expect(
    screen.queryByText("AxiosError: Request failed with status code 500"),
  ).not.toBeInTheDocument();
});
