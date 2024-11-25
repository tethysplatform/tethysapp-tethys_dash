import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, useEffect } from "react";
import DashboardItemDropdown from "components/buttons/DashboardItemDropdown";
import SelectedDashboardContextProvider, {
  useLayoutContext,
} from "components/contexts/SelectedDashboardContext";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";
import { mockedDashboards } from "__tests__/utilities/constants";
import PropTypes from "prop-types";

const TestingComponent = (props) => {
  const { setLayoutContext } = useLayoutContext();

  useEffect(() => {
    setLayoutContext(props.layoutContext);
    // eslint-disable-next-line
  }, []);

  return (
    <DashboardItemDropdown
      showFullscreen={props.showFullscreen}
      deleteGridItem={props.deleteGridItem}
      editGridItem={props.editGridItem}
      editSize={props.editSize}
      copyGridItem={props.copyGridItem}
    />
  );
};

test("DashboardItemDropdown for noneditable item and no fullscreen", () => {
  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <TestingComponent
          showFullscreen={null}
          deleteGridItem={jest.fn()}
          editGridItem={jest.fn()}
          editSize={jest.fn()}
          copyGridItem={jest.fn()}
          layoutContext={mockedDashboards.editable}
        />
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  expect(screen.queryByText("Fullscreen")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Visualization")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(screen.queryByText("Create Copy")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();
});

test("DashboardItemDropdown for noneditable item but has fullscreen", async () => {
  const mockShowFullscreen = jest.fn();

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <TestingComponent
          showFullscreen={mockShowFullscreen}
          deleteGridItem={jest.fn()}
          editGridItem={jest.fn()}
          editSize={jest.fn()}
          copyGridItem={jest.fn()}
          layoutContext={mockedDashboards.noneditable}
        />
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(screen.queryByText("Edit Visualization")).not.toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(screen.queryByText("Create Copy")).not.toBeInTheDocument();
  expect(screen.queryByText("Delete")).not.toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item but already in edit mode", async () => {
  const mockShowFullscreen = jest.fn();
  const mockDeleteGridItem = jest.fn();
  const mockEditGridItem = jest.fn();
  const mockCopyGridItem = jest.fn();

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <TestingComponent
          showFullscreen={mockShowFullscreen}
          deleteGridItem={mockDeleteGridItem}
          editGridItem={mockEditGridItem}
          editSize={null}
          copyGridItem={mockCopyGridItem}
          layoutContext={mockedDashboards.editable}
        />
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(screen.queryByText("Edit Size/Location")).not.toBeInTheDocument();
  expect(await screen.findByText("Create Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyGridItemButton);
  });
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

test("DashboardItemDropdown for editable item and not in edit mode", async () => {
  const mockShowFullscreen = jest.fn();
  const mockDeleteGridItem = jest.fn();
  const mockEditGridItem = jest.fn();
  const mockCopyGridItem = jest.fn();
  const mockEditSize = jest.fn();

  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <TestingComponent
          showFullscreen={mockShowFullscreen}
          deleteGridItem={mockDeleteGridItem}
          editGridItem={mockEditGridItem}
          editSize={mockEditSize}
          copyGridItem={mockCopyGridItem}
          layoutContext={mockedDashboards.editable}
        />
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const dropdownToggle = screen.getByRole("button");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(dropdownToggle);
  });

  expect(await screen.findByText("Fullscreen")).toBeInTheDocument();
  expect(await screen.findByText("Edit Visualization")).toBeInTheDocument();
  expect(await screen.findByText("Edit Size/Location")).toBeInTheDocument();
  expect(await screen.findByText("Create Copy")).toBeInTheDocument();
  expect(await screen.findByText("Delete")).toBeInTheDocument();

  const fullScreenButton = await screen.findByText("Fullscreen");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(fullScreenButton);
  });
  expect(mockShowFullscreen.mock.calls).toHaveLength(1);

  const editGridItemButton = await screen.findByText("Edit Visualization");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editGridItemButton);
  });
  expect(mockEditGridItem.mock.calls).toHaveLength(1);

  const editSizeButton = await screen.findByText("Edit Size/Location");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(editSizeButton);
  });
  expect(mockEditSize.mock.calls).toHaveLength(1);

  const copyGridItemButton = await screen.findByText("Create Copy");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(copyGridItemButton);
  });
  expect(mockCopyGridItem.mock.calls).toHaveLength(1);

  const deleteGridItemButton = await screen.findByText("Delete");
  // eslint-disable-next-line
  await act(async () => {
    await userEvent.click(deleteGridItemButton);
  });
  expect(mockDeleteGridItem.mock.calls).toHaveLength(1);
});

TestingComponent.propTypes = {
  layoutContext: PropTypes.object,
  showFullscreen: PropTypes.func,
  deleteGridItem: PropTypes.func,
  editGridItem: PropTypes.func,
  editSize: PropTypes.func,
  copyGridItem: PropTypes.func,
};
