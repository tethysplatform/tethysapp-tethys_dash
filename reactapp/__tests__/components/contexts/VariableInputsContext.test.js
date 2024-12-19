import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import VariableInputsContextProvider, {
  useVariableInputValuesContext,
} from "components/contexts/VariableInputsContext";

const TestingComponent = () => {
  const {
    variableInputValues,
    setVariableInputValues,
    updateVariableInputValuesWithGridItems,
  } = useVariableInputValuesContext();
  const gridItems = [
    { args_string: "{}", source: "source" },
    {
      args_string: JSON.stringify({
        variable_name: "testArg",
        initial_value: "some_other_value",
      }),
      source: "Variable Input",
    },
    {
      args_string: JSON.stringify({
        variable_name: "testArg2",
        initial_value: "some_value",
      }),
      source: "Variable Input",
    },
  ];

  useEffect(() => {
    setVariableInputValues({ testArg: "some_value" });
    // eslint-disable-next-line
  }, []);

  function updateVariables() {
    updateVariableInputValuesWithGridItems(gridItems);
  }

  return (
    <>
      <button onClick={updateVariables}></button>
      {Object.keys(variableInputValues).map((key) => (
        <p key={key}>
          {key} - {variableInputValues[key]}
        </p>
      ))}
    </>
  );
};

test("variable inputs context", async () => {
  render(
    <VariableInputsContextProvider>
      <TestingComponent />
    </VariableInputsContextProvider>
  );

  expect(await screen.findByText("testArg - some_value")).toBeInTheDocument();
  expect(screen.queryByText("testArg2 - some_value")).not.toBeInTheDocument();

  const button = screen.getByRole("button");
  await userEvent.click(button);

  expect(await screen.findByText("testArg - some_value")).toBeInTheDocument();
  expect(await screen.findByText("testArg2 - some_value")).toBeInTheDocument();
  // The line below is because we just want to add new variable inputs using initial values
  // The variableInputValues keeps track of current variable inputs and needs to keep changed values from the user
  expect(
    screen.queryByText("testArg - some_other_value")
  ).not.toBeInTheDocument();
});
