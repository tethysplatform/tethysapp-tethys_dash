// ...existing code...
import PropTypes from "prop-types";
import RuleEditor from "components/inputs/RuleEditor";
import styled from "styled-components";

const RulesList = styled.div`
  margin-bottom: 16px;
`;

const AddButton = styled.button`
  margin-bottom: 12px;
`;

const RuleStyleEditor = ({ rules, setRules }) => {
  const availableShapes = [
    "circle",
    "square",
    "rectangle",
    "triangle",
    "star",
    "diamond",
    "cross",
    "x",
    "icon",
  ];

  const handleRuleChange = (idx, newRule) => {
    const updated = rules.map((r, i) => (i === idx ? newRule : r));
    setRules(updated);
  };

  const handleRemoveRule = (idx) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const handleAddRule = () => {
    setRules([
      ...rules,
      {
        conditions: {},
        shape: "circle",
        fill: "gray",
        stroke: "black",
        strokeWidth: 1,
        size: 5,
      },
    ]);
  };

  return (
    <div>
      <AddButton type="button" onClick={handleAddRule}>
        + Add Rule
      </AddButton>
      <RulesList>
        {rules.map((rule, idx) => (
          <RuleEditor
            key={idx}
            rule={rule}
            onChange={(newRule) => handleRuleChange(idx, newRule)}
            onRemove={() => handleRemoveRule(idx)}
            availableShapes={availableShapes}
          />
        ))}
      </RulesList>
    </div>
  );
};

RuleStyleEditor.propTypes = {
  rules: PropTypes.array.isRequired,
  setRules: PropTypes.func.isRequired,
};

export default RuleStyleEditor;
