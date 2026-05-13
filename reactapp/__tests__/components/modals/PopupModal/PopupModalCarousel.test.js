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

describe("PopupModalCarousel — visibility", () => {
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

  test("renders prev / pagination / next controls for multi-feature input", () => {
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId("popup-modal-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-carousel-prev")).toBeInTheDocument();
    expect(screen.getByTestId("popup-modal-carousel-next")).toBeInTheDocument();
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toBeInTheDocument();
  });
});

describe("PopupModalCarousel — pagination indicator", () => {
  test("shows the active 1-indexed position over the total", () => {
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={1}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("2 / 3");
  });

  test("updates the indicator when activeIndex changes", () => {
    const { rerender } = render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("1 / 3");

    rerender(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={2}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(
      screen.getByTestId("popup-modal-carousel-pagination"),
    ).toHaveTextContent("3 / 3");
  });
});

describe("PopupModalCarousel — arrow buttons", () => {
  test("clicking the next arrow advances the active index", async () => {
    const user = userEvent.setup();
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    await user.click(screen.getByTestId("popup-modal-carousel-next"));
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
  });

  test("clicking the prev arrow decreases the active index", async () => {
    const user = userEvent.setup();
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={2}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    await user.click(screen.getByTestId("popup-modal-carousel-prev"));
    expect(onActiveIndexChange).toHaveBeenCalledWith(1);
  });

  test("prev is disabled at activeIndex=0 and does not fire onActiveIndexChange", async () => {
    const user = userEvent.setup();
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    const prev = screen.getByTestId("popup-modal-carousel-prev");
    expect(prev).toBeDisabled();
    await user.click(prev);
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });

  test("next is disabled at the last feature and does not fire onActiveIndexChange", async () => {
    const user = userEvent.setup();
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={2}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    const next = screen.getByTestId("popup-modal-carousel-next");
    expect(next).toBeDisabled();
    await user.click(next);
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });

  // The `disabled` attribute on the arrows is the primary defense
  // against out-of-bounds navigation, but goPrev / goNext also each
  // carry a defensive `if (!atStart)` / `if (!atEnd)` guard inside
  // their click handler. `userEvent.click` (and `fireEvent.click`)
  // honor React's synthetic-event filter for `<button disabled>` and
  // never reach the handler, so those guards never execute in the
  // user-behavior tests above. The two tests below pull the registered
  // onClick straight off the DOM node's React fiber props and invoke it
  // directly, so the handler runs while `atStart` / `atEnd` is still
  // true and the early-return is exercised.
  const invokeReactOnClick = (node) => {
    const propsKey = Object.keys(node).find((k) =>
      k.startsWith("__reactProps"),
    );
    if (!propsKey) throw new Error("React props not found on node");
    node[propsKey].onClick();
  };

  test("goPrev's defensive guard suppresses onActiveIndexChange when atStart is true", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    invokeReactOnClick(screen.getByTestId("popup-modal-carousel-prev"));
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });

  test("goNext's defensive guard suppresses onActiveIndexChange when atEnd is true", () => {
    const onActiveIndexChange = jest.fn();
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={FEATURES.length - 1}
        onActiveIndexChange={onActiveIndexChange}
      />,
    );
    invokeReactOnClick(screen.getByTestId("popup-modal-carousel-next"));
    expect(onActiveIndexChange).not.toHaveBeenCalled();
  });
});

describe("PopupModalCarousel — aria labels", () => {
  test("falls back to generic 'Previous feature' / 'Next feature' when no getLabel is supplied", () => {
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={1}
        onActiveIndexChange={jest.fn()}
      />,
    );
    expect(screen.getByTestId("popup-modal-carousel-prev")).toHaveAttribute(
      "aria-label",
      "Previous feature",
    );
    expect(screen.getByTestId("popup-modal-carousel-next")).toHaveAttribute(
      "aria-label",
      "Next feature",
    );
  });

  test("uses getLabel for the neighboring feature so screen readers announce its title", () => {
    const getLabel = (feature) => `Site ${feature.attributes.id}`;
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={1}
        onActiveIndexChange={jest.fn()}
        getLabel={getLabel}
      />,
    );
    expect(screen.getByTestId("popup-modal-carousel-prev")).toHaveAttribute(
      "aria-label",
      "Previous feature: Site a",
    );
    expect(screen.getByTestId("popup-modal-carousel-next")).toHaveAttribute(
      "aria-label",
      "Next feature: Site c",
    );
  });

  test("disabled arrows still announce the generic label (no neighbor to read out)", () => {
    const getLabel = (feature) => `Site ${feature.attributes.id}`;
    render(
      <PopupModalCarousel
        features={FEATURES}
        activeIndex={0}
        onActiveIndexChange={jest.fn()}
        getLabel={getLabel}
      />,
    );
    // At index 0 there's no previous feature to describe.
    expect(screen.getByTestId("popup-modal-carousel-prev")).toHaveAttribute(
      "aria-label",
      "Previous feature",
    );
    // Next IS available, so it uses the label.
    expect(screen.getByTestId("popup-modal-carousel-next")).toHaveAttribute(
      "aria-label",
      "Next feature: Site b",
    );
  });
});

describe("PopupModalCarousel — keyboard navigation", () => {
  test("ArrowRight advances the active index", () => {
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

  test("ArrowLeft at the boundary doesn't fire", () => {
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

  test("non-navigation keys (Tab / Enter) are ignored", () => {
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

// `computeNextIndexFromKey` is exported so each branch of the keyboard
// navigation logic can be exercised directly — the previous chip-based UI
// had an empty-features guard that was unreachable via the rendered
// component, and this pattern keeps that branch covered.
describe("computeNextIndexFromKey", () => {
  test("returns null when features is null", () => {
    expect(computeNextIndexFromKey("ArrowRight", null, 0)).toBeNull();
  });

  test("returns null when features is undefined", () => {
    expect(computeNextIndexFromKey("End", undefined, 0)).toBeNull();
  });

  test("returns null when features is an empty array", () => {
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
