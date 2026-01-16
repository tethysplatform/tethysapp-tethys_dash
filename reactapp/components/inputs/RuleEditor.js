import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";

const RuleContainer = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
`;

const CONDITION_OPTIONS = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
];

const STYLE_OPTIONS = [
  { value: "fill", label: "Fill Color" },
  { value: "stroke", label: "Stroke Color" },
  { value: "strokeWidth", label: "Stroke Width" },
  { value: "size", label: "Size" },
  { value: "shape", label: "Shape" },
];

const RuleEditor = ({
  rule,
  onChange,
  availableShapes,
  availableFields,
  containerRef,
  hideConditionFields = false,
}) => {
  // Extract condition
  const conditionField = rule.conditionField || "";
  const conditionType = rule.conditionType || "=";
  const conditionValue = rule.conditionValue || "";

  // Style options
  const styleKeys = Object.keys(rule).filter(
    (key) =>
      !["conditionField", "conditionType", "conditionValue"].includes(key)
  );

  // Add style option
  const handleAddStyle = (selected) => {
    if (!selected || styleKeys.includes(selected.value)) return;
    const newRule = { ...rule };
    if (selected.value === "fill" || selected.value === "stroke") {
      newRule[selected.value] = "#888888";
    } else {
      newRule[selected.value] = "";
    }
    onChange(newRule);
  };

  // Remove style option
  const handleRemoveStyle = (key) => {
    const newRule = { ...rule };
    delete newRule[key];
    onChange(newRule);
  };

  // Update style value
  const handleStyleValueChange = (key, value) => {
    const newRule = { ...rule };
    newRule[key] = value;
    onChange(newRule);
  };

  return (
    <RuleContainer>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {!hideConditionFields && (
          <>
            <DataSelect
              label="Field"
              options={availableFields.map((f) => ({ value: f, label: f }))}
              selectedOption={
                conditionField
                  ? { value: conditionField, label: conditionField }
                  : null
              }
              onChange={(opt) =>
                onChange({ ...rule, conditionField: opt?.value || "" })
              }
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <DataSelect
              label="Condition"
              options={CONDITION_OPTIONS}
              selectedOption={CONDITION_OPTIONS.find(
                (o) => o.value === conditionType
              )}
              onChange={(opt) =>
                onChange({ ...rule, conditionType: opt?.value || "=" })
              }
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <NormalInput
              label="Value"
              value={conditionValue}
              type="text"
              onChange={(e) =>
                onChange({ ...rule, conditionValue: e.target.value })
              }
              labelProps={{ style: { marginBottom: 0 } }}
            />
            <DataSelect
              label="Add Style Option"
              options={STYLE_OPTIONS.filter(
                (opt) => !styleKeys.includes(opt.value)
              )}
              selectedOption={null}
              onChange={handleAddStyle}
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            {rule.shape === "icon" && (
              <NormalInput
                label="Icon URL"
                value={rule.iconUrl || ""}
                type="text"
                onChange={(e) => onChange({ ...rule, iconUrl: e.target.value })}
                style={{ minWidth: 120 }}
              />
            )}
          </>
        )}
        <div style={{ width: "100%" }}>
          {hideConditionFields ? (
            <div
              style={{
                display: "flex",
                gap: 16,
                alignItems: "center",
                marginTop: 8,
              }}
            >
              {STYLE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  {opt.value === "fill" || opt.value === "stroke" ? (
                    <ColorPickerPopover
                      label={opt.value === "fill" ? "Fill" : "Stroke"}
                      color={rule[opt.value]}
                      onChange={(color) =>
                        handleStyleValueChange(opt.value, color)
                      }
                      containerRef={containerRef}
                    />
                  ) : opt.value === "shape" ? (
                    <DataSelect
                      label="Shape"
                      options={availableShapes.map((s) => ({
                        value: s,
                        label: s,
                      }))}
                      selectedOption={
                        rule[opt.value]
                          ? {
                              value: rule[opt.value],
                              label: rule[opt.value],
                            }
                          : null
                      }
                      onChange={(o) =>
                        handleStyleValueChange(opt.value, o?.value || "circle")
                      }
                      creatable={false}
                      divProps={{ style: { marginBottom: 0 } }}
                    />
                  ) : (
                    <NormalInput
                      label={
                        opt.value === "strokeWidth" ? "Stroke Width" : "Size"
                      }
                      value={rule[opt.value] || ""}
                      type="number"
                      onChange={(e) =>
                        handleStyleValueChange(opt.value, e.target.value)
                      }
                      labelProps={{ style: { marginBottom: 0 } }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            styleKeys.map((key) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => handleRemoveStyle(key)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#d32f2f",
                    fontWeight: "bold",
                    fontSize: 20,
                    cursor: "pointer",
                    zIndex: 2,
                    marginRight: 4,
                  }}
                  aria-label={`Remove ${key} style option`}
                  title={`Remove ${key} style option`}
                >
                  ×
                </button>
                {key === "fill" || key === "stroke" ? (
                  <ColorPickerPopover
                    label={key === "fill" ? "Fill" : "Stroke"}
                    color={rule[key]}
                    onChange={(color) => handleStyleValueChange(key, color)}
                    containerRef={containerRef}
                  />
                ) : key === "shape" ? (
                  <DataSelect
                    label="Shape"
                    options={availableShapes.map((s) => ({
                      value: s,
                      label: s,
                    }))}
                    selectedOption={
                      rule[key] ? { value: rule[key], label: rule[key] } : null
                    }
                    onChange={(opt) =>
                      handleStyleValueChange(key, opt?.value || "circle")
                    }
                    creatable={false}
                    style={{ minWidth: 100 }}
                  />
                ) : (
                  <NormalInput
                    label={key === "strokeWidth" ? "Stroke Width" : "Size"}
                    value={rule[key]}
                    type="number"
                    onChange={(e) =>
                      handleStyleValueChange(key, e.target.value)
                    }
                    style={{ minWidth: 60 }}
                  />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </RuleContainer>
  );
};

RuleEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  availableShapes: PropTypes.array.isRequired,
  availableFields: PropTypes.array.isRequired,
  containerRef: PropTypes.object.isRequired,
  hideConditionFields: PropTypes.bool,
};

export default RuleEditor;
