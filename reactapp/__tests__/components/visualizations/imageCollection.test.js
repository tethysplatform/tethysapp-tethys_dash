import { act, fireEvent, render, screen } from "@testing-library/react";

import ImageCollection from "components/visualizations/ImageCollection";

const defaultProps = {
  urls: [
    "https://example.com/image1.png",
    "https://example.com/image2.png",
    "https://example.com/image3.png",
  ],
};

function renderCollection(overrides = {}) {
  return render(<ImageCollection {...defaultProps} {...overrides} />);
}

describe("ImageCollection", () => {
  it("renders all images from urls", () => {
    renderCollection();

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
    expect(images[0].src).toBe("https://example.com/image1.png");
    expect(images[1].src).toBe("https://example.com/image2.png");
    expect(images[2].src).toBe("https://example.com/image3.png");
  });

  it("renders correct alt text for each image", () => {
    renderCollection();

    expect(screen.getByAltText("image-0")).toBeInTheDocument();
    expect(screen.getByAltText("image-1")).toBeInTheDocument();
    expect(screen.getByAltText("image-2")).toBeInTheDocument();
  });

  it("renders title when provided", () => {
    renderCollection({ title: "My Images" });

    expect(screen.getByText("My Images")).toBeInTheDocument();
  });

  it("does not render title when not provided", () => {
    renderCollection();

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("renders empty grid when urls is empty", () => {
    renderCollection({ urls: [] });

    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  it("shows default error message when image fails to load", () => {
    renderCollection({ urls: ["https://example.com/broken.png"] });

    const image = screen.getByAltText("image-0");
    fireEvent.error(image);

    expect(screen.getByText("Failed to get image.")).toBeInTheDocument();
    expect(screen.queryByAltText("image-0")).not.toBeInTheDocument();
  });

  it("shows custom error message when imageError prop is provided", () => {
    renderCollection({
      urls: ["https://example.com/broken.png"],
      imageError: "Image unavailable",
    });

    const image = screen.getByAltText("image-0");
    fireEvent.error(image);

    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
  });

  it("only replaces the broken image, not all images", () => {
    renderCollection();

    const image = screen.getByAltText("image-1");
    fireEvent.error(image);

    expect(screen.getByAltText("image-0")).toBeInTheDocument();
    expect(screen.queryByAltText("image-1")).not.toBeInTheDocument();
    expect(screen.getByAltText("image-2")).toBeInTheDocument();
    expect(screen.getByText("Failed to get image.")).toBeInTheDocument();
  });

  it("handles multiple images failing", () => {
    renderCollection();

    fireEvent.error(screen.getByAltText("image-0"));
    fireEvent.error(screen.getByAltText("image-2"));

    const errors = screen.getAllByText("Failed to get image.");
    expect(errors).toHaveLength(2);
    expect(screen.getByAltText("image-1")).toBeInTheDocument();
  });

  it("accepts a visualizationRef", () => {
    const ref = { current: null };
    renderCollection({ visualizationRef: ref });

    expect(ref.current).not.toBeNull();
  });

  it("accepts columns prop", () => {
    renderCollection({ columns: 3 });

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);
  });

  it("does not add duplicate url to error set on repeated error events", () => {
    renderCollection({
      urls: [
        "https://example.com/broken.png",
        "https://example.com/broken.png",
      ],
    });

    const [img0, img1] = screen.getAllByRole("img");

    // Dispatch both errors in a single act() so React batches the state
    // updates — the second setErrorUrls call sees the url already in the
    // set and hits the early-return branch (line 55)
    act(() => {
      img0.dispatchEvent(new Event("error", { bubbles: false }));
      img1.dispatchEvent(new Event("error", { bubbles: false }));
    });

    expect(screen.getAllByText("Failed to get image.")).toHaveLength(2);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
