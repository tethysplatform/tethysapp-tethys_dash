import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";
import { getLayerAttributes } from "components/map/utilities";
import Spinner from "react-bootstrap/Spinner";
import {
  valuesEqual,
  extractVariableInputNames,
  findMissingKeys,
  removeEmptyStringsFromObject,
} from "components/modals/utilities";

import { sourcePropertiesOptions } from "components/map/utilities";
import InputTable from "components/inputs/InputTable";
import "components/modals/wideModal.css";

const StyledSpinner = styled(Spinner)`
  margin: auto;
  display: block;
`;

const FixedTable = styled(Table)`
  table-layout: fixed;
  font-size: small;
`;

const OverflowTD = styled.td`
  overflow-x: auto;
`;

const StyledInput = styled.input`
  width: 100%;
`;

const CenteredTD = styled.td`
  text-align: center;
  vertical-align: middle;
`;

const InLineDiv = styled.div`
  display: inline-block;
  float: ${(props) => props?.float && props.float};
`;

const AttributesPane = ({
  attributeVariables,
  setAttributeVariables,
  omittedPopupAttributes,
  setOmittedPopupAttributes,
  sourceProps,
  layerProps,
  tabKey,
}) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [attributes, setAttributes] = useState({});
  const attributeVariableValues = useRef(attributeVariables);
  const omittedPopupAttributesValues = useRef(omittedPopupAttributes);
  const previousConfiguration = useRef({});
  const [automatedAttributes, setAutomatedAttributes] = useState(null);
  const [layerPopupSwitch, setLayerPopupSwitch] = useState({});

  useEffect(() => {
    attributeVariableValues.current = attributeVariables;
    omittedPopupAttributesValues.current = omittedPopupAttributes;
    if (tabKey === "attributes") {
      setWarningMessage(null);
      setErrorMessage(null);

      if (!layerProps.name) {
        setErrorMessage(
          "The layer name must be configured to retrieve attributes"
        );
        return;
      }

      if (!sourceProps.type) {
        setErrorMessage(
          "The source type must be configured to retrieve attributes"
        );
        return;
      }

      const validSourceProps = removeEmptyStringsFromObject(sourceProps.props);
      const missingRequiredProps = findMissingKeys(
        sourcePropertiesOptions[sourceProps.type].required,
        validSourceProps
      );
      if (missingRequiredProps.length > 0) {
        setErrorMessage(
          `Missing required ${missingRequiredProps} arguments. Please check the source and try again before getting attributes`
        );
        return;
      }
      if (!valuesEqual(previousConfiguration.current, sourceProps)) {
        setAutomatedAttributes(null);
        previousConfiguration.current = JSON.parse(JSON.stringify(sourceProps));

        if (sourceProps.type === "GeoJSON") {
          try {
            JSON.parse(sourceProps.geojson);
          } catch (err) {
            setAutomatedAttributes(false);
            setErrorMessage(
              <>
                Invalid json is being used. Please alter the json and try again.
                <br />
                <br />
                {err.message}
              </>
            );
            return;
          }
        }

        queryLayerAttributes().then((queriedLayerAttributes) => {
          const layerParams = sourceProps.props?.params ?? [];
          let layerAttributes = {};
          if (
            queriedLayerAttributes === undefined &&
            Object.keys(layerParams).length > 0
          ) {
            setAutomatedAttributes(false);
            const lowercaseLayerParams = Object.keys(layerParams).reduce(
              (acc, key) => {
                acc[key.toLowerCase()] = layerParams[key];
                return acc;
              },
              {}
            );
            const potentialLayers = lowercaseLayerParams?.layers ?? "";
            const transformedLayers = potentialLayers
              .split(",")
              .map((layer) => layer.replace(/^[^:]*:/, ""));
            for (const layerName of transformedLayers) {
              let newAttributes = [];
              let existingLayerattributeVariableFields = [];
              let existingOmittedPopupAttributesFields = [];

              if (layerName in attributeVariableValues.current) {
                existingLayerattributeVariableFields = Object.keys(
                  attributeVariableValues.current[layerName]
                );
              }

              if (layerName in omittedPopupAttributesValues.current) {
                existingOmittedPopupAttributesFields =
                  omittedPopupAttributesValues.current[layerName];
              }
              const existingAttributes = [
                ...new Set([
                  ...existingLayerattributeVariableFields,
                  ...existingOmittedPopupAttributesFields,
                ]),
              ];

              if (existingAttributes.length > 0) {
                for (const existingAttribute of existingAttributes) {
                  newAttributes.push({
                    "Field Name": existingAttribute,
                    "Show in popup": omittedPopupAttributesValues.current[
                      layerName
                    ]
                      ? !omittedPopupAttributesValues.current[
                          layerName
                        ].includes(existingAttribute)
                      : true,
                    "Variable Input Name": attributeVariableValues.current[
                      layerName
                    ]
                      ? (attributeVariableValues.current[layerName][
                          existingAttribute
                        ] ?? "")
                      : "",
                  });
                }
              } else {
                newAttributes.push({
                  "Field Name": "",
                  "Show in popup": true,
                  "Variable Input Name": "",
                });
              }
              layerAttributes[layerName] = newAttributes;
            }
          } else {
            layerAttributes = queriedLayerAttributes ?? {};
            setAutomatedAttributes(true);
          }

          const validLayerAttributes = Object.fromEntries(
            Object.entries(layerAttributes).filter(
              ([_, value]) => !(Array.isArray(value) && value.length === 0)
            )
          );

          if (Object.keys(validLayerAttributes).length > 0) {
            setAttributes(layerAttributes);
            attributeVariableValues.current =
              extractVariableInputNames(layerAttributes);

            setLayerPopupSwitch(
              Object.keys(layerAttributes).reduce((acc, key) => {
                acc[key] = false; // Set each value to an empty string
                return acc;
              }, {})
            );
          } else {
            setWarningMessage("No field attributes were found.");
            setAttributes({});
            setLayerPopupSwitch({});
            attributeVariableValues.current = {};
            return;
          }
        });
      }
    }
  }, [tabKey]);

  function updateAttributes(index, layerName, field, value) {
    const updatedAttributes = JSON.parse(JSON.stringify(attributes));
    updatedAttributes[layerName][index][field] = value;
    setAttributes(updatedAttributes);

    if (field === "variableInput") {
      if (!(layerName in attributeVariableValues.current)) {
        attributeVariableValues.current[layerName] = {};
      }
      attributeVariableValues.current[layerName][
        updatedAttributes[layerName][index]["alias"]
      ] = value;
      setAttributeVariables(attributeVariableValues.current);
    }

    if (field === "popup") {
      if (!(layerName in omittedPopupAttributesValues.current)) {
        omittedPopupAttributesValues.current[layerName] = [];
      }
      if (value) {
        omittedPopupAttributesValues.current[layerName] =
          omittedPopupAttributesValues.current[layerName].filter(
            (alias) => alias !== updatedAttributes[layerName][index]["alias"]
          );
      } else {
        omittedPopupAttributesValues.current[layerName].push(
          updatedAttributes[layerName][index]["alias"]
        );
      }
      setOmittedPopupAttributes(omittedPopupAttributesValues.current);

      const updatedLayerPopupSwitch = JSON.parse(
        JSON.stringify(layerPopupSwitch)
      );
      if (
        omittedPopupAttributesValues.current[layerName].length ===
        updatedAttributes[layerName].length
      ) {
        updatedLayerPopupSwitch[layerName] = false;
      } else {
        updatedLayerPopupSwitch[layerName] = true;
      }
      setLayerPopupSwitch(updatedLayerPopupSwitch);
    }
  }

  async function queryLayerAttributes() {
    let layerAttributes;
    try {
      layerAttributes = await getLayerAttributes(sourceProps, layerProps.name);
    } catch (error) {
      setWarningMessage(
        <>
          {error.message}
          <br />
          <br />
          Please provide the desired fields manually below or attempt to fix the
          issues and retry.
        </>
      );
      return;
    }
    layerAttributes = appendExistingAttributeVariables(layerAttributes);
    layerAttributes = appendExistingOmittedPopupAttributes(layerAttributes);

    return layerAttributes;
  }

  function appendExistingAttributeVariables(layerAttributes) {
    if (attributeVariableValues.current) {
      const newObj = {};
      for (const layerName in layerAttributes) {
        newObj[layerName] = [];
        for (const layerAttribute of layerAttributes[layerName]) {
          const alias = layerAttribute.alias ?? layerAttribute.Alias;
          const existingValue =
            attributeVariableValues.current[layerName] &&
            attributeVariableValues.current[layerName][alias];
          layerAttribute["variableInput"] = existingValue ?? "";
          newObj[layerName].push(layerAttribute);
        }
      }

      return newObj;
    } else {
      return layerAttributes;
    }
  }

  function appendExistingOmittedPopupAttributes(layerAttributes) {
    if (omittedPopupAttributesValues.current) {
      const newObj = {};
      for (const layerName in layerAttributes) {
        newObj[layerName] = [];
        for (const layerAttribute of layerAttributes[layerName]) {
          const alias = layerAttribute.alias ?? layerAttribute.Alias;
          const existingValue =
            !omittedPopupAttributesValues.current[layerName] ||
            !omittedPopupAttributesValues.current[layerName].includes(alias);
          layerAttribute["popup"] = existingValue;
          newObj[layerName].push(layerAttribute);
        }
      }

      return newObj;
    } else {
      return layerAttributes;
    }
  }

  function handleAttributeChange(fields, layerName) {
    const newAttributes = JSON.parse(JSON.stringify(attributes));
    newAttributes[layerName] = fields;
    setAttributes(newAttributes);

    if (!(layerName in attributeVariableValues.current)) {
      attributeVariableValues.current[layerName] = {};
    }

    if (!(layerName in omittedPopupAttributesValues.current)) {
      omittedPopupAttributesValues.current[layerName] = [];
    }

    for (const field of fields) {
      attributeVariableValues.current[layerName][field["Field Name"]] =
        field["Variable Input Name"];
      setAttributeVariables(attributeVariableValues.current);

      if (field["popup"]) {
        omittedPopupAttributesValues.current[layerName] =
          omittedPopupAttributesValues.current[layerName].filter(
            (alias) => alias !== field["Field Name"]
          );
      } else {
        omittedPopupAttributesValues.current[layerName].push(
          field["Field Name"]
        );
      }
      setOmittedPopupAttributes(omittedPopupAttributesValues.current);
    }
  }

  function handleLayerPopup(layerName, checkedValue) {
    const updatedLayerPopupSwitch = JSON.parse(
      JSON.stringify(layerPopupSwitch)
    );
    updatedLayerPopupSwitch[layerName] = checkedValue;
    setLayerPopupSwitch(updatedLayerPopupSwitch);

    if (!(layerName in omittedPopupAttributesValues.current)) {
      omittedPopupAttributesValues.current[layerName] = [];
    }
    const updatedAttributes = JSON.parse(JSON.stringify(attributes));
    let updatedLayerAttributes;
    if (checkedValue) {
      updatedLayerAttributes = updatedAttributes[layerName].map((item) => ({
        ...item,
        popup: true,
      }));
      delete omittedPopupAttributesValues.current[layerName];
    } else {
      updatedLayerAttributes = updatedAttributes[layerName].map((item) => ({
        ...item,
        popup: false,
      }));
      omittedPopupAttributesValues.current[layerName] =
        updatedLayerAttributes.map((item) => item.alias);
    }
    updatedAttributes[layerName] = updatedLayerAttributes;
    setAttributes(updatedAttributes);
    setOmittedPopupAttributes(omittedPopupAttributesValues.current);
  }

  return (
    <>
      {errorMessage ? (
        <Alert key="danger" variant="danger" dismissible>
          {errorMessage}
        </Alert>
      ) : (
        <>
          {warningMessage && (
            <Alert key="warning" variant="warning" dismissible>
              {warningMessage}
            </Alert>
          )}
          {automatedAttributes === null ? (
            <StyledSpinner
              data-testid="Loading..."
              animation="border"
              variant="info"
            />
          ) : automatedAttributes ? (
            Object.keys(attributes).map((layerName, index) => (
              <div key={index}>
                <p>
                  <b>{layerName}</b>:
                </p>
                <FixedTable striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th className="text-center" style={{ width: "25%" }}>
                        Name
                      </th>
                      <th className="text-center" style={{ width: "25%" }}>
                        Alias
                      </th>
                      <th className="text-center" style={{ width: "20%" }}>
                        Show in popup
                        <br />
                        <input
                          type="checkbox"
                          checked={layerPopupSwitch[layerName]}
                          onChange={(e) =>
                            handleLayerPopup(layerName, e.target.checked)
                          }
                        />
                      </th>
                      <th className="text-center">Variable Input Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attributes[layerName].map(({ name, alias }, index) => (
                      <tr key={index}>
                        <OverflowTD>{name}</OverflowTD>
                        <OverflowTD>{alias}</OverflowTD>
                        <CenteredTD>
                          <input
                            type="checkbox"
                            checked={
                              attributes[layerName][index]["popup"] ?? true
                            }
                            onChange={(e) => {
                              updateAttributes(
                                index,
                                layerName,
                                "popup",
                                e.target.checked
                              );
                            }}
                          />
                        </CenteredTD>
                        <td>
                          <StyledInput
                            value={
                              attributes[layerName][index]["variableInput"]
                            }
                            onChange={(e) => {
                              updateAttributes(
                                index,
                                layerName,
                                "variableInput",
                                e.target.value
                              );
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </FixedTable>
              </div>
            ))
          ) : (
            Object.keys(attributes).map((layerName) => (
              <InputTable
                label={layerName}
                onChange={(e) => handleAttributeChange(e, layerName)}
                values={attributes[layerName]}
                allowRowCreation={true}
              />
            ))
          )}
        </>
      )}
    </>
  );
};

AttributesPane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default AttributesPane;
