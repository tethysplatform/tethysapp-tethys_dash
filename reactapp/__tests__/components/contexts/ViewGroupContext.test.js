import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewGroupProvider, {
  useViewGroupContext,
} from "components/contexts/ViewGroupContext";

const VIEW_A = { center: [100, 200], resolution: 10, rotation: 0 };
const VIEW_B = { center: [500, 600], resolution: 5, rotation: 0.25 };

// A probe standing in for a grouped map. It registers itself on mount, prints
// what it last read out of the registry, and exposes buttons that publish on
// its behalf -- no map is rendered.
const MemberProbe = ({
  groupName,
  memberId,
  applyView,
  applyCursor,
  view,
  cursor,
}) => {
  const { registerMember, publishView, publishCursor, getGroupView } =
    useViewGroupContext();
  const [readView, setReadView] = useState("unread");

  // Keep the handlers current without re-registering on every render.
  const handlersRef = useRef({ applyView, applyCursor });
  handlersRef.current = { applyView, applyCursor };

  useEffect(() => {
    return registerMember(groupName, memberId, {
      applyView: (...args) => handlersRef.current.applyView?.(...args),
      applyCursor: (...args) => handlersRef.current.applyCursor?.(...args),
    });
  }, [registerMember, groupName, memberId]);

  return (
    <div>
      <p data-testid={`group-view-${memberId}`}>{readView}</p>
      <button
        type="button"
        data-testid={`publish-view-${memberId}`}
        onClick={() => publishView(groupName, memberId, view)}
      >
        publish view
      </button>
      <button
        type="button"
        data-testid={`publish-cursor-${memberId}`}
        onClick={() => publishCursor(groupName, memberId, cursor ?? null)}
      >
        publish cursor
      </button>
      <button
        type="button"
        data-testid={`read-${memberId}`}
        onClick={() =>
          setReadView(JSON.stringify(getGroupView(groupName) ?? null))
        }
      >
        read
      </button>
    </div>
  );
};

MemberProbe.propTypes = {
  groupName: PropTypes.string,
  memberId: PropTypes.string.isRequired,
  applyView: PropTypes.func,
  applyCursor: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  view: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  cursor: PropTypes.array,
};

const readGroupView = (memberId) => {
  fireEvent.click(screen.getByTestId(`read-${memberId}`));
  return screen.getByTestId(`group-view-${memberId}`).textContent;
};

