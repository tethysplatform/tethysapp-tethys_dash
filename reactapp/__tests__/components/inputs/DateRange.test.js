import DateRange from "components/inputs/DateRange";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataViewerModeContext } from "components/contexts/Contexts";

describe("DateRange Component", () => {
  test("renders DatePicker components with correct labels and values", () => {
    render(
      <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
        <DateRange
          values={{ StartDate: "2025-08-01", EndDate: "2025-08-15" }}
          metadata={{
            startDateVariable: "StartDate",
            endDateVariable: "EndDate",
            format: "yyyy-MM-dd",
          }}
          onChange={jest.fn()}
        />
        ,
      </DataViewerModeContext.Provider>,
    );

    expect(screen.getByLabelText("StartDate")).toHaveValue("2025-08-01");
    expect(screen.getByLabelText("EndDate")).toHaveValue("2025-08-15");
  });

  test("calls onChange with updated start date", () => {
    const handleChange = jest.fn();
    render(
      <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
        <DateRange
          values={{ StartDate: "2025-08-01", EndDate: "2025-08-15" }}
          metadata={{
            startDateVariable: "StartDate",
            endDateVariable: "EndDate",
            format: "yyyy-MM-dd",
          }}
          onChange={handleChange}
        />
      </DataViewerModeContext.Provider>,
    );

    const startDateInput = screen.getByLabelText("StartDate");
    fireEvent.change(startDateInput, { target: { value: "2025-08-05" } });

    expect(handleChange).toHaveBeenCalledWith({
      StartDate: "2025-08-05",
      EndDate: "2025-08-15",
    });
  });

  test("calls onChange with updated end date", () => {
    const handleChange = jest.fn();
    const { rerender } = render(
      <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
        <DateRange
          values={{ StartDate: "2025-08-01", EndDate: "2025-08-15" }}
          metadata={{
            startDateVariable: "StartDate",
            endDateVariable: "EndDate",
            format: "yyyy-MM-dd",
          }}
          onChange={handleChange}
        />
      </DataViewerModeContext.Provider>,
    );

    const endDateInput = screen.getByLabelText("EndDate");
    fireEvent.change(endDateInput, { target: { value: "2025-08-20" } });

    expect(handleChange).toHaveBeenCalledWith({
      StartDate: "2025-08-01",
      EndDate: "2025-08-20",
    });

    rerender(
      <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
        <DateRange
          values={{ StartDate: "2025-08-02", EndDate: "2025-08-20" }}
          metadata={{
            startDateVariable: "Start Date",
            endDateVariable: "End Date",
            format: "yyyy-MM-dd",
          }}
          onChange={handleChange}
        />
      </DataViewerModeContext.Provider>,
    );

    expect(handleChange).toHaveBeenCalledWith({
      "Start Date": "2025-08-02",
      "End Date": "2025-08-20",
    });

    rerender(
      <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
        <DateRange
          values={{
            "New Start Date": "2025-08-02",
            "New End Date": "2025-08-20",
          }}
          metadata={{
            startDateVariable: "New Start Date",
            endDateVariable: "New End Date",
            format: "yyyy-MM-dd",
          }}
          onChange={handleChange}
        />
      </DataViewerModeContext.Provider>,
    );

    expect(handleChange).toHaveBeenCalledWith({
      "New Start Date": "2025-08-02",
      "New End Date": "2025-08-20",
    });
  });

  test("handles default variable names when metadata is missing", () => {
    render(
      <DataViewerModeContext.Provider value={{ inDataViewerMode: false }}>
        <DateRange values={{}} onChange={jest.fn()} />
      </DataViewerModeContext.Provider>,
    );
    expect(screen.getByLabelText("Start Date")).toHaveValue("");
    expect(screen.getByLabelText("End Date")).toHaveValue("");
  });
});
