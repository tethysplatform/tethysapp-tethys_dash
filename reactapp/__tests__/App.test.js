import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  mockedDashboards,
  mockedVisualizations,
} from "__tests__/utilities/constants";
import appAPI from "services/api/app";
appAPI.getDashboards = () => {
  return Promise.resolve(mockedDashboards);
};
appAPI.getVisualizations = () => {
  return Promise.resolve({ visualizations: mockedVisualizations });
};

import App from "App";

function renderWithRouter(ui, { route = "/" } = {}) {
  route = `${route}`;
  return {
    user: userEvent.setup(),
    ...render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>),
  };
}

it("Renders the Loading message", async () => {
  renderWithRouter(<App />);
  // "find" queries wait until element matching description is found
  const loadingMessage = await screen.findByText("Loading...");
  expect(loadingMessage).toBeInTheDocument();
});

it("Renders app title on Home view", async () => {
  renderWithRouter(<App />);
  // "find" queries wait until element matching description is found
  const linkElement = await screen.findByText("Select/Add Dashboard:");
  expect(linkElement).toBeInTheDocument();
});
