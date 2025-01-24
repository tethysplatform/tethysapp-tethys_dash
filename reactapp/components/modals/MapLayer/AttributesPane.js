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
} from "components/modals/utilities";
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

const AttributesPane = ({
  attributeVariables,
  setAttributeVariables,
  omittedPopupAttributes,
  setOmittedPopupAttributes,
  configuration,
  tabKey,
}) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const [attributes, setAttributes] = useState({});
  const attributeVariableValues = useRef(attributeVariables);
  const omittedPopupAttributesValues = useRef(omittedPopupAttributes);
  const previousConfiguration = useRef({});
  const [automatedAttributes, setAutomatedAttributes] = useState(null);

  useEffect(() => {
    if (tabKey === "attributes") {
      if (!valuesEqual(previousConfiguration.current, configuration)) {
        setAutomatedAttributes(null);
        setWarningMessage(null);
        previousConfiguration.current = JSON.parse(
          JSON.stringify(configuration)
        );

        if (configuration.layerType === "GeoJSON") {
          try {
            JSON.parse(configuration.geojson);
          } catch (err) {
            setAutomatedAttributes(false);
            setWarningMessage(
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
          const layerParams = configuration.sourceProps?.params ?? [];
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
              let newAttributeVariables = [];
              if (
                layerName in attributes &&
                Object.keys(attributes[layerName]).length > 0
              ) {
                for (const fieldName in attributes[layerName]) {
                  newAttributeVariables.push({
                    "Field Name": fieldName,
                    "Variable Input Name": attributes[layerName][fieldName],
                  });
                }
              } else {
                newAttributeVariables.push({
                  "Field Name": "",
                  "Variable Input Name": "",
                });
              }
              layerAttributes[layerName] = newAttributeVariables;
            }
          } else {
            layerAttributes = queriedLayerAttributes;
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
          } else {
            setWarningMessage("No field attributes were found.");
            setAttributes({});
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
    }
  }

  async function queryLayerAttributes() {
    setWarningMessage(null);
    if (!configuration.layerType) {
      setWarningMessage(
        "A Layer Type must be set in the Configuration to get attributes"
      );
      return;
    }
    let layerAttributes;
    try {
      layerAttributes = await getLayerAttributes(configuration);
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

    // only update variables when all inputs are filled out
    if (
      fields.every((obj) => Object.values(obj).every((value) => value !== ""))
    ) {
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

        omittedPopupAttributesValues.current[layerName].push(
          field["Field Name"]
        );
        setOmittedPopupAttributes(omittedPopupAttributesValues.current);
      }
    }
  }

  return (
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
        Object.keys(attributes).map((layerName) => (
          <>
            <p>
              <b>{layerName}</b>:{" "}
            </p>
            <FixedTable striped bordered hover size="sm">
              <thead>
                <tr>
                  <th className="text-center" style={{ width: "33%" }}>
                    Name
                  </th>
                  <th className="text-center" style={{ width: "33%" }}>
                    Alias
                  </th>
                  <th className="text-center" style={{ width: "10%" }}>
                    Show in popup
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
                        checked={attributes[layerName][index]["popup"] ?? true}
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
                        value={attributes[layerName][index]["variableInput"]}
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
          </>
        ))
      ) : (
        Object.keys(attributes).map((layerName) => (
          <InputTable
            label={layerName}
            onChange={(e) => handleAttributeChange(e, layerName)}
            values={attributes[layerName]}
          />
        ))
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
