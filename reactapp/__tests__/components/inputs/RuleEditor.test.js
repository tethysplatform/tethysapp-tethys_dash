import PropTypes from "prop-types";
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
  WithFieldToggle,
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
  initialRule = {},
  onRuleChange,
  defaultSection,
}) => {
  const availableFields = ["field1", "field2"];
  const [rule, setRule] = useState(initialRule);
  const containerRef = useRef(null);

  const handleChange = (newRule) => {
    setRule(newRule);

    if (onRuleChange) onRuleChange(newRule);
  };

  return (
    <div ref={containerRef}>
      <RuleEditor
        rule={JSON.parse(JSON.stringify(rule))}
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
    expect(screen.getByLabelText(/^Field$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Condition$/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Value Input")).toBeInTheDocument();
    expect(screen.getByLabelText(/valuesource/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/addstyle option/i)).toBeInTheDocument();
  });

  it("renders WHEN and THEN section headers", () => {
    render(<TestingComponent />);
    expect(screen.getByText("When")).toBeInTheDocument();
    expect(screen.getByText(/Then apply style/i)).toBeInTheDocument();
  });

  it("calls onChange when geometry type changes", async () => {
    const mockOnChange = jest.fn();

    render(<TestingComponent onRuleChange={mockOnChange} />);
    expect(screen.getByText("Point")).toBeInTheDocument(); // default geometry type

    const geomTypeSelect = screen.getByRole("combobox", {
      name: /geometrytype/i,
    });
    await selectEvent.select(geomTypeSelect, "Polygon");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      conditionField: "",
      conditionType: "=",
      conditionValue: "",
      conditionValueIsField: false,
      conditions: [],
      geometryType: "polygon",
    });
  });

  it("calls onChange when field is changed", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{ geometryType: "polygon" }}
        onRuleChange={mockOnChange}
      />,
    );

    expect(screen.getByText("Polygon")).toBeInTheDocument();

    const fieldSelect = screen.getByRole("combobox", { name: /^Field$/i });
    await selectEvent.select(fieldSelect, "field1");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      conditionField: "field1",
      conditionType: "=",
      conditionValue: "",
      conditionValueIsField: false,
    });

    const condSelect = screen.getByRole("combobox", { name: /^Condition$/i });
    await selectEvent.select(condSelect, ">");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      conditionField: "field1",
      conditionType: ">",
      conditionValue: "",
      conditionValueIsField: false,
    });

    const valueInput = screen.getByLabelText("Value Input");
    fireEvent.change(valueInput, { target: { value: "test" } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      conditionField: "field1",
      conditionType: ">",
      conditionValue: "test",
      conditionValueIsField: false,
    });
  });

  it("update rule name", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{ geometryType: "polygon" }}
        onRuleChange={mockOnChange}
      />,
    );

    const ruleNameInput = screen.getByLabelText("Rule Name Input");
    fireEvent.change(ruleNameInput, { target: { value: "My Rule" } });
    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "polygon",
      name: "My Rule",
    });
  });

  it("add style for polygon", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{ geometryType: "polygon" }}
        onRuleChange={mockOnChange}
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

    const { rerender } = render(
      <TestingComponent
        initialRule={{ geometryType: "point" }}
        onRuleChange={mockOnChange}
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

    const sizeInput = screen.getByLabelText("Size Input");
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

    rerender(
      <TestingComponent
        initialRule={{ geometryType: "point" }}
        onRuleChange={mockOnChange}
      />,
    );

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

    const removeFillStyleButton = screen.getByLabelText(
      "Remove fill style option",
    );
    fireEvent.click(removeFillStyleButton);
    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      stroke: defaultStroke,
    });
  });

  it("add style for linestring", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{ geometryType: "linestring" }}
        onRuleChange={mockOnChange}
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

    const removeStrokeDashButton = screen.getByLabelText(
      "Remove strokeDash style option",
    );
    fireEvent.click(removeStrokeDashButton);
    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      stroke: defaultStroke,
      strokeWidth: defaultStrokeWidth,
    });
  });

  it("point with null fill, stroke, strokeWidth, size, and zindex", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          fill: null,
          stroke: null,
          strokeWidth: null,
          size: null,
          zIndex: null,
        }}
        onRuleChange={mockOnChange}
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

    const strokeWidthInput = screen.getByLabelText("Stroke Width Input");
    expect(strokeWidthInput).toHaveValue(`${defaultStrokeWidth}`);

    const sizeInput = screen.getByLabelText("Size Input");
    expect(sizeInput).toHaveValue(`${defaultSize}`);

    const zIndexInput = screen.getByLabelText("Z Index Input");
    expect(zIndexInput).toHaveValue(`${defaultZIndex}`);
  });

  it("linestring with stroke Dash", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{ geometryType: "linestring", strokeDash: "0" }}
        onRuleChange={mockOnChange}
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
        initialRule={{
          geometryType: "polygon",
          polygonFillType: "hatch",
          hatchDirection: "horizontal",
          hatchSpacing: 5,
        }}
        onRuleChange={mockOnChange}
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
        initialRule={{
          geometryType: "polygon",
          polygonFillType: "dot",
          dotRadius: 3,
          dotSpacing: 7,
        }}
        onRuleChange={mockOnChange}
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
        initialRule={{
          geometryType: "point",
          shape: "icon",
          iconUrl: "https://example.com/icon.png",
        }}
        onRuleChange={mockOnChange}
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
        initialRule={{
          geometryType: "point",
          shape: "icon",
        }}
        onRuleChange={mockOnChange}
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
    const { rerender } = render(
      <TestingComponent
        initialRule={{ point: { fill: "#fff", stroke: "#000" } }}
        defaultSection="point"
        onRuleChange={mockOnChange}
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

    rerender(
      <TestingComponent
        initialRule={{
          point: {
            fill: "#2aff00",
            stroke: "#000",
            shape: "icon",
            iconUrl: "https://example.com/icon.png",
          },
        }}
        defaultSection="point"
        onRuleChange={mockOnChange}
      />,
    );

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
        initialRule={{ linestring: { stroke: "#000" } }}
        defaultSection="linestring"
        onRuleChange={mockOnChange}
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
        initialRule={{ linestring: { strokeDash: "0" } }}
        defaultSection="linestring"
        onRuleChange={mockOnChange}
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
        initialRule={{ polygon: { stroke: "#000" } }}
        defaultSection="polygon"
        onRuleChange={mockOnChange}
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

  it("switches rotation to a feature-field reference via propertyRefs", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          shape: "rectangle",
          rotation: 0,
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const sourceSelects = screen.getAllByRole("combobox", {
      name: /valuesource/i,
    });
    await selectEvent.select(sourceSelects[sourceSelects.length - 1], "Field");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        propertyRefs: { rotation: "" },
      }),
    );

    const rotationFieldSelect = screen.getByRole("combobox", {
      name: /rotationfield/i,
    });
    await selectEvent.select(rotationFieldSelect, "field1");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        propertyRefs: { rotation: "field1" },
      }),
    );
  });

  it("switches fill to a feature-field reference via propertyRefs", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          fill: defaultFill,
          rotation: 0,
          propertyRefs: { rotation: "bearing" },
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const sources = screen.getAllByRole("combobox", {
      name: /valuesource/i,
    });
    await selectEvent.select(sources[sources.length - 2], "Field");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      fill: "rgba(255, 255, 255, 0.4)",
      geometryType: "point",
      propertyRefs: { rotation: "bearing", fill: "" },
      rotation: 0,
    });

    const fieldDropdown = screen.getByRole("combobox", {
      name: /fillfield/i,
    });
    await selectEvent.select(fieldDropdown, "field1");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      fill: "rgba(255, 255, 255, 0.4)",
      geometryType: "point",
      propertyRefs: { rotation: "bearing", fill: "field1" },
      rotation: 0,
    });
  });

  it("switches size to a feature-field reference via propertyRefs", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{ geometryType: "point", size: defaultSize }}
        onRuleChange={mockOnChange}
      />,
    );

    const sources = screen.getAllByRole("combobox", {
      name: /valuesource/i,
    });
    await selectEvent.select(sources[sources.length - 1], "Field");

    const fieldDropdown = screen.getByRole("combobox", {
      name: /sizefield/i,
    });
    await selectEvent.select(fieldDropdown, "field2");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      propertyRefs: {
        size: "field2",
      },
      size: 5,
    });

    await selectEvent.select(sources[sources.length - 1], "Literal");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      size: 5,
    });
  });

  it("clears propertyRefs.rotation when the styles are removed", () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          shape: "rectangle",
          rotation: 0,
          fill: "red",
          propertyRefs: { rotation: "bearing", fill: "color" },
        }}
        onRuleChange={mockOnChange}
      />,
    );

    fireEvent.click(screen.getByLabelText("Remove rotation style option"));

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      fill: "red",
      propertyRefs: { fill: "color" },
      shape: "rectangle",
    });

    fireEvent.click(screen.getByLabelText("Remove fill style option"));

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      shape: "rectangle",
    });
  });

  it("adds rotation as a point style option and accepts a degree value", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{ geometryType: "point" }}
        onRuleChange={mockOnChange}
      />,
    );

    const styleSelect = screen.getByRole("combobox", {
      name: /addstyle option/i,
    });
    await selectEvent.select(styleSelect, "Rotation");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ rotation: 0 }),
    );

    const rotationInput = screen.getByLabelText("Rotation Input");
    fireEvent.change(rotationInput, { target: { value: 90 } });

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ rotation: "90" }),
    );
  });

  it("adds an extra condition when the + condition button is clicked", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "streamflow_gage",
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const addBtn = screen.getByRole("button", {
      name: /add condition/i,
    });
    fireEvent.click(addBtn);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      conditionField: "type",
      conditionType: "=",
      conditionValue: "streamflow_gage",
      conditions: [{ field: "", type: "=", value: "" }],
    });

    const conditions = screen.getAllByRole("combobox", {
      name: /condition/i,
    });
    await selectEvent.select(
      conditions[conditions.length - 1],
      "is null/empty",
    );

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      conditionField: "type",
      conditionType: "=",
      conditionValue: "streamflow_gage",
      conditions: [
        { field: "", type: "isNull", value: "", valueIsField: false },
      ],
    });
  });

  it("shows the AND/OR toggle only when a rule has extra conditions", async () => {
    const { unmount } = render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
        }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /toggle match logic/i }),
    ).not.toBeInTheDocument();
    unmount();

    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [{ field: "active", type: "=", value: "true" }],
        }}
      />,
    );

    const toggle = screen.getByRole("button", { name: /toggle match logic/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveTextContent("AND");
  });

  it("toggles conditionCombinator when the AND/OR label is clicked", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [{ field: "active", type: "=", value: "true" }],
        }}
        onRuleChange={mockOnChange}
      />,
    );

    // Default is AND; clicking flips to OR.
    fireEvent.click(
      screen.getByRole("button", { name: /toggle match logic/i }),
    );
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ conditionCombinator: "OR" }),
    );

    // Now showing OR; clicking flips back to AND.
    const toggle = screen.getByRole("button", { name: /toggle match logic/i });
    expect(toggle).toHaveTextContent("OR");
    fireEvent.click(toggle);
    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ conditionCombinator: "AND" }),
    );
  });

  it("uses a list value input and clears valueIsField for the 'is in' operator", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "buildCat",
          conditionType: "=",
          conditionValue: "",
          conditionValueIsField: true,
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const condSelect = screen.getByRole("combobox", { name: /^Condition$/i });
    await selectEvent.select(condSelect, "is in");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conditionType: "in",
        conditionValueIsField: false,
      }),
    );

    // Value Source selector is hidden; a plain list input is shown instead.
    expect(screen.queryByLabelText(/valuesource/i)).not.toBeInTheDocument();
    const listInput = screen.getByLabelText("Values Input");
    fireEvent.change(listInput, { target: { value: "0, 36, 42" } });

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conditionType: "in",
        conditionValue: "0, 36, 42",
        conditionValueIsField: false,
      }),
    );
  });

  it("hides the Value input when condition is isNull or isNotNull", async () => {
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "bankfull",
          conditionType: "isNotNull",
          conditionValue: "",
        }}
      />,
    );

    expect(screen.queryByLabelText("Value Input")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/valuesource/i)).not.toBeInTheDocument();
  });

  it("switches the value input to a field dropdown when Value Source = Field", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "value",
          conditionType: ">",
          conditionValue: "",
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const sourceSelect = screen.getByRole("combobox", {
      name: /valuesource/i,
    });
    await selectEvent.select(sourceSelect, "Field");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conditionValueIsField: true,
        conditionValue: "",
      }),
    );

    const valueFieldSelect = screen.getByRole("combobox", {
      name: /valuefield/i,
    });
    await selectEvent.select(valueFieldSelect, "field1");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conditionValueIsField: true,
        conditionValue: "field1",
      }),
    );
  });

  it("removes an extra condition when its remove button is clicked", async () => {
    const mockOnChange = jest.fn();

    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [
            { field: "bankfull", type: "isNotNull", value: "" },
            { field: "", type: "=", value: "" },
          ],
        }}
        onRuleChange={mockOnChange}
      />,
    );

    let removeBtn = screen.getAllByLabelText("Remove condition");
    fireEvent.click(removeBtn[0]);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      conditionField: "type",
      conditionType: "=",
      conditionValue: "gage",
      conditions: [{ field: "", type: "=", value: "" }],
    });

    removeBtn = screen.getByLabelText("Remove condition");
    fireEvent.click(removeBtn);

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "point",
      conditionField: "type",
      conditionType: "=",
      conditionValue: "gage",
    });
  });

  it("does not render the conditions array as a style option", () => {
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [{ field: "bankfull", type: "isNotNull", value: "" }],
          fill: "#7f00ff",
        }}
      />,
    );

    expect(
      screen.queryByLabelText(/Remove conditions style option/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/)).not.toBeInTheDocument();
  });

  it("default point section iconUrl not present when shape is changed", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          point: { shape: "icon" },
        }}
        defaultSection="point"
        onRuleChange={mockOnChange}
      />,
    );

    const shapeSelect = screen.getByRole("combobox", { name: /shape/i });
    await selectEvent.select(shapeSelect, "circle");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      point: { shape: "circle" },
    });
  });

  it("handleAddStyle else branch: strokeDash sets empty string (line 319)", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{ geometryType: "linestring" }}
        onRuleChange={mockOnChange}
      />,
    );

    const styleSelect = screen.getByRole("combobox", {
      name: /addstyle option/i,
    });
    await selectEvent.select(styleSelect, "Stroke Dash");

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      strokeDash: "",
    });
  });

  it("updateStyleValue null-section branch: non-defaultSection style change (line 236)", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{ geometryType: "linestring", strokeWidth: 2 }}
        onRuleChange={mockOnChange}
      />,
    );

    const strokeWidthInput = screen.getByLabelText("Stroke Width Input");
    fireEvent.change(strokeWidthInput, { target: { value: 4 } });

    expect(mockOnChange).toHaveBeenLastCalledWith({
      geometryType: "linestring",
      strokeWidth: "4",
    });
  });

  it("geometry type change clears existing conditions array (line 292)", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [{ field: "bankfull", type: "isNotNull", value: "" }],
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const geomTypeSelect = screen.getByRole("combobox", {
      name: /geometrytype/i,
    });
    await selectEvent.select(geomTypeSelect, "Polygon");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ conditions: [] }),
    );
  });

  it("updateFirstCondition clears value and valueIsField when isNull selected (lines 915-916)", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "bankfull",
          conditionType: ">",
          conditionValue: "100",
          conditionValueIsField: true,
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const condSelect = screen.getByRole("combobox", { name: /^Condition$/i });
    await selectEvent.select(condSelect, "is null/empty");

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conditionType: "isNull",
        conditionValue: "",
        conditionValueIsField: false,
      }),
    );
  });

  it("updateExtraCondition preserves value and valueIsField for non-valueless type (lines 926-927)", async () => {
    const mockOnChange = jest.fn();
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [
            { field: "value", type: "isNull", value: "", valueIsField: false },
          ],
        }}
        onRuleChange={mockOnChange}
      />,
    );

    const conditionSelects = screen.getAllByRole("combobox", {
      name: /^Condition$/i,
    });
    await selectEvent.select(
      conditionSelects[conditionSelects.length - 1],
      ">",
    );

    expect(mockOnChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        conditions: [
          expect.objectContaining({
            type: ">",
            value: "",
            valueIsField: false,
          }),
        ],
      }),
    );
  });

  it("extra condition without type renders with = fallback (line 988)", () => {
    render(
      <TestingComponent
        initialRule={{
          geometryType: "point",
          conditionField: "type",
          conditionType: "=",
          conditionValue: "gage",
          conditions: [{ field: "bankfull", value: "" }],
        }}
      />,
    );

    const conditionSelects = screen.getAllByRole("combobox", {
      name: /^Condition$/i,
    });
    expect(conditionSelects.length).toBe(2);
  });
});

