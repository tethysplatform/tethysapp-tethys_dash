// ...existing code...
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataRadioSelect from "components/inputs/DataRadioSelect";

const RuleContainer = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
`;

const RuleEditor = ({ rule, onChange, onRemove, availableShapes }) => {
  const handleFieldChange = (field, value) => {
    onChange({ ...rule, [field]: value });
  };

  return (
    <RuleContainer>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <NormalInput
          label="Field (Condition)"
          value={Object.keys(rule.conditions || {})[0] || ""}
          type="text"
          onChange={(e) => {
            const oldKey = Object.keys(rule.conditions || {})[0];
            const newKey = e.target.value;
            const newConditions = { ...rule.conditions };
            if (oldKey && oldKey !== newKey) {
              delete newConditions[oldKey];
            }
            if (newKey) newConditions[newKey] = rule.conditions?.[oldKey] || "";
            onChange({ ...rule, conditions: newConditions });
          }}
        />
        <NormalInput
          label="Value (Condition)"
          value={Object.values(rule.conditions || {})[0] || ""}
          type="text"
          onChange={(e) => {
            const key = Object.keys(rule.conditions || {})[0];
            onChange({
              ...rule,
              conditions: key ? { [key]: e.target.value } : {},
            });
          }}
        />
        <DataRadioSelect
          label="Shape"
          selectedRadio={rule.shape || "circle"}
          radioOptions={availableShapes.map((s) => ({ value: s, label: s }))}
          onChange={(e) => handleFieldChange("shape", e.target.value)}
        />
        {rule.shape === "icon" && (
          <NormalInput
            label="Icon URL"
            value={rule.iconUrl || ""}
            type="text"
            onChange={(e) => handleFieldChange("iconUrl", e.target.value)}
          />
        )}
        <NormalInput
          label="Fill"
          value={rule.fill || ""}
          type="text"
          onChange={(e) => handleFieldChange("fill", e.target.value)}
        />
        <NormalInput
          label="Stroke"
          value={rule.stroke || ""}
          type="text"
          onChange={(e) => handleFieldChange("stroke", e.target.value)}
        />
        <NormalInput
          label="Stroke Width"
          value={rule.strokeWidth || ""}
          type="number"
          onChange={(e) => handleFieldChange("strokeWidth", e.target.value)}
        />
        <NormalInput
          label="Size"
          value={rule.size || ""}
          type="number"
          onChange={(e) => handleFieldChange("size", e.target.value)}
        />
        <button type="button" onClick={onRemove} style={{ marginLeft: 8 }}>
          Remove
        </button>
      </div>
    </RuleContainer>
  );
};

RuleEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  availableShapes: PropTypes.array.isRequired,
};

export default RuleEditor;
