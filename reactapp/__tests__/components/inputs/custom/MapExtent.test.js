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
  getProjection: () => ({ getCode: () => "EPSG:3857" }),
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
    </MapContext.Provider>,
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
    }),
  );

  const mapExtent = await screen.findByText("Map Extent");
  fireEvent.click(mapExtent);

  expect(
    await screen.findByText("Use the Previewed Map Extent"),
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

it("existing Custom MapExtent with existing variable", async () => {
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
    }),
  );

  const mapExtent = await screen.findByText("Map Extent");
  fireEvent.click(mapExtent);

  expect(
    await screen.findByText("Use the Previewed Map Extent"),
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
    await screen.findByLabelText(/Use the Previewed Map Extent/i),
  );

  expect(mockMap.getView().on).toHaveBeenCalledWith(
    "change:resolution",
    expect.any(Function),
  );

  expect(mockMap.on).toHaveBeenCalledWith("moveend", expect.any(Function));

  // Simulate the handler call
  let resolutionCallback = mockMap
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

  fireEvent.change(extentVariable, {
    target: { value: "new_test" },
  });

  // Simulate the handler call
  resolutionCallback = mockMap
    .getView()
    .on.mock.calls.find(([event]) => event === "change:resolution")[1];
  resolutionCallback();

  expect(onChange.mock.calls[7][0]).toStrictEqual({
    extent: "123456.78,987654.32,4.57",
    variable: "new_test",
  });
});

test("setMapExtent wraps an out-of-range center X for EPSG:3857 projections", async () => {
  // The wrap branch in setMapExtent activates only for EPSG:3857. An
  // out-of-range center (e.g., one world-width west of valid range, the
  // reported bug coordinate) must be wrapped back into [-half, +half].
  const view3857 = {
    on: jest.fn(),
    un: jest.fn(),
    getCenter: () => [-25981450.0, 5746110.48],
    getZoom: () => 10.61,
    getProjection: () => ({ getCode: () => "EPSG:3857" }),
  };
  const map3857 = {
    getView: () => view3857,
    on: jest.fn(),
    un: jest.fn(),
  };
  const visualizationRef = createRef();
  visualizationRef.current = map3857;
  const onChange = jest.fn();

  render(
    <MapContext.Provider value={{ mapReady: true }}>
      <MapExtent
        onChange={onChange}
        values={{ extent: "10,20,4" }}
        visualizationRef={visualizationRef}
      />
    </MapContext.Provider>,
  );

  fireEvent.click(screen.getByText("Map Extent"));
  fireEvent.click(
    await screen.findByLabelText(/Use the Previewed Map Extent/i),
  );

  // -25,981,450 + 2 * MERCATOR_HALF_WORLD ≈ +14,093,566.69
  expect(onChange).toHaveBeenCalledWith({
    extent: "14093566.69,5746110.48,10.61",
  });
});

test("setMapExtent leaves the raw center X unwrapped for non-EPSG:3857 projections", async () => {
  // The wrap branch in setMapExtent is gated on EPSG:3857. A view in another
  // projection must pass center[0] through untouched, even if its magnitude
  // would be out of range for Web Mercator.
  const view4326 = {
    on: jest.fn(),
    un: jest.fn(),
    getCenter: () => [9999999999, 987654.32],
    getZoom: () => 4.5678,
    getProjection: () => ({ getCode: () => "EPSG:4326" }),
  };
  const map4326 = {
    getView: () => view4326,
    on: jest.fn(),
    un: jest.fn(),
  };
  const visualizationRef = createRef();
  visualizationRef.current = map4326;
  const onChange = jest.fn();

  render(
    <MapContext.Provider value={{ mapReady: true }}>
      <MapExtent
        onChange={onChange}
        values={{ extent: "10,20,4" }}
        visualizationRef={visualizationRef}
      />
    </MapContext.Provider>,
  );

  fireEvent.click(screen.getByText("Map Extent"));
  fireEvent.click(
    await screen.findByLabelText(/Use the Previewed Map Extent/i),
  );

  expect(onChange).toHaveBeenCalledWith({
    extent: "9999999999.00,987654.32,4.57",
  });
});

