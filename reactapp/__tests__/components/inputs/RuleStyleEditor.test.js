import { render, screen, fireEvent } from "@testing-library/react";
import RuleStyleEditor from "components/inputs/RuleStyleEditor";

describe("RuleStyleEditor", () => {
  const mockSetRules = jest.fn();
  const mockSetDefaultStyle = jest.fn();
  const mockContainerRef = { current: null };
  const defaultStyle = { color: "#000" };
  const availableFields = ["field1", "field2"];
  const rules = [
    {
      conditionField: "field1",
      conditionType: "==",
      conditionValue: "A",
      style: { color: "#f00" },
    },
    {
      conditionField: "field2",
      conditionType: ">",
      conditionValue: 10,
      style: { color: "#0f0" },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders default style sections for each geometry type", async () => {
    render(
      <RuleStyleEditor
        rules={rules}
        setRules={mockSetRules}
        availableFields={availableFields}
        defaultStyle={defaultStyle}
        setDefaultStyle={mockSetDefaultStyle}
        containerRef={mockContainerRef}
      />,
    );
    expect(screen.getByText("Default Style")).toBeInTheDocument();
    expect(
      screen.getByLabelText("point default styling section"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("linestring default styling section"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("polygon default styling section"),
    ).toBeInTheDocument();

    expect(screen.getByText("field1 == A")).toBeInTheDocument();
    expect(screen.getByText("field2 > 10")).toBeInTheDocument();

    // Find all remove buttons (×)
    const removeButtons = screen.getAllByRole("button", {
      name: "Remove Rule",
    });
    expect(removeButtons.length).toBe(rules.length);
    fireEvent.click(removeButtons[0]);
    expect(mockSetRules).toHaveBeenCalledWith([rules[1]]);
  });

  test("updates rule on change", () => {
    render(
      <RuleStyleEditor
        rules={rules}
        setRules={mockSetRules}
        availableFields={availableFields}
        defaultStyle={defaultStyle}
        setDefaultStyle={mockSetDefaultStyle}
        containerRef={mockContainerRef}
      />,
    );

    const conditionValueInputs = screen.getAllByLabelText("Value Input");
    const rule1ConditionValue = conditionValueInputs[0];
    fireEvent.change(rule1ConditionValue, { target: { value: "B" } });
    expect(mockSetRules).toHaveBeenCalledWith([
      {
        conditionField: "field1",
        conditionType: "==",
        conditionValue: "B",
        conditionValueIsField: false,
        style: { color: "#f00" },
      },
      rules[1],
    ]);
  });

  it("renders rule names", () => {
    const fallbackRules = [
      { name: "A custom rule name" },
      { conditionField: "", conditionType: "=" },
      {
        conditionField: "some field",
        conditionType: "=",
        conditionValue: "some value",
      },
    ];
    render(
      <RuleStyleEditor
        rules={fallbackRules}
        setRules={mockSetRules}
        availableFields={availableFields}
        defaultStyle={defaultStyle}
        setDefaultStyle={mockSetDefaultStyle}
        containerRef={mockContainerRef}
      />,
    );
    expect(screen.getByText("A custom rule name")).toBeInTheDocument();
    expect(screen.getByText("Rule 2")).toBeInTheDocument();
    expect(screen.getByText("some field = some value")).toBeInTheDocument();
  });
});
