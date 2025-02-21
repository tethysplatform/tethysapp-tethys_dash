import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import FileUpload from "components/inputs/FileUpload";

it("FileUpload", async () => {
  const label = "Test Upload";
  const onFileUpload = jest.fn();
  render(<FileUpload label={label} onFileUpload={onFileUpload} />);

  const file = new File(["file content"], "test-file.txt", {
    type: "text/plain",
  });
  const input = screen.getByTestId("file-input");

  fireEvent.change(input, { target: { files: [file] } });

  expect(input.files[0]).toBe(file);
  expect(input.files).toHaveLength(1);

  await waitFor(() => {
    expect(onFileUpload).toHaveBeenCalledWith({
      uploadedFileName: "test-file.txt",
      fileContent: "file content",
    });
  });
});

it("FileUpload with invalid extension", async () => {
  const label = "Test Upload";
  const onFileUpload = jest.fn();
  render(
    <FileUpload
      label={label}
      onFileUpload={onFileUpload}
      extensionsAllowed={["json"]}
    />
  );

  const file = new File(["file content"], "test-file.txt", {
    type: "text/plain",
  });
  const input = screen.getByTestId("file-input");

  fireEvent.change(input, { target: { files: [file] } });

  expect(input.files[0]).toBe(file);
  expect(input.files).toHaveLength(1);

  await waitFor(() => {
    expect(onFileUpload).toHaveBeenCalledTimes(0);
  });
  expect(
    await screen.findByText(
      "txt is not a valid extension. The uploaded file must be one of the following extensions: json"
    )
  ).toBeInTheDocument();
});
