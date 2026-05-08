import { useContext, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariableInputsContext } from "components/contexts/Contexts";
import FeatureScopedVariableInputs, {
  FEATURE_SCOPE_MARKER,
} from "components/contexts/FeatureScopedVariableInputs";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";

// A descendant probe that prints the merged VariableInputsContext value into
// the DOM so we can assert against it from tests.
const ContextProbe = () => {
  const { variableInputValues } = useContext(VariableInputsContext);
  return (
    <p data-testid="merged-values">{JSON.stringify(variableInputValues)}</p>
  );
};

// A descendant that lets us fire a setVariableInputValues call from a test
// click handler. The `nextValue` prop is stringified JSON or a marker for the
// functional updater path.
const ContextWriter = ({ nextValue, useFunctional, returnNull }) => {
  const { setVariableInputValues } = useContext(VariableInputsContext);
  return (
    <button
      type="button"
      data-testid="writer"
      onClick={() => {
        if (useFunctional) {
          if (returnNull) {
            setVariableInputValues(() => null);
            return;
          }
          setVariableInputValues((prev) => ({
            ...prev,
            ...JSON.parse(nextValue),
          }));
        } else {
          setVariableInputValues(JSON.parse(nextValue));
        }
      }}
    >
      write
    </button>
  );
};

ContextWriter.propTypes = {
  nextValue: PropTypes.string.isRequired,
  useFunctional: PropTypes.bool,
  returnNull: PropTypes.bool,
};

ContextWriter.defaultProps = {
  useFunctional: false,
};

// A parent that mimics DashboardLoader's VariableInputsContext.Provider shape.
const ParentProvider = ({ initialValues, children }) => {
  const [variableInputValues, setVariableInputValues] = useState(initialValues);
  return (
    <VariableInputsContext.Provider
      value={{
        variableInputValues,
        setVariableInputValues,
        variableInputDateFormats: {},
        variableInputSliderMeta: {},
        setVariableInputSliderMeta: () => {},
      }}
    >
      <p data-testid="parent-values">{JSON.stringify(variableInputValues)}</p>
      {children}
    </VariableInputsContext.Provider>
  );
};

ParentProvider.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  initialValues: PropTypes.object,
  children: PropTypes.node,
};

ParentProvider.defaultProps = {
  initialValues: {},
  children: null,
};

const readMerged = () =>
  JSON.parse(screen.getByTestId("merged-values").textContent);
const readParent = () =>
  JSON.parse(screen.getByTestId("parent-values").textContent);

