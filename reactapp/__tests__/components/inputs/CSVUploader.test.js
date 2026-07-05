import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataViewerModeContext } from "components/contexts/Contexts";
import CSVUploader from "components/inputs/CSVUploader";

test("CSVUploader with defaults", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <CSVUploader onChange={mockOnChange} />
    </DataViewerModeContext.Provider>,
  );

  const toggleButton = screen.getByRole("button");
  expect(toggleButton).toHaveClass("btn-primary");
  expect(screen.getByText(/Toggle Table/i)).toBeInTheDocument();
  expect(screen.getByTestId("file-input")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("CSVUploader no headers", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <CSVUploader
        buttonText="Toggle CSV"
        variant="secondary"
        headers={[]}
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  const toggleButton = screen.getByRole("button");
  expect(toggleButton).toHaveClass("btn-secondary");
  expect(screen.getByText(/Toggle CSV/i)).toBeInTheDocument();
  expect(screen.getByTestId("file-input")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

test("CSVUploader with headers", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <CSVUploader
        buttonText="Toggle Table"
        variant="primary"
        headers={["A", "B"]}
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  expect(screen.getByText(/Toggle Table/i)).toBeInTheDocument();
  expect(screen.getByTestId("file-input")).toBeInTheDocument();
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "B" })).toBeInTheDocument();

  const collasibleTableDiv = screen.getByTestId("collapsible-table");
  expect(collasibleTableDiv).toHaveClass("collapse");
  expect(collasibleTableDiv).not.toHaveClass("show");

  const toggleButton = screen.getByRole("button");
  fireEvent.click(toggleButton);
  await waitFor(() => {
    expect(collasibleTableDiv).toHaveClass("show");
  });
});

test("CSVUploader with uploading a correct file not in DataViewerMode", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
      <CSVUploader
        buttonText="Toggle Table"
        variant="primary"
        headers={["A", "B"]}
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  const file = new File(["A,B\n1,2\n3,4"], "test.csv", { type: "text/csv" });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  expect(mockOnChange).toHaveBeenLastCalledWith([
    { A: "1", B: "2" },
    { A: "3", B: "4" },
  ]);
});

test("CSVUploader with uploading a correct file in DataViewerMode", async () => {
  const mockOnChange = jest.fn();

  render(
    <DataViewerModeContext.Provider value={{ inDataViewerMode: true }}>
      <CSVUploader
        buttonText="Toggle Table"
        variant="primary"
        headers={["A", "B"]}
        onChange={mockOnChange}
      />
    </DataViewerModeContext.Provider>,
  );

  const file = new File(["A,B\n1,2\n3,4"], "test.csv", { type: "text/csv" });
  const fileInput = screen.getByTestId("file-input");
  fireEvent.change(fileInput, { target: { files: [file] } });

  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalledTimes(1);
  });

  expect(mockOnChange).toHaveBeenLastCalledWith("test.csv");
});