// ---------------------------------------------------------------------------
// View group controls
// ---------------------------------------------------------------------------

const makeMap = () => {
  const view = {
    on: jest.fn(),
    un: jest.fn(),
    getCenter: () => [123456.78, 987654.32],
    getZoom: () => 4.5678,
    getProjection: () => ({ getCode: () => "EPSG:3857" }),
  };
  return {
    getView: () => view,
    on: jest.fn(),
    un: jest.fn(),
  };
};

const PREVIEWED_EXTENT = "123456.78,987654.32,4.57";

// Renders the widget with the collapsible section already expanded.
const renderOpen = (props = {}) => {
  const visualizationRef = createRef();
  visualizationRef.current = makeMap();
  const onChange = jest.fn();

  render(
    <MapContext.Provider value={{ mapReady: true }}>
      <MapExtent
        onChange={onChange}
        values={{ extent: "10,20,4" }}
        visualizationRef={visualizationRef}
        {...props}
      />
    </MapContext.Provider>,
  );

  fireEvent.click(screen.getByText("Map Extent"));

  return { onChange, visualizationRef };
};

const lastValue = (onChange) =>
  onChange.mock.calls[onChange.mock.calls.length - 1][0];

const setGroupName = (name) => {
  const field = screen.getByLabelText("View Group Input");
  fireEvent.change(field, { target: { value: name } });
  fireEvent.blur(field);
  return field;
};

const flagAsInitialExtent = () =>
  fireEvent.click(screen.getByLabelText("View Group Initial Extent Input"));

test("entering a group name emits the extent together with the group name", () => {
  const { onChange } = renderOpen();

  // Surrounding whitespace is trimmed off the committed name (R25).
  setGroupName("  Basin  ");

  expect(lastValue(onChange)).toStrictEqual({
    extent: "10,20,4",
    viewGroup: "Basin",
  });
  expect(screen.getByLabelText("View Group Input").value).toBe("Basin");
});

test("a whitespace-only group name commits as no group", () => {
  const { onChange } = renderOpen();

  setGroupName("   ");

  expect(lastValue(onChange)).toStrictEqual({ extent: "10,20,4" });
  expect(
    screen.getByLabelText("View Group Initial Extent Input"),
  ).toBeDisabled();
});

test("changing the extent keeps the group name and initial-extent flag", () => {
  const { onChange } = renderOpen();

  setGroupName("Basin");
  flagAsInitialExtent();

  expect(lastValue(onChange)).toStrictEqual({
    extent: "10,20,4",
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });

  fireEvent.change(screen.getByLabelText("Custom Extent Input"), {
    target: { value: "1,2,3" },
  });

  expect(lastValue(onChange)).toStrictEqual({
    extent: "1,2,3",
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });
});

test("toggling the previewed-extent radio keeps the group name and flag", async () => {
  const { onChange } = renderOpen();

  setGroupName("Basin");
  flagAsInitialExtent();

  fireEvent.click(
    await screen.findByLabelText(/Use the Previewed Map Extent/i),
  );

  expect(lastValue(onChange)).toStrictEqual({
    extent: PREVIEWED_EXTENT,
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });

  fireEvent.click(await screen.findByLabelText(/Use a Custom Extent/i));

  expect(lastValue(onChange)).toStrictEqual({
    extent: PREVIEWED_EXTENT,
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });
});

test("editing the extent variable keeps the group name and flag", () => {
  const { onChange } = renderOpen();

  setGroupName("Basin");
  flagAsInitialExtent();

  fireEvent.change(screen.getByLabelText("Extent Variable Name:"), {
    target: { value: "map_extent" },
  });

  expect(lastValue(onChange)).toStrictEqual({
    extent: "10,20,4",
    variable: "map_extent",
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });
});

