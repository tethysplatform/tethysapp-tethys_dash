import { render, screen, fireEvent } from "@testing-library/react";
import CustomPicker from "components/inputs/CustomPicker";

it("CustomPicker", async () => {
  const pickerOptions = {
    pick1: () => <p>Pick 1</p>,
    pick2: () => <p>Pick 2</p>,
    pick3: () => <p>Pick 3</p>,
  };
  const onSelect = jest.fn();
  render(
    <CustomPicker
      maxColCount={2}
      pickerOptions={pickerOptions}
      onSelect={onSelect}
    />
  );

  expect(screen.getByText("Pick 1")).toBeInTheDocument();
  expect(screen.getByText("Pick 2")).toBeInTheDocument();
  expect(screen.getByText("Pick 3")).toBeInTheDocument();

  fireEvent.click(screen.getByText("Pick 1"));
  expect(onSelect).toHaveBeenCalledWith("pick1");

  fireEvent.click(screen.getByText("Pick 3"));
  expect(onSelect).toHaveBeenCalledWith("pick3");
});
