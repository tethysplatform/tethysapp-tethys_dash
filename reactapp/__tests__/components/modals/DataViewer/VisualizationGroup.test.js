import { useState } from "react";
import { render, screen } from "@testing-library/react";
import VisualizationGroup from "components/modals/DataViewer/VisualizationGroup";
import PropTypes from "prop-types";
import userEvent from "@testing-library/user-event";

const TestingComponent = ({ children, title }) => {
  const [sectionsOpened, setSectionsOpened] = useState([]);

  return (
    <>
      <VisualizationGroup
        title={title}
        sectionsOpened={sectionsOpened}
        setSectionsOpened={setSectionsOpened}
      >
        {children}
      </VisualizationGroup>
      <p data-testid="sectionsOpened">{JSON.stringify(sectionsOpened)}</p>
    </>
  );
};

it("VisualizationGroup", async () => {
  const title = "Some Title";

  render(<TestingComponent title={title}>Hello World</TestingComponent>);

  const sectionTitle = await screen.findByText(title);
  expect(sectionTitle).toBeInTheDocument();
  const sectionArrow = screen.getByLabelText("Section Arrow");
  expect(sectionArrow).toHaveStyle("transform: rotate(-90deg)");
  expect(await screen.findByTestId("sectionsOpened")).toHaveTextContent(
    JSON.stringify([])
  );

  await userEvent.click(sectionTitle);

  expect(sectionArrow).toHaveStyle("transform: rotate(0deg)");
  expect(await screen.findByTestId("sectionsOpened")).toHaveTextContent(
    JSON.stringify([title])
  );

  await userEvent.click(sectionTitle);

  expect(sectionArrow).toHaveStyle("transform: rotate(-90deg)");
  expect(await screen.findByTestId("sectionsOpened")).toHaveTextContent(
    JSON.stringify([])
  );
});

TestingComponent.propTypes = {
  title: PropTypes.string,
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.element,
    PropTypes.object,
  ]),
};
