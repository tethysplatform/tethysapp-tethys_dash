import { act } from "react";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import Header from "components/layout/Header";
import { MemoryRouter } from "react-router-dom";
import renderWithLoaders from "__tests__/utilities/customRender";

window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: function () {},
      removeListener: function () {},
    };
  };

test("Header, staff user", async () => {
  renderWithLoaders({
    children: (
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>
    ),
  });

  expect(
    screen.queryByLabelText("dashboardSettingButton")
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("appSettingButton")).toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
  const selector = await screen.findByRole("combobox");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(selector);
  });

  const userOption = await screen.findByText("test_label");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(userOption);
  });

  const dashboardSettingButton = screen.getByLabelText(
    "dashboardSettingButton"
  );
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dashboardSettingButton);
  });
  expect(await screen.findByText("Dashboard Settings")).toBeInTheDocument();
});

test("Header, non staff user", async () => {
  renderWithLoaders({
    children: (
      <MemoryRouter initialEntries={["/"]}>
        <Header />
      </MemoryRouter>
    ),
    options: { user: { isAuthenticated: true, isStaff: false } },
  });

  expect(
    screen.queryByLabelText("dashboardSettingButton")
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText("appSettingButton")).not.toBeInTheDocument();
  expect(screen.getByLabelText("appExitButton")).toBeInTheDocument();

  expect(await screen.findByText("Select/Add Dashboard:")).toBeInTheDocument();
});
