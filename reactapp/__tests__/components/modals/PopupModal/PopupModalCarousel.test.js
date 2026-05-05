import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModalCarousel from "components/modals/PopupModal/PopupModalCarousel";

const FEATURES = [
  { layerName: "L", attributes: { id: "a" } },
  { layerName: "L", attributes: { id: "b" } },
  { layerName: "L", attributes: { id: "c" } },
];

describe("PopupModalCarousel", () => {
  test("renders nothing when there are 0 features", () => {
    render(
      <PopupModalCarousel
        features={[]}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("popup-modal-carousel")).toBeNull();
  });

  test("renders nothing when there is only 1 feature (no selection needed)", () => {
    render(
      <PopupModalCarousel
        features={[FEATURES[0]]}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("popup-modal-carousel")).toBeNull();
  });

  test("renders one chip per feature for multi-feature input", () => {
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId("popup-modal-carousel")).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  test("falls back to 'Feature N' label when no getLabel is supplied", () => {
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(screen.getByText("Feature 1")).toBeInTheDocument();
    expect(screen.getByText("Feature 2")).toBeInTheDocument();
    expect(screen.getByText("Feature 3")).toBeInTheDocument();
  });

  test("uses getLabel(feature, i) when supplied", () => {
    const getLabel = (feature, i) => `${feature.attributes.id}@${i}`;
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
        getLabel={getLabel}
      />,
    );
    expect(screen.getByText("a@0")).toBeInTheDocument();
    expect(screen.getByText("b@1")).toBeInTheDocument();
    expect(screen.getByText("c@2")).toBeInTheDocument();
  });

  test("active chip carries aria-selected=true; others false", () => {
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={1}
        onActiveIndexChange={jest.fn()}
      />,
    );
    const chips = screen.getAllByRole("tab");
    expect(chips[0]).toHaveAttribute("aria-selected", "false");
    expect(chips[1]).toHaveAttribute("aria-selected", "true");
    expect(chips[2]).toHaveAttribute("aria-selected", "false");
  });

  test("clicking a chip calls onActiveIndexChange with its index", async () => {
    const user = userEvent.setup();
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    await user.click(screen.getByTestId("popup-modal-carousel-chip-2"));
    expect(onActiveIndexChange).toHaveBeenCalledWith(2);
  });

  test("ArrowRight advances active index", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    fireEvent.keyDown(screen.getByTestId("popup-modal-carousel"), {
      key: "ArrowRight",
    });
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
  });

  test("ArrowLeft decreases active index, clamps at 0", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    fireEvent.keyDown(screen.getByTestId("popup-modal-carousel"), {
      key: "ArrowLeft",
    });
    // No change emitted because activeIndex was already 0.
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });

  test("Home/End jump to the bounds", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={1}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    const carousel = screen.getByTestId("popup-modal-carousel");
    fireEvent.keyDown(carousel, { key: "End" });
    expect(onActiveIndexChange).toHaveBeenLastCalledWith(2);
    fireEvent.keyDown(carousel, { key: "Home" });
    expect(onActiveIndexChange).toHaveBeenLastCalledWith(0);
  });

  test("does not fire onActiveIndexChange when arrow is pressed at the boundary", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={2}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    fireEvent.keyDown(screen.getByTestId("popup-modal-carousel"), {
      key: "ArrowRight",
    });
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });
});
