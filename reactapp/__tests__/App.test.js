import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "App";

function renderWithRouter(ui, { route = "/" } = {}) {
  route = `${route}`;
  return {
    user: userEvent.setup(),
    ...render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>),
  };
}

it("Renders the loading spinner", async () => {
  renderWithRouter(<App />);
  // The loader shows a spinner only; its status text is logged, not rendered.
  const loader = await screen.findByTestId("loading-animation");
  expect(loader).toBeInTheDocument();
});
