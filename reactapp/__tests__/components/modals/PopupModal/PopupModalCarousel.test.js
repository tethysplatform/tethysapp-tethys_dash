import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PopupModalCarousel, {
  computeNextIndexFromKey,
} from "components/modals/PopupModal/PopupModalCarousel";

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

  // Line 70 — handleKeyDown's defensive `!features || features.length === 0`
  // guard. The Strip only mounts when features.length >= 2 (line 89), so the
  // handler is normally only invokable when features is healthy. We exploit
  // useCallback's reference-equality deps: mutating the array in place keeps
  // the same reference, so the already-attached handler keeps running, but
  // its closure now sees features.length === 0 and the guard fires.
  test("handleKeyDown's empty-features guard fires when the array is mutated to empty in place", () => {
    const features = [...FEATURES];
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={features}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );

    // Empty the array — same reference, length now 0. No re-render is
    // triggered (React doesn't observe mutations), so the Strip stays mounted
    // with the original handleKeyDown attached.
    features.length = 0;

    fireEvent.keyDown(screen.getByTestId("popup-modal-carousel"), {
      key: "ArrowRight",
    });

    // Guard returned before reaching the navigation logic.
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });

  // Line 70 false branch: a key that reaches the End check without matching it.
  // Existing tests fire Arrow*/Home/End, all of which either short-circuit the
  // if/else chain early or match End. Firing an unrelated key (e.g. "Tab")
  // walks the full chain and exits with the End check evaluating to false.
  test("ignores non-navigation keys (Tab/Enter) without firing onActiveIndexChange", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={1}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    const carousel = screen.getByTestId("popup-modal-carousel");
    fireEvent.keyDown(carousel, { key: "Tab" });
    fireEvent.keyDown(carousel, { key: "Enter" });
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });
});

// Line 62: the `if (!features || features.length === 0)` guard is unreachable
// through the component because Strip only renders when features.length >= 2.
// The logic now lives in the exported computeNextIndexFromKey pure function
// so each branch can be exercised directly.
describe("computeNextIndexFromKey", () => {
  test("returns null when features is null", () => {
    // Hits `!features` truthy → if-body taken → return null.
    expect(computeNextIndexFromKey("ArrowRight", null, 0)).toBeNull();
  });

  test("returns null when features is undefined", () => {
    expect(computeNextIndexFromKey("End", undefined, 0)).toBeNull();
  });

  test("returns null when features is an empty array", () => {
    // Hits `features.length === 0` truthy via the `||` right operand.
    expect(computeNextIndexFromKey("Home", [], 0)).toBeNull();
  });

  test("returns null for non-navigation keys", () => {
    expect(computeNextIndexFromKey("Tab", FEATURES, 1)).toBeNull();
    expect(computeNextIndexFromKey("Enter", FEATURES, 1)).toBeNull();
    expect(computeNextIndexFromKey("a", FEATURES, 1)).toBeNull();
  });

  test("returns correct index for each navigation key", () => {
    expect(computeNextIndexFromKey("ArrowRight", FEATURES, 0)).toBe(1);
    expect(computeNextIndexFromKey("ArrowRight", FEATURES, 2)).toBe(2); // clamped
    expect(computeNextIndexFromKey("ArrowLeft", FEATURES, 2)).toBe(1);
    expect(computeNextIndexFromKey("ArrowLeft", FEATURES, 0)).toBe(0); // clamped
    expect(computeNextIndexFromKey("Home", FEATURES, 2)).toBe(0);
    expect(computeNextIndexFromKey("End", FEATURES, 0)).toBe(2);
  });
});