describe("FeatureScopedVariableInputs", () => {
  test("exposes feature.* keys from feature.attributes", () => {
    const feature = {
      layerName: "Stations",
      attributes: { station_id: "ABC", state_id: "WA" },
    };
    render(
      <ParentProvider>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    const merged = readMerged();
    expect(merged["feature.station_id"]).toBe("ABC");
    expect(merged["feature.state_id"]).toBe("WA");
  });

  test("does not shadow a host variable input that shares a base name", () => {
    const feature = {
      layerName: "Stations",
      attributes: { state_id: "WA" },
    };
    render(
      <ParentProvider initialValues={{ state_id: "OR" }}>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    const merged = readMerged();
    // Host var still readable as its bare name.
    expect(merged.state_id).toBe("OR");
    // Feature value readable under feature.* namespace.
    expect(merged["feature.state_id"]).toBe("WA");
  });

  test("attribute names with spaces produce dotted keys that substitute correctly", () => {
    const feature = {
      layerName: "Sites",
      attributes: { "Site Name": "Alpha", "USGS ID": "01646500" },
    };
    render(
      <ParentProvider>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    const merged = readMerged();
    expect(merged["feature.Site Name"]).toBe("Alpha");
    expect(merged["feature.USGS ID"]).toBe("01646500");

    // Verify the substitution machinery accepts the dotted-with-spaces key.
    const substituted = updateObjectWithVariableInputs({
      args: {
        // eslint-disable-next-line
        x: "${feature.Site Name}",
        // eslint-disable-next-line
        y: "Site is ${feature.Site Name}",
      },
      variableInputs: merged,
    });
    expect(substituted.x).toBe("Alpha");
    expect(substituted.y).toBe("Site is Alpha");
  });

  test("non-string attribute values: numbers and arrays substitute per utilities semantics", () => {
    const feature = {
      layerName: "Mixed",
      attributes: { count: 5, tags: ["a", "b"], meta: null },
    };
    render(
      <ParentProvider>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    const merged = readMerged();
    expect(merged["feature.count"]).toBe(5);
    expect(merged["feature.tags"]).toEqual(["a", "b"]);
    expect(merged["feature.meta"]).toBeNull();

    // Exact-match preserves the numeric type.
    const substituted = updateObjectWithVariableInputs({
      args: {
        // eslint-disable-next-line
        countExact: "${feature.count}",
        // eslint-disable-next-line
        tagsInline: "tags=${feature.tags}",
        // eslint-disable-next-line
        metaExact: "${feature.meta}",
      },
      variableInputs: merged,
    });
    expect(substituted.countExact).toBe(5);
    // Inline arrays JSON-stringify.
    expect(substituted.tagsInline).toBe('tags=["a","b"]');
    // Exact-match null falls back to "" because `null || ""` evaluates to ""
    // (utilities.js line ~360 uses `||` not `??` for the exact-match path).
    expect(substituted.metaExact).toBe("");
  });

  test("zero-attribute feature exposes no feature.* keys; substitution resolves to empty", () => {
    const feature = { layerName: "Empty", attributes: {} };
    render(
      <ParentProvider>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    const merged = readMerged();
    const featureKeys = Object.keys(merged).filter((k) =>
      k.startsWith("feature."),
    );
    expect(featureKeys).toHaveLength(0);

    const substituted = updateObjectWithVariableInputs({
      // eslint-disable-next-line
      args: { x: "${feature.x}" },
      variableInputs: merged,
    });
    expect(substituted.x).toBe("");
  });

  test("setVariableInputValues with feature.* key only updates scoped state", () => {
    const feature = {
      layerName: "Stations",
      attributes: { station_id: "ABC" },
    };
    render(
      <ParentProvider initialValues={{ host_var: "host" }}>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
          <ContextWriter
            nextValue={JSON.stringify({ "feature.note": "scoped-note" })}
          />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    expect(readMerged()["feature.note"]).toBeUndefined();
    expect(readParent().host_var).toBe("host");

    fireEvent.click(screen.getByTestId("writer"));

    // Scoped state visible to descendants.
    expect(readMerged()["feature.note"]).toBe("scoped-note");
    // Parent context is untouched.
    expect(readParent()).toEqual({ host_var: "host" });
  });

  test("setVariableInputValues with non-feature.* key only updates parent", () => {
    const feature = { layerName: "X", attributes: { a: 1 } };
    render(
      <ParentProvider initialValues={{ host_var: "old" }}>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
          <ContextWriter nextValue={JSON.stringify({ host_var: "new" })} />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    fireEvent.click(screen.getByTestId("writer"));

    expect(readParent().host_var).toBe("new");
    // Merged view reflects the new parent value (no scoped state shadowing
    // it).
    expect(readMerged().host_var).toBe("new");
  });

  test("mixed-key setVariableInputValues routes both correctly", () => {
    const feature = { layerName: "X", attributes: { a: 1 } };
    render(
      <ParentProvider initialValues={{ host_var: "old" }}>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
          <ContextWriter
            nextValue={JSON.stringify({
              host_var: "fresh",
              "feature.note": "scope",
            })}
          />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    fireEvent.click(screen.getByTestId("writer"));

    // Both reads settle.
    expect(readParent().host_var).toBe("fresh");
    const merged = readMerged();
    expect(merged.host_var).toBe("fresh");
    expect(merged["feature.note"]).toBe("scope");
  });

  test("setVariableInputValues null nextValue", () => {
    render(
      <ParentProvider>
        <FeatureScopedVariableInputs>
          <ContextProbe />
          <ContextWriter nextValue={null} />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    fireEvent.click(screen.getByTestId("writer"));

    const merged = readMerged();
    expect(merged).toStrictEqual({ [FEATURE_SCOPE_MARKER]: true });
  });

  test("functional updater pattern works against the merged view", () => {
    const feature = { layerName: "X", attributes: { a: 1 } };
    render(
      <ParentProvider initialValues={{ host_var: "old" }}>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
          <ContextWriter
            useFunctional
            nextValue={JSON.stringify({
              "feature.foo": "bar",
              host_var: "fresher",
            })}
          />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    fireEvent.click(screen.getByTestId("writer"));

    const merged = readMerged();
    expect(merged["feature.foo"]).toBe("bar");
    expect(merged.host_var).toBe("fresher");
    // feature.a is the unchanged flattened attribute and remains visible.
    expect(merged["feature.a"]).toBe(1);
    // Parent updated.
    expect(readParent().host_var).toBe("fresher");
  });

  test("functional updater null nextValue", () => {
    render(
      <ParentProvider initialValues={{}}>
        <FeatureScopedVariableInputs>
          <ContextProbe />
          <ContextWriter useFunctional returnNull />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    fireEvent.click(screen.getByTestId("writer"));

    const merged = readMerged();
    expect(merged).toStrictEqual({ [FEATURE_SCOPE_MARKER]: true });
  });

  test("scoped feature.* writes shadow the flattened attribute on collision", () => {
    const feature = {
      layerName: "X",
      attributes: { a: "from-feature" },
    };
    render(
      <ParentProvider>
        <FeatureScopedVariableInputs feature={feature}>
          <ContextProbe />
          <ContextWriter
            nextValue={JSON.stringify({ "feature.a": "from-scope" })}
          />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    expect(readMerged()["feature.a"]).toBe("from-feature");

    fireEvent.click(screen.getByTestId("writer"));

    expect(readMerged()["feature.a"]).toBe("from-scope");
  });

  test("mounts cleanly with feature={null}", () => {
    render(
      <ParentProvider initialValues={{ host: "v" }}>
        <FeatureScopedVariableInputs feature={null}>
          <ContextProbe />
        </FeatureScopedVariableInputs>
      </ParentProvider>,
    );

    const merged = readMerged();
    expect(merged.host).toBe("v");
    const featureKeys = Object.keys(merged).filter((k) =>
      k.startsWith("feature."),
    );
    expect(featureKeys).toHaveLength(0);
  });
});
