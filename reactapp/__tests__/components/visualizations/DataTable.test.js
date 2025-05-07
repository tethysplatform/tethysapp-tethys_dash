import PropTypes from "prop-types";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import DataTable from "components/visualizations/DataTable";
import { mockedTableData } from "__tests__/utilities/constants";

function initAndRender(props) {
  const user = userEvent.setup();

  const DataTableRender = (props) => {
    return (
      <DataTable
        title={props.title}
        data={props.data}
        subtitle={props.subtitle}
      />
    );
  };

  DataTableRender.propTypes = {
    title: PropTypes.string,
    description: PropTypes.string,
    data: PropTypes.string,
    subtitle: PropTypes.string,
  };

  const { rerender } = render(DataTableRender(props));

  return {
    user,
    DataTableRender,
    rerender,
  };
}

it("Creates a Data Table with the provided data", () => {
  initAndRender(mockedTableData);

  expect(screen.getByText("User Information")).toBeInTheDocument();

  const header1 = screen.getByText("Name");
  const header2 = screen.getByText("Age");
  const header3 = screen.getByText("Occupation");
  expect(header1).toBeInTheDocument();
  expect(header2).toBeInTheDocument();
  expect(header3).toBeInTheDocument();

  const nameData1 = screen.getByText("Alice Johnson");
  const nameData2 = screen.getByText("Bob Smith");
  const nameData3 = screen.getByText("Charlie Brown");
  expect(nameData1).toBeInTheDocument();
  expect(nameData2).toBeInTheDocument();
  expect(nameData3).toBeInTheDocument();

  const ageData1 = screen.getByText("28");
  const ageData2 = screen.getByText("34");
  const ageData3 = screen.getByText("22");
  expect(ageData1).toBeInTheDocument();
  expect(ageData2).toBeInTheDocument();
  expect(ageData3).toBeInTheDocument();

  const occupationData1 = screen.getByText("Engineer");
  const occupationData2 = screen.getByText("Designer");
  const occupationData3 = screen.getByText("Teacher");
  expect(occupationData1).toBeInTheDocument();
  expect(occupationData2).toBeInTheDocument();
  expect(occupationData3).toBeInTheDocument();
});

it("Creates a Data Table with subtitle with the provided data", () => {
  mockedTableData.subtitle = "some subtitle";
  initAndRender(mockedTableData);

  expect(screen.getByText("User Information")).toBeInTheDocument();
  expect(screen.getByText("some subtitle")).toBeInTheDocument();

  const header1 = screen.getByText("Name");
  const header2 = screen.getByText("Age");
  const header3 = screen.getByText("Occupation");
  expect(header1).toBeInTheDocument();
  expect(header2).toBeInTheDocument();
  expect(header3).toBeInTheDocument();

  const nameData1 = screen.getByText("Alice Johnson");
  const nameData2 = screen.getByText("Bob Smith");
  const nameData3 = screen.getByText("Charlie Brown");
  expect(nameData1).toBeInTheDocument();
  expect(nameData2).toBeInTheDocument();
  expect(nameData3).toBeInTheDocument();

  const ageData1 = screen.getByText("28");
  const ageData2 = screen.getByText("34");
  const ageData3 = screen.getByText("22");
  expect(ageData1).toBeInTheDocument();
  expect(ageData2).toBeInTheDocument();
  expect(ageData3).toBeInTheDocument();

  const occupationData1 = screen.getByText("Engineer");
  const occupationData2 = screen.getByText("Designer");
  const occupationData3 = screen.getByText("Teacher");
  expect(occupationData1).toBeInTheDocument();
  expect(occupationData2).toBeInTheDocument();
  expect(occupationData3).toBeInTheDocument();
});

it("Renders nothing if the data is empty", () => {
  initAndRender({
    title: "Placeholder Title",
    data: [],
  });

  expect(screen.getByText("No Data Available")).toBeInTheDocument();
});
