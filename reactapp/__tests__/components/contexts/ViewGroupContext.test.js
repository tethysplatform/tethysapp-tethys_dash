import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewGroupProvider, {
  useViewGroupContext,
} from "components/contexts/ViewGroupContext";
import { TabContext } from "components/contexts/Contexts";

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

  it("logs a consistently failing member once rather than on every publish", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const thrower = jest.fn(() => {
      throw new Error("still broken");
    });

    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" applyView={thrower} />
        <MemberProbe groupName="Basin" memberId="b" view={VIEW_B} />
      </ViewGroupProvider>,
    );

    // A pan drives one publish per rendered frame, so a member that throws
    // every time would otherwise log at frame rate.
    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(screen.getByTestId("publish-view-b"));
    }

    // Isolation is unchanged -- every publish is still delivered and still
    // caught -- and only the logging is deduplicated.
    expect(thrower).toHaveBeenCalledTimes(10);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });

  // Joins with two arguments only, so the handlers parameter falls back to its
  // default: a map that groups but has nothing to be told about.
  const HandlerlessProbe = ({ groupName, memberId }) => {
    const { registerMember } = useViewGroupContext();
    useEffect(
      () => registerMember(groupName, memberId),
      [registerMember, groupName, memberId],
    );
    return null;
  };
  HandlerlessProbe.propTypes = {
    groupName: PropTypes.string,
    memberId: PropTypes.string.isRequired,
  };

  it("skips a member that joined without handlers", () => {
    const applyB = jest.fn();
    const Harness = ({ showPair }) => (
      <ViewGroupProvider>
        <HandlerlessProbe groupName="Basin" memberId="silent" />
        {showPair ? (
          <>
            <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
            <MemberProbe groupName="Basin" memberId="b" applyView={applyB} />
          </>
        ) : null}
      </ViewGroupProvider>
    );
    Harness.propTypes = { showPair: PropTypes.bool };

    const { rerender } = render(<Harness showPair />);

    // The handler-less member is passed over rather than called, and the rest
    // of the group is delivered to as usual.
    expect(() =>
      fireEvent.click(screen.getByTestId("publish-view-a")),
    ).not.toThrow();
    expect(applyB).toHaveBeenCalledTimes(1);

    // It is a full member all the same: the group is not dropped when the two
    // handler-carrying members leave, so the view outlives them.
    rerender(<Harness showPair={false} />);
    rerender(<Harness showPair />);
    expect(JSON.parse(readGroupView("b"))).toEqual(VIEW_A);
  });

  it("delivers a view whose center is not a coordinate array unchanged", () => {
    // Only an array center is copied -- anything else is handed on as it came,
    // rather than being dropped or turned into an array.
    const CENTERLESS_VIEW = { center: null, resolution: 4, rotation: 0 };
    const applyB = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" view={CENTERLESS_VIEW} />
        <MemberProbe groupName="Basin" memberId="b" applyView={applyB} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("publish-view-a"));

    expect(applyB).toHaveBeenCalledWith(CENTERLESS_VIEW, {
      groupName: "Basin",
      sourceId: "a",
    });
    expect(JSON.parse(readGroupView("b"))).toEqual(CENTERLESS_VIEW);
  });
});

