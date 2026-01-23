import { useState, useRef } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RuleEditor, {
  getStyleKeysForGeom,
  defaultFill,
  defaultStroke,
  defaultStrokeWidth,
  defaultZIndex,
  defaultSize,
  availableStrokeDashOptions,
} from "components/inputs/RuleEditor";
import selectEvent from "react-select-event";

beforeEach(() => {
  delete window.ResizeObserver;
  window.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

afterEach(() => {
  window.ResizeObserver = ResizeObserver;
  jest.restoreAllMocks();
});

const TestingComponent = ({
  initialRules = {},
  onRulesChange,
  defaultSection,
}) => {
  const availableFields = ["field1", "field2"];
  const [rules, setRules] = useState(initialRules);
  const containerRef = useRef(null);

  const handleChange = (newRules) => {
    setRules(newRules);
    if (onRulesChange) onRulesChange(newRules);
  };

  return (
    <div ref={containerRef}>
      <RuleEditor
        rule={rules}
        onChange={handleChange}
        availableFields={availableFields}
        containerRef={containerRef}
        defaultSection={defaultSection}
      />
    </div>
  );
};

describe("RuleEditor", () => {
  it("renders geometry type, field, condition, and value inputs", () => {
    render(<TestingComponent />);
    expect(screen.getByLabelText(/geometrytype/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Field/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Condition/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Value/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addstyle option/i)).toBeInTheDocument();
  });

  it("calls onChange when geometry type changes", async () => {
    const mockOnChange = jest.fn();

    render(<TestingComponent onRulesChange={mockOnChange} />);
    expect(screen.getByText("Point")).toBeInTheDocument(); // default geometry type

    const geomTypeSelect = screen.getByRole("combobox", {
      name: /geometrytype/i,
    });
    await selectEvent.select(geomTypeSelect, "Polygon");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      conditionField: "",
      conditionType: "=",
      conditionValue: "",
      geometryType: "polygon",
    });
  });

  it("calls onChange when field is changed", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{ geometryType: "polygon" }}
        onRulesChange={mockOnChange}
      />,
    );

    expect(screen.getByText("Polygon")).toBeInTheDocument();

    const fieldSelect = screen.getByRole("combobox", { name: /Field/i });
    await selectEvent.select(fieldSelect, "field1");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      conditionField: "field1",
    });

    const condSelect = screen.getByRole("combobox", { name: /Condition/i });
    await selectEvent.select(condSelect, ">");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      conditionField: "field1",
      conditionType: ">",
    });

    const valueInput = screen.getByLabelText(/Value/i);
    fireEvent.change(valueInput, { target: { value: "test" } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      conditionField: "field1",
      conditionType: ">",
      conditionValue: "test",
    });
  });

  it("add style for polygon", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{ geometryType: "polygon" }}
        onRulesChange={mockOnChange}
      />,
    );

    const styleSelect = screen.getByRole("combobox", {
      name: /addstyle option/i,
    });
    await selectEvent.select(styleSelect, "Fill");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
    });

    await selectEvent.select(styleSelect, "Stroke");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
    });

    await selectEvent.select(styleSelect, "Stroke Width");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
    });

    await selectEvent.select(styleSelect, "Polygon Fill Type");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      polygonFillType: "",
    });

    await selectEvent.select(styleSelect, "Z Index");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      polygonFillType: "",
      zIndex: defaultZIndex,
    });

    const polygonFillTypeSelect = screen.getByRole("combobox", {
      name: /polygonfill type/i,
    });
    await selectEvent.select(polygonFillTypeSelect, "Hatch");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      polygonFillType: "hatch",
      zIndex: defaultZIndex,
    });

    const hatchDirectionSelect = screen.getByRole("combobox", {
      name: /hatchdirection/i,
    });
    await selectEvent.select(hatchDirectionSelect, "Diagonal");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      polygonFillType: "hatch",
      hatchDirection: "diagonal",
      zIndex: defaultZIndex,
    });

    const hatchSpacingInput = screen.getByLabelText("Hatch Spacing Input");
    fireEvent.change(hatchSpacingInput, { target: { value: 10 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      polygonFillType: "hatch",
      hatchDirection: "diagonal",
      hatchSpacing: "10",
      zIndex: defaultZIndex,
    });

    await selectEvent.select(polygonFillTypeSelect, "Dot");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      polygonFillType: "dot",
      zIndex: defaultZIndex,
    });

    expect(hatchSpacingInput).not.toBeInTheDocument();
    expect(hatchDirectionSelect).not.toBeInTheDocument();

    const dotRadiusInput = screen.getByLabelText("Dot Radius Input");
    fireEvent.change(dotRadiusInput, { target: { value: 5 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      zIndex: defaultZIndex,
      polygonFillType: "dot",
      dotRadius: "5",
    });

    const dotSpacingInput = screen.getByLabelText("Dot Spacing Input");
    fireEvent.change(dotSpacingInput, { target: { value: 10 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      zIndex: defaultZIndex,
      polygonFillType: "dot",
      dotRadius: "5",
      dotSpacing: "10",
    });

    await selectEvent.select(polygonFillTypeSelect, "Solid");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      zIndex: defaultZIndex,
      polygonFillType: "solid",
    });

    const removePolygonFillTypeButton = screen.getByLabelText(
      "Remove polygonFillType style option",
    );
    fireEvent.click(removePolygonFillTypeButton);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      fill: defaultFill,
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      zIndex: defaultZIndex,
    });
  });

  it("add style for point", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{ geometryType: "point" }}
        onRulesChange={mockOnChange}
      />,
    );

    const styleSelect = screen.getByRole("combobox", {
      name: /addstyle option/i,
    });
    await selectEvent.select(styleSelect, "Fill");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: defaultFill,
    });

    await selectEvent.select(styleSelect, "Size");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: defaultFill,
      size: defaultSize,
    });

    const sizeInput = screen.getByLabelText("size Input");
    fireEvent.change(sizeInput, { target: { value: 10 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: defaultFill,
      size: "10",
    });

    const colorPopoverSwatch = screen.getByLabelText(
      "Fill color popover square",
    );
    fireEvent.click(colorPopoverSwatch);

    const newColor = screen.getByRole("textbox", { name: "HEX" });
    fireEvent.change(newColor, { target: { value: "#2aff00" } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith({
        geometryType: "point",
        fill: "#2aff00",
        size: "10",
      });
    });

    const removeSizeButton = screen.getByLabelText("Remove size style option");
    fireEvent.click(removeSizeButton);

    await waitFor(
      () => {
        expect(mockOnChange).toHaveBeenCalledWith({
          geometryType: "point",
          fill: "#2aff00",
        });
      },
      { timeout: 10000 },
    );

    await selectEvent.select(styleSelect, "Shape");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: "#2aff00",
      shape: "",
    });

    const shapeSelect = screen.getByRole("combobox", { name: /shape/i });
    await selectEvent.select(shapeSelect, "icon");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: "#2aff00",
      shape: "icon",
    });

    const iconUrlInput = screen.getByLabelText("Icon URL Input");
    expect(iconUrlInput).toBeInTheDocument();
    fireEvent.change(iconUrlInput, {
      target: { value: "https://example.com/icon.png" },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: "#2aff00",
      shape: "icon",
      iconUrl: "https://example.com/icon.png",
    });

    const removeShapeButton = screen.getByLabelText(
      "Remove shape style option",
    );
    fireEvent.click(removeShapeButton);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: "#2aff00",
    });

    await selectEvent.select(styleSelect, "Stroke");
    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: "#2aff00",
      stroke: defaultStroke,
    });
  });

  it("add style for linestring", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{ geometryType: "linestring" }}
        onRulesChange={mockOnChange}
      />,
    );

    const styleSelect = screen.getByRole("combobox", {
      name: /addstyle option/i,
    });
    await selectEvent.select(styleSelect, "Stroke");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      stroke: defaultStroke,
    });

    await selectEvent.select(styleSelect, "Stroke Width");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
    });

    await selectEvent.select(styleSelect, "Stroke Dash");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      strokeDash: "",
    });

    const strokeDashSelect = screen.getByRole("combobox", {
      name: /strokedash/i,
    });
    await selectEvent.select(strokeDashSelect, "Dot");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
      strokeDash: "1,4",
    });
  });

  it("point with null fill, stroke, strokeWidth, size, and zindex", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{
          geometryType: "point",
          fill: null,
          stroke: null,
          strokeWidth: null,
          size: null,
          zIndex: null,
        }}
        onRulesChange={mockOnChange}
      />,
    );

    const fillColorPopoverSquare = screen.getByLabelText(
      "Fill color popover square",
    );
    expect(fillColorPopoverSquare).toBeInTheDocument();
    expect(fillColorPopoverSquare).toHaveStyle(`background: ${defaultFill}`);

    const strokeColorPopoverSquare = screen.getByLabelText(
      "Stroke color popover square",
    );
    expect(strokeColorPopoverSquare).toBeInTheDocument();
    expect(strokeColorPopoverSquare).toHaveStyle(
      `background: ${defaultStroke}`,
    );

    const strokeWidthInput = screen.getByLabelText("strokeWidth Input");
    expect(strokeWidthInput).toHaveValue(defaultStrokeWidth);

    const sizeInput = screen.getByLabelText("size Input");
    expect(sizeInput).toHaveValue(defaultSize);

    const zIndexInput = screen.getByLabelText("zIndex Input");
    expect(zIndexInput).toHaveValue(defaultZIndex);
  });

  it("linestring with stroke Dash", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{ geometryType: "linestring", strokeDash: "0" }}
        onRulesChange={mockOnChange}
      />,
    );

    expect(
      screen.getByText(availableStrokeDashOptions[0].label),
    ).toBeInTheDocument();
  });

  it("removes hatchDirection and hatchSpacing when polygonFillType is changed from Hatch to Solid", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{
          geometryType: "polygon",
          polygonFillType: "hatch",
          hatchDirection: "horizontal",
          hatchSpacing: 5,
        }}
        onRulesChange={mockOnChange}
      />,
    );

    const removePolygonFillTypeButton = screen.getByLabelText(
      "Remove polygonFillType style option",
    );
    fireEvent.click(removePolygonFillTypeButton);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
    });
  });

  it("removes dotRadius and dotSpacing when polygonFillType is changed from Dot to Solid", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{
          geometryType: "polygon",
          polygonFillType: "dot",
          dotRadius: 3,
          dotSpacing: 7,
        }}
        onRulesChange={mockOnChange}
      />,
    );

    const removePolygonFillTypeButton = screen.getByLabelText(
      "Remove polygonFillType style option",
    );
    fireEvent.click(removePolygonFillTypeButton);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
    });
  });

  it("removes iconUrl when shape is changed from icon to circle", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{
          geometryType: "point",
          shape: "icon",
          iconUrl: "https://example.com/icon.png",
        }}
        onRulesChange={mockOnChange}
      />,
    );

    const shapeSelect = screen.getByRole("combobox", { name: /shape/i });
    await selectEvent.select(shapeSelect, "circle");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      shape: "circle",
    });
  });

  it("shape is changed from icon to circle without iconUrl", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRules={{
          geometryType: "point",
          shape: "icon",
        }}
        onRulesChange={mockOnChange}
      />,
    );

    const shapeSelect = screen.getByRole("combobox", { name: /shape/i });
    await selectEvent.select(shapeSelect, "circle");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      shape: "circle",
    });
  });

  it("renders defaultSection point", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{ point: { fill: "#fff", stroke: "#000" } }}
        defaultSection="point"
        onRulesChange={mockOnChange}
      />,
    );

    expect(screen.getByText("Point")).toBeInTheDocument();
    expect(screen.getByText("Fill")).toBeInTheDocument();
    expect(screen.getByText("Stroke")).toBeInTheDocument();
    expect(screen.getByText("Stroke Width")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Shape")).toBeInTheDocument();
    expect(screen.getByText("Z Index")).toBeInTheDocument();

    const shapeSelect = screen.getByRole("combobox", { name: /shape/i });
    await selectEvent.select(shapeSelect, "icon");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      point: { fill: "#fff", stroke: "#000", shape: "icon" },
    });

    const iconUrlInput = screen.getByLabelText("Icon URL Input");
    fireEvent.change(iconUrlInput, {
      target: { value: "https://example.com/icon.png" },
    });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      point: {
        fill: "#fff",
        stroke: "#000",
        shape: "icon",
        iconUrl: "https://example.com/icon.png",
      },
    });

    const colorPopoverSwatch = screen.getByLabelText(
      "Fill color popover square",
    );
    fireEvent.click(colorPopoverSwatch);

    const newColor = screen.getByRole("textbox", { name: "HEX" });
    fireEvent.change(newColor, { target: { value: "#2aff00" } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenLastCalledWith({
        point: {
          fill: "#2aff00",
          stroke: "#000",
          shape: "icon",
          iconUrl: "https://example.com/icon.png",
        },
      });
    });

    await selectEvent.select(shapeSelect, "rectangle");
    await waitFor(
      () => {
        expect(mockOnChange).toHaveBeenLastCalledWith({
          point: { fill: "#2aff00", stroke: "#000", shape: "rectangle" },
        });
      },
      { timeout: 10000 },
    );
  });

  it("renders defaultSection linestring", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{ linestring: { stroke: "#000" } }}
        defaultSection="linestring"
        onRulesChange={mockOnChange}
      />,
    );

    expect(screen.getByText("Linestring")).toBeInTheDocument();
    expect(screen.getByText("Stroke")).toBeInTheDocument();
    expect(screen.getByText("Stroke Dash")).toBeInTheDocument();
    expect(screen.getByText("Stroke Width")).toBeInTheDocument();
    expect(screen.getByText("Z Index")).toBeInTheDocument();

    const zIndexInput = screen.getByLabelText("Z Index Input");
    fireEvent.change(zIndexInput, { target: { value: 2 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      linestring: { stroke: "#000", zIndex: "2" },
    });

    const strokeDashSelect = screen.getByRole("combobox", {
      name: /strokedash/i,
    });
    await selectEvent.select(strokeDashSelect, "Dot");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      linestring: { stroke: "#000", zIndex: "2", strokeDash: "1,4" },
    });

    const strokeWidthInput = screen.getByLabelText("Stroke Width Input");
    fireEvent.change(strokeWidthInput, { target: { value: 5 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      linestring: {
        stroke: "#000",
        zIndex: "2",
        strokeDash: "1,4",
        strokeWidth: "5",
      },
    });
  });

  it("renders defaultSection linestring with stroke Dash", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{ linestring: { strokeDash: "0" } }}
        defaultSection="linestring"
        onRulesChange={mockOnChange}
      />,
    );

    expect(
      screen.getByText(availableStrokeDashOptions[0].label),
    ).toBeInTheDocument();
  });

  it("renders defaultSection polygon", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{ polygon: { stroke: "#000" } }}
        defaultSection="polygon"
        onRulesChange={mockOnChange}
      />,
    );

    expect(screen.getByText("Polygon")).toBeInTheDocument();
    expect(screen.getByText("Fill")).toBeInTheDocument();
    expect(screen.getByText("Stroke")).toBeInTheDocument();
    expect(screen.getByText("Stroke Width")).toBeInTheDocument();
    expect(screen.getByText("Polygon Fill Type")).toBeInTheDocument();
    expect(screen.getByText("Z Index")).toBeInTheDocument();

    const zIndexInput = screen.getByLabelText("Z Index Input");
    fireEvent.change(zIndexInput, { target: { value: 2 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: { stroke: "#000", zIndex: "2" },
    });

    const polygonFillTypeSelect = screen.getByRole("combobox", {
      name: /polygonfill type/i,
    });
    await selectEvent.select(polygonFillTypeSelect, "Hatch");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: { stroke: "#000", zIndex: "2", polygonFillType: "hatch" },
    });

    const hatchDirectionSelect = screen.getByRole("combobox", {
      name: /hatchdirection/i,
    });
    await selectEvent.select(hatchDirectionSelect, "Diagonal");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: {
        stroke: "#000",
        zIndex: "2",
        polygonFillType: "hatch",
        hatchDirection: "diagonal",
      },
    });

    const hatchSpacingInput = screen.getByLabelText("Hatch Spacing Input");
    fireEvent.change(hatchSpacingInput, { target: { value: 10 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: {
        stroke: "#000",
        zIndex: "2",
        polygonFillType: "hatch",
        hatchDirection: "diagonal",
        hatchSpacing: "10",
      },
    });

    await selectEvent.select(polygonFillTypeSelect, "Dot");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: {
        stroke: "#000",
        zIndex: "2",
        polygonFillType: "dot",
      },
    });

    expect(hatchSpacingInput).not.toBeInTheDocument();
    expect(hatchDirectionSelect).not.toBeInTheDocument();

    const dotRadiusInput = screen.getByLabelText("Dot Radius Input");
    fireEvent.change(dotRadiusInput, { target: { value: 5 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: {
        stroke: "#000",
        zIndex: "2",
        polygonFillType: "dot",
        dotRadius: "5",
      },
    });

    const dotSpacingInput = screen.getByLabelText("Dot Spacing Input");
    fireEvent.change(dotSpacingInput, { target: { value: 10 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: {
        stroke: "#000",
        zIndex: "2",
        polygonFillType: "dot",
        dotRadius: "5",
        dotSpacing: "10",
      },
    });

    await selectEvent.select(polygonFillTypeSelect, "Solid");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      polygon: {
        stroke: "#000",
        zIndex: "2",
        polygonFillType: "solid",
      },
    });
  });

  it("default point section iconUrl not present when shape is changed", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRules={{
          point: { shape: "icon" },
        }}
        defaultSection="point"
        onRulesChange={mockOnChange}
      />,
    );

    const shapeSelect = screen.getByRole("combobox", { name: /shape/i });
    await selectEvent.select(shapeSelect, "circle");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      point: { shape: "circle" },
    });
  });
});

describe("getStyleKeysForGeom", () => {
  it("returns point style options for point geometries", () => {
    const result = getStyleKeysForGeom("point");
    expect(result).toStrictEqual([
      "fill",
      "stroke",
      "strokeWidth",
      "size",
      "shape",
      "zIndex",
    ]);
  });

  it("returns linestring style options for linestring geometries", () => {
    const result = getStyleKeysForGeom("linestring");
    expect(result).toStrictEqual([
      "stroke",
      "strokeWidth",
      "strokeDash",
      "zIndex",
    ]);
  });

  it("returns polygon style options for polygon geometries", () => {
    const result = getStyleKeysForGeom("polygon");
    expect(result).toStrictEqual([
      "fill",
      "stroke",
      "strokeWidth",
      "polygonFillType",
      "zIndex",
    ]);
  });

  it("returns an empty array for unknown geometries", () => {
    const result = getStyleKeysForGeom("unknown");
    expect(result).toStrictEqual([]);
  });
});
