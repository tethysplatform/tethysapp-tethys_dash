import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PropTypes from "prop-types";
import ModuleLoader, {
  loadComponent,
} from "../../../components/visualizations/ModuleLoader";
import { VariableInputsContext } from "../../../components/contexts/Contexts";
import useDynamicScript from "../../../hooks/useDynamicScript";

// Mock the useDynamicScript hook
jest.mock("../../../hooks/useDynamicScript");

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
    visualizationRef: React.createRef(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Default useDynamicScript mock
    useDynamicScript.mockReturnValue({ ready: false, failed: false });
  });

  describe("No module specified", () => {
    test("renders 'No system specified' when module is null", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={null} />
        </Wrapper>
      );

      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("renders 'No system specified' when module is undefined", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={undefined} />
        </Wrapper>
      );

      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("renders 'No system specified' when module is empty string", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module="" />
        </Wrapper>
      );

      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    test("renders 'No system specified' when module is falsy", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={false} />
        </Wrapper>
      );

      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });
  });

  describe("Dynamic script loading", () => {
    test("calls useDynamicScript with correct URL when module and url provided", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      expect(useDynamicScript).toHaveBeenCalledWith({
        url: defaultProps.url,
      });
    });

    test("renders error message when script fails to load", () => {
      useDynamicScript.mockReturnValue({ ready: false, failed: true });
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      expect(
        screen.getByText(`Failed to load dynamic script: ${defaultProps.url}`)
      ).toBeInTheDocument();
    });

    test("renders nothing when script is loading", () => {
      useDynamicScript.mockReturnValue({ ready: false, failed: false });
      const Wrapper = createContextWrapper();

      const { container } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // Should not render anything when not ready and not failed
      expect(screen.queryByText("No system specified")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Failed to load dynamic script/)
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("dynamic-component")).not.toBeInTheDocument();

      // Container should not contain any visible text
      expect(container).toBeEmptyDOMElement();
    });

    test("renders loading animation when script is ready", () => {
      useDynamicScript.mockReturnValue({ ready: true, failed: false });
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // Should render the Suspense component with fallback
      expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
    });
  });

  describe("Script URL handling", () => {
    test("handles case when module exists but url is null", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} url={null} />
        </Wrapper>
      );

      // When module exists but url is null, should pass null to useDynamicScript
      expect(useDynamicScript).toHaveBeenCalledWith({
        url: null,
      });
    });

    test("handles case when module exists but url is undefined", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} url={undefined} />
        </Wrapper>
      );

      // When module exists but url is undefined, should pass undefined to useDynamicScript
      expect(useDynamicScript).toHaveBeenCalledWith({
        url: undefined,
      });
    });

    test("handles missing URL gracefully", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader
            scope="testScope"
            module="testModule"
            // url is intentionally missing
            props={{}}
            visualizationRef={React.createRef()}
          />
        </Wrapper>
      );

      expect(useDynamicScript).toHaveBeenCalledWith({
        url: undefined, // module && url evaluates to undefined when url is undefined
      });
    });
  });

  describe("Component lifecycle and state management", () => {
    test("renders correctly on initial mount", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // Initial state should not render anything visible
      expect(screen.queryByText("No system specified")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Failed to load dynamic script/)
      ).not.toBeInTheDocument();
    });

    test("handles script ready state correctly", () => {
      useDynamicScript.mockReturnValue({ ready: true, failed: false });
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // Should show loading animation when script is ready
      expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
    });

    test("handles script failed state correctly", () => {
      useDynamicScript.mockReturnValue({ ready: false, failed: true });
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // Should show error message when script fails
      expect(
        screen.getByText(`Failed to load dynamic script: ${defaultProps.url}`)
      ).toBeInTheDocument();
    });
  });

  describe("Context integration", () => {
    test("integrates with VariableInputsContext", () => {
      useDynamicScript.mockReturnValue({ ready: true, failed: false });
      const contextValue = {
        variableInputValues: { var1: "value1", var2: "value2" },
        setVariableInputValues: jest.fn(),
      };
      const Wrapper = createContextWrapper(contextValue);

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // Should render loading animation, indicating successful context integration
      expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
    });

    test("createVariableInputsUpdater function is created", () => {
      useDynamicScript.mockReturnValue({ ready: true, failed: false });
      const setVariableInputValues = jest.fn();
      const contextValue = {
        variableInputValues: { existing: "value" },
        setVariableInputValues,
      };
      const Wrapper = createContextWrapper(contextValue);

      render(
        <Wrapper>
          <ModuleLoader {...defaultProps} />
        </Wrapper>
      );

      // The component should render successfully, indicating updateVariableInputValues was created
      expect(screen.getByTestId("loading-animation")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    test("calls updateVariableInputValues and triggers setVariableInputValues (covers line 54)", async () => {
      useDynamicScript.mockReturnValue({ ready: true, failed: false });
      const setVariableInputValues = jest.fn((updater) => {
        // Simulate React state updater function
        const prev = { a: 1 };
        return typeof updater === "function" ? updater(prev) : updater;
      });
      // Dummy component to capture props
      const DummyComponent = React.forwardRef((props, ref) => {
        const { updateVariableInputValues } = props;
        React.useEffect(() => {
          if (updateVariableInputValues) {
            updateVariableInputValues({ b: 2 });
          }
        }, [updateVariableInputValues]);
        return <div data-testid="dynamic-component">Dynamic Loaded</div>;
      });
      DummyComponent.displayName = "DummyComponent";
      DummyComponent.propTypes = {
        updateVariableInputValues: PropTypes.func,
      };
      jest.spyOn(React, "lazy").mockImplementation(() => DummyComponent);
      const contextValue = {
        variableInputValues: { a: 1 },
        setVariableInputValues,
      };
      const Wrapper = createContextWrapper(contextValue);
      render(
        <Wrapper>
          <ModuleLoader
            scope="testScope"
            module="testModule"
            url="https://example.com/test.js"
            props={{}}
            visualizationRef={React.createRef()}
          />
        </Wrapper>
      );
      expect(
        await screen.findByTestId("dynamic-component")
      ).toBeInTheDocument();
      expect(setVariableInputValues).toHaveBeenCalled();
      React.lazy.mockRestore();
    });
    test("handles various falsy module values", () => {
      const Wrapper = createContextWrapper();

      // Test with 0
      const { rerender } = render(
        <Wrapper>
          <ModuleLoader {...defaultProps} module={0} />
        </Wrapper>
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();

      // Test with empty string
      rerender(
        <Wrapper>
          <ModuleLoader {...defaultProps} module="" />
        </Wrapper>
      );
      expect(screen.getByText("No system specified")).toBeInTheDocument();
    });

    describe("loadComponent and dynamic loading", () => {
      let originalWindow;
      beforeEach(() => {
        originalWindow = { ...window };
      });
      afterEach(() => {
        // Restore window object
        Object.keys(window).forEach((key) => {
          if (!(key in originalWindow)) {
            delete window[key];
          }
        });
        Object.assign(window, originalWindow);
      });

      test("calls __webpack_init_sharing__ and container.init if window[scope] is not initialized", async () => {
        // Arrange
        const scope = "TestScope";
        const module = "TestModule";
        const mockInitSharing = jest.fn(() => Promise.resolve());
        const mockContainerInit = jest.fn(() => Promise.resolve());
        const mockGet = jest.fn(() =>
          Promise.resolve(() => {
            const Loaded = () => <div>Loaded!</div>;
            Loaded.displayName = "Loaded";
            return Loaded;
          })
        );
        window[scope] = {
          initialized: false,
          init: mockContainerInit,
          get: mockGet,
        };
        global.__webpack_init_sharing__ = mockInitSharing;
        global.__webpack_share_scopes__ = { default: {} };

        // Act
        const loader = loadComponent(scope, module);
        const result = await loader();
        expect(mockInitSharing).toHaveBeenCalledWith("default");
        expect(mockContainerInit).toHaveBeenCalledWith(
          global.__webpack_share_scopes__.default
        );
        expect(mockGet).toHaveBeenCalledWith(module);
        expect(typeof result).toBe("function");
      });

      test("does not call __webpack_init_sharing__ if window[scope] is already initialized", async () => {
        const scope = "TestScope2";
        const module = "TestModule2";
        const mockGet = jest.fn(() =>
          Promise.resolve(() => {
            const Loaded2 = () => <div>Loaded2!</div>;
            Loaded2.displayName = "Loaded2";
            return Loaded2;
          })
        );
        window[scope] = { initialized: true, get: mockGet };
        // __webpack_init_sharing__ should not be called
        global.__webpack_init_sharing__ = jest.fn();
        global.__webpack_share_scopes__ = { default: {} };

        const loader = loadComponent(scope, module);
        const result = await loader();
        expect(global.__webpack_init_sharing__).not.toHaveBeenCalled();
        expect(mockGet).toHaveBeenCalledWith(module);
        expect(typeof result).toBe("function");
      });

      test("renders the loaded component when ready (ModuleLoader line 54)", async () => {
        // Simulate the dynamic import and ready state
        useDynamicScript.mockReturnValue({ ready: true, failed: false });
        // Patch React.lazy to return a dummy component
        const DummyComponent = React.forwardRef((props, ref) => (
          <div data-testid="dynamic-component">Dynamic Loaded</div>
        ));
        DummyComponent.displayName = "DummyComponent";
        jest.spyOn(React, "lazy").mockImplementation(() => DummyComponent);
        const Wrapper = createContextWrapper();
        render(
          <Wrapper>
            <ModuleLoader
              scope="testScope"
              module="testModule"
              url="https://example.com/test.js"
              props={{}}
              visualizationRef={React.createRef()}
            />
          </Wrapper>
        );
        expect(
          await screen.findByTestId("dynamic-component")
        ).toBeInTheDocument();
        React.lazy.mockRestore();
      });
    });

    test("handles empty props correctly", () => {
      const Wrapper = createContextWrapper();

      render(
        <Wrapper>
          <ModuleLoader
            scope="testScope"
            module="testModule"
            url="https://example.com/test.js"
            props={{}}
            visualizationRef={React.createRef()}
          />
        </Wrapper>
      );

      // Should behave normally with empty props
      expect(useDynamicScript).toHaveBeenCalledWith({
        url: "https://example.com/test.js",
      });
    });
  });
});
