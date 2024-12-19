import { render, screen } from "@testing-library/react";
import { useEffect } from "react";
import EditingContextProvider, {
  useEditingContext,
} from "components/contexts/EditingContext";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TestingComponent = () => {
  const { isEditing, setIsEditing } = useEditingContext();
  useEffect(() => {
    sleep(1).then(() => {
      setIsEditing(true);
    });
    // eslint-disable-next-line
  }, []);

  return <p>{isEditing ? "yes" : "no"}</p>;
};

test("editing context", async () => {
  render(
    <EditingContextProvider>
      <TestingComponent />
    </EditingContextProvider>
  );

  expect(await screen.findByText("no")).toBeInTheDocument();
  expect(await screen.findByText("yes")).toBeInTheDocument();
});
