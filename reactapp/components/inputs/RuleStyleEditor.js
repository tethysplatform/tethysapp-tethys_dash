import { memo } from "react";
import PropTypes from "prop-types";
import RuleEditor from "components/inputs/RuleEditor";
import Accordion from "react-bootstrap/Accordion";

const RuleStyleEditor = ({
  rules,
  setRules,
  availableFields,
  defaultStyle,
  setDefaultStyle,
  containerRef,
}) => {
  const layerGeomTypes = ["point", "linestring", "polygon"];
  const handleRuleChange = (idx, newRule) => {
    const updated = rules.map((r, i) => (i === idx ? newRule : r));
    setRules(updated);
  };

  const handleRemoveRule = (idx) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  return (
    <div>
      <Accordion alwaysOpen>
        <Accordion.Item eventKey="default-style">
          <Accordion.Header>
            <span style={{ flex: 1, fontWeight: 500 }}>Default Style</span>
          </Accordion.Header>
          <Accordion.Body>
            {layerGeomTypes &&
              layerGeomTypes.length > 0 &&
              layerGeomTypes.map((geomType) => (
                <div key={geomType} style={{ marginBottom: 24 }}>
                  <RuleEditor
                    rule={defaultStyle}
                    onChange={setDefaultStyle}
                    availableFields={[]}
                    defaultSection={geomType}
                    containerRef={containerRef}
                  />
                </div>
              ))}
          </Accordion.Body>
        </Accordion.Item>
        {rules.map((rule, idx) => (
          <Accordion.Item eventKey={idx.toString()} key={idx}>
            <Accordion.Header>
              <span
                style={{ display: "flex", alignItems: "center", width: "100%" }}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveRule(idx);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#d32f2f",
                    fontWeight: "bold",
                    fontSize: 20,
                    cursor: "pointer",
                    marginRight: 20,
                    display: "inline-block",
                    lineHeight: 1,
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Remove Rule"
                  title="Remove Rule"
                >
                  ×
                </div>
                <span style={{ flex: 1 }}>
                  {rule.name
                    ? rule.name
                    : rule.conditionField &&
                        rule.conditionType &&
                        rule.conditionValue
                      ? `${rule.conditionField} ${rule.conditionType} ${rule.conditionValue}`
                      : `Rule ${idx + 1}`}
                </span>
              </span>
            </Accordion.Header>
            <Accordion.Body>
              <RuleEditor
                rule={rule}
                onChange={(newRule) => handleRuleChange(idx, newRule)}
                availableFields={availableFields}
                containerRef={containerRef}
              />
            </Accordion.Body>
          </Accordion.Item>
        ))}
      </Accordion>
    </div>
  );
};

RuleStyleEditor.propTypes = {
  rules: PropTypes.array.isRequired,
  setRules: PropTypes.func.isRequired,
  availableFields: PropTypes.array,
  defaultStyle: PropTypes.object,
  setDefaultStyle: PropTypes.func,
  containerRef: PropTypes.object,
};

export default memo(RuleStyleEditor);
