import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VisualizationCard from "components/modals/DataViewer/VisualizationCard";

it("VisualizationCard", async () => {
  const label = "some label";
  const type = "some type";
  const description = "some description";
  const tags = ["test", "tag"];
  const mockOnClick = jest.fn();

  render(
    <VisualizationCard
      label={label}
      type={type}
      description={description}
      tags={tags}
      onClick={mockOnClick}
    />
  );

  expect(await screen.findByText(label)).toBeInTheDocument();
  const thumbnail = screen.getByRole("img");
  expect(thumbnail).toBeInTheDocument();
  expect(thumbnail.src).toBe(
    "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Aptenodytes_forsteri_-Snow_Hill_Island%2C_Antarctica_-adults_and_juvenile-8.jpg/640px-Aptenodytes_forsteri_-Snow_Hill_Island%2C_Antarctica_-adults_and_juvenile-8.jpg"
  );

  fireEvent.mouseEnter(thumbnail);

  expect(await screen.findByText("Description")).toBeInTheDocument();
  expect(await screen.findByText(`: ${description}`)).toBeInTheDocument();

  expect(await screen.findByText("Type")).toBeInTheDocument();
  expect(await screen.findByText(`: ${type}`)).toBeInTheDocument();

  expect(await screen.findByText("Tags")).toBeInTheDocument();
  expect(await screen.findByText(`: ${tags.join(", ")}`)).toBeInTheDocument();

  fireEvent.mouseLeave(thumbnail);

  await waitFor(() => {
    expect(screen.queryByText(`: ${description}`)).not.toBeInTheDocument();
  });
  expect(screen.queryByText(`: ${type}`)).not.toBeInTheDocument();
  expect(screen.queryByText(`: ${tags.join(", ")}`)).not.toBeInTheDocument();

  await userEvent.click(thumbnail);
  expect(mockOnClick).toHaveBeenCalledTimes(1);
});
