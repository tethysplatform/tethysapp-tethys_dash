import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import App from "App";

function renderWithRouter(ui, { route = "/" } = {}) {
  route = `/apps/tethysdash/${route}`;
  return {
    user: userEvent.setup(),
    ...render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>),
  };
}

it("Renders the Loading message", async () => {
  renderWithRouter(<App />);
  // "find" queries wait until element matching description is found
  const loadingMessage = await screen.findByText(/Loading.../i);
  expect(loadingMessage).toBeInTheDocument();
});

it("Renders app title on Home view", async () => {
  renderWithRouter(<App />);
  // "find" queries wait until element matching description is found
  const linkElement = await screen.findByText(/tethysdash/i);
  expect(linkElement).toBeInTheDocument();
});

it("Renders app title on Learn React view", async () => {
  renderWithRouter(<App />, "learn");
  // "find" queries wait until element matching description is found
  const linkElement = await screen.findByText(/tethysdash/i);
  expect(linkElement).toBeInTheDocument();
});

it("Has Home and Learn React items in the navigation menu", async () => {
  const { user } = renderWithRouter(<App />);
  // "find" queries wait until element matching description is found
  const navButton = await screen.findByRole("button", {
    name: /show navigation/i,
  });
  expect(navButton).toBeInTheDocument();
  user.click(navButton);

  const homeNavLink = await screen.findByRole("link", { name: /Home/i });
  const learnNavLink = await screen.findByRole("link", {
    name: /Learn React/i,
  });
  expect(homeNavLink).toBeVisible();
  expect(learnNavLink).toBeVisible();
});
