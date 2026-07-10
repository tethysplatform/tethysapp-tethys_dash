import { useEffect, useState, useRef, memo } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";
import { spaceAndCapitalize, valuesEqual } from "components/modals/utilities";

const RuleContainer = styled.div`
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
`;

const FlexContainer = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  overflow-wrap: anywhere;
`;

const XButton = styled.button`
  background: none;
  border: none;
  color: #d32f2f;
  font-weight: bold;
  font-size: 20px;
  cursor: pointer;
  margin-right: 4px;
`;

const AndLabel = styled.button`
  font-weight: 600;
  font-size: 12px;
  color: #555;
  padding: 2px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #eef;
  cursor: pointer;
  &:hover {
    background: #dde;
    border-color: #99a;
  }
`;

const AddConditionButton = styled.button`
  background: none;
  border: 1px dashed #888;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  &:hover {
    background: #f0f0f0;
  }
`;

const HeaderRow = styled.div`
  display: flex;
  gap: 16px;
  align-items: flex-end;
  flex-wrap: wrap;
  margin-bottom: 8px;
`;

const Section = styled.section`
  margin-top: 12px;
`;

const SectionHeader = styled.div`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #666;
  margin-bottom: 6px;
`;

const SectionDivider = styled.hr`
  border: none;
  border-top: 1px solid #e5e5e5;
  margin: 16px 0 0 0;
`;

const ConditionRowWrapper = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 4px;
`;

const StyleRowWrapper = styled.div`
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 6px;
  width: 100%;
`;

const Spacer = styled.div`
  margin-left: auto;
`;

const FullWidthContainer = styled.div`
  width: 100%;
`;

const StyleContainer = styled.div`
  display: flex;
  gap: ${(props) => (props.$gap ? props.$gap : 16)}px;
  align-items: ${(props) => (props.$align ? props.$align : "center")};
  margin-top: 8px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow-wrap: anywhere;
`;

// Styled number input wrapper for consistent width
const NumberInputWrapper = styled.div`
  min-width: 150px;
  width: 150px;
`;

const availableShapes = [
  "circle",
  "square",
  "rectangle",
  "triangle",
  "trapezoid",
  "star",
  "diamond",
  "cross",
  "x",
  "icon",
];

export const availableStrokeDashOptions = [
  { value: "", label: "Solid" },
  { value: "4,4", label: "Dash" },
  { value: "1,4", label: "Dot" },
  { value: "8,4,2,4", label: "Dash Dot" },
  { value: "8,4,2,4,2,4", label: "Dash Dot Dot" },
];

// Geometry-specific style option filters
export const geomStyleOptions = {
  point: [
    "fill",
    "stroke",
    "strokeWidth",
    "size",
    "shape",
    "rotation",
    "zIndex",
  ],
  linestring: ["stroke", "strokeWidth", "strokeDash", "zIndex"],
  polygon: ["fill", "stroke", "strokeWidth", "polygonFillType", "zIndex"],
};

const CONDITION_OPTIONS = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
  { value: "in", label: "is in" },
  { value: "notIn", label: "is not in" },
  { value: "isNull", label: "is null/empty" },
  { value: "isNotNull", label: "is not null/empty" },
];

const VALUELESS_CONDITIONS = ["isNull", "isNotNull"];

// List operators take a comma-separated list of literals; a field reference
// as the comparison value makes no sense for them, so the value source
// selector is hidden and the value is always a plain literal string.
const LIST_CONDITIONS = ["in", "notIn"];

const VALUE_SOURCE_OPTIONS = [
  { value: "literal", label: "Literal" },
  { value: "field", label: "Field" },
];

const RULE_METADATA_KEYS = [
  "conditionField",
  "conditionType",
  "conditionValue",
  "conditionValueIsField",
  "conditionCombinator",
  "conditions",
  "geometryType",
  "iconUrl",
  "hatchDirection",
  "hatchSpacing",
  "dotRadius",
  "dotSpacing",
  "propertyRefs",
  "name",
];

