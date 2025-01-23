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

const AttributeVariablesPane = ({
  attributeVariables,
  setAttributeVariables,
  configuration,
  tabKey,
}) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const attributeVariableValues = useRef(attributeVariables);
  const previousSourceProps = useRef({});
  const [automatedAttributes, setAutomatedAttributes] = useState(null);

  useEffect(() => {
    if (tabKey === "attributeVariables") {
      const validSourceProps = removeEmptyStringsFromObject(
        configuration.sourceProps
      );
      if (!valuesEqual(previousSourceProps.current, validSourceProps)) {
        setAutomatedAttributes(null);
        setWarningMessage(null);
        previousSourceProps.current = validSourceProps;

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
                layerName in attributeVariables &&
                Object.keys(attributeVariables[layerName]).length > 0
              ) {
                for (const fieldName in attributeVariables[layerName]) {
                  newAttributeVariables.push({
                    "Field Name": fieldName,
                    "Variable Input Name":
                      attributeVariables[layerName][fieldName],
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
            setAttributeVariables(layerAttributes);
            attributeVariableValues.current =
              extractVariableInputNames(layerAttributes);
          } else {
            setWarningMessage("No field attributes were found.");
            setAttributeVariables({});
            attributeVariableValues.current = {};
            return;
          }
        });
      }
    }
  }, [tabKey]);

  function updateAttributeVariables(index, layerName, variableInputName) {
    const updatedAttributeVariables = JSON.parse(
      JSON.stringify(attributeVariables)
    );
    updatedAttributeVariables[layerName][index]["Variable Input Name"] =
      variableInputName;
    setAttributeVariables(updatedAttributeVariables);
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

    return layerAttributes;
  }

  function appendExistingAttributeVariables(layerAttributes) {
    const newObj = {};
    for (const layerName in layerAttributes) {
      newObj[layerName] = [];
      for (const layerAttribute of layerAttributes[layerName]) {
        const alias = layerAttribute.alias ?? layerAttribute.Alias;
        const existingValue =
          attributeVariableValues.current[layerName] &&
          attributeVariableValues.current[layerName][alias];
        layerAttribute["Variable Input Name"] = existingValue ?? "";
        newObj[layerName].push(layerAttribute);
      }
    }

    return newObj;
  }

  function handleAttributeChange(fields, layerName) {
    const newAttributes = JSON.parse(JSON.stringify(attributeVariables));
    newAttributes[layerName] = fields;

    // only update variables when all inputs are filled out
    if (
      fields.every((obj) => Object.values(obj).every((value) => value !== ""))
    ) {
      const updatedAttributeVariables = JSON.parse(
        JSON.stringify(attributeVariables)
      );
      if (!(layerName in updatedAttributeVariables)) {
        updatedAttributeVariables[layerName] = [];
      }
      for (const field of fields) {
        updatedAttributeVariables[layerName].push({
          "Field Name": field["Field Name"],
          "Variable Input Name": field["Variable Input Name"],
        });
      }
      setAttributeVariables(updatedAttributeVariables);
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
        Object.keys(attributeVariables).map((layerName) => (
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
                {attributeVariables[layerName].map(({ name, alias }, index) => (
                  <tr key={index}>
                    <OverflowTD>{name}</OverflowTD>
                    <OverflowTD>{alias}</OverflowTD>
                    <td>
                      <StyledInput
                        value={
                          attributeVariables[layerName][index][
                            "Variable Input Name"
                          ]
                        }
                        onChange={(e) => {
                          updateAttributeVariables(
                            index,
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
        Object.keys(attributeVariables).map((layerName) => (
          <InputTable
            label={layerName}
            onChange={(e) => handleAttributeChange(e, layerName)}
            values={attributeVariables[layerName]}
          />
        ))
      )}
    </>
  );
};

AttributeVariablesPane.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node,
    PropTypes.object,
  ]),
  showModal: PropTypes.bool,
  handleModalClose: PropTypes.func,
};

export default AttributeVariablesPane;
