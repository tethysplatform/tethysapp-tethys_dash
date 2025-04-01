import { useRef, forwardRef, useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPane from "components/modals/DataViewer/SettingsPane";
import createLoadedComponent from "__tests__/utilities/customRender";
import PropTypes from "prop-types";

global.ResizeObserver = require("resize-observer-polyfill");

const TestingComponent = forwardRef(
  ({ visualizationRefElement, currentSettings = {} }, ref) => {
    const settingsRef = useRef(currentSettings);
    const visualizationRef = useRef(visualizationRefElement);

    // Ensure ref stays updated
    useEffect(() => {
      if (ref) {
        ref.current = settingsRef.current;
      }
    }, [currentSettings, ref]);

    return (
      <>
        <SettingsPane
          settingsRef={settingsRef}
          viz={null}
          visualizationRef={visualizationRef}
        />
      </>
    );
  }
);
TestingComponent.displayName = "TestingComponent";

test("Settings Pane", async () => {
  render(
    createLoadedComponent({
      children: <TestingComponent />,
      options: {
        inDataViewerMode: true,
      },
    })
  );

  expect(
    await screen.findByText(
      "Visualization must be loaded to change additional settings."
    )
  ).toBeInTheDocument();
});

test("Settings Pane with visualizationRef Element", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          visualizationRefElement={{
            tagName: "div",
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const refreshRateInput = await screen.findByLabelText(
    "Refresh Rate (Minutes) Input"
  );
  expect(refreshRateInput).toBeInTheDocument();
  fireEvent.change(refreshRateInput, { target: { value: -2 } });
  expect(refreshRateInput.value).toBe("0");

  fireEvent.change(refreshRateInput, { target: { value: 2 } });
  expect(refreshRateInput.value).toBe("2");

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      refreshRate: 2,
    });
  });
});

test("Settings Pane with visualizationRef Image Element with current settings", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          visualizationRefElement={{
            tagName: "img",
            naturalWidth: 1,
            naturalHeight: 2,
          }}
          currentSettings={{ refreshRate: 5, enforceAspectRatio: true }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const refreshRateInput = await screen.findByLabelText(
    "Refresh Rate (Minutes) Input"
  );
  expect(refreshRateInput).toBeInTheDocument();
  expect(refreshRateInput.value).toBe("5");

  const enforceAspectRationInput = screen.getByLabelText(
    "Enforce Aspect Ratio Input"
  );
  expect(enforceAspectRationInput).toBeInTheDocument();
  expect(enforceAspectRationInput).toBeChecked();
  await userEvent.click(enforceAspectRationInput);
  expect(enforceAspectRationInput).not.toBeChecked();

  fireEvent.click(enforceAspectRationInput);
  expect(enforceAspectRationInput).toBeChecked();

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      aspectRatio: 0.5,
      enforceAspectRatio: true,
      refreshRate: 5,
    });
  });
});

test("Settings Pane with visualizationRef Image Element but no natural width", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          visualizationRefElement={{
            tagName: "img",
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const enforceAspectRationInput = screen.queryByLabelText(
    "Enforce Aspect Ratio Input"
  );
  expect(enforceAspectRationInput).not.toBeInTheDocument();

  await waitFor(() => {
    expect(settingsRef.current).toEqual({});
  });
});

test("Settings with border", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{ border: { border: "4px solid #ff6161" } }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: { border: "4px solid #ff6161" },
    });
  });

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const topBorderButton = screen.getByLabelText("top Border Button");
  expect(topBorderButton).toBeInTheDocument();
  const rightBorderButton = screen.getByLabelText("right Border Button");
  expect(rightBorderButton).toBeInTheDocument();
  const bottomBorderButton = screen.getByLabelText("bottom Border Button");
  expect(bottomBorderButton).toBeInTheDocument();
  const removeBordersButton = screen.getByLabelText("Remove Borders");
  expect(removeBordersButton).toBeInTheDocument();

  expect(leftBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161"
  );
  expect(topBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161"
  );
  expect(rightBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161"
  );
  expect(bottomBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161"
  );

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: { border: "4px solid #ff6161" },
    });
  });

  await userEvent.click(removeBordersButton);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({});
  });
});

test("Settings with top and bottom border", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{
            border: {
              "border-top": "2px solid #7fc066",
              "border-bottom": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const topBorderButton = screen.getByLabelText("top Border Button");
  expect(topBorderButton).toBeInTheDocument();
  const rightBorderButton = screen.getByLabelText("right Border Button");
  expect(rightBorderButton).toBeInTheDocument();
  const bottomBorderButton = screen.getByLabelText("bottom Border Button");
  expect(bottomBorderButton).toBeInTheDocument();

  expect(leftBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  expect(topBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#7fc066"
  );
  expect(rightBorderButton.querySelector("svg")).not.toHaveAttribute("color");
  expect(bottomBorderButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161"
  );

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: {
        "border-bottom": "4px solid #ff6161",
        "border-top": "2px solid #7fc066",
      },
    });
  });
});

