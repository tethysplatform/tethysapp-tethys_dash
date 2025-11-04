import CSVUploaderMetadata from "components/inputs/custom/CSVUploaderMetadata";
import { render, screen, fireEvent } from "@testing-library/react";
import selectEvent from "react-select-event";
import userEvent from "@testing-library/user-event";

test("CSVUploaderMetadata renders wiht initial headers and calls onChange", async () => {
    const mockOnChange = jest.fn();
    const values = { headers: ["A", "B"] };

    render(
        <CSVUploaderMetadata
            onChange={mockOnChange}
            values={values}
        />
    );

    expect(screen.getByText("CSV Columns")).toBeInTheDocument();

    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenLastCalledWith({ headers: ["A", "B"] });
});


test("CSVUploaderMetadata adds a new header via MultiInput input field", async () => {
    const mockOnChange = jest.fn();
    const values = { headers: [] };

    render(
        <CSVUploaderMetadata
            onChange={mockOnChange}
            values={values}
        />
    );
    
    const input = screen.getByPlaceholderText("Add a value and press enter");
    expect(input).toBeInTheDocument();

    await userEvent.type(input, "A{enter}");
    expect(screen.getByText("A")).toBeInTheDocument();
    
    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenLastCalledWith({ headers: ["A"] });
});


test("CSVUploaderMetadata removes a header via MultiInput remove button", async () => {
    const mockOnChange = jest.fn();
    const values = { headers: ["A", "B"] };

    render(
        <CSVUploaderMetadata
            onChange={mockOnChange}
            values={values}
        />
    );

    const removeBButton = screen.getByTitle("Remove B");
    expect(removeBButton).toBeInTheDocument();

    fireEvent.click(removeBButton);
    expect(screen.queryByText("B")).not.toBeInTheDocument();

    expect(mockOnChange).toHaveBeenCalledTimes(2);
    expect(mockOnChange).toHaveBeenLastCalledWith({ headers: ["A"] });
});