// Geometry type options for dropdown
const GEOMETRY_TYPE_OPTIONS = [
  { value: "point", label: "Point" },
  { value: "linestring", label: "LineString" },
  { value: "polygon", label: "Polygon" },
];
const POLYGON_FILL_TYPES = [
  { value: "solid", label: "Solid" },
  { value: "hatch", label: "Hatch" },
  { value: "dot", label: "Dot" },
];
export const getStyleKeysForGeom = (geomType) => {
  if (["point", "multipoint"].includes(geomType)) return geomStyleOptions.point;
  if (["linestring", "multilinestring"].includes(geomType))
    return geomStyleOptions.linestring;
  if (["polygon", "multipolygon"].includes(geomType))
    return geomStyleOptions.polygon;
  return [];
};

export const defaultFill = "rgba(255, 255, 255, 0.4)";
export const defaultStroke = "#3399CC";
export const defaultStrokeWidth = 1.25;
export const defaultSize = 5;
export const defaultZIndex = 0;
export const defaultShape = "circle";
export const defaultRotation = 0;
export const defaultHatchSpacing = 8;
export const defaultHatchDirection = "diagonal";
export const defaultDotSpacing = 8;
export const defaultDotRadius = 2;

// Centralized style value change/cleanup logic
function updateStyleValue({ rule, key, value, sectionName, defaultSection }) {
  const newRule = { ...rule };
  const section = sectionName ? { ...newRule[sectionName] } : null;

  // Clean up hatch and dot rules when polygonFillType changes
  if (key === "polygonFillType") {
    const target = sectionName ? section : newRule;
    ["hatchDirection", "hatchSpacing", "dotRadius", "dotSpacing"].forEach(
      (k) => {
        if (k in target) delete target[k];
      },
    );
    if (sectionName) newRule[sectionName] = target;
  }
  if (key === "shape" && value !== "icon") {
    const target = sectionName ? section : newRule;
    if ("iconUrl" in target) delete target.iconUrl;
    if (sectionName) newRule[sectionName] = target;
  }
  if (sectionName) {
    newRule[sectionName] = { ...section, [key]: value };
  } else {
    newRule[key] = value;
  }
  return newRule;
}

