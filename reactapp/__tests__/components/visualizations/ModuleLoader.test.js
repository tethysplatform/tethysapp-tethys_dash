import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import PropTypes from "prop-types";
import ModuleLoader from "../../../components/visualizations/ModuleLoader";
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
