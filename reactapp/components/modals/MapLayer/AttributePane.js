import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import DataInput from "components/inputs/DataInput";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";
import { getLayerAttributes } from "components/backlayer/layer/Layer";
import Spinner from "react-bootstrap/Spinner";
import {
  valuesEqual,
  objectToArray,
  arrayToObject,
} from "components/modals/utilities";
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

function getNonEmptyValues(obj) {
  const newObj = {};
  for (const key in obj) {
    newObj[key] = {};
    for (const nestedKey in obj[key]) {
      const variableInputName = obj[key][nestedKey];
      if (variableInputName) {
        newObj[key][nestedKey] = variableInputName;
      }
    }
  }

  for (const key in newObj) {
    if (!Object.keys(newObj[key]).length) {
      delete newObj[key];
    }
  }
  return newObj;
}

const AttributePane = ({ layerInfo, setLayerInfo, tabKey }) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const [attributes, setAttributes] = useState({});
  const previouslayerInfo = useRef({});
  const [attributeVariables, setAttributesVariables] = useState(
    layerInfo.attributeVariables ?? {}
  );
  const [automatedAttributes, setAutomatedAttributes] = useState(null);

  useEffect(() => {
    const layerAttributeValues = {
      url: layerInfo.url,
      params: layerInfo.params,
    };
    if (
      tabKey === "attributes" &&
      !valuesEqual(previouslayerInfo.current, layerAttributeValues)
    ) {
      previouslayerInfo.current = layerAttributeValues;
      setAttributes({});
      queryLayerAttributes().then((layerAttributes) => {
        if (layerAttributes === undefined) {
          setAutomatedAttributes(false);
          const lowercaseLayerParams = Object.keys(layerInfo.params).reduce(
            (acc, key) => {
              acc[key.toLowerCase()] = layerInfo.params[key];
              return acc;
            },
            {}
          );
          const potentialLayers = lowercaseLayerParams?.layers ?? "";
          const transformedLayers = potentialLayers
            .split(",")
            .map((layer) => layer.replace(/^[^:]*:/, ""));
          const layerAttributes = {};
          for (const layerName of transformedLayers) {
            const attributeVariables = [];
            if (
              layerName in layerInfo.attributeVariables &&
              Object.keys(layerInfo.attributeVariables[layerName]).length > 0
            ) {
              for (const fieldName in layerInfo.attributeVariables[layerName]) {
                attributeVariables.push({
                  "Field Name": fieldName,
                  "Variable Input Name":
                    layerInfo.attributeVariables[layerName][fieldName],
                });
              }
            } else {
              attributeVariables.push({
                "Field Name": "",
                "Variable Input Name": "",
              });
            }
            layerAttributes[layerName] = attributeVariables;
          }

          setAttributes(layerAttributes);
        } else {
          setAutomatedAttributes(true);
        }
      });
    }
  }, [tabKey]);

  function updateAttributeVariables(alias, layerName, variableInputName) {
    const updatedAttributeVariables = JSON.parse(
      JSON.stringify(attributeVariables)
    );
    updatedAttributeVariables[layerName][alias] = variableInputName;
    setAttributesVariables(updatedAttributeVariables);

    updateLayerInfo(updatedAttributeVariables);
  }

  function updateLayerInfo(updatedAttributeVariables) {
    const validAttributeValues = getNonEmptyValues(updatedAttributeVariables);
    setLayerInfo((previousLayerInfo) => ({
      ...previousLayerInfo,
      ...{ attributeVariables: validAttributeValues },
    }));
  }

  async function queryLayerAttributes() {
    setWarningMessage(null);
    if (!layerInfo.url || !layerInfo.layerType) {
      setWarningMessage(
        "A Layer Type and URL must be set in the Configuration to get attributes"
      );
      return;
    }
    let layerAttributes;
    try {
      layerAttributes = await getLayerAttributes(layerInfo);
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
    setAttributes(layerAttributes);
    refreshAttributeVariables(layerAttributes);

    return layerAttributes;
  }

  function refreshAttributeVariables(layerAttributes) {
    const newObj = {};
    for (const layerName in layerAttributes) {
      newObj[layerName] = {};
      for (const layerAttribute of layerAttributes[layerName]) {
        const alias = layerAttribute.alias ?? layerAttribute.Alias;
        const existingValue =
          attributeVariables[layerName] && attributeVariables[layerName][alias];
        newObj[layerName][alias] = existingValue ?? "";
      }
    }
    setAttributesVariables(newObj);
  }

  function handleAttributeChange(fields, layerName) {
    const newAttributes = JSON.parse(JSON.stringify(attributes));
    newAttributes[layerName] = fields;
    setAttributes(newAttributes);

    // only update variables when all inputs are filled out
    if (
      fields.every((obj) => Object.values(obj).every((value) => value !== ""))
    ) {
      const updatedAttributeVariables = JSON.parse(
        JSON.stringify(attributeVariables)
      );
      if (!(layerName in updatedAttributeVariables)) {
        updatedAttributeVariables[layerName] = {};
      }
      for (const field of fields) {
        updatedAttributeVariables[layerName][field["Field Name"]] =
          field["Variable Input Name"];
      }
      setAttributesVariables(updatedAttributeVariables);
      updateLayerInfo(updatedAttributeVariables);
    }
  }

  return (
    <>
      {warningMessage && (
        <>
          <Alert key="warning" variant="warning" dismissible>
            {warningMessage}
          </Alert>
          {}
        </>
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
                  <th className="text-center">Variable Input Name</th>
                </tr>
              </thead>
              <tbody>
                {attributes[layerName].map(({ name, alias }, index) => (
                  <tr key={index}>
                    <OverflowTD>{name}</OverflowTD>
                    <OverflowTD>{alias}</OverflowTD>
                    <td>
                      <StyledInput
                        value={attributeVariables[layerName][alias]}
                        onChange={(e) => {
                          updateAttributeVariables(
                            alias,
                            layerName,
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
          <DataInput
            objValue={{
              label: layerName,
              type: "inputtable",
              value: attributes[layerName],
            }}
            onChange={(e) => handleAttributeChange(e, layerName)}
          />
        ))
      )}
    </>
  );
};

AttributePane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default AttributePane;