const RuleEditor = ({
  rule,
  onChange,
  availableFields,
  containerRef,
  defaultSection = false,
}) => {
  const [selectedGeomType, setSelectedGeomType] = useState(
    rule.geometryType
      ? {
          value: rule.geometryType,
          label: spaceAndCapitalize(rule.geometryType),
        }
      : { value: "point", label: "Point" },
  );
  const [styleOptions, setStyleOptions] = useState(() => {
    return getStyleKeysForGeom(rule.geometryType || "point").map((key) => ({
      value: key,
      label: spaceAndCapitalize(key),
    }));
  });
  const currentGeomType = useRef(rule.geometryType || "point");

  useEffect(() => {
    if (currentGeomType.current !== selectedGeomType.value) {
      onChange({
        geometryType: selectedGeomType.value,
        conditionField: "",
        conditionType: "=",
        conditionValue: "",
        conditionValueIsField: false,
        conditions: [],
      });
      currentGeomType.current = selectedGeomType.value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule.geometryType]);

  const handleGeomTypeChange = (opt) => {
    setSelectedGeomType(opt);
    const newStyleOptions = getStyleKeysForGeom(opt.value);
    const formatedStyleOptions = newStyleOptions.map((key) => ({
      value: key,
      label: spaceAndCapitalize(key),
    }));
    setStyleOptions(formatedStyleOptions);
    onChange({ ...rule, geometryType: opt.value });
  };

  const handleAddStyle = (selected) => {
    const newRule = { ...rule };
    if (selected.value === "fill") newRule.fill = defaultFill;
    else if (selected.value === "stroke") newRule.stroke = defaultStroke;
    else if (selected.value === "strokeWidth")
      newRule.strokeWidth = defaultStrokeWidth;
    else if (selected.value === "size") newRule.size = defaultSize;
    else if (selected.value === "rotation") newRule.rotation = defaultRotation;
    else if (selected.value === "zIndex") newRule.zIndex = defaultZIndex;
    else newRule[selected.value] = "";
    onChange(newRule);
  };

  const handleRemoveStyle = (key) => {
    const newRule = { ...rule };
    delete newRule[key];
    if (key === "polygonFillType") {
      ["hatchDirection", "hatchSpacing", "dotRadius", "dotSpacing"].forEach(
        (k) => {
          if (k in newRule) delete newRule[k];
        },
      );
    }
    if (key === "shape" && "iconUrl" in newRule) {
      delete newRule.iconUrl;
    }
    if (newRule.propertyRefs && key in newRule.propertyRefs) {
      const nextRefs = { ...newRule.propertyRefs };
      delete nextRefs[key];
      if (Object.keys(nextRefs).length === 0) {
        delete newRule.propertyRefs;
      } else {
        newRule.propertyRefs = nextRefs;
      }
    }
    onChange(newRule);
  };

  if (defaultSection) {
    return (
      <RuleContainer>
        <FlexContainer>
          <FullWidthContainer>
            <DefaultStyleSection
              rule={rule}
              onChange={onChange}
              containerRef={containerRef}
              sectionName={defaultSection}
            />
          </FullWidthContainer>
        </FlexContainer>
      </RuleContainer>
    );
  }

  const styleKeys = Object.keys(rule).filter(
    (key) => !RULE_METADATA_KEYS.includes(key),
  );

  return (
    <RuleContainer>
      <RuleConditionEditor
        rule={rule}
        onChange={onChange}
        availableFields={availableFields}
        selectedGeomType={selectedGeomType}
        handleGeomTypeChange={handleGeomTypeChange}
        GEOMETRY_TYPE_OPTIONS={GEOMETRY_TYPE_OPTIONS}
      />
      <SectionDivider />
      <Section>
        <SectionHeader>Then apply style</SectionHeader>
        {styleKeys.map((key) => (
          <StyleOptionControl
            key={key}
            keyName={key}
            rule={rule}
            onChange={onChange}
            containerRef={containerRef}
            handleRemoveStyle={handleRemoveStyle}
            availableFields={availableFields}
          />
        ))}
        <StyleRowWrapper>
          <DataSelect
            label="Add Style Option"
            options={styleOptions}
            selectedOption={null}
            onChange={handleAddStyle}
            creatable={false}
            divProps={{ style: { marginBottom: 0 } }}
          />
        </StyleRowWrapper>
      </Section>
    </RuleContainer>
  );
};

// Wraps a style control with a Literal | Field source toggle so the value can
// either be a rule literal or a per-feature property reference (propertyRefs).
export function WithFieldToggle({
  keyName,
  label,
  rule,
  onChange,
  availableFields,
  sectionName,
  defaultLiteralValue,
  children,
}) {
  // Default-style section has no per-feature semantics — render the literal control as-is.
  if (sectionName) return children;

  const refs = rule.propertyRefs || {};
  const isField = typeof refs[keyName] === "string";

  const setSource = (nextSource) => {
    const nextRule = { ...rule };
    const nextRefs = { ...(nextRule.propertyRefs || {}) };
    if (nextSource === "field") {
      nextRefs[keyName] = "";
    } else {
      delete nextRefs[keyName];
    }
    if (Object.keys(nextRefs).length === 0) {
      delete nextRule.propertyRefs;
    } else {
      nextRule.propertyRefs = nextRefs;
    }
    if (defaultLiteralValue !== undefined) {
      nextRule[keyName] = defaultLiteralValue;
    }
    onChange(nextRule);
  };

  const setFieldRef = (fieldName) => {
    onChange({
      ...rule,
      propertyRefs: { ...(rule.propertyRefs || {}), [keyName]: fieldName },
    });
  };

  return (
    <>
      <DataSelect
        label="Value Source"
        options={VALUE_SOURCE_OPTIONS}
        selectedOption={VALUE_SOURCE_OPTIONS.find(
          (o) => o.value === (isField ? "field" : "literal"),
        )}
        onChange={(opt) => setSource(opt.value)}
        creatable={false}
        divProps={{ style: { marginBottom: 0, marginRight: "1rem" } }}
      />
      {isField ? (
        <DataSelect
          label={`${label} Field`}
          options={(availableFields || []).map((f) => ({ value: f, label: f }))}
          selectedOption={
            refs[keyName]
              ? { value: refs[keyName], label: refs[keyName] }
              : null
          }
          onChange={(opt) => setFieldRef(opt.value)}
          creatable={true}
          divProps={{ style: { marginBottom: 0 } }}
        />
      ) : (
        children
      )}
    </>
  );
}

WithFieldToggle.propTypes = {
  keyName: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  availableFields: PropTypes.array,
  sectionName: PropTypes.string,
  defaultLiteralValue: PropTypes.any,
  children: PropTypes.node,
};

// Reusable style option control
function StyleOptionControl({
  keyName,
  rule,
  onChange,
  containerRef,
  handleRemoveStyle,
  sectionName,
  defaultSection,
  availableFields = [],
}) {
  const value = sectionName ? rule?.[sectionName]?.[keyName] : rule[keyName];
  const styleValueChange = (k, v) => {
    onChange(
      updateStyleValue({ rule, key: k, value: v, sectionName, defaultSection }),
    );
  };
  if (keyName === "polygonFillType") {
    return (
      <StyleContainer $gap={8} key={keyName}>
        <WithFieldToggle
          keyName={keyName}
          label="Polygon Fill Type"
          rule={rule}
          onChange={onChange}
          availableFields={availableFields}
          sectionName={sectionName}
          defaultLiteralValue="solid"
        >
          <DataSelect
            label="Polygon Fill Type"
            options={POLYGON_FILL_TYPES}
            selectedOption={
              POLYGON_FILL_TYPES.find((o) => o.value === value) ||
              POLYGON_FILL_TYPES[0]
            }
            onChange={(opt) => styleValueChange(keyName, opt.value)}
            creatable={false}
            divProps={{ style: { marginBottom: 0 } }}
          />
        </WithFieldToggle>
        {value === "hatch" && (
          <>
            <DataSelect
              label="Hatch Direction"
              options={[
                { value: "diagonal", label: "Diagonal" },
                { value: "horizontal", label: "Horizontal" },
                { value: "vertical", label: "Vertical" },
                { value: "cross", label: "Cross" },
              ]}
              selectedOption={(() => {
                const hatchDir = sectionName
                  ? rule?.[sectionName]?.hatchDirection
                  : rule.hatchDirection;
                return hatchDir
                  ? {
                      value: hatchDir,
                      label:
                        hatchDir.charAt(0).toUpperCase() + hatchDir.slice(1),
                    }
                  : null;
              })()}
              onChange={(opt) => styleValueChange("hatchDirection", opt.value)}
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <NumberInputWrapper>
              <NormalInput
                label="Hatch Spacing"
                value={
                  sectionName
                    ? rule?.[sectionName]?.hatchSpacing || ""
                    : rule.hatchSpacing || ""
                }
                type="number"
                onChange={(e) =>
                  styleValueChange("hatchSpacing", e.target.value)
                }
                labelProps={{ style: { marginBottom: 0 } }}
              />
            </NumberInputWrapper>
          </>
        )}
        {value === "dot" && (
          <>
            <NumberInputWrapper>
              <NormalInput
                label="Dot Radius"
                value={
                  sectionName
                    ? rule?.[sectionName]?.dotRadius || ""
                    : rule.dotRadius || ""
                }
                type="number"
                onChange={(e) => styleValueChange("dotRadius", e.target.value)}
                labelProps={{ style: { marginBottom: 0 } }}
              />
            </NumberInputWrapper>
            <NumberInputWrapper>
              <NormalInput
                label="Dot Spacing"
                value={
                  sectionName
                    ? rule?.[sectionName]?.dotSpacing || ""
                    : rule.dotSpacing || ""
                }
                type="number"
                onChange={(e) => styleValueChange("dotSpacing", e.target.value)}
                labelProps={{ style: { marginBottom: 0 } }}
              />
            </NumberInputWrapper>
          </>
        )}
        {handleRemoveStyle && (
          <>
            <Spacer />
            <XButton
              type="button"
              onClick={() => handleRemoveStyle(keyName)}
              aria-label={`Remove ${keyName} style option`}
              title={`Remove ${keyName} style option`}
            >
              ×
            </XButton>
          </>
        )}
      </StyleContainer>
    );
  }
  if (keyName === "shape") {
    return (
      <StyleContainer $gap={8} key={keyName}>
        <WithFieldToggle
          keyName={keyName}
          label="Shape"
          rule={rule}
          onChange={onChange}
          availableFields={availableFields}
          sectionName={sectionName}
          defaultLiteralValue={defaultShape}
        >
          <DataSelect
            label="Shape"
            options={availableShapes.map((s) => ({ value: s, label: s }))}
            selectedOption={
              value
                ? { value, label: value }
                : { value: defaultShape, label: defaultShape }
            }
            onChange={(o) => styleValueChange(keyName, o.value)}
            creatable={false}
            divProps={{ style: { marginBottom: 0 } }}
          />
        </WithFieldToggle>
        {value === "icon" && (
          <NormalInput
            label="Icon URL"
            value={
              sectionName
                ? rule?.[sectionName]?.iconUrl || ""
                : rule.iconUrl || ""
            }
            type="text"
            onChange={(e) => styleValueChange("iconUrl", e.target.value)}
            labelProps={{ style: { marginBottom: 0 } }}
          />
        )}
        {handleRemoveStyle && (
          <>
            <Spacer />
            <XButton
              type="button"
              onClick={() => handleRemoveStyle(keyName)}
              aria-label={`Remove ${keyName} style option`}
              title={`Remove ${keyName} style option`}
            >
              ×
            </XButton>
          </>
        )}
      </StyleContainer>
    );
  }
  if (keyName === "fill" || keyName === "stroke") {
    return (
      <StyleContainer key={keyName} $gap={4}>
        <WithFieldToggle
          keyName={keyName}
          label={keyName === "fill" ? "Fill" : "Stroke"}
          rule={rule}
          onChange={onChange}
          availableFields={availableFields}
          sectionName={sectionName}
          defaultLiteralValue={keyName === "fill" ? defaultFill : defaultStroke}
        >
          <ColorPickerPopover
            label={keyName === "fill" ? "Fill" : "Stroke"}
            color={value || (keyName === "fill" ? defaultFill : defaultStroke)}
            onChange={(color) => styleValueChange(keyName, color)}
            containerRef={containerRef}
            divProps={
              defaultSection && { style: { "flex-direction": "column" } }
            }
          />
        </WithFieldToggle>
        {handleRemoveStyle && (
          <>
            <Spacer />
            <XButton
              type="button"
              onClick={() => handleRemoveStyle(keyName)}
              aria-label={`Remove ${keyName} style option`}
              title={`Remove ${keyName} style option`}
            >
              ×
            </XButton>
          </>
        )}
      </StyleContainer>
    );
  }
  if (keyName === "strokeDash") {
    return (
      <StyleContainer key={keyName} $gap={4}>
        <WithFieldToggle
          keyName={keyName}
          label="Stroke Dash"
          rule={rule}
          onChange={onChange}
          availableFields={availableFields}
          sectionName={sectionName}
          defaultLiteralValue=""
        >
          <DataSelect
            label="Stroke Dash"
            options={availableStrokeDashOptions}
            selectedOption={
              availableStrokeDashOptions.find(
                (o) => o.value === (value || ""),
              ) || availableStrokeDashOptions[0]
            }
            onChange={(opt) => styleValueChange(keyName, opt.value)}
            creatable={false}
            divProps={{ style: { marginBottom: 0 } }}
          />
        </WithFieldToggle>
        {handleRemoveStyle && (
          <>
            <Spacer />
            <XButton
              type="button"
              onClick={() => handleRemoveStyle(keyName)}
              aria-label={`Remove ${keyName} style option`}
              title={`Remove ${keyName} style option`}
            >
              ×
            </XButton>
          </>
        )}
      </StyleContainer>
    );
  }
  // Fallback for number input (size, strokeWidth, zIndex, rotation)
  const label = keyName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
  const numericDefault =
    keyName === "strokeWidth"
      ? defaultStrokeWidth
      : keyName === "size"
        ? defaultSize
        : keyName === "rotation"
          ? defaultRotation
          : defaultZIndex;
  return (
    <StyleContainer key={keyName} $gap={4}>
      <WithFieldToggle
        keyName={keyName}
        label={label}
        rule={rule}
        onChange={onChange}
        availableFields={availableFields}
        sectionName={sectionName}
        defaultLiteralValue={numericDefault}
      >
        <NumberInputWrapper>
          <NormalInput
            label={label}
            value={value ?? numericDefault}
            type="number"
            onChange={(e) => styleValueChange(keyName, e.target.value)}
            labelProps={{ style: { marginBottom: 0 } }}
          />
        </NumberInputWrapper>
      </WithFieldToggle>
      {handleRemoveStyle && (
        <>
          <Spacer />
          <XButton
            type="button"
            onClick={() => handleRemoveStyle(keyName)}
            aria-label={`Remove ${keyName} style option`}
            title={`Remove ${keyName} style option`}
          >
            ×
          </XButton>
        </>
      )}
    </StyleContainer>
  );
}

function ConditionRow({
  field,
  type,
  value,
  valueIsField,
  availableFields,
  onChange,
}) {
  const valueless = VALUELESS_CONDITIONS.includes(type);
  const isList = LIST_CONDITIONS.includes(type);
  const source = valueIsField ? "field" : "literal";

  const emit = (next) =>
    onChange({
      field: next.field !== undefined ? next.field : field,
      type: next.type !== undefined ? next.type : type,
      value: next.value !== undefined ? next.value : value,
      valueIsField:
        next.valueIsField !== undefined
          ? next.valueIsField
          : valueIsField || false,
    });

  return (
    <>
      <DataSelect
        label="Field"
        options={availableFields.map((f) => ({ value: f, label: f }))}
        selectedOption={field ? { value: field, label: field } : null}
        onChange={(opt) => emit({ field: opt.value })}
        creatable={true}
        divProps={{ style: { marginBottom: 0 } }}
      />
      <DataSelect
        label="Condition"
        options={CONDITION_OPTIONS}
        selectedOption={CONDITION_OPTIONS.find((o) => o.value === type)}
        onChange={(opt) => emit({ type: opt.value })}
        creatable={false}
        divProps={{ style: { marginBottom: 0 } }}
      />
      {!valueless && isList && (
        <NormalInput
          label="Values"
          value={value || ""}
          type="text"
          placeholder="0, 36, 42"
          onChange={(e) => emit({ value: e.target.value })}
          labelProps={{ style: { marginBottom: 0 } }}
        />
      )}
      {!valueless && !isList && (
        <>
          <DataSelect
            label="Value Source"
            options={VALUE_SOURCE_OPTIONS}
            selectedOption={VALUE_SOURCE_OPTIONS.find(
              (o) => o.value === source,
            )}
            onChange={(opt) =>
              emit({ valueIsField: opt.value === "field", value: "" })
            }
            creatable={false}
            divProps={{ style: { marginBottom: 0 } }}
          />
          {valueIsField ? (
            <DataSelect
              label="Value Field"
              options={availableFields.map((f) => ({ value: f, label: f }))}
              selectedOption={value ? { value, label: value } : null}
              onChange={(opt) => emit({ value: opt.value })}
              creatable={true}
              divProps={{ style: { marginBottom: 0 } }}
            />
          ) : (
            <NormalInput
              label="Value"
              value={value || ""}
              type="text"
              onChange={(e) => emit({ value: e.target.value })}
              labelProps={{ style: { marginBottom: 0 } }}
            />
          )}
        </>
      )}
    </>
  );
}

ConditionRow.propTypes = {
  field: PropTypes.string,
  type: PropTypes.string,
  value: PropTypes.string,
  valueIsField: PropTypes.bool,
  availableFields: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};

const RuleConditionEditor = ({
  rule,
  onChange,
  availableFields,
  selectedGeomType,
  handleGeomTypeChange,
  GEOMETRY_TYPE_OPTIONS,
}) => {
  const conditionField = rule.conditionField || "";
  const conditionType = rule.conditionType || "=";
  const conditionValue = rule.conditionValue || "";
  const ruleName = rule.name || "";
  const extraConditions = rule.conditions || [];
  const combinator = rule.conditionCombinator === "OR" ? "OR" : "AND";

  const updateFirstCondition = (next) => {
    const valueless = VALUELESS_CONDITIONS.includes(next.type);
    const isList = LIST_CONDITIONS.includes(next.type);
    onChange({
      ...rule,
      conditionField: next.field,
      conditionType: next.type,
      conditionValue: valueless ? "" : next.value,
      conditionValueIsField: valueless || isList ? false : !!next.valueIsField,
    });
  };

  const updateExtraCondition = (i, next) => {
    const valueless = VALUELESS_CONDITIONS.includes(next.type);
    const isList = LIST_CONDITIONS.includes(next.type);
    const conditions = [...extraConditions];
    conditions[i] = {
      field: next.field,
      type: next.type,
      value: valueless ? "" : next.value,
      valueIsField: valueless || isList ? false : !!next.valueIsField,
    };
    onChange({ ...rule, conditions });
  };

  const addExtraCondition = () => {
    const conditions = [
      ...extraConditions,
      { field: "", type: "=", value: "" },
    ];
    onChange({ ...rule, conditions });
  };

  const toggleCombinator = () => {
    onChange({
      ...rule,
      conditionCombinator: combinator === "OR" ? "AND" : "OR",
    });
  };

  const removeExtraCondition = (i) => {
    const conditions = extraConditions.filter((_, idx) => idx !== i);
    const nextRule = { ...rule };
    if (conditions.length === 0) {
      delete nextRule.conditions;
    } else {
      nextRule.conditions = conditions;
    }
    onChange(nextRule);
  };

  return (
    <>
      <HeaderRow>
        <NormalInput
          label="Rule Name"
          value={ruleName}
          type="text"
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
          labelProps={{ style: { marginBottom: 0 } }}
        />
        <DataSelect
          label="Geometry Type"
          options={GEOMETRY_TYPE_OPTIONS}
          selectedOption={selectedGeomType}
          onChange={handleGeomTypeChange}
          creatable={false}
          divProps={{ style: { marginBottom: 0 } }}
        />
      </HeaderRow>

      <Section>
        <SectionHeader>When</SectionHeader>
        <ConditionRowWrapper>
          <ConditionRow
            field={conditionField}
            type={conditionType}
            value={conditionValue}
            valueIsField={!!rule.conditionValueIsField}
            availableFields={availableFields}
            onChange={updateFirstCondition}
          />
        </ConditionRowWrapper>
        {extraConditions.map((c, i) => (
          <ConditionRowWrapper key={i}>
            <AndLabel
              type="button"
              onClick={toggleCombinator}
              aria-label={`Toggle match logic, currently ${combinator}`}
              title="Click to toggle between AND and OR"
            >
              {combinator}
            </AndLabel>
            <ConditionRow
              field={c.field || ""}
              type={c.type || "="}
              value={c.value || ""}
              valueIsField={!!c.valueIsField}
              availableFields={availableFields}
              onChange={(next) => updateExtraCondition(i, next)}
            />
            <Spacer />
            <XButton
              type="button"
              onClick={() => removeExtraCondition(i)}
              aria-label="Remove condition"
              title="Remove condition"
            >
              ×
            </XButton>
          </ConditionRowWrapper>
        ))}
        <ConditionRowWrapper>
          <AddConditionButton
            type="button"
            onClick={addExtraCondition}
            aria-label="Add condition"
          >
            + condition
          </AddConditionButton>
        </ConditionRowWrapper>
      </Section>
    </>
  );
};

const DefaultStyleSection = ({ rule, onChange, containerRef, sectionName }) => (
  <div key={sectionName} style={{ marginBottom: 24 }}>
    <div
      aria-label={`${sectionName} default styling section`}
      style={{ fontWeight: 600, marginBottom: 8 }}
    >
      {spaceAndCapitalize(sectionName)}
    </div>
    <StyleContainer $align="flex-start">
      {geomStyleOptions[sectionName].map((optKey) => (
        <div key={optKey} style={{ display: "flex", alignItems: "center" }}>
          <StyleOptionControl
            keyName={optKey}
            rule={rule}
            onChange={onChange}
            containerRef={containerRef}
            sectionName={sectionName}
            defaultSection={sectionName}
          />
        </div>
      ))}
    </StyleContainer>
  </div>
);

StyleOptionControl.propTypes = {
  keyName: PropTypes.string.isRequired,
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  containerRef: PropTypes.object,
  handleRemoveStyle: PropTypes.func,
  sectionName: PropTypes.string,
  defaultSection: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
  availableFields: PropTypes.array,
};

DefaultStyleSection.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  containerRef: PropTypes.object,
  sectionName: PropTypes.string.isRequired,
};

RuleEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  availableFields: PropTypes.array,
  containerRef: PropTypes.object,
  styleOptionFilter: PropTypes.array,
  hideConditionFields: PropTypes.bool,
  defaultSection: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]),
};

RuleConditionEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  availableFields: PropTypes.array.isRequired,
  selectedGeomType: PropTypes.object.isRequired,
  handleGeomTypeChange: PropTypes.func.isRequired,
  GEOMETRY_TYPE_OPTIONS: PropTypes.array.isRequired,
};

export default memo(RuleEditor, valuesEqual);
