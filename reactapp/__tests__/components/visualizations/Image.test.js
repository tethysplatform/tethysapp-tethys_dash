import PropTypes from "prop-types";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Image from "components/visualizations/Image";

function initAndRender(props) {
  const user = userEvent.setup();

  const ImageRender = (props) => {
    return (
      <Image
        source={props.source}
        alt={props.alt}
      />
    );
  };

  ImageRender.propTypes = {
    source: PropTypes.string,
    alt: PropTypes.string,
  };

  const { rerender } = render(ImageRender(props));

  return {
    user,
    ImageRender,
    rerender
  };
}

it("Creates an image with the correct source and alt", () => {
  initAndRender({
    source: "https://www.aquaveo.com/images/aquaveo_logo.svg",
    alt: "Aquaveo Logo"
  });

  expect(screen.getByAltText("Aquaveo Logo")).toBeInTheDocument();
  expect(screen.getByAltText("Aquaveo Logo").src).toBe("https://www.aquaveo.com/images/aquaveo_logo.svg");
});

it("Doesn't render an image if the source is invalid", () => {
  initAndRender({
    source: "http://localhost:3000/non-existent-image.png",
    alt: "Invalid Logo"
  });

  const image = screen.getByAltText("Invalid Logo");

  expect(image).toBeInTheDocument();
  fireEvent.error(image); // Weird that you need to force an error but okay?

  expect(screen.getByText("Failed to get image.")).toBeInTheDocument();
});