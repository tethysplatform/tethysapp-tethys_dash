import PropTypes from "prop-types";
import RuleEditor from "components/inputs/RuleEditor";
import Accordion from "react-bootstrap/Accordion";
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

// Geometry-specific style option filters
export const geomStyleOptions = {
  point: ["fill", "stroke", "strokeWidth", "size", "shape", "zIndex"],
  linestring: ["stroke", "strokeWidth", "strokeDash", "zIndex"],
  polygon: [
    "fill",
    "stroke",
    "strokeWidth",
    "polygonFillType",
    "hatchDirection",
    "hatchSpacing",
    "hatchColor",
    "dotRadius",
    "dotSpacing",
    "dotColor",
    "zIndex",
  ],
};

const RuleStyleEditor = ({
  rules,
  setRules,
  layerGeomTypes = ["point", "linestring", "polygon"],
  availableFields,
  defaultStyle,
  setDefaultStyle,
  containerRef,
}) => {
  const getStyleKeysForGeom = (geomType) => {
    if (["point", "multipoint"].includes(geomType))
      return geomStyleOptions.point;
    if (["linestring", "multilinestring"].includes(geomType))
      return geomStyleOptions.linestring;
    if (["polygon", "multipolygon"].includes(geomType))
      return geomStyleOptions.polygon;
    return [];
  };

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
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    {geomType.replace("Multi", "")} Style
                  </div>
                  <RuleEditor
                    rule={defaultStyle}
                    onChange={setDefaultStyle}
                    availableShapes={availableShapes}
                    availableFields={[]}
                    defaultSection={true}
                    containerRef={containerRef}
                    styleOptionFilter={getStyleKeysForGeom(geomType)}
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
                <button
                  type="button"
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
                    marginLeft: 8,
                  }}
                  aria-label="Remove Rule"
                  title="Remove Rule"
                >
                  ×
                </button>
                <span style={{ flex: 1 }}>
                  {rule.conditionField &&
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
                availableShapes={availableShapes}
                availableFields={availableFields}
                containerRef={containerRef}
                styleOptionFilter={getStyleKeysForGeom(
                  layerGeomTypes && layerGeomTypes[0],
                )}
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
};

export default RuleStyleEditor;
