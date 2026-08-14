import { useEffect, useContext } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DataViewerModal from "components/modals/DataViewer/DataViewer";
import {
  userDashboard,
  mockedDateRangeVariable,
} from "__tests__/utilities/constants";
import createLoadedComponent, {
  InputVariablePComponent,
} from "__tests__/utilities/customRender";
import { GridItemContext, TabContext } from "components/contexts/Contexts";

const { ResizeObserver } = window;

beforeEach(() => {
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

afterEach(() => {
  window.ResizeObserver = ResizeObserver;
  jest.restoreAllMocks();
});

const TestingComponent = ({ gridItem, onTabUpdate }) => {
  const { tabs } = useContext(TabContext);
  useEffect(() => {
    onTabUpdate(tabs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);
  return (
    <GridItemContext.Provider
      value={{
        gridItemSource: gridItem.source,
        gridItemI: gridItem.i,
        gridItemMetadataString: gridItem.metadata_string,
        gridItemArgsString: gridItem.args_string,
        gridItemIndex: 0,
      }}
    >
      <DataViewerModal
        showModal={true}
        handleModalClose={jest.fn()}
        setGridItemMessage={jest.fn()}
        setShowGridItemMessage={jest.fn()}
      />
    </GridItemContext.Provider>
  );
};

TestingComponent.propTypes = {
  gridItem: PropTypes.object,
  onTabUpdate: PropTypes.func,
};

const sliderGridItem = () => {
  const gridItem = JSON.parse(JSON.stringify(mockedDateRangeVariable));
  gridItem.args_string = JSON.stringify({
    variable_name: "Storm",
    show_label: true,
    variable_options_source: "slider",
    "variable_options_source.metadata": {
      min: 0,
      max: 10,
      step: 1,
      dataType: "Number",
      outputFormat: "{{n}}",
    },
    initial_value: null,
  });
  return gridItem;
};

test("a slider variable input with no explicit initial value saves without a false validation error", async () => {
  const mockedDashboard = JSON.parse(JSON.stringify(userDashboard));
  const gridItem = sliderGridItem();
  mockedDashboard.tabs[0].gridItems[0] = gridItem;
  const mockUpdateTab = jest.fn();

  render(
    createLoadedComponent({
      children: (
        <>
          <TestingComponent gridItem={gridItem} onTabUpdate={mockUpdateTab} />
          <InputVariablePComponent />
        </>
      ),
      options: { initialDashboard: mockedDashboard },
    }),
  );

  const saveButton = await screen.findByLabelText("dataviewer-save-button");

  mockUpdateTab.mockClear();
  fireEvent.click(saveButton);

  await waitFor(() => expect(mockUpdateTab).toHaveBeenCalled());
  expect(
    screen.queryByText("Initial value must be selected in the dropdown"),
  ).not.toBeInTheDocument();

  const savedArgs = JSON.parse(
    mockUpdateTab.mock.calls.at(-1)[0][0].gridItems[0].args_string,
  );
  expect(savedArgs.variable_options_source).toBe("slider");
});