describe("ViewGroupProvider fan-out", () => {
  it("delivers a publish to the other member and not to the publisher", () => {
    const applyA = jest.fn();
    const applyB = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe
          groupName="Basin"
          memberId="a"
          applyView={applyA}
          view={VIEW_A}
        />
        <MemberProbe groupName="Basin" memberId="b" applyView={applyB} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-view-a"));

    expect(applyA).not.toHaveBeenCalled();
    expect(applyB).toHaveBeenCalledTimes(1);
    expect(applyB).toHaveBeenCalledWith(VIEW_A, {
      groupName: "Basin",
      sourceId: "a",
    });
  });

  it("calls nothing when the group has a single member", () => {
    const applyA = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe
          groupName="Basin"
          memberId="a"
          applyView={applyA}
          view={VIEW_A}
        />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-view-a"));

    expect(applyA).not.toHaveBeenCalled();
    // The view is still recorded so a later joiner can adopt it.
    expect(JSON.parse(readGroupView("a"))).toEqual(VIEW_A);
  });

  it("fans a cursor position out to the other members only", () => {
    const cursorA = jest.fn();
    const cursorB = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe
          groupName="Basin"
          memberId="a"
          applyCursor={cursorA}
          cursor={[1, 2]}
        />
        <MemberProbe groupName="Basin" memberId="b" applyCursor={cursorB} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-cursor-a"));

    expect(cursorA).not.toHaveBeenCalled();
    expect(cursorB).toHaveBeenCalledWith([1, 2], {
      groupName: "Basin",
      sourceId: "a",
    });

    // A null coordinate clears the marker on the other members.
    fireEvent.click(screen.getByTestId("publish-cursor-b"));
    expect(cursorA).toHaveBeenCalledWith(null, {
      groupName: "Basin",
      sourceId: "b",
    });
  });

  it("keeps fanning out when one member's callback throws", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const thrower = jest.fn(() => {
      throw new Error("member torn down mid-frame");
    });
    const applyC = jest.fn();

    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" applyView={thrower} />
        <MemberProbe groupName="Basin" memberId="c" applyView={applyC} />
        <MemberProbe groupName="Basin" memberId="b" view={VIEW_B} />
      </ViewGroupProvider>,
    );

    expect(() =>
      fireEvent.click(screen.getByTestId("publish-view-b")),
    ).not.toThrow();

    expect(thrower).toHaveBeenCalledTimes(1);
    expect(applyC).toHaveBeenCalledWith(VIEW_B, {
      groupName: "Basin",
      sourceId: "b",
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe("ViewGroupProvider group identity", () => {
  it("resolves trimmed names to one group and differing case to another", () => {
    const trimmed = jest.fn();
    const lowercase = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
        <MemberProbe groupName=" Basin " memberId="b" applyView={trimmed} />
        <MemberProbe groupName="basin" memberId="c" applyView={lowercase} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-view-a"));

    expect(trimmed).toHaveBeenCalledWith(VIEW_A, {
      groupName: "Basin",
      sourceId: "a",
    });
    expect(lowercase).not.toHaveBeenCalled();
  });

  it("treats an empty or whitespace-only name as no group", () => {
    const blankApply = jest.fn();
    const whitespaceApply = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe groupName="" memberId="a" view={VIEW_A} />
        <MemberProbe groupName="" memberId="b" applyView={blankApply} />
        <MemberProbe groupName="   " memberId="c" view={VIEW_B} />
        <MemberProbe groupName="   " memberId="d" applyView={whitespaceApply} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-view-a"));
    fireEvent.click(screen.getByTestId("publish-view-c"));

    expect(blankApply).not.toHaveBeenCalled();
    expect(whitespaceApply).not.toHaveBeenCalled();
    expect(readGroupView("a")).toBe("null");
    expect(readGroupView("c")).toBe("null");
  });

  it("keeps members of different groups isolated from each other", () => {
    const applyBasin = jest.fn();
    const applyDelta = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
        <MemberProbe groupName="Basin" memberId="b" applyView={applyBasin} />
        <MemberProbe groupName="Delta" memberId="c" applyView={applyDelta} />
        <MemberProbe groupName="Delta" memberId="d" view={VIEW_B} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-view-a"));
    expect(applyBasin).toHaveBeenCalledTimes(1);
    expect(applyDelta).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("publish-view-d"));
    expect(applyBasin).toHaveBeenCalledTimes(1);
    expect(applyDelta).toHaveBeenCalledWith(VIEW_B, {
      groupName: "Delta",
      sourceId: "d",
    });
  });
});

describe("ViewGroupProvider lifecycle", () => {
  it("drops the group with its last member so a stale view is not resurrected", () => {
    const Harness = ({ memberIds }) => (
      <ViewGroupProvider>
        {memberIds.map((id) => (
          <MemberProbe key={id} groupName="Basin" memberId={id} view={VIEW_A} />
        ))}
      </ViewGroupProvider>
    );
    Harness.propTypes = { memberIds: PropTypes.arrayOf(PropTypes.string) };

    const { rerender } = render(<Harness memberIds={["a", "reader"]} />);
    fireEvent.click(screen.getByTestId("publish-view-a"));
    expect(JSON.parse(readGroupView("reader"))).toEqual(VIEW_A);

    // Every member of the group leaves, then one comes back under the same
    // name: it must not inherit the departed group's view.
    rerender(<Harness memberIds={[]} />);
    rerender(<Harness memberIds={["a"]} />);
    expect(readGroupView("a")).toBe("null");
  });

  it("stops delivering to a member once it unmounts", () => {
    const applyB = jest.fn();
    const Harness = ({ showB }) => (
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
        {showB ? (
          <MemberProbe groupName="Basin" memberId="b" applyView={applyB} />
        ) : null}
      </ViewGroupProvider>
    );
    Harness.propTypes = { showB: PropTypes.bool };

    const { rerender } = render(<Harness showB />);
    fireEvent.click(screen.getByTestId("publish-view-a"));
    expect(applyB).toHaveBeenCalledTimes(1);

    rerender(<Harness showB={false} />);
    fireEvent.click(screen.getByTestId("publish-view-a"));
    expect(applyB).toHaveBeenCalledTimes(1);
  });

  it("seeds a group view without fanning out, and never over a live view", () => {
    const applyB = jest.fn();
    const Seeder = () => {
      const { seedGroupView } = useViewGroupContext();
      return (
        <button
          type="button"
          data-testid="seed"
          onClick={() => seedGroupView("Basin", VIEW_B)}
        >
          seed
        </button>
      );
    };

    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
        <MemberProbe groupName="Basin" memberId="b" applyView={applyB} />
        <Seeder />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("seed"));
    expect(applyB).not.toHaveBeenCalled();
    expect(JSON.parse(readGroupView("a"))).toEqual(VIEW_B);

    // A published view wins, and a later seed does not overwrite it.
    fireEvent.click(screen.getByTestId("publish-view-a"));
    fireEvent.click(screen.getByTestId("seed"));
    expect(JSON.parse(readGroupView("a"))).toEqual(VIEW_A);
  });
});

describe("ViewGroupProvider context value", () => {
  it("is referentially stable across a parent re-render", () => {
    const StabilityProbe = () => {
      const value = useViewGroupContext();
      const firstValue = useRef(value);
      return <p data-testid="stable">{String(firstValue.current === value)}</p>;
    };

    const Parent = () => {
      const [count, setCount] = useState(0);
      return (
        <ViewGroupProvider>
          <p data-testid="count">{count}</p>
          <button
            type="button"
            data-testid="rerender"
            onClick={() => setCount((c) => c + 1)}
          >
            rerender
          </button>
          <StabilityProbe />
        </ViewGroupProvider>
      );
    };

    render(<Parent />);
    expect(screen.getByTestId("stable")).toHaveTextContent("true");

    fireEvent.click(screen.getByTestId("rerender"));
    fireEvent.click(screen.getByTestId("rerender"));

    expect(screen.getByTestId("count")).toHaveTextContent("2");
    expect(screen.getByTestId("stable")).toHaveTextContent("true");
  });

  it("returns null from the hook when rendered outside the provider", () => {
    const NullProbe = () => (
      <p data-testid="hook">{String(useViewGroupContext())}</p>
    );
    render(<NullProbe />);
    expect(screen.getByTestId("hook")).toHaveTextContent("null");
  });
});