test("an invalid extent blocks saving but restores the group fields once corrected", () => {
  const { onChange } = renderOpen();

  setGroupName("Basin");
  flagAsInitialExtent();

  const extentInput = screen.getByLabelText("Custom Extent Input");
  fireEvent.change(extentInput, { target: { value: "10,20" } });
  expect(lastValue(onChange)).toBe(null);

  fireEvent.change(extentInput, { target: { value: "10,20,30,40" } });

  expect(lastValue(onChange)).toStrictEqual({
    extent: "10,20,30,40",
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });
});

test.each([
  ["a legacy bare string", "10,20,4", { extent: "10,20,4" }],
  ["an { extent } object", { extent: "10,20,4" }, { extent: "10,20,4" }],
  [
    "an { extent, variable } object",
    { extent: "10,20,4", variable: "map_extent" },
    { extent: "10,20,4", variable: "map_extent" },
  ],
])("loads %s and preserves it on emit", (_label, values, expected) => {
  const { onChange } = renderOpen({ values });

  expect(screen.getByLabelText("Custom Extent Input").value).toBe("10,20,4");
  expect(onChange.mock.calls[0][0]).toStrictEqual(expected);

  setGroupName("Basin");

  expect(lastValue(onChange)).toStrictEqual({
    ...expected,
    viewGroup: "Basin",
  });
});

test("a saved legacy bare string loads with its extent populated", () => {
  const { onChange } = renderOpen({ values: "-100.5,40.2,6" });

  expect(screen.getByLabelText("Custom Extent Input").value).toBe(
    "-100.5,40.2,6",
  );
  expect(onChange.mock.calls[0][0]).toStrictEqual({ extent: "-100.5,40.2,6" });
});

test("the group name field emits on blur, not on each keystroke", () => {
  const { onChange } = renderOpen();

  const field = screen.getByLabelText("View Group Input");
  const callsBefore = onChange.mock.calls.length;

  fireEvent.change(field, { target: { value: "B" } });
  fireEvent.change(field, { target: { value: "Ba" } });
  fireEvent.change(field, { target: { value: "Basin" } });

  expect(onChange.mock.calls.length).toBe(callsBefore);

  fireEvent.blur(field);

  expect(onChange.mock.calls.length).toBe(callsBefore + 1);
  expect(lastValue(onChange)).toStrictEqual({
    extent: "10,20,4",
    viewGroup: "Basin",
  });
});

test("the initial-extent checkbox is disabled while the group name is empty", () => {
  renderOpen();

  const checkbox = screen.getByLabelText("View Group Initial Extent Input");
  expect(checkbox).toBeDisabled();
  expect(
    screen.getByText(/Set a view group name to use this map's extent/i),
  ).toBeInTheDocument();

  setGroupName("Basin");

  expect(
    screen.getByLabelText("View Group Initial Extent Input"),
  ).not.toBeDisabled();
});

test("the initial-extent checkbox is disabled while the extent is templated", () => {
  renderOpen();

  setGroupName("Basin");
  expect(
    screen.getByLabelText("View Group Initial Extent Input"),
  ).not.toBeDisabled();

  fireEvent.change(screen.getByLabelText("Custom Extent Input"), {
    // eslint-disable-next-line no-template-curly-in-string
    target: { value: "${Lon}, 12, 4" },
  });

  expect(
    screen.getByLabelText("View Group Initial Extent Input"),
  ).toBeDisabled();
  expect(
    screen.getByText(/cannot supply the group's initial extent/i),
  ).toBeInTheDocument();
});

test("clearing the group name clears the initial-extent flag", () => {
  const { onChange } = renderOpen();

  setGroupName("Basin");
  flagAsInitialExtent();
  expect(lastValue(onChange)).toStrictEqual({
    extent: "10,20,4",
    viewGroup: "Basin",
    isGroupInitialExtent: true,
  });

  setGroupName("");

  expect(lastValue(onChange)).toStrictEqual({ extent: "10,20,4" });
  expect(
    screen.getByLabelText("View Group Initial Extent Input"),
  ).not.toBeChecked();
});