describe("ViewGroupProvider projection pin", () => {
  // Stands in for a map whose view projection changes under it: a raster
  // auto-fit adopts the raster's projection long after the map joined.
  const ProjectionProbe = ({ groupName, memberId, code, applyView }) => {
    const { registerMember, reportMemberProjection, publishView } =
      useViewGroupContext();
    const [pin, setPin] = useState("unreported");

    const handlersRef = useRef({ applyView });
    handlersRef.current = { applyView };

    useEffect(
      () =>
        registerMember(groupName, memberId, {
          applyView: (...args) => handlersRef.current.applyView?.(...args),
        }),
      [registerMember, groupName, memberId],
    );

    return (
      <div>
        <p data-testid={`pin-${memberId}`}>{String(pin)}</p>
        <button
          type="button"
          data-testid={`report-${memberId}`}
          onClick={() =>
            setPin(reportMemberProjection(groupName, memberId, code))
          }
        >
          report
        </button>
        <button
          type="button"
          data-testid={`publish-${memberId}`}
          onClick={() => publishView(groupName, memberId, VIEW_A)}
        >
          publish
        </button>
      </div>
    );
  };
  ProjectionProbe.propTypes = {
    groupName: PropTypes.string,
    memberId: PropTypes.string.isRequired,
    code: PropTypes.string,
    applyView: PropTypes.func,
  };

  const report = (memberId) => {
    fireEvent.click(screen.getByTestId(`report-${memberId}`));
    return screen.getByTestId(`pin-${memberId}`).textContent;
  };

  it("re-pins once no member still reports the pinned projection", () => {
    const applyA = jest.fn();
    const Harness = ({ codeA, codeB }) => (
      <ViewGroupProvider>
        <ProjectionProbe
          groupName="Basin"
          memberId="a"
          code={codeA}
          applyView={applyA}
        />
        <ProjectionProbe groupName="Basin" memberId="b" code={codeB} />
      </ViewGroupProvider>
    );
    Harness.propTypes = {
      codeA: PropTypes.string,
      codeB: PropTypes.string,
    };

    const { rerender } = render(
      <Harness codeA="EPSG:3857" codeB="EPSG:3857" />,
    );

    // The first member to report pins the group.
    expect(report("a")).toBe("EPSG:3857");
    expect(report("b")).toBe("EPSG:3857");

    // Both members then auto-fit to a UTM raster, one frame apart.
    rerender(<Harness codeA="EPSG:32615" codeB="EPSG:32615" />);

    // While B still holds the pinned code, A is genuinely out of sync (R6).
    expect(report("a")).toBe("EPSG:3857");

    // Once nobody holds it, the pin is not allowed to outlive them: the group
    // re-pins on what its members actually are, rather than stranding every
    // one of them against a code that no longer exists on the dashboard.
    expect(report("b")).toBe("EPSG:32615");
    expect(report("a")).toBe("EPSG:32615");

    // Both read their own code back, so both are in the group again.
    fireEvent.click(screen.getByTestId("publish-b"));
    expect(applyA).toHaveBeenCalledWith(VIEW_A, {
      groupName: "Basin",
      sourceId: "b",
    });
  });

  it("keeps the pin while any member still reports it", () => {
    const Harness = ({ codeA }) => (
      <ViewGroupProvider>
        <ProjectionProbe groupName="Basin" memberId="a" code={codeA} />
        <ProjectionProbe groupName="Basin" memberId="b" code="EPSG:3857" />
      </ViewGroupProvider>
    );
    Harness.propTypes = { codeA: PropTypes.string };

    const { rerender } = render(<Harness codeA="EPSG:3857" />);
    expect(report("a")).toBe("EPSG:3857");
    expect(report("b")).toBe("EPSG:3857");

    rerender(<Harness codeA="EPSG:4326" />);
    expect(report("a")).toBe("EPSG:3857");
    expect(report("b")).toBe("EPSG:3857");
  });

  // Reports on behalf of an id that never joined the group.
  const GhostReporter = ({ groupName, memberId, code }) => {
    const { reportMemberProjection } = useViewGroupContext();
    const [pin, setPin] = useState("unreported");
    return (
      <div>
        <p data-testid={`pin-${memberId}`}>{String(pin)}</p>
        <button
          type="button"
          data-testid={`report-${memberId}`}
          onClick={() =>
            setPin(reportMemberProjection(groupName, memberId, code))
          }
        >
          report
        </button>
      </div>
    );
  };
  GhostReporter.propTypes = {
    groupName: PropTypes.string,
    memberId: PropTypes.string.isRequired,
    code: PropTypes.string,
  };

  it("reads the pin back for an id that never joined without recording it", () => {
    render(
      <ViewGroupProvider>
        <ProjectionProbe groupName="Basin" memberId="a" code="EPSG:3857" />
        <GhostReporter groupName="Basin" memberId="ghost" code="EPSG:32615" />
      </ViewGroupProvider>,
    );

    expect(report("a")).toBe("EPSG:3857");

    // A report from an unregistered id reads the group's pin but leaves no
    // projection behind, so it cannot re-pin the group or unseat the member
    // that did join.
    expect(report("ghost")).toBe("EPSG:3857");
    expect(report("a")).toBe("EPSG:3857");
  });

  it("releases the pin when the member holding it reports no projection", () => {
    const Harness = ({ codeA }) => (
      <ViewGroupProvider>
        <ProjectionProbe groupName="Basin" memberId="a" code={codeA} />
        <ProjectionProbe groupName="Basin" memberId="b" code="EPSG:4326" />
      </ViewGroupProvider>
    );
    Harness.propTypes = { codeA: PropTypes.string };

    const { rerender } = render(<Harness codeA="EPSG:3857" />);
    expect(report("a")).toBe("EPSG:3857");
    // B is genuinely out of sync while A holds the pin (R6).
    expect(report("b")).toBe("EPSG:3857");

    // A's map loses its view projection entirely and reports none.
    rerender(<Harness codeA={undefined} />);
    expect(report("a")).toBe("null");

    // The pin went with it, so B is no longer stranded against a code nobody
    // on the dashboard holds.
    expect(report("b")).toBe("EPSG:4326");
  });

  it("drops the pin when its member leaves and nobody else reports one", () => {
    const Harness = ({ showA }) => (
      <ViewGroupProvider>
        {showA ? (
          <ProjectionProbe groupName="Basin" memberId="a" code="EPSG:3857" />
        ) : null}
        <ProjectionProbe groupName="Basin" memberId="b" code="EPSG:32615" />
      </ViewGroupProvider>
    );
    Harness.propTypes = { showA: PropTypes.bool };

    const { rerender } = render(<Harness showA />);

    // A pins the group; B has reported nothing at all yet.
    expect(report("a")).toBe("EPSG:3857");

    rerender(<Harness showA={false} />);

    // The pin leaves with the member that set it rather than outliving it, so
    // the projection B actually holds is accepted.
    expect(report("b")).toBe("EPSG:32615");
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

  // Calls the registry straight through for the guards that have no member to
  // observe, and prints whatever came back.
  const GuardProbe = ({ groupName }) => {
    const {
      publishView,
      publishCursor,
      reportMemberProjection,
      seedGroupView,
      getGroupView,
    } = useViewGroupContext();
    const [result, setResult] = useState("uncalled");
    const record = (value) => setResult(JSON.stringify(value ?? null));
    return (
      <div>
        <p data-testid="guard-result">{result}</p>
        <button
          type="button"
          data-testid="guard-publish-view"
          onClick={() => record(publishView(groupName, "ghost", VIEW_A))}
        >
          publish view
        </button>
        <button
          type="button"
          data-testid="guard-publish-cursor"
          onClick={() => record(publishCursor(groupName, "ghost", [1, 2]))}
        >
          publish cursor
        </button>
        <button
          type="button"
          data-testid="guard-report"
          onClick={() =>
            record(reportMemberProjection(groupName, "ghost", "EPSG:3857"))
          }
        >
          report
        </button>
        <button
          type="button"
          data-testid="guard-seed"
          onClick={() => record(seedGroupView(groupName, VIEW_B))}
        >
          seed
        </button>
        <button
          type="button"
          data-testid="guard-read"
          onClick={() => record(getGroupView(groupName))}
        >
          read
        </button>
      </div>
    );
  };
  GuardProbe.propTypes = { groupName: PropTypes.string };

  const guardResult = () => screen.getByTestId("guard-result").textContent;

  it("ignores a whitespace-only name on every registry method", () => {
    const applyA = jest.fn();
    const cursorA = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe
          groupName="Basin"
          memberId="a"
          applyView={applyA}
          applyCursor={cursorA}
        />
        <GuardProbe groupName="   " />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("guard-publish-cursor"));
    fireEvent.click(screen.getByTestId("guard-report"));
    expect(guardResult()).toBe("null");
    fireEvent.click(screen.getByTestId("guard-seed"));
    expect(guardResult()).toBe("null");
    fireEvent.click(screen.getByTestId("guard-read"));
    expect(guardResult()).toBe("null");

    // Nothing reached the real group either -- a blank name is no group, not a
    // group everyone shares.
    expect(applyA).not.toHaveBeenCalled();
    expect(cursorA).not.toHaveBeenCalled();
  });

  it("is inert for a named group nothing has joined", () => {
    const applyA = jest.fn();
    const cursorA = jest.fn();
    render(
      <ViewGroupProvider>
        <MemberProbe
          groupName="Basin"
          memberId="a"
          applyView={applyA}
          applyCursor={cursorA}
        />
        <GuardProbe groupName="Nowhere" />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("guard-publish-view"));
    fireEvent.click(screen.getByTestId("guard-publish-cursor"));
    fireEvent.click(screen.getByTestId("guard-report"));
    expect(guardResult()).toBe("null");

    // Publishing into a group nobody is in neither reaches another group nor
    // brings the empty one into being with a view of its own.
    expect(applyA).not.toHaveBeenCalled();
    expect(cursorA).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("guard-read"));
    expect(guardResult()).toBe("null");
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

  it("creates the group entry when seeding a group nothing has joined", () => {
    // A bbox seed is promoted by the first member that can resolve it, and a
    // group whose members all live on tabs that have never mounted has no
    // entry yet. Seeding has to make one rather than drop the view.
    const SeedProbe = () => {
      const { seedGroupView, getGroupView } = useViewGroupContext();
      const [readView, setReadView] = useState("unread");
      return (
        <div>
          <p data-testid="unjoined-view">{readView}</p>
          <button
            type="button"
            data-testid="seed-unjoined"
            onClick={() => seedGroupView("Unjoined", VIEW_B)}
          >
            seed
          </button>
          <button
            type="button"
            data-testid="read-unjoined"
            onClick={() =>
              setReadView(JSON.stringify(getGroupView("Unjoined") ?? null))
            }
          >
            read
          </button>
        </div>
      );
    };

    render(
      <ViewGroupProvider>
        <SeedProbe />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("read-unjoined"));
    expect(screen.getByTestId("unjoined-view")).toHaveTextContent("null");

    fireEvent.click(screen.getByTestId("seed-unjoined"));
    fireEvent.click(screen.getByTestId("read-unjoined"));
    expect(JSON.parse(screen.getByTestId("unjoined-view").textContent)).toEqual(
      VIEW_B,
    );
  });

  // Joins on demand and keeps every unregister it was handed, so a test can
  // call a stale one, or the same one twice.
  const RejoinProbe = ({ groupName, memberId, applyView, view }) => {
    const { registerMember, publishView } = useViewGroupContext();
    const unregistersRef = useRef([]);
    const handlerRef = useRef(applyView);
    handlerRef.current = applyView;

    return (
      <div>
        <button
          type="button"
          data-testid={`join-${memberId}`}
          onClick={() =>
            unregistersRef.current.push(
              registerMember(groupName, memberId, {
                applyView: (...args) => handlerRef.current?.(...args),
              }),
            )
          }
        >
          join
        </button>
        <button
          type="button"
          data-testid={`leave-first-${memberId}`}
          onClick={() => unregistersRef.current[0]?.()}
        >
          leave first
        </button>
        <button
          type="button"
          data-testid={`leave-last-${memberId}`}
          onClick={() => unregistersRef.current.at(-1)?.()}
        >
          leave last
        </button>
        <button
          type="button"
          data-testid={`send-${memberId}`}
          onClick={() => publishView(groupName, memberId, view)}
        >
          send
        </button>
      </div>
    );
  };
  RejoinProbe.propTypes = {
    groupName: PropTypes.string,
    memberId: PropTypes.string.isRequired,
    applyView: PropTypes.func,
    // eslint-disable-next-line react/forbid-prop-types
    view: PropTypes.object,
  };

  it("tolerates calling the same unregister twice", () => {
    const applyA = jest.fn();
    render(
      <ViewGroupProvider>
        <RejoinProbe groupName="Basin" memberId="a" applyView={applyA} />
        <RejoinProbe groupName="Basin" memberId="b" view={VIEW_B} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("join-a"));
    fireEvent.click(screen.getByTestId("join-b"));
    fireEvent.click(screen.getByTestId("send-b"));
    expect(applyA).toHaveBeenCalledTimes(1);

    // Both members leave, which takes the group entry with them, and then A's
    // unregister runs a second time against a group that is no longer there.
    fireEvent.click(screen.getByTestId("leave-last-a"));
    fireEvent.click(screen.getByTestId("leave-last-b"));
    expect(() =>
      fireEvent.click(screen.getByTestId("leave-last-a")),
    ).not.toThrow();

    // The registry is unharmed: the same two members can form the group again.
    fireEvent.click(screen.getByTestId("join-a"));
    fireEvent.click(screen.getByTestId("join-b"));
    fireEvent.click(screen.getByTestId("send-b"));
    expect(applyA).toHaveBeenCalledTimes(2);
  });

  it("ignores a stale unregister from a member that re-registered", () => {
    const applyA = jest.fn();
    render(
      <ViewGroupProvider>
        <RejoinProbe groupName="Basin" memberId="a" applyView={applyA} />
        <RejoinProbe groupName="Basin" memberId="b" view={VIEW_B} />
      </ViewGroupProvider>,
    );

    fireEvent.click(screen.getByTestId("join-b"));
    // A joins twice under the same id -- a group rename or a remount installs
    // a second registration over the first.
    fireEvent.click(screen.getByTestId("join-a"));
    fireEvent.click(screen.getByTestId("join-a"));

    // The first registration's unregister must not take the live one down.
    fireEvent.click(screen.getByTestId("leave-first-a"));
    fireEvent.click(screen.getByTestId("send-b"));
    expect(applyA).toHaveBeenCalledTimes(1);

    // The live registration still leaves when its own unregister is called.
    fireEvent.click(screen.getByTestId("leave-last-a"));
    fireEvent.click(screen.getByTestId("send-b"));
    expect(applyA).toHaveBeenCalledTimes(1);
  });

  it("seeds a view whose center is not a coordinate array", () => {
    const CENTERLESS_VIEW = { center: null, resolution: 4, rotation: 0 };
    const Seeder = () => {
      const { seedGroupView } = useViewGroupContext();
      return (
        <button
          type="button"
          data-testid="seed-centerless"
          onClick={() => seedGroupView("Basin", CENTERLESS_VIEW)}
        >
          seed
        </button>
      );
    };

    render(
      <ViewGroupProvider>
        <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
        <Seeder />
      </ViewGroupProvider>,
    );

    // Only an array center is copied; any other center is recorded as it came
    // rather than being dropped.
    fireEvent.click(screen.getByTestId("seed-centerless"));
    expect(JSON.parse(readGroupView("a"))).toEqual(CENTERLESS_VIEW);
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

describe("ViewGroupProvider seed discovery", () => {
  const flaggedItem = (group, extent, overrides = {}) => ({
    source: "Map",
    args_string: JSON.stringify({
      map_extent: {
        extent,
        viewGroup: group,
        isGroupInitialExtent: true,
      },
    }),
    ...overrides,
  });

  // Reads the seed during its own render, which is the moment a map's
  // registration effect would read it: the scan has to have run by then.
  const SeedProbe = ({ groupName, testId = "seed" }) => {
    const { getGroupSeed } = useViewGroupContext();
    return (
      <p data-testid={testId}>{JSON.stringify(getGroupSeed(groupName))}</p>
    );
  };
  SeedProbe.propTypes = {
    groupName: PropTypes.string,
    testId: PropTypes.string,
  };

  const withTabs = (tabs, children) => (
    <TabContext.Provider value={{ tabs, activeTabId: 1 }}>
      <ViewGroupProvider>{children}</ViewGroupProvider>
    </TabContext.Provider>
  );

  const seedText = (testId = "seed") => screen.getByTestId(testId).textContent;

  it("holds a flagged member's seed before any member registers", () => {
    render(
      withTabs(
        [{ gridItems: [flaggedItem("Basin", "-100,200,7")] }],
        <SeedProbe groupName="Basin" />,
      ),
    );

    expect(JSON.parse(seedText())).toEqual({
      type: "center",
      center: [-100, 200],
      zoom: 7,
    });
  });

  it("reads the flag off a tab whose members never render", () => {
    render(
      withTabs(
        [
          { gridItems: [] },
          { gridItems: [flaggedItem("Basin", "-10,-20,30,40")] },
        ],
        <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />,
      ),
    );

    // Registration reuses the entry the scan created rather than replacing it.
    expect(readGroupView("a")).toBe("null");
  });

  it("keeps the first flagged member in tab-then-grid order", () => {
    render(
      withTabs(
        [
          {
            gridItems: [
              flaggedItem("Basin", "1,2,3"),
              flaggedItem("Basin", "4,5,6"),
            ],
          },
          { gridItems: [flaggedItem("Basin", "7,8,9")] },
        ],
        <SeedProbe groupName="Basin" />,
      ),
    );

    expect(JSON.parse(seedText()).center).toEqual([1, 2]);
  });

  it("has no seed for an unflagged group, an unknown group, or no group", () => {
    render(
      withTabs(
        [{ gridItems: [flaggedItem("Basin", "1,2,3")] }],
        [
          <SeedProbe key="other" groupName="Other" testId="other" />,
          <SeedProbe key="blank" groupName="   " testId="blank" />,
        ],
      ),
    );

    expect(seedText("other")).toBe("null");
    expect(seedText("blank")).toBe("null");
  });

  it("rescans when the tab list changes", () => {
    const { rerender } = render(
      withTabs([{ gridItems: [] }], <SeedProbe groupName="Basin" />),
    );
    expect(seedText()).toBe("null");

    rerender(
      withTabs(
        [{ gridItems: [flaggedItem("Basin", "1,2,3")] }],
        <SeedProbe groupName="Basin" />,
      ),
    );
    expect(JSON.parse(seedText()).center).toEqual([1, 2]);

    // Unflagging or deleting the flagged member stops the group seeding.
    rerender(withTabs([{ gridItems: [] }], <SeedProbe groupName="Basin" />));
    expect(seedText()).toBe("null");
  });

  it("keeps a discovered seed when the last member leaves, but not the live view", () => {
    // Held stable so the scan does not re-run and re-seed behind the test.
    const tabs = [{ gridItems: [flaggedItem("Basin", "1,2,3")] }];
    const Harness = ({ showMembers }) => (
      <TabContext.Provider value={{ tabs, activeTabId: 1 }}>
        <ViewGroupProvider>
          {showMembers && (
            <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
          )}
          <SeedProbe groupName="Basin" />
        </ViewGroupProvider>
      </TabContext.Provider>
    );
    Harness.propTypes = { showMembers: PropTypes.bool };

    const { rerender } = render(<Harness showMembers />);
    fireEvent.click(screen.getByTestId("publish-view-a"));
    expect(JSON.parse(readGroupView("a"))).toEqual(VIEW_A);

    // The last member goes, which drops the group's live view. The seed came
    // from the dashboard rather than from that member, so it survives.
    rerender(<Harness showMembers={false} />);
    expect(JSON.parse(seedText()).center).toEqual([1, 2]);

    rerender(<Harness showMembers />);
    expect(readGroupView("a")).toBe("null");
    expect(JSON.parse(seedText()).center).toEqual([1, 2]);
  });

  it("seeds and unseeds a group that already has members", () => {
    const Harness = ({ tabs }) => (
      <TabContext.Provider value={{ tabs, activeTabId: 1 }}>
        <ViewGroupProvider>
          <MemberProbe groupName="Basin" memberId="a" view={VIEW_A} />
          <SeedProbe groupName="Basin" />
        </ViewGroupProvider>
      </TabContext.Provider>
    );
    Harness.propTypes = {
      // eslint-disable-next-line react/forbid-prop-types
      tabs: PropTypes.array,
    };

    const { rerender } = render(<Harness tabs={[{ gridItems: [] }]} />);
    fireEvent.click(screen.getByTestId("publish-view-a"));
    expect(seedText()).toBe("null");

    // The seed lands on the entry the member already made, rather than on a
    // fresh one that would discard the view the group is holding.
    rerender(
      <Harness tabs={[{ gridItems: [flaggedItem("Basin", "1,2,3")] }]} />,
    );
    expect(JSON.parse(seedText()).center).toEqual([1, 2]);
    expect(JSON.parse(readGroupView("a"))).toEqual(VIEW_A);

    // Unflagging clears the seed, but a group with members is not disbanded
    // for having none.
    rerender(<Harness tabs={[{ gridItems: [] }]} />);
    expect(seedText()).toBe("null");
    expect(JSON.parse(readGroupView("a"))).toEqual(VIEW_A);
  });

  it("tolerates rendering with no tab context at all", () => {
    render(
      <ViewGroupProvider>
        <SeedProbe groupName="Basin" />
      </ViewGroupProvider>,
    );
    expect(seedText()).toBe("null");
  });
});
