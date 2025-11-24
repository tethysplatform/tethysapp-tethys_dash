import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import AppInfoModal from "components/modals/AppInfo";
import { mockedDashboards } from "__tests__/utilities/constants";
import { server } from "__tests__/utilities/server";
import { rest } from "msw";

test("landing page app info modal and close", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            dashboards: [mockedDashboards],
            support_info: {
              support_email: "support@example.com",
              support_github: "some/github/url",
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  const user = userEvent.setup();
  const mockSetShowModal = jest.fn();
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

  render(
    createLoadedComponent({
      children: (
        <AppInfoModal showModal={true} setShowModal={mockSetShowModal} />
      ),
    })
  );

  expect(
    await screen.findByText("TethysDash Landing Page")
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /Welcome to TethysDash, a customizable data viewer and dashboard application. The landing page provides a summary of all available dashboards, including publicly available dashboards. For more information about the application and developing visualizations, check the official/i
    )
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Have questions or need support\? Contact us at/i)
  ).toBeInTheDocument();
  expect(screen.getByText("support@example.com")).toBeInTheDocument();
  expect(screen.getByText("GitHub")).toBeInTheDocument();
  const githubLink = screen.getByText("GitHub");
  expect(githubLink).toHaveAttribute("href", "some/github/url");
  expect(
    screen.getByText(
      /for inquiries about custom visualizations, dashboards, or any issues you encounter\./i
    )
  ).toBeInTheDocument();

  expect(localStorage.getItem("dontShowLandingPageInfoOnStart")).toEqual(null);
  const dontShowOnStartupInput = screen.getByLabelText("dontShowOnStartup");
  await user.click(dontShowOnStartupInput);
  expect(dontShowOnStartupInput).toBeChecked();
  expect(localStorage.getItem("dontShowLandingPageInfoOnStart")).toEqual(
    "true"
  );

  const closeButton = await screen.findByLabelText("Close");
  await userEvent.click(closeButton);
  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});

test("dashboard app info modal and close", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            dashboards: [mockedDashboards],
            support_info: {
              support_email: "support@example.com",
              support_github: null,
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  const user = userEvent.setup();
  const mockSetShowModal = jest.fn();
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

  render(
    createLoadedComponent({
      children: (
        <AppInfoModal
          showModal={true}
          setShowModal={mockSetShowModal}
          view="dashboard"
        />
      ),
    })
  );

  expect(await screen.findByText("TethysDash Dashboards")).toBeInTheDocument();
  expect(
    await screen.findByText(
      /If you would like to take a tour of the application, click on the button below to begin./i
    )
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      /TethysDash dashboards provide a customizable dataviewer for a variety of user defined data sources. For more information about the application and developing visualizations, check the official/i
    )
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Have questions or need support\? Contact us at/i)
  ).toBeInTheDocument();
  expect(screen.getByText("support@example.com")).toBeInTheDocument();
  expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
  expect(
    screen.getByText(
      /for inquiries about custom visualizations, dashboards, or any issues you encounter\./i
    )
  ).toBeInTheDocument();

  expect(localStorage.getItem("dontShowDashboardInfoOnStart")).toEqual(null);
  const dontShowOnStartupInput = screen.getByLabelText("dontShowOnStartup");
  await user.click(dontShowOnStartupInput);
  expect(dontShowOnStartupInput).toBeChecked();
  expect(localStorage.getItem("dontShowDashboardInfoOnStart")).toEqual("true");

  const closeButton = await screen.findByLabelText("Close");
  await userEvent.click(closeButton);
  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});

test("shows only email if only support_email is provided", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            dashboards: [mockedDashboards],
            support_info: {
              support_email: "support@example.com",
              support_github: null,
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  const mockSetShowModal = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <AppInfoModal showModal={true} setShowModal={mockSetShowModal} />
      ),
    })
  );

  expect(await screen.findByText(/Contact us at/i)).toBeInTheDocument();
  expect(screen.getByText("support@example.com")).toBeInTheDocument();
  expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
});

test("shows only github if only support_github is provided", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            dashboards: [mockedDashboards],
            support_info: {
              support_email: null,
              support_github: "https://github.com/example/support",
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  const mockSetShowModal = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <AppInfoModal showModal={true} setShowModal={mockSetShowModal} />
      ),
    })
  );

  expect(await screen.findByText(/Contact us at/i)).toBeInTheDocument();
  expect(screen.getByText("GitHub")).toBeInTheDocument();
  expect(screen.getByText("GitHub")).toHaveAttribute(
    "href",
    "https://github.com/example/support"
  );
  expect(screen.queryByText("support@example.com")).not.toBeInTheDocument();
});

test("does not show support section if neither email nor github is provided", async () => {
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/list/",
      (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            dashboards: [mockedDashboards],
            support_info: {
              support_email: null,
              support_github: null,
            },
          }),
          ctx.set("Content-Type", "application/json")
        );
      }
    )
  );

  const mockSetShowModal = jest.fn();
  render(
    createLoadedComponent({
      children: (
        <AppInfoModal showModal={true} setShowModal={mockSetShowModal} />
      ),
    })
  );

  expect(
    screen.queryByText(/Have questions or need support/i)
  ).not.toBeInTheDocument();
  expect(screen.queryByText("support@example.com")).not.toBeInTheDocument();
  expect(screen.queryByText("GitHub")).not.toBeInTheDocument();
});
