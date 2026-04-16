import { render, screen, fireEvent } from "@testing-library/react";
import ImageSequence from "components/visualizations/ImageSequence";

const urls = [
  "https://example.com/frame1.gif",
  "https://example.com/frame2.gif",
  "https://example.com/frame3.gif",
];

it("renders all images in the DOM", () => {
  render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  const images = screen.getAllByAltText("sequence");
  expect(images).toHaveLength(3);
  expect(images[0].src).toBe(urls[0]);
  expect(images[1].src).toBe(urls[1]);
  expect(images[2].src).toBe(urls[2]);
});

it("shows loading text while active image has not loaded", () => {
  render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  expect(screen.getByText("Loading Images...")).toBeInTheDocument();
  // All images should be hidden while loading
  const images = screen.getAllByAltText("sequence");
  images.forEach((img) => {
    expect(img.style.visibility).toBe("hidden");
  });
});

it("shows active image after it loads", () => {
  render(
    <ImageSequence urls={urls} activeUrl={urls[1]} alt="sequence" />,
  );

  // Simulate the active image loading
  const images = screen.getAllByAltText("sequence");
  const activeImg = images.find((img) => img.src === urls[1]);
  fireEvent.load(activeImg);

  expect(screen.queryByText("Loading Images...")).not.toBeInTheDocument();
  expect(activeImg.style.visibility).toBe("visible");

  // Other images should remain hidden
  const otherImgs = images.filter((img) => img.src !== urls[1]);
  otherImgs.forEach((img) => {
    expect(img.style.visibility).toBe("hidden");
  });
});

it("shows error message when active image fails to load", () => {
  render(
    <ImageSequence
      urls={urls}
      activeUrl={urls[0]}
      alt="sequence"
      imageError="Custom error"
    />,
  );

  const images = screen.getAllByAltText("sequence");
  const activeImg = images.find((img) => img.src === urls[0]);
  fireEvent.error(activeImg);

  expect(screen.getByText("Custom error")).toBeInTheDocument();
  expect(screen.queryByText("Loading Images...")).not.toBeInTheDocument();
});

it("shows default error message when no imageError prop provided", () => {
  render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  const images = screen.getAllByAltText("sequence");
  fireEvent.error(images[0]);

  expect(screen.getByText("Failed to get image.")).toBeInTheDocument();
});

it("switches visible image when activeUrl changes", () => {
  const { rerender } = render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  // Load all images
  const images = screen.getAllByAltText("sequence");
  images.forEach((img) => fireEvent.load(img));

  const firstImg = images.find((img) => img.src === urls[0]);
  expect(firstImg.style.visibility).toBe("visible");

  // Change activeUrl to frame2
  rerender(
    <ImageSequence urls={urls} activeUrl={urls[1]} alt="sequence" />,
  );

  // frame2 is already loaded, so it should be visible immediately
  const secondImg = images.find((img) => img.src === urls[1]);
  expect(secondImg.style.visibility).toBe("visible");
  expect(firstImg.style.visibility).toBe("hidden");
});

it("attaches visualizationRef to the active image", () => {
  const ref = { current: null };

  render(
    <ImageSequence
      urls={urls}
      activeUrl={urls[1]}
      alt="sequence"
      visualizationRef={ref}
    />,
  );

  expect(ref.current).toBeTruthy();
  expect(ref.current.src).toBe(urls[1]);
});

it("does not duplicate entries in loadedUrls on repeated onLoad", () => {
  render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  const images = screen.getAllByAltText("sequence");
  // Fire onLoad twice for the same image
  fireEvent.load(images[0]);
  fireEvent.load(images[0]);

  // Active image should be visible (state not corrupted)
  expect(images[0].style.visibility).toBe("visible");
});

it("does not duplicate entries in errorUrls on repeated onError", () => {
  render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  const images = screen.getAllByAltText("sequence");
  fireEvent.error(images[0]);
  fireEvent.error(images[0]);

  // Error message should show once, not duplicated
  expect(screen.getByText("Failed to get image.")).toBeInTheDocument();
});

it("shows loading for new activeUrl that has not loaded yet", () => {
  const { rerender } = render(
    <ImageSequence urls={urls} activeUrl={urls[0]} alt="sequence" />,
  );

  // Load only the first image
  const images = screen.getAllByAltText("sequence");
  fireEvent.load(images[0]);

  expect(images[0].style.visibility).toBe("visible");
  expect(screen.queryByText("Loading Images...")).not.toBeInTheDocument();

  // Switch to a non-loaded image
  rerender(
    <ImageSequence urls={urls} activeUrl={urls[2]} alt="sequence" />,
  );

  // Should show loading since frame3 hasn't loaded yet
  expect(screen.getByText("Loading Images...")).toBeInTheDocument();
  // All images hidden while active is loading
  const updatedImages = screen.getAllByAltText("sequence");
  updatedImages.forEach((img) => {
    expect(img.style.visibility).toBe("hidden");
  });
});
