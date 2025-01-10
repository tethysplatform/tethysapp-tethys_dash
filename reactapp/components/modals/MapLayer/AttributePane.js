import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";
import { getLayerAttributes } from "components/backlayer/layer/Layer";
import Spinner from "react-bootstrap/Spinner";
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

const AttributePane = ({ layerInfo, setLayerInfo, containerRef, tabKey }) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const [attributes, setAttributes] = useState({});
  const previousUrl = useRef("");
  const [attributeVariables, setAttributesVariables] = useState(
    layerInfo.attributeVariables ?? {}
  );

  useEffect(() => {
    if (tabKey === "attributes" && previousUrl.current !== layerInfo.url) {
      previousUrl.current = layerInfo.url;
      setAttributes({});
      queryLayerAttributes();
    }
  }, [tabKey]);

  function updateAttributeVariables(alias, layerName, variableInputName) {
    const updatedAttributeVariable = JSON.parse(
      JSON.stringify(attributeVariables)
    );
    updatedAttributeVariable[layerName][alias] = variableInputName;
    setAttributesVariables(updatedAttributeVariable);

    const validAttributeValues = getNonEmptyValues(updatedAttributeVariable);
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
    const layerAttributes = await getLayerAttributes(
      layerInfo.url,
      layerInfo.layerType
    );
    setAttributes(layerAttributes);
    refreshAttributeVariables(layerAttributes);
  }

  function refreshAttributeVariables(layerAttributes) {
    const newObj = {};
    for (const key in layerAttributes) {
      newObj[key] = {};
      for (const { alias } of layerAttributes[key]) {
        const existingValue =
          attributeVariables[key] && attributeVariables[key][alias];
        newObj[key][alias] = existingValue ?? "";
      }
    }
    setAttributesVariables(newObj);
  }

  return (
    <>
      {warningMessage && (
        <Alert key="warning" variant="warning">
          {warningMessage}
        </Alert>
      )}
      {attributes ? (
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
        <StyledSpinner
          data-testid="Loading..."
          animation="border"
          variant="info"
        />
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
