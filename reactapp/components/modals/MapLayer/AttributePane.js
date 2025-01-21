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
  removeEmptyStringsFromObject,
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
  const previousSourceProps = useRef({});
  const [attributeVariables, setAttributesVariables] = useState(
    layerInfo.attributeVariables ?? {}
  );
  const [automatedAttributes, setAutomatedAttributes] = useState(null);
  const [disabledFields, setDisabledFields] = useState([]);

  useEffect(() => {
    if (tabKey === "attributes") {
      const validSourceProps = removeEmptyStringsFromObject(
        layerInfo.sourceProps
      );
      if (
        tabKey === "attributes" &&
        !valuesEqual(previousSourceProps.current, validSourceProps)
      ) {
        setAutomatedAttributes(null);
        setWarningMessage(null);
        setDisabledFields([]);

        previousSourceProps.current = validSourceProps;
        setAttributes({});
        let attributeVariables = [];

        if (layerInfo.layerType === "GeoJSON") {
          try {
            JSON.parse(layerInfo.geojson);
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
          const layerParams = layerInfo.sourceProps?.params ?? [];
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
              if (
                layerName in layerInfo.attributeVariables &&
                Object.keys(layerInfo.attributeVariables[layerName]).length > 0
              ) {
                for (const fieldName in layerInfo.attributeVariables[
                  layerName
                ]) {
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
          } else {
            setWarningMessage("No field attributes were found.");
            return;
          }
        });
      }
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
    setLayerInfo((previousSourceProps) => ({
      ...previousSourceProps,
      ...{ attributeVariables: validAttributeValues },
    }));
  }

  async function queryLayerAttributes() {
    setWarningMessage(null);
    if (!layerInfo.layerType) {
      setWarningMessage(
        "A Layer Type must be set in the Configuration to get attributes"
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
          <InputTable
            label={layerName}
            onChange={(e) => handleAttributeChange(e, layerName)}
            values={attributes[layerName]}
          />
          // <DataInput
          //   objValue={{
          //     label: layerName,
          //     type: "inputtable",
          //     value: attributes[layerName],
          //   }}
          //   onChange={(e) => handleAttributeChange(e, layerName)}
          //   inputProps={{ disabledFields }}
          // />
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