test("Settings with backgroundColor", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{ backgroundColor: "#ff6161" }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      backgroundColor: "#ff6161",
    });
  });

  const backgroundColorButton = await screen.findByLabelText(
    "Background Color Selector"
  );
  expect(backgroundColorButton).toBeInTheDocument();
  expect(backgroundColorButton.querySelector("svg")).toHaveAttribute(
    "color",
    "#ff6161"
  );

  await userEvent.click(backgroundColorButton);

  const hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("#ff6161");

  fireEvent.change(hexInput, { target: { value: "#0000ff" } });

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      backgroundColor: "#0000ff",
    });
  });

  // change to transparent
  fireEvent.change(hexInput, { target: { value: "#00000000" } });

  await waitFor(() => {
    expect(settingsRef.current).toEqual({});
  });

  fireEvent.change(hexInput, { target: { value: "rgb(255,255,0)" } });

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      backgroundColor: "rgb(255,255,0)",
    });
  });

  // change to transparent
  fireEvent.change(hexInput, { target: { value: "rgba(0, 0, 0, 0)" } });

  await waitFor(() => {
    expect(settingsRef.current).toEqual({});
  });

  // change to transparent
  fireEvent.change(hexInput, { target: { value: "argertert" } });

  await waitFor(() => {
    expect(settingsRef.current).toEqual({});
  });
});

test("Settings with box shadow", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: <TestingComponent ref={settingsRef} currentSettings={{}} />,
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const boxShadowCheckbox = await screen.findByRole("checkbox");
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
    });
  });

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({});
  });
});

test("Settings with box shadow and border", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{ border: { border: "4px solid #ff6161" } }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const boxShadowCheckbox = await screen.findByRole("checkbox");
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: { border: "4px solid #ff6161" },
      boxShadow: "0 4px 8px #ff6161",
    });
  });

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: { border: "4px solid #ff6161" },
    });
  });
});

test("Settings with box shadow and top and bottom border", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{
            border: {
              "border-top": "2px solid #7fc066",
              "border-bottom": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const boxShadowCheckbox = await screen.findByRole("checkbox");
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: {
        "border-bottom": "4px solid #ff6161",
        "border-top": "2px solid #7fc066",
      },
      boxShadow: "0 4px 8px #ff6161,0 -4px 8px #7fc066",
    });
  });
});

test("Settings with box shadow and left and right border", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{
            border: {
              "border-left": "2px solid #7fc066",
              "border-right": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const boxShadowCheckbox = await screen.findByRole("checkbox");
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: {
        "border-left": "2px solid #7fc066",
        "border-right": "4px solid #ff6161",
      },
      boxShadow: "4px 0 8px #ff6161,-4px 0 8px #7fc066",
    });
  });
});

test("Settings with box shadow and change border", async () => {
  const settingsRef = { current: null };

  render(
    createLoadedComponent({
      children: (
        <TestingComponent
          ref={settingsRef}
          currentSettings={{
            border: {
              "border-left": "2px solid #7fc066",
              "border-right": "4px solid #ff6161",
            },
          }}
        />
      ),
      options: {
        inDataViewerMode: true,
      },
    })
  );

  const leftBorderButton = await screen.findByLabelText("left Border Button");
  expect(leftBorderButton).toBeInTheDocument();
  const boxShadowCheckbox = await screen.findByRole("checkbox");
  expect(boxShadowCheckbox).toBeInTheDocument();

  await userEvent.click(boxShadowCheckbox);

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: {
        "border-left": "2px solid #7fc066",
        "border-right": "4px solid #ff6161",
      },
      boxShadow: "4px 0 8px #ff6161,-4px 0 8px #7fc066",
    });
  });

  await userEvent.click(leftBorderButton);

  const hexInput = await screen.findByLabelText(/hex/i);
  expect(hexInput.value).toBe("#7fc066");
  fireEvent.change(hexInput, { target: { value: "#FF0000" } });

  await waitFor(() => {
    expect(settingsRef.current).toEqual({
      border: {
        "border-left": "2px solid #FF0000",
        "border-right": "4px solid #ff6161",
      },
      boxShadow: "4px 0 8px #ff6161,-4px 0 8px #FF0000",
    });
  });
});

TestingComponent.propTypes = {
  visualizationRefElement: PropTypes.object,
  currentSettings: PropTypes.object,
};
