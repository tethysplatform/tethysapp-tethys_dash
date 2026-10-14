import { useEffect } from "react";
import PropTypes from "prop-types";
import { render } from "@testing-library/react";
import LinkedExtentProvider, {
  useLinkedExtentContext,
} from "components/contexts/LinkedExtentContext";

// Captures the registry so tests can drive it directly.
let registry;
const Capture = () => {
  registry = useLinkedExtentContext();
  return null;
};

const renderRegistry = () =>
  render(
    <LinkedExtentProvider>
      <Capture />
    </LinkedExtentProvider>,
  );

const RING_A = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 0],
];
const RING_B = [
  [2, 2],
  [3, 2],
  [3, 3],
  [2, 2],
];

beforeEach(() => {
  registry = null;
});

test("a subscriber is told once per distinct publish", () => {
  renderRegistry();
  const listener = jest.fn();
  registry.subscribe("Basin", listener);
  const handle = registry.register("Basin", "detail");

  handle.publish(RING_A);
  handle.publish(RING_A);
  expect(listener).toHaveBeenCalledTimes(1);
  expect(registry.getFootprints("Basin")).toEqual([
    { memberId: "detail", ring: RING_A, viewGroup: null },
  ]);

  handle.publish(RING_B);
  expect(listener).toHaveBeenCalledTimes(2);
  // Told which member changed, so a map can skip changes that cannot affect it.
  expect(listener).toHaveBeenLastCalledWith({ memberId: "detail" });
});

test("groups are isolated and names are normalized", () => {
  renderRegistry();
  const basin = jest.fn();
  const valley = jest.fn();
  registry.subscribe("Basin", basin);
  registry.subscribe("Valley", valley);

  registry.register("  Basin ", "detail").publish(RING_A);

  expect(basin).toHaveBeenCalledTimes(1);
  expect(valley).not.toHaveBeenCalled();
  expect(registry.getFootprints("basin")).toEqual([]);
});

test("unregistering removes the member and tells subscribers", () => {
  renderRegistry();
  const listener = jest.fn();
  registry.subscribe("Basin", listener);
  const handle = registry.register("Basin", "detail");
  handle.publish(RING_A);
  listener.mockClear();

  handle.unregister();

  expect(listener).toHaveBeenCalledTimes(1);
  expect(registry.getFootprints("Basin")).toEqual([]);
});

test("publishing null records the member as having nothing on screen", () => {
  renderRegistry();
  const handle = registry.register("Basin", "detail", { viewGroup: "Valley" });
  handle.publish(RING_A);
  handle.publish(null);

  expect(registry.getFootprints("Basin")).toEqual([
    { memberId: "detail", ring: null, viewGroup: "Valley" },
  ]);
});

test("a stale handle cannot touch a newer registration of the same member", () => {
  renderRegistry();
  const stale = registry.register("Basin", "detail");
  const fresh = registry.register("Basin", "detail");
  fresh.publish(RING_A);

  stale.publish(RING_B);
  stale.unregister();

  expect(registry.getFootprints("Basin")).toEqual([
    { memberId: "detail", ring: RING_A, viewGroup: null },
  ]);
});

test("an unsubscribed listener is no longer told", () => {
  renderRegistry();
  const listener = jest.fn();
  const unsubscribe = registry.subscribe("Basin", listener);
  unsubscribe();

  registry.register("Basin", "detail").publish(RING_A);

  expect(listener).not.toHaveBeenCalled();
});

test("a throwing listener does not stop the others", () => {
  renderRegistry();
  const consoleError = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});
  const good = jest.fn();
  registry.subscribe("Basin", () => {
    throw new Error("boom");
  });
  registry.subscribe("Basin", good);

  registry.register("Basin", "detail").publish(RING_A);

  expect(good).toHaveBeenCalledTimes(1);
  expect(consoleError).toHaveBeenCalled();
  consoleError.mockRestore();
});

test("blank names and missing ids register nothing", () => {
  renderRegistry();
  registry.register("  ", "detail").publish(RING_A);
  registry.register("Basin", undefined).publish(RING_A);

  expect(registry.getFootprints("Basin")).toEqual([]);
  expect(registry.getFootprints("")).toEqual([]);
});

test("the context value is stable across provider re-renders", () => {
  const seen = [];
  const Probe = ({ tick }) => {
    const value = useLinkedExtentContext();
    useEffect(() => {
      seen.push(value);
    }, [tick, value]);
    return null;
  };
  Probe.propTypes = { tick: PropTypes.number };

  const { rerender } = render(
    <LinkedExtentProvider>
      <Probe tick={1} />
    </LinkedExtentProvider>,
  );
  rerender(
    <LinkedExtentProvider>
      <Probe tick={2} />
    </LinkedExtentProvider>,
  );

  expect(seen).toHaveLength(2);
  expect(seen[0]).toBe(seen[1]);
});

test("outside a provider the hook returns null", () => {
  render(<Capture />);
  expect(registry).toBeNull();
});
