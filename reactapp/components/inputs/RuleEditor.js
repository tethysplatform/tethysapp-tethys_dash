import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";
import NormalInput from "components/inputs/NormalInput";
import DataSelect from "components/inputs/DataSelect";
import ColorPickerPopover from "components/inputs/ColorPickerPopOver";
import { spaceAndCapitalize } from "components/modals/utilities";

// Styled number input wrapper for consistent width
const NumberInputWrapper = styled.div`
  min-width: 100px;
  width: 100px;
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
  z-index: 2;
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
const getStyleKeysForGeom = (geomType) => {
  if (["point", "multipoint"].includes(geomType)) return geomStyleOptions.point;
  if (["linestring", "multilinestring"].includes(geomType))
    return geomStyleOptions.linestring;
  if (["polygon", "multipolygon"].includes(geomType))
    return geomStyleOptions.polygon;
  return [];
};

const RuleEditor = ({
  rule,
  onChange,
  availableFields,
  containerRef,
  defaultSection = false,
}) => {
  const [selectedGeomType, setSelectedGeomType] = useState(
    rule.geometryType || "point",
  );
  const [styleOptions, setStyleOptions] = useState(
    getStyleKeysForGeom(rule.geometryType || "point"),
  );

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
              creatable={false}
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
            {/* Add Style Option Dropdown, filtered by styleOptionFilter */}
            <DataSelect
              label="Add Style Option"
              options={styleOptions}
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
              />
            )}
          </>
        )}
        <FullWidthContainer>
          {defaultSection ? (
            <div key={defaultSection} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {spaceAndCapitalize(defaultSection)}
              </div>
              <StyleContainer>
                {geomStyleOptions[defaultSection].map((optKey) => {
                  if (optKey === "fill" || optKey === "stroke") {
                    return (
                      <ColorPickerPopover
                        key={optKey}
                        label={optKey === "fill" ? "Fill" : "Stroke"}
                        color={rule[defaultSection]?.[optKey] || "#888888"}
                        onChange={(color) =>
                          handleStyleValueChange(optKey, color)
                        }
                        containerRef={containerRef}
                      />
                    );
                  } else if (optKey === "shape") {
                    return (
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
                            : null
                        }
                        onChange={(o) =>
                          handleStyleValueChange(optKey, o.value)
                        }
                        creatable={false}
                        divProps={{ style: { marginBottom: 0 } }}
                      />
                    );
                  } else if (optKey === "polygonFillType") {
                    return (
                      <>
                        <DataSelect
                          key={optKey}
                          label="Polygon Fill Type"
                          options={POLYGON_FILL_TYPES}
                          selectedOption={POLYGON_FILL_TYPES.find(
                            (o) => o.value === rule?.[defaultSection]?.[optKey],
                          )}
                          onChange={(opt) =>
                            handleStyleValueChange(optKey, opt.value)
                          }
                          creatable={false}
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
                                  : null
                              }
                              onChange={(opt) =>
                                handleStyleValueChange(
                                  "hatchDirection",
                                  opt.value,
                                )
                              }
                              creatable={false}
                            />
                            <NumberInputWrapper>
                              <NormalInput
                                label="Hatch Spacing"
                                value={rule[defaultSection]?.hatchSpacing || ""}
                                type="number"
                                onChange={(e) =>
                                  handleStyleValueChange(
                                    "hatchSpacing",
                                    e.target.value,
                                  )
                                }
                              />
                            </NumberInputWrapper>
                            <ColorPickerPopover
                              label="Hatch Color"
                              color={rule[defaultSection]?.hatchColor || "#000"}
                              onChange={(color) =>
                                handleStyleValueChange("hatchColor", color)
                              }
                              containerRef={containerRef}
                            />
                          </>
                        )}
                        {rule?.[defaultSection]?.[optKey] === "dot" && (
                          <>
                            <NumberInputWrapper>
                              <NormalInput
                                label="Dot Radius"
                                value={rule[defaultSection]?.dotRadius || ""}
                                type="number"
                                onChange={(e) =>
                                  handleStyleValueChange(
                                    "dotRadius",
                                    e.target.value,
                                  )
                                }
                              />
                            </NumberInputWrapper>
                            <NumberInputWrapper>
                              <NormalInput
                                label="Dot Spacing"
                                value={rule[defaultSection]?.dotSpacing || ""}
                                type="number"
                                onChange={(e) =>
                                  handleStyleValueChange(
                                    "dotSpacing",
                                    e.target.value,
                                  )
                                }
                              />
                            </NumberInputWrapper>
                            <ColorPickerPopover
                              label="Dot Color"
                              color={rule[defaultSection]?.dotColor || "#444"}
                              onChange={(color) =>
                                handleStyleValueChange("dotColor", color)
                              }
                              containerRef={containerRef}
                            />
                          </>
                        )}
                      </>
                    );
                  } else if (optKey === "hatchColor" || optKey === "dotColor") {
                    return (
                      <ColorPickerPopover
                        key={optKey}
                        label={
                          optKey === "hatchColor" ? "Hatch Color" : "Dot Color"
                        }
                        color={
                          rule?.[defaultSection]?.[optKey] ||
                          (optKey === "hatchColor" ? "#000" : "#444")
                        }
                        onChange={(color) =>
                          handleStyleValueChange(optKey, color)
                        }
                        containerRef={containerRef}
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
                          value={rule?.[defaultSection]?.[optKey]}
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
                        selectedOption={POLYGON_FILL_TYPES.find(
                          (o) => o.value === rule[key],
                        )}
                        onChange={(opt) =>
                          handleStyleValueChange(key, opt?.value || "solid")
                        }
                        creatable={false}
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
                            />
                          </NumberInputWrapper>
                          <ColorPickerPopover
                            label="Hatch Color"
                            color={rule.hatchColor || "#000"}
                            onChange={(color) =>
                              handleStyleValueChange("hatchColor", color)
                            }
                            containerRef={containerRef}
                          />
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
                            />
                          </NumberInputWrapper>
                          <ColorPickerPopover
                            label="Dot Color"
                            color={rule.dotColor || "#444"}
                            onChange={(color) =>
                              handleStyleValueChange("dotColor", color)
                            }
                            containerRef={containerRef}
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
                          rule[key]
                            ? { value: rule[key], label: rule[key] }
                            : null
                        }
                        onChange={(opt) =>
                          handleStyleValueChange(key, opt?.value || "circle")
                        }
                        creatable={false}
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
                      />
                    ) : (
                      <NumberInputWrapper>
                        <NormalInput
                          label={key}
                          value={rule[key]}
                          type="number"
                          onChange={(e) =>
                            handleStyleValueChange(key, e.target.value)
                          }
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
  onRemove: PropTypes.func.isRequired,
  availableShapes: PropTypes.array.isRequired,
  availableFields: PropTypes.array.isRequired,
  containerRef: PropTypes.object.isRequired,
  styleOptionFilter: PropTypes.array,
  hideConditionFields: PropTypes.bool,
};

export default RuleEditor;
