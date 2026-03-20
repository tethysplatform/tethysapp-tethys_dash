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
  point: ["fill", "stroke", "strokeWidth", "size", "shape", "zIndex"],
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
      });
      currentGeomType.current = selectedGeomType.value;
    }
    // eslint-disable-next-line
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
    onChange(newRule);
  };

  return (
    <RuleContainer>
      <FlexContainer>
        {!defaultSection && (
          <RuleConditionEditor
            rule={rule}
            onChange={onChange}
            availableFields={availableFields}
            selectedGeomType={selectedGeomType}
            handleGeomTypeChange={handleGeomTypeChange}
            styleOptions={styleOptions}
            handleAddStyle={handleAddStyle}
            GEOMETRY_TYPE_OPTIONS={GEOMETRY_TYPE_OPTIONS}
            CONDITION_OPTIONS={CONDITION_OPTIONS}
          />
        )}
        <FullWidthContainer>
          {defaultSection ? (
            <DefaultStyleSection
              rule={rule}
              onChange={onChange}
              containerRef={containerRef}
              sectionName={defaultSection}
            />
          ) : (
            Object.keys(rule)
              .filter(
                (key) =>
                  ![
                    "conditionField",
                    "conditionType",
                    "conditionValue",
                    "geometryType",
                    "iconUrl",
                    "hatchDirection",
                    "hatchSpacing",
                    "dotRadius",
                    "dotSpacing",
                    "name",
                  ].includes(key),
              )
              .map((key) => (
                <StyleOptionControl
                  key={key}
                  keyName={key}
                  rule={rule}
                  onChange={onChange}
                  containerRef={containerRef}
                  handleRemoveStyle={handleRemoveStyle}
                />
              ))
          )}
        </FullWidthContainer>
      </FlexContainer>
    </RuleContainer>
  );
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
        {handleRemoveStyle && (
          <XButton
            type="button"
            onClick={() => handleRemoveStyle(keyName)}
            aria-label={`Remove ${keyName} style option`}
            title={`Remove ${keyName} style option`}
          >
            ×
          </XButton>
        )}
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
      </StyleContainer>
    );
  }
  if (keyName === "shape") {
    return (
      <StyleContainer $gap={8} key={keyName}>
        {handleRemoveStyle && (
          <XButton
            type="button"
            onClick={() => handleRemoveStyle(keyName)}
            aria-label={`Remove ${keyName} style option`}
            title={`Remove ${keyName} style option`}
          >
            ×
          </XButton>
        )}
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
      </StyleContainer>
    );
  }
  if (keyName === "fill" || keyName === "stroke") {
    return (
      <StyleContainer key={keyName} $gap={4}>
        {handleRemoveStyle && (
          <XButton
            type="button"
            onClick={() => handleRemoveStyle(keyName)}
            aria-label={`Remove ${keyName} style option`}
            title={`Remove ${keyName} style option`}
          >
            ×
          </XButton>
        )}
        <ColorPickerPopover
          label={keyName === "fill" ? "Fill" : "Stroke"}
          color={value || (keyName === "fill" ? defaultFill : defaultStroke)}
          onChange={(color) => styleValueChange(keyName, color)}
          containerRef={containerRef}
          divProps={defaultSection && { style: { "flex-direction": "column" } }}
        />
      </StyleContainer>
    );
  }
  if (keyName === "strokeDash") {
    return (
      <StyleContainer key={keyName} $gap={4}>
        {handleRemoveStyle && (
          <XButton
            type="button"
            onClick={() => handleRemoveStyle(keyName)}
            aria-label={`Remove ${keyName} style option`}
            title={`Remove ${keyName} style option`}
          >
            ×
          </XButton>
        )}
        <DataSelect
          label="Stroke Dash"
          options={availableStrokeDashOptions}
          selectedOption={
            availableStrokeDashOptions.find((o) => o.value === (value || "")) ||
            availableStrokeDashOptions[0]
          }
          onChange={(opt) => styleValueChange(keyName, opt.value)}
          creatable={false}
          divProps={{ style: { marginBottom: 0 } }}
        />
      </StyleContainer>
    );
  }
  // Fallback for number input
  const label = keyName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase());
  return (
    <StyleContainer key={keyName} $gap={4}>
      {handleRemoveStyle && (
        <XButton
          type="button"
          onClick={() => handleRemoveStyle(keyName)}
          aria-label={`Remove ${keyName} style option`}
          title={`Remove ${keyName} style option`}
        >
          ×
        </XButton>
      )}
      <NumberInputWrapper>
        <NormalInput
          label={label}
          value={
            value ??
            (keyName === "strokeWidth"
              ? defaultStrokeWidth
              : keyName === "size"
                ? defaultSize
                : defaultZIndex)
          }
          type="number"
          onChange={(e) => styleValueChange(keyName, e.target.value)}
          labelProps={{ style: { marginBottom: 0 } }}
        />
      </NumberInputWrapper>
    </StyleContainer>
  );
}

const RuleConditionEditor = ({
  rule,
  onChange,
  availableFields,
  selectedGeomType,
  handleGeomTypeChange,
  styleOptions,
  handleAddStyle,
  GEOMETRY_TYPE_OPTIONS,
  CONDITION_OPTIONS,
}) => {
  const conditionField = rule.conditionField || "";
  const conditionType = rule.conditionType || "=";
  const conditionValue = rule.conditionValue || "";
  const ruleName = rule.name || "";
  return (
    <>
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
      <DataSelect
        label="Field"
        options={availableFields.map((f) => ({ value: f, label: f }))}
        selectedOption={
          conditionField
            ? { value: conditionField, label: conditionField }
            : null
        }
        onChange={(opt) => onChange({ ...rule, conditionField: opt.value })}
        creatable={true}
        divProps={{ style: { marginBottom: 0 } }}
      />
      <DataSelect
        label="Condition"
        options={CONDITION_OPTIONS}
        selectedOption={CONDITION_OPTIONS.find(
          (o) => o.value === conditionType,
        )}
        onChange={(opt) => onChange({ ...rule, conditionType: opt.value })}
        creatable={false}
        divProps={{ style: { marginBottom: 0 } }}
      />
      <NormalInput
        label="Value"
        value={conditionValue}
        type="text"
        onChange={(e) => onChange({ ...rule, conditionValue: e.target.value })}
        labelProps={{ style: { marginBottom: 0 } }}
      />
      <DataSelect
        label="Add Style Option"
        options={styleOptions}
        selectedOption={null}
        onChange={handleAddStyle}
        creatable={false}
        divProps={{ style: { marginBottom: 0 } }}
      />
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
  styleOptions: PropTypes.array.isRequired,
  handleAddStyle: PropTypes.func.isRequired,
  GEOMETRY_TYPE_OPTIONS: PropTypes.array.isRequired,
  CONDITION_OPTIONS: PropTypes.array.isRequired,
};

export default memo(RuleEditor, valuesEqual);
