import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import SelectedDashboardContextProvider, {
  useLayoutContext,
  useLayoutNameContext,
  useLayoutLabelContext,
  useLayoutNotesContext,
  useLayoutGridItemsContext,
  useLayoutEditableContext,
  useLayoutAccessGroupsContext,
} from "components/contexts/SelectedDashboardContext";
import { mockedDashboards } from "__tests__/utilities/constants";
import VariableInputsContextProvider from "components/contexts/VariableInputsContext";

const TestingComponent = () => {
  const [setLayoutContext, resetLayoutContext, getLayoutContext] =
    useLayoutContext();
  const name = useLayoutNameContext()[0];
  const label = useLayoutLabelContext()[0];
  const notes = useLayoutNotesContext()[0];
  const gridItems = useLayoutGridItemsContext()[0];
  const editable = useLayoutEditableContext();
  const accessGroups = useLayoutAccessGroupsContext()[0];

  useEffect(() => {
    setLayoutContext(mockedDashboards.test2);
    // eslint-disable-next-line
  }, []);

  return (
    <>
      <button onClick={resetLayoutContext}></button>
      <div data-testid="individual-getter">
        <p>{name}</p>
        <p>{label}</p>
        <p>{notes}</p>
        <ul>
          {gridItems.map((gridItem, index) => {
            return <li key={index}>{gridItem.i}</li>;
          })}
        </ul>
        <p>{editable ? "yes" : "no"}</p>
        <ul>
          {accessGroups.map((accessGroup, index) => {
            return <li key={index}>{accessGroup}</li>;
          })}
        </ul>
      </div>
      <div data-testid="group-getter">
        <p>{getLayoutContext().name}</p>
        <p>{getLayoutContext().label}</p>
        <p>{getLayoutContext().notes}</p>
        <ul>
          {getLayoutContext().gridItems.map((gridItem, index) => {
            return <li key={index}>{gridItem.i}</li>;
          })}
        </ul>
        <p>{getLayoutContext().editable ? "yes" : "no"}</p>
        <ul>
          {getLayoutContext().access_groups.map((accessGroup, index) => {
            return <li key={index}>{accessGroup}</li>;
          })}
        </ul>
      </div>
    </>
  );
};

test("selected dashboard context", async () => {
  render(
    <VariableInputsContextProvider>
      <SelectedDashboardContextProvider>
        <TestingComponent />
      </SelectedDashboardContextProvider>
    </VariableInputsContextProvider>
  );

  const individualGetter = await screen.findByTestId("individual-getter");
  expect(within(individualGetter).getByText("test2")).toBeInTheDocument();
  expect(within(individualGetter).getByText("test_label2")).toBeInTheDocument();
  expect(within(individualGetter).getByText("test_notes2")).toBeInTheDocument();
  expect(within(individualGetter).getByText("1")).toBeInTheDocument();
  expect(within(individualGetter).getByText("no")).toBeInTheDocument();
  expect(within(individualGetter).getByText("public")).toBeInTheDocument();

  const groupGetter = await screen.findByTestId("group-getter");
  expect(within(groupGetter).getByText("test2")).toBeInTheDocument();
  expect(within(groupGetter).getByText("test_label2")).toBeInTheDocument();
  expect(within(groupGetter).getByText("test_notes2")).toBeInTheDocument();
  expect(within(groupGetter).getByText("1")).toBeInTheDocument();
  expect(within(groupGetter).getByText("no")).toBeInTheDocument();
  expect(within(groupGetter).getByText("public")).toBeInTheDocument();

  const button = screen.getByRole("button");
  await userEvent.click(button);
  expect(screen.queryByText("test2")).not.toBeInTheDocument();
  expect(screen.queryByText("test_label2")).not.toBeInTheDocument();
  expect(screen.queryByText("test_notes2")).not.toBeInTheDocument();
  expect(screen.queryByText("1")).not.toBeInTheDocument();
  expect(within(groupGetter).getByText("no")).toBeInTheDocument();
  expect(screen.queryByText("public")).not.toBeInTheDocument();
});