describe("WithFieldToggle", () => {
  it("setSource skips keyName reset when defaultLiteralValue is undefined (line 439)", async () => {
    const mockOnChange = jest.fn();
    const WFTWrapper = () => {
      const [rule, setRule] = useState({ rotation: 45 });
      return (
        <WithFieldToggle
          keyName="rotation"
          label="Rotation"
          rule={rule}
          onChange={(r) => {
            setRule(r);
            mockOnChange(r);
          }}
          availableFields={["field1", "field2"]}
        >
          <input aria-label="Rotation Input" />
        </WithFieldToggle>
      );
    };
    render(<WFTWrapper />);

    const sourceSelect = screen.getByRole("combobox", { name: /valuesource/i });
    await selectEvent.select(sourceSelect, "Field");

    // defaultLiteralValue is undefined → line 439 is false → rotation stays 45, not reset
    expect(mockOnChange).toHaveBeenLastCalledWith({
      rotation: 45,
      propertyRefs: { rotation: "" },
    });
  });

  it("setFieldRef falls back to {} when rule.propertyRefs is null (line 448)", async () => {
    const mockOnChange = jest.fn();
    let readCount = 0;
    // Proxy: first read (render) returns an object so isField=true;
    // second read (inside setFieldRef closure) returns null to hit the {} fallback.
    const ruleProxy = new Proxy(
      { rotation: 45 },
      {
        get(target, prop) {
          if (prop === "propertyRefs") {
            readCount++;
            return readCount === 1 ? { rotation: "" } : null;
          }
          return Reflect.get(target, prop);
        },
      },
    );

    render(
      <WithFieldToggle
        keyName="rotation"
        label="Rotation"
        rule={ruleProxy}
        onChange={mockOnChange}
        availableFields={["field1", "field2"]}
      >
        <input aria-label="Rotation Input" />
      </WithFieldToggle>,
    );

    const fieldDropdown = screen.getByRole("combobox", {
      name: /rotationfield/i,
    });
    await selectEvent.select(fieldDropdown, "field1");

    // rule.propertyRefs was null in setFieldRef → {} fallback spread, then key added
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyRefs: { rotation: "field1" },
      }),
    );
  });

  it("field dropdown renders with empty options when availableFields is null (line 467)", () => {
    render(
      <WithFieldToggle
        keyName="rotation"
        label="Rotation"
        rule={{ rotation: 45, propertyRefs: { rotation: "" } }}
        onChange={jest.fn()}
        availableFields={null}
      >
        <input aria-label="Rotation Input" />
      </WithFieldToggle>,
    );

    // isField=true (propertyRefs.rotation is a string) so the field dropdown renders.
    // availableFields || [] triggers the [] fallback — options are empty but no crash.
    expect(
      screen.getByRole("combobox", { name: /rotationfield/i }),
    ).toBeInTheDocument();
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
      "rotation",
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

TestingComponent.propTypes = {
  initialRule: PropTypes.object,
  onRuleChange: PropTypes.func,
  defaultSection: PropTypes.string,
};
