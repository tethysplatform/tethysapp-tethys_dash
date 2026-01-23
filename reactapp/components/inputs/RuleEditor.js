import { useEffect, useState, useRef, memo, Fragment } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";
import { spaceAndCapitalize } from "components/modals/utilities";

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
  gap: ${(props) => (props.gap ? props.gap : 16)}px;
  align-items: center;
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

const availableStrokeDashOptions = [
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

export const defaultFill = "gray";
export const defaultStroke = "black";
export const defaultStrokeWidth = 1;
export const defaultSize = 5;
export const defaultZIndex = 0;
export const defaultShape = "circle";
export const defaultHatchSpacing = 8;
export const defaultHatchDirection = "diagonal";
export const defaultDotSpacing = 8;
export const defaultDotRadius = 2;

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
    // when geometry type changes, remove old rules
    if (currentGeomType.current !== selectedGeomType.value) {
      onChange({
        geometryType: selectedGeomType.value,
        conditionField: "",
        conditionType: "=",
        conditionValue: "",
      });
      currentGeomType.current = selectedGeomType.value;
    }
  }, [rule.geometryType]);

  // Extract condition
  const conditionField = rule.conditionField || "";
  const conditionType = rule.conditionType || "=";
  const conditionValue = rule.conditionValue || "";

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

  // Add style option
  const handleAddStyle = (selected) => {
    const newRule = { ...rule };
    if (selected.value === "fill") {
      newRule.fill = defaultFill;
    } else if (selected.value === "stroke") {
      newRule.stroke = defaultStroke;
    } else if (selected.value === "strokeWidth") {
      newRule.strokeWidth = defaultStrokeWidth;
    } else if (selected.value === "size") {
      newRule.size = defaultSize;
    } else if (selected.value === "zIndex") {
      newRule.zIndex = defaultZIndex;
    } else {
      newRule[selected.value] = "";
    }
    onChange(newRule);
  };

  // Remove style option
  const handleRemoveStyle = (key) => {
    const newRule = { ...rule };
    delete newRule[key];

    if (key === "polygonFillType") {
      if ("hatchDirection" in newRule) {
        delete newRule.hatchDirection;
      }
      if ("hatchSpacing" in newRule) {
        delete newRule.hatchSpacing;
      }
      if ("dotRadius" in newRule) {
        delete newRule.dotRadius;
      }
      if ("dotSpacing" in newRule) {
        delete newRule.dotSpacing;
      }
    }

    if (key === "shape" && "iconUrl" in newRule) {
      delete newRule.iconUrl;
    }

    onChange(newRule);
  };

  // Update style value
  const handleStyleValueChange = (key, value) => {
    const newRule = { ...rule };

    // Clean up hatch and dot rules when polygonFillType changes
    if (key === "polygonFillType") {
      if (defaultSection) {
        // Clean up inside the defaultSection object
        const section = { ...newRule[defaultSection] };
        if ("hatchDirection" in section) {
          delete section.hatchDirection;
        }
        if ("hatchSpacing" in section) {
          delete section.hatchSpacing;
        }
        if ("dotRadius" in section) {
          delete section.dotRadius;
        }
        if ("dotSpacing" in section) {
          delete section.dotSpacing;
        }
        newRule[defaultSection] = section;
      } else {
        // Clean up at the top level
        if ("hatchDirection" in newRule) {
          delete newRule.hatchDirection;
        }
        if ("hatchSpacing" in newRule) {
          delete newRule.hatchSpacing;
        }
        if ("dotRadius" in newRule) {
          delete newRule.dotRadius;
        }
        if ("dotSpacing" in newRule) {
          delete newRule.dotSpacing;
        }
      }
    }

    if (key === "shape" && value !== "icon") {
      // Remove iconUrl if shape is changed from icon to something else
      if (defaultSection) {
        const section = { ...newRule[defaultSection] };
        if ("iconUrl" in section) {
          delete section.iconUrl;
        }
        newRule[defaultSection] = section;
      } else {
        if ("iconUrl" in newRule) {
          delete newRule.iconUrl;
        }
      }
    }

    if (defaultSection) {
      newRule[defaultSection] = { ...newRule[defaultSection], [key]: value };
    } else {
      newRule[key] = value;
    }
    onChange(newRule);
  };

  return (
    <RuleContainer>
      <FlexContainer>
        {!defaultSection && (
          <>
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
              onChange={(opt) =>
                onChange({ ...rule, conditionField: opt?.value || "" })
              }
              creatable={true}
              divProps={{ style: { marginBottom: 0 } }}
            />
            <DataSelect
              label="Condition"
              options={CONDITION_OPTIONS}
              selectedOption={CONDITION_OPTIONS.find(
                (o) => o.value === conditionType,
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
              options={styleOptions}
              selectedOption={null}
              onChange={handleAddStyle}
              creatable={false}
              divProps={{ style: { marginBottom: 0 } }}
            />
          </>
        )}
        <FullWidthContainer>
          {defaultSection ? (
            <div key={defaultSection} style={{ marginBottom: 24 }}>
              <div
                aria-label={`${defaultSection} default styling section`}
                style={{ fontWeight: 600, marginBottom: 8 }}
              >
                {spaceAndCapitalize(defaultSection)}
              </div>
              <StyleContainer>
                {geomStyleOptions[defaultSection].map((optKey) => {
                  if (optKey === "fill" || optKey === "stroke") {
                    return (
                      <ColorPickerPopover
                        key={optKey}
                        label={optKey === "fill" ? "Fill" : "Stroke"}
                        color={
                          optKey === "fill"
                            ? rule[defaultSection]?.fill || defaultFill
                            : rule[defaultSection]?.stroke || defaultStroke
                        }
                        onChange={(color) =>
                          handleStyleValueChange(optKey, color)
                        }
                        containerRef={containerRef}
                      />
                    );
                  } else if (optKey === "shape") {
                    return (
                      <Fragment key={optKey}>
                        <DataSelect
                          key={optKey}
                          label="Shape"
                          options={availableShapes.map((s) => ({
                            value: s,
                            label: s,
                          }))}
                          selectedOption={
                            rule?.[defaultSection]?.[optKey]
                              ? {
                                  value: rule[defaultSection][optKey],
                                  label: rule[defaultSection][optKey],
                                }
                              : { value: defaultShape, label: defaultShape }
                          }
                          onChange={(o) =>
                            handleStyleValueChange(optKey, o.value)
                          }
                          creatable={false}
                          divProps={{ style: { marginBottom: 0 } }}
                        />
                        {rule?.[defaultSection]?.[optKey] === "icon" && (
                          <>
                            <NormalInput
                              label="Icon URL"
                              value={rule[defaultSection]?.iconUrl || ""}
                              type="text"
                              onChange={(e) =>
                                handleStyleValueChange(
                                  "iconUrl",
                                  e.target.value,
                                )
                              }
                              labelProps={{ style: { marginBottom: 0 } }}
                            />
                          </>
                        )}
                      </Fragment>
                    );
                  } else if (optKey === "polygonFillType") {
                    return (
                      <Fragment key={optKey}>
                        <DataSelect
                          key={optKey}
                          label="Polygon Fill Type"
                          options={POLYGON_FILL_TYPES}
                          selectedOption={
                            POLYGON_FILL_TYPES.find(
                              (o) =>
                                o.value === rule?.[defaultSection]?.[optKey],
                            ) || POLYGON_FILL_TYPES[0]
                          }
                          onChange={(opt) =>
                            handleStyleValueChange(optKey, opt.value)
                          }
                          creatable={false}
                          divProps={{ style: { marginBottom: 0 } }}
                        />
                        {rule?.[defaultSection]?.[optKey] === "hatch" && (
                          <>
                            <DataSelect
                              label="Hatch Direction"
                              options={[
                                { value: "diagonal", label: "Diagonal" },
                                { value: "horizontal", label: "Horizontal" },
                                { value: "vertical", label: "Vertical" },
                                { value: "cross", label: "Cross" },
                              ]}
                              selectedOption={
                                rule?.[defaultSection]?.hatchDirection
                                  ? {
                                      value:
                                        rule[defaultSection].hatchDirection,
                                      label:
                                        rule[defaultSection].hatchDirection
                                          .charAt(0)
                                          .toUpperCase() +
                                        rule[
                                          defaultSection
                                        ].hatchDirection.slice(1),
                                    }
                                  : {
                                      value: defaultHatchDirection,
                                      label:
                                        defaultHatchDirection
                                          .charAt(0)
                                          .toUpperCase() +
                                        defaultHatchDirection.slice(1),
                                    }
                              }
                              onChange={(opt) =>
                                handleStyleValueChange(
                                  "hatchDirection",
                                  opt.value,
                                )
                              }
                              creatable={false}
                              divProps={{ style: { marginBottom: 0 } }}
                            />
                            <NumberInputWrapper>
                              <NormalInput
                                label="Hatch Spacing"
                                value={
                                  rule[defaultSection]?.hatchSpacing ||
                                  defaultHatchSpacing
                                }
                                type="number"
                                onChange={(e) =>
                                  handleStyleValueChange(
                                    "hatchSpacing",
                                    e.target.value,
                                  )
                                }
                                labelProps={{ style: { marginBottom: 0 } }}
                              />
                            </NumberInputWrapper>
                          </>
                        )}
                        {rule?.[defaultSection]?.[optKey] === "dot" && (
                          <>
                            <NumberInputWrapper>
                              <NormalInput
                                label="Dot Radius"
                                value={
                                  rule[defaultSection]?.dotRadius ||
                                  defaultDotRadius
                                }
                                type="number"
                                onChange={(e) =>
                                  handleStyleValueChange(
                                    "dotRadius",
                                    e.target.value,
                                  )
                                }
                                labelProps={{ style: { marginBottom: 0 } }}
                              />
                            </NumberInputWrapper>
                            <NumberInputWrapper>
                              <NormalInput
                                label="Dot Spacing"
                                value={
                                  rule[defaultSection]?.dotSpacing ||
                                  defaultDotSpacing
                                }
                                type="number"
                                onChange={(e) => {
                                  handleStyleValueChange(
                                    "dotSpacing",
                                    e.target.value,
                                  );
                                }}
                                labelProps={{ style: { marginBottom: 0 } }}
                              />
                            </NumberInputWrapper>
                          </>
                        )}
                      </Fragment>
                    );
                  } else if (optKey === "strokeDash") {
                    return (
                      <DataSelect
                        key={optKey}
                        label="Stroke Dash"
                        options={availableStrokeDashOptions}
                        selectedOption={
                          availableStrokeDashOptions.find(
                            (o) =>
                              o.value ===
                              (rule?.[defaultSection]?.strokeDash || ""),
                          ) || availableStrokeDashOptions[0]
                        }
                        onChange={(opt) =>
                          handleStyleValueChange(optKey, opt.value)
                        }
                        creatable={false}
                        divProps={{ style: { marginBottom: 0 } }}
                      />
                    );
                  } else {
                    // Fallback label: Capitalize and add spaces
                    const label = optKey
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (str) => str.toUpperCase());
                    return (
                      <NumberInputWrapper key={optKey}>
                        <NormalInput
                          label={label}
                          value={
                            rule?.[defaultSection]?.[optKey] ??
                            (optKey === "strokeWidth"
                              ? defaultStrokeWidth
                              : optKey === "size"
                                ? defaultSize
                                : optKey === "zIndex"
                                  ? defaultZIndex
                                  : "")
                          }
                          type="number"
                          onChange={(e) =>
                            handleStyleValueChange(optKey, e.target.value)
                          }
                          labelProps={{ style: { marginBottom: 0 } }}
                        />
                      </NumberInputWrapper>
                    );
                  }
                })}
              </StyleContainer>
            </div>
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
                  ].includes(key),
              )
              .map((key) => {
                if (key === "polygonFillType") {
                  return (
                    <StyleContainer gap={8} key={key}>
                      <XButton
                        type="button"
                        onClick={() => handleRemoveStyle(key)}
                        aria-label={`Remove ${key} style option`}
                        title={`Remove ${key} style option`}
                      >
                        ×
                      </XButton>
                      <DataSelect
                        label="Polygon Fill Type"
                        options={POLYGON_FILL_TYPES}
                        selectedOption={
                          POLYGON_FILL_TYPES.find(
                            (o) => o.value === rule[key],
                          ) || POLYGON_FILL_TYPES[0]
                        }
                        onChange={(opt) =>
                          handleStyleValueChange(key, opt?.value || "solid")
                        }
                        creatable={false}
                        divProps={{ style: { marginBottom: 0 } }}
                      />
                      {rule[key] === "hatch" && (
                        <>
                          <DataSelect
                            label="Hatch Direction"
                            options={[
                              { value: "diagonal", label: "Diagonal" },
                              { value: "horizontal", label: "Horizontal" },
                              { value: "vertical", label: "Vertical" },
                              { value: "cross", label: "Cross" },
                            ]}
                            selectedOption={
                              rule.hatchDirection
                                ? {
                                    value: rule.hatchDirection,
                                    label:
                                      rule.hatchDirection
                                        .charAt(0)
                                        .toUpperCase() +
                                      rule.hatchDirection.slice(1),
                                  }
                                : null
                            }
                            onChange={(opt) =>
                              handleStyleValueChange(
                                "hatchDirection",
                                opt?.value || "diagonal",
                              )
                            }
                            creatable={false}
                            divProps={{ style: { marginBottom: 0 } }}
                          />
                          <NumberInputWrapper>
                            <NormalInput
                              label="Hatch Spacing"
                              value={rule.hatchSpacing || ""}
                              type="number"
                              onChange={(e) =>
                                handleStyleValueChange(
                                  "hatchSpacing",
                                  e.target.value,
                                )
                              }
                              labelProps={{ style: { marginBottom: 0 } }}
                            />
                          </NumberInputWrapper>
                        </>
                      )}
                      {rule[key] === "dot" && (
                        <>
                          <NumberInputWrapper>
                            <NormalInput
                              label="Dot Radius"
                              value={rule.dotRadius || ""}
                              type="number"
                              onChange={(e) =>
                                handleStyleValueChange(
                                  "dotRadius",
                                  e.target.value,
                                )
                              }
                              labelProps={{ style: { marginBottom: 0 } }}
                            />
                          </NumberInputWrapper>
                          <NumberInputWrapper>
                            <NormalInput
                              label="Dot Spacing"
                              value={rule.dotSpacing || ""}
                              type="number"
                              onChange={(e) =>
                                handleStyleValueChange(
                                  "dotSpacing",
                                  e.target.value,
                                )
                              }
                              labelProps={{ style: { marginBottom: 0 } }}
                            />
                          </NumberInputWrapper>
                        </>
                      )}
                    </StyleContainer>
                  );
                } else if (key === "shape") {
                  return (
                    <StyleContainer gap={8} key={key}>
                      <XButton
                        type="button"
                        onClick={() => handleRemoveStyle(key)}
                        aria-label={`Remove ${key} style option`}
                        title={`Remove ${key} style option`}
                      >
                        ×
                      </XButton>
                      <DataSelect
                        key={key}
                        label="Shape"
                        options={availableShapes.map((s) => ({
                          value: s,
                          label: s,
                        }))}
                        selectedOption={
                          rule.shape
                            ? {
                                value: rule.shape,
                                label: rule.shape,
                              }
                            : null
                        }
                        onChange={(o) => handleStyleValueChange(key, o.value)}
                        creatable={false}
                        divProps={{ style: { marginBottom: 0 } }}
                      />
                      {rule.shape === "icon" && (
                        <>
                          <NormalInput
                            label="Icon URL"
                            value={rule.iconUrl || ""}
                            type="text"
                            onChange={(e) =>
                              handleStyleValueChange("iconUrl", e.target.value)
                            }
                            labelProps={{ style: { marginBottom: 0 } }}
                          />
                        </>
                      )}
                    </StyleContainer>
                  );
                }

                return (
                  <StyleContainer key={key} gap={4}>
                    <XButton
                      type="button"
                      onClick={() => handleRemoveStyle(key)}
                      aria-label={`Remove ${key} style option`}
                      title={`Remove ${key} style option`}
                    >
                      ×
                    </XButton>
                    {key === "fill" || key === "stroke" ? (
                      <ColorPickerPopover
                        label={key === "fill" ? "Fill" : "Stroke"}
                        color={
                          rule[key] ||
                          (key === "fill" ? defaultFill : defaultStroke)
                        }
                        onChange={(color) => {
                          handleStyleValueChange(key, color);
                        }}
                        containerRef={containerRef}
                      />
                    ) : key === "strokeDash" ? (
                      <DataSelect
                        label="Stroke Dash"
                        options={availableStrokeDashOptions}
                        selectedOption={
                          availableStrokeDashOptions.find(
                            (o) => o.value === (rule[key] || ""),
                          ) || availableStrokeDashOptions[0]
                        }
                        onChange={(opt) =>
                          handleStyleValueChange(key, opt?.value || "")
                        }
                        creatable={false}
                        divProps={{ style: { marginBottom: 0 } }}
                      />
                    ) : (
                      <NumberInputWrapper>
                        <NormalInput
                          label={key}
                          value={
                            rule[key] ??
                            (key === "strokeWidth"
                              ? defaultStrokeWidth
                              : key === "size"
                                ? defaultSize
                                : key === "zIndex"
                                  ? defaultZIndex
                                  : "")
                          }
                          type="number"
                          onChange={(e) =>
                            handleStyleValueChange(key, e.target.value)
                          }
                          labelProps={{ style: { marginBottom: 0 } }}
                        />
                      </NumberInputWrapper>
                    )}
                  </StyleContainer>
                );
              })
          )}
        </FullWidthContainer>
      </FlexContainer>
    </RuleContainer>
  );
};

RuleEditor.propTypes = {
  rule: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  availableFields: PropTypes.array,
  containerRef: PropTypes.object,
  styleOptionFilter: PropTypes.array,
  hideConditionFields: PropTypes.bool,
};

export default memo(RuleEditor);
