import { createRef, forwardRef, useEffect } from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PropTypes from "prop-types";
import ModuleLoader from "../../../components/visualizations/ModuleLoader";
import { VariableInputsContext } from "../../../components/contexts/Contexts";
import { loadComponent } from "../../../components/visualizations/remoteLoader";

// Mock the remoteLoader module
jest.mock("../../../components/visualizations/remoteLoader");

// Mock LoadingAnimation component
jest.mock("../../../components/loader/LoadingAnimation", () => {
  return function MockLoadingAnimation() {
    return <div data-testid="loading-animation">Loading...</div>;
  };
});

// Helper function to create context wrapper
const createContextWrapper = (contextValue = {}) => {
  const defaultValue = {
    variableInputValues: {},
    setVariableInputValues: jest.fn(),
    ...contextValue,
  };

  function TestWrapper({ children }) {
    return (
      <VariableInputsContext.Provider value={defaultValue}>
        {children}
      </VariableInputsContext.Provider>
    );
  }

  TestWrapper.propTypes = {
    children: PropTypes.node.isRequired,
  };

  return TestWrapper;
};

describe("ModuleLoader", () => {
  const defaultProps = {
    scope: "testScope",
    module: "testModule",
    url: "https://example.com/test.js",
    props: { testProp: "testValue" },
    visualizationRef: createRef(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});

    // Default: loadComponent returns a thunk that resolves to a component
    const DummyDefault = forwardRef((props, ref) => (
      <div data-testid="remote-component">Remote Component</div>
    ));
    DummyDefault.displayName = "DummyDefault";

    loadComponent.mockReturnValue(() =>
      Promise.resolve({ default: DummyDefault }),
    );
  });

  // ──────────────────────────────────────────────────────────
  // No module specified
  // ──────────────────────────────────────────────────────────
  describe("No module specified", () => {
    test("renders 'No system specified' when module is null", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={null} />
        </Wrapper>,
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("renders 'No system specified' when module is undefined", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={undefined} />
        </Wrapper>,
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("renders 'No system specified' when module is empty string", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module="" />
        </Wrapper>,
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("renders 'No system specified' when module is falsy (0)", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={0} />
        </Wrapper>,
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("does not call loadComponent when module is falsy", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={null} />
        </Wrapper>,
      );
      expect(loadComponent).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // useDynamicFederatedComponent (tested through ModuleLoader)
  // ──────────────────────────────────────────────────────────
  describe("useDynamicFederatedComponent", () => {
    test("calls loadComponent with correct params", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith({
        scope: "testScope",
        module: "testModule",
        url: "https://example.com/test.js",
        remoteType: "webpack",
      });
    });

    test("defaults remoteType to 'webpack'", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith(
        expect.objectContaining({ remoteType: "webpack" }),
      );
    });

    test("passes remoteType='vite-esm' through to loadComponent", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} remoteType="vite-esm" />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith(
        expect.objectContaining({ remoteType: "vite-esm" }),
      );
    });

    test("does not call loadComponent when url is missing", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} url={null} />
        </Wrapper>,
      );

      // useEffect guard: if (!url || !module) return;
      expect(loadComponent).not.toHaveBeenCalled();
    });

    test("re-invokes loadComponent when scope changes", () => {
      const Wrapper = createContextWrapper();
      const { rerender } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      loadComponent.mockClear();

      rerender(
        <Wrapper>
          <ModuleLoader {...defaultProps} scope="newScope" />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "newScope" }),
      );
    });

    test("re-invokes loadComponent when url changes", () => {
      const Wrapper = createContextWrapper();
      const { rerender } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      loadComponent.mockClear();

      rerender(
        <Wrapper>
          <ModuleLoader {...defaultProps} url="https://new-url.com/r.js" />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith(
        expect.objectContaining({ url: "https://new-url.com/r.js" }),
      );
    });

    test("re-invokes loadComponent when remoteType changes", () => {
      const Wrapper = createContextWrapper();
      const { rerender } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} remoteType="webpack" />
        </Wrapper>,
      );

      loadComponent.mockClear();

      rerender(
        <Wrapper>
          <ModuleLoader {...defaultProps} remoteType="vite-esm" />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith(
        expect.objectContaining({ remoteType: "vite-esm" }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // Rendering states
  // ──────────────────────────────────────────────────────────
  describe("rendering states", () => {
    test("renders loaded component via Suspense", async () => {
      const Loaded = forwardRef((props, ref) => (
        <div data-testid="dynamic-component">Dynamic Loaded</div>
      ));
      Loaded.displayName = "Loaded";

      loadComponent.mockReturnValue(() => Promise.resolve({ default: Loaded }));

      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      expect(
        await screen.findByTestId("dynamic-component"),
      ).toBeInTheDocument();
    });

    test("shows loading fallback while component resolves", async () => {
      // loadComponent returns a thunk that never resolves
      loadComponent.mockReturnValue(() => new Promise(() => {}));

      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
    });

    test("renders error message when remote fails to load", async () => {
      loadComponent.mockReturnValue(() =>
        Promise.reject(new Error("network failure")),
      );

      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      expect(
        await screen.findByText(`Failed to load remote: ${defaultProps.url}`),
      ).toBeInTheDocument();
    });

    test("renders nothing when url is null (component stays null)", () => {
      const Wrapper = createContextWrapper();
      const { container } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} url={null} />
        </Wrapper>,
      );

      expect(screen.queryByTestId("loading-animation")).not.toBeInTheDocument();
      expect(screen.queryByText("No system specified")).not.toBeInTheDocument();
      expect(container).toBeEmptyDOMElement();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Context integration
  // ──────────────────────────────────────────────────────────
  describe("context integration", () => {
    test("passes variableInputValues to loaded component", async () => {
      const receivedProps = {};
      const Spy = forwardRef((props, ref) => {
        Object.assign(receivedProps, props);
        return <div data-testid="spy-component">Spy</div>;
      });
      Spy.displayName = "Spy";

      loadComponent.mockReturnValue(() => Promise.resolve({ default: Spy }));

      const contextValue = {
        variableInputValues: { var1: "value1", var2: "value2" },
        setVariableInputValues: jest.fn(),
      };
      const Wrapper = createContextWrapper(contextValue);

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      await screen.findByTestId("spy-component");

      expect(receivedProps.variableInputValues).toEqual({
        var1: "value1",
        var2: "value2",
      });
      expect(typeof receivedProps.updateVariableInputValues).toBe("function");
    });

    test("updateVariableInputValues merges with previous state", async () => {
      const setVariableInputValues = jest.fn();

      const Invoker = forwardRef((props, ref) => {
        const { updateVariableInputValues } = props;
        useEffect(() => {
          if (updateVariableInputValues) {
            updateVariableInputValues({ newVar: "newValue" });
          }
        }, [updateVariableInputValues]);
        return <div data-testid="invoker">Invoker</div>;
      });
      Invoker.displayName = "Invoker";
      Invoker.propTypes = { updateVariableInputValues: PropTypes.func };

      loadComponent.mockReturnValue(() =>
        Promise.resolve({ default: Invoker }),
      );

      const contextValue = {
        variableInputValues: { existing: "value" },
        setVariableInputValues,
      };
      const Wrapper = createContextWrapper(contextValue);

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      await screen.findByTestId("invoker");

      expect(setVariableInputValues).toHaveBeenCalled();
      const updater = setVariableInputValues.mock.calls[0][0];
      const merged = updater({ existing: "value" });
      expect(merged).toEqual({ existing: "value", newVar: "newValue" });
    });

    test("passes custom props to loaded component", async () => {
      const receivedProps = {};
      const Spy = forwardRef((props, ref) => {
        Object.assign(receivedProps, props);
        return <div data-testid="spy-component">Spy</div>;
      });
      Spy.displayName = "Spy";

      loadComponent.mockReturnValue(() => Promise.resolve({ default: Spy }));

      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader
            {...defaultProps}
            props={{ customProp: "customValue", anotherProp: 42 }}
          />
        </Wrapper>,
      );

      await screen.findByTestId("spy-component");

      expect(receivedProps.customProp).toBe("customValue");
      expect(receivedProps.anotherProp).toBe(42);
    });

    test("forwards visualizationRef to loaded component", async () => {
      const ref = createRef();
      const Spy = forwardRef((props, fwdRef) => (
        <div data-testid="spy-component" ref={fwdRef}>
          Spy
        </div>
      ));
      Spy.displayName = "Spy";

      loadComponent.mockReturnValue(() => Promise.resolve({ default: Spy }));

      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} visualizationRef={ref} />
        </Wrapper>,
      );

      await screen.findByTestId("spy-component");

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Edge cases
  // ──────────────────────────────────────────────────────────
  describe("edge cases", () => {
    test("handles empty props object", () => {
      const Wrapper = createContextWrapper();
      render(
        <Wrapper>
          <ModuleLoader
            scope="testScope"
            module="testModule"
            url="https://example.com/test.js"
            props={{}}
            visualizationRef={createRef()}
          />
        </Wrapper>,
      );

      expect(loadComponent).toHaveBeenCalledWith({
        scope: "testScope",
        module: "testModule",
        url: "https://example.com/test.js",
        remoteType: "webpack",
      });
    });

    test("handles various falsy module values", () => {
      const Wrapper = createContextWrapper();

      const { rerender } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={0} />
        </Wrapper>,
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();

      rerender(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={false} />
        </Wrapper>,
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("integrates with VariableInputsContext", async () => {
      const Loaded = forwardRef((props, ref) => (
        <div data-testid="dynamic-component">Context OK</div>
      ));
      Loaded.displayName = "Loaded";

      loadComponent.mockReturnValue(() => Promise.resolve({ default: Loaded }));

      const contextValue = {
        variableInputValues: { v1: "a", v2: "b" },
        setVariableInputValues: jest.fn(),
      };
      const Wrapper = createContextWrapper(contextValue);

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>,
      );

      expect(
        await screen.findByTestId("dynamic-component"),
      ).toBeInTheDocument();
    });
  });
});
