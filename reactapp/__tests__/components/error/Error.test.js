import { render, screen } from "@testing-library/react";
import Error from "components/error/Error";

test("error", async () => {
  render(<Error title={"Error Title"} image={"some_image"} />);

  expect(await screen.findByText("Reload App")).toBeInTheDocument();
  expect(await screen.findByText("Exit the App")).toBeInTheDocument();
});
