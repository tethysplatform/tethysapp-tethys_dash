import { createRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MapExtent } from "components/inputs/custom/MapExtent";
import createLoadedComponent from "__tests__/utilities/customRender";
import MapContextProvider from "components/contexts/MapContext";
import { MapContext } from "components/contexts/Contexts";

// Mock view object with required methods
const mockView = {
  on: jest.fn(),
  un: jest.fn(),
  getCenter: () => [123456.78, 987654.32],
  getZoom: () => 4.5678,
};

// Mock map object with getView, on, un
const mockMap = {
  getView: () => mockView,
  on: jest.fn(),
  un: jest.fn(),
};

const renderWithContext = (props) => {
  const visualizationRef = createRef();
  visualizationRef.current = mockMap;

  const onChange = jest.fn();

  render(
    <MapContext.Provider value={{ mapReady: true }}>
      <MapExtent
        onChange={onChange}
        values={{ extent: "10,20,4" }}
        visualizationRef={visualizationRef}
        {...props}
      />
    </MapContext.Provider>
  );

  return { onChange, visualizationRef };
};

it("empty MapExtent", async () => {
  const onChange = jest.fn();
  const visualizationRef = { current: jest.fn() };
  const values = null;

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <MapExtent
            values={values}
            onChange={onChange}
            visualizationRef={visualizationRef}
          />
        </MapContextProvider>
      ),
    })
  );

  const mapExtent = await screen.findByText("Map Extent");
  fireEvent.click(mapExtent);

  expect(
    await screen.findByText("Use the Previewed Map Extent")
  ).toBeInTheDocument();
  expect(screen.getByText("Use a Custom Extent")).toBeInTheDocument();
  expect(screen.getByText("Custom Extent")).toBeInTheDocument();

  const input = screen.getByLabelText("Custom Extent Input");

  await waitFor(() => {
    expect(input.value).toBe("-10686671.12,4721671.57,4.5");
  });

  const extentVariable = screen.getByLabelText("Extent Variable Name:");
  expect(extentVariable).toBeInTheDocument();

  fireEvent.change(extentVariable, {
    target: { value: "test" },
  });

  expect(onChange.mock.calls[1][0]).toStrictEqual({
    extent: "-10686671.12,4721671.57,4.5",
    variable: "test",
  });
});

it("existing Custom MapExtent", async () => {
  const onChange = jest.fn();
  const visualizationRef = { current: jest.fn() };
  const values = { extent: "10, 20,4" };

  render(
    createLoadedComponent({
      children: (
        <MapContextProvider>
          <MapExtent
            values={values}
            onChange={onChange}
            visualizationRef={visualizationRef}
          />
        </MapContextProvider>
      ),
    })
  );

  const mapExtent = await screen.findByText("Map Extent");
  fireEvent.click(mapExtent);

  expect(
    await screen.findByText("Use the Previewed Map Extent")
  ).toBeInTheDocument();
  expect(screen.getByText("Use a Custom Extent")).toBeInTheDocument();
  expect(screen.getByText("Custom Extent")).toBeInTheDocument();

  const input = screen.getByLabelText("Custom Extent Input");

  expect(input.value).toBe("10, 20,4");
  await waitFor(() => {
    expect(onChange.mock.calls[0][0]).toStrictEqual(values);
  });
  expect(window.getComputedStyle(input).borderColor).toBe("#ccc");

  const invalidValues = "10,20";
  fireEvent.change(input, {
    target: { value: invalidValues },
  });

  expect(onChange.mock.calls[1][0]).toBe(null);
  expect(window.getComputedStyle(input).borderColor).toBe("red");

  const validValues = "10,20,30,40";
  fireEvent.change(input, {
    target: { value: validValues },
  });

  expect(onChange.mock.calls[2][0]).toStrictEqual({ extent: validValues });
  expect(window.getComputedStyle(input).borderColor).toBe("#ccc");

  const extentVariable = screen.getByLabelText("Extent Variable Name:");
  expect(extentVariable).toBeInTheDocument();

  fireEvent.change(extentVariable, {
    target: { value: "test" },
  });

  expect(onChange.mock.calls[3][0]).toStrictEqual({
    extent: validValues,
    variable: "test",
  });

  const moreInvalidValues = "10,20,30,40, 50";
  fireEvent.change(input, {
    target: { value: moreInvalidValues },
  });

  expect(onChange.mock.calls[4][0]).toBe(null);
  expect(window.getComputedStyle(input).borderColor).toBe("red");

  // eslint-disable-next-line
  const variableValues = "${extent}";
  fireEvent.change(input, {
    target: { value: variableValues },
  });

  expect(onChange.mock.calls[5][0]).toStrictEqual({
    extent: variableValues,
    variable: "test",
  });
  expect(window.getComputedStyle(input).borderColor).toBe("#ccc");

  // eslint-disable-next-line
  const moreVariableValues = "${Lon}, 12, 4";
  fireEvent.change(input, {
    target: { value: moreVariableValues },
  });

  expect(onChange.mock.calls[6][0]).toStrictEqual({
    extent: moreVariableValues,
    variable: "test",
  });
  expect(window.getComputedStyle(input).borderColor).toBe("#ccc");

  // eslint-disable-next-line
  const evenMoreVariableValues = "${LonLat}, 4";
  fireEvent.change(input, {
    target: { value: evenMoreVariableValues },
  });

  expect(onChange.mock.calls[7][0]).toStrictEqual({
    extent: evenMoreVariableValues,
    variable: "test",
  });
  expect(window.getComputedStyle(input).borderColor).toBe("#ccc");
});

test("attaches event listeners when extentMode is mapExtent", async () => {
  const { onChange } = renderWithContext();

  expect(onChange.mock.calls[0][0]).toStrictEqual({
    extent: "10,20,4",
  });

  const mapExtent = screen.getByText("Map Extent");
  fireEvent.click(mapExtent);

  // Switch to "mapExtent" mode
  fireEvent.click(
    await screen.findByLabelText(/Use the Previewed Map Extent/i)
  );

  expect(mockMap.getView().on).toHaveBeenCalledWith(
    "change:resolution",
    expect.any(Function)
  );

  expect(mockMap.on).toHaveBeenCalledWith("moveend", expect.any(Function));

  // Simulate the handler call
  const resolutionCallback = mockMap
    .getView()
    .on.mock.calls.find(([event]) => event === "change:resolution")[1];
  resolutionCallback();

  expect(onChange.mock.calls[2][0]).toStrictEqual({
    extent: "123456.78,987654.32,4.57",
  });

  const extentVariable = screen.getByLabelText("Extent Variable Name:");
  expect(extentVariable).toBeInTheDocument();

  fireEvent.change(extentVariable, {
    target: { value: "test" },
  });

  expect(onChange.mock.calls[5][0]).toStrictEqual({
    extent: "123456.78,987654.32,4.57",
    variable: "test",
  });

  fireEvent.click(await screen.findByLabelText(/Use a Custom Extent/i));

  expect(onChange.mock.calls[6][0]).toStrictEqual({
    extent: "123456.78,987654.32,4.57",
    variable: "test",
  });
});
