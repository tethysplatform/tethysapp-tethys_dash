import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import createLoadedComponent from "__tests__/utilities/customRender";
import AppInfoModal from "components/modals/AppInfo";

test("landing page app info modal and close", async () => {
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

  expect(localStorage.getItem("dontShowDashboardInfoOnStart")).toEqual(null);
  const dontShowOnStartupInput = screen.getByLabelText("dontShowOnStartup");
  await user.click(dontShowOnStartupInput);
  expect(dontShowOnStartupInput).toBeChecked();
  expect(localStorage.getItem("dontShowDashboardInfoOnStart")).toEqual("true");

  const closeButton = await screen.findByLabelText("Close");
  await userEvent.click(closeButton);
  expect(mockSetShowModal).toHaveBeenCalledWith(false);
});
