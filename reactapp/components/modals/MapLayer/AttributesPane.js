import PropTypes from "prop-types";
import { useState, useRef, useEffect } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";
import {
  getLayerAttributes,
  sourcePropertiesOptions,
  attributeVariablesPropType,
  omittedPopupAttributesPropType,
  sourcePropType,
} from "components/map/utilities";
import Spinner from "react-bootstrap/Spinner";
import {
  valuesEqual,
  checkRequiredKeys,
  removeEmptyValues,
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
  sourceProps,
  layerProps,
  tabKey,
}) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [attributes, setAttributes] = useState({});
  const attributeVariableValues = useRef(attributeVariables ?? {});
  const omittedPopupAttributesValues = useRef(omittedPopupAttributes ?? {});
  const previousSourceProps = useRef({});
  const [customAttributes, setCustomAttributes] = useState(null);
  const [layerPopupSwitch, setLayerPopupSwitch] = useState({});

  useEffect(() => {
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

      // make sure all the required source properties are being supplied
      const validSourceProps = removeEmptyValues(sourceProps.props);
      const missingRequiredProps = checkRequiredKeys(
        sourcePropertiesOptions[sourceProps.type].required,
        validSourceProps
      );
      if (missingRequiredProps.length > 0) {
        setErrorMessage(
          `Missing required ${missingRequiredProps} arguments. Please check the source and try again before getting attributes`
        );
        return;
      }

      // make sure a valid json is supplied if the source is GeoJSON
      if (sourceProps.type === "GeoJSON") {
        try {
          JSON.parse(sourceProps.geojson);
        } catch (err) {
          setCustomAttributes(false);
          setErrorMessage(
            <>
              <p>
                Invalid json is being used. Please alter the json and try again.
              </p>
              <br />
              <br />
              <p>{err.message}</p>
            </>
          );
          return;
        }
      }

      // only run if source props have changed
      if (!valuesEqual(previousSourceProps.current, sourceProps)) {
        setCustomAttributes(null);
        previousSourceProps.current = JSON.parse(JSON.stringify(sourceProps));

        // query attributes from the source props url
        queryLayerAttributes().then((queriedLayerAttributes) => {
          let layerAttributes = {};

          // if attributes were returned from the query, use them and move on
          if (queriedLayerAttributes) {
            setCustomAttributes(true);

            // remove an layers where no attributes were found
            layerAttributes = Object.fromEntries(
              Object.entries(queriedLayerAttributes).filter(
                ([_, value]) => !(Array.isArray(value) && value.length === 0)
              )
            );

            // if the query failed, allow the user to create their own fields for configuration
          } else {
            setCustomAttributes(false);

            // lowercase layerParams to make sure a key isnt missed from capitalization
            const validSourceProps = removeEmptyValues(sourceProps.props);
            const layerParams = validSourceProps?.params ?? [];
            const lowercaseLayerParams = Object.keys(layerParams).reduce(
              (acc, key) => {
                acc[key.toLowerCase()] = layerParams[key];
                return acc;
              },
              {}
            );

            // Check params for potential layers, otherwise just use the layer name
            const potentialLayers =
              lowercaseLayerParams?.layers ?? layerProps.name;

            // split layers based on a comma delimited list. For WMS, extract the layer name from the namespace (topp:states for example)
            const layers = potentialLayers
              .split(",")
              .map((layer) => layer.replace(/^[^:]*:/, ""));

            // loop through each potential layer and setup custom attributes
            for (const layerName of layers) {
              let newAttributes = [];

              // check to see if there are any current attributes or ommitted popups setup for the layer
              const existingLayerattributeVariableFields = Object.keys(
                attributeVariableValues.current[layerName] || {}
              );
              const existingOmittedPopupAttributesFields =
                omittedPopupAttributesValues.current[layerName] || [];

              // get a unique array of attributes already configured for either popups or attributes
              const existingAttributes = [
                ...new Set([
                  ...existingLayerattributeVariableFields,
                  ...existingOmittedPopupAttributesFields,
                ]),
              ];

              // if preexisting attributes, then create a new attribute for each one. otherwise just create a single new attribute
              if (existingAttributes.length > 0) {
                for (const existingAttribute of existingAttributes) {
                  newAttributes.push({
                    name: existingAttribute,
                  });
                }
              } else {
                newAttributes.push({
                  name: "",
                });
              }

              // add the set of attributes for the layerName
              layerAttributes[layerName] = newAttributes;
            }
          }

          // add a popup and variableInput field, using preexisting values if possible
          layerAttributes = appendExistingVariablesAndPopups(layerAttributes);

          // check to see what the header popup switch should be. If all field popups are false, then the header switch should be false
          let popupSwitchValues;
          if (Object.keys(layerAttributes).length > 0) {
            popupSwitchValues = Object.fromEntries(
              Object.entries(layerAttributes).map(([key, value]) => [
                key,
                !value.every((item) => item.popup === false), // false if all popups are false, true otherwise
              ])
            );
          } else {
            setWarningMessage("No field attributes were found.");
            layerAttributes = {};
            popupSwitchValues = {};
          }

          // set states and refs after processing all done
          setAttributes(layerAttributes);
          setLayerPopupSwitch(popupSwitchValues);
          attributeVariableValues.current =
            extractVariableInputs(layerAttributes);
          omittedPopupAttributesValues.current =
            extractFalsePopups(layerAttributes);
        });
      }
    }
    // eslint-disable-next-line
  }, [tabKey]);

  async function queryLayerAttributes() {
    // query source endpoints for attributes
    try {
      return await getLayerAttributes(sourceProps, layerProps.name);
    } catch (error) {
      setWarningMessage(
        <>
          <p>{error.message}</p>
          <br />
          <p>
            Please provide the desired fields manually below or attempt to fix
            the issues and retry.
          </p>
        </>
      );
      return;
    }
  }

  function appendExistingVariablesAndPopups(layerAttributes) {
    const newObj = {};

    // loop through layers
    for (const layerName in layerAttributes) {
      newObj[layerName] = [];

      // loop through layer attributes and append a popup and variableInput field, using existing configuration if possible
      for (const layerAttribute of layerAttributes[layerName]) {
        const name = layerAttribute.name;

        // check to see if the attribute is already being omitted in the popup
        const existingPopup =
          !omittedPopupAttributesValues.current[layerName] ||
          !omittedPopupAttributesValues.current[layerName].includes(name);
        layerAttribute["popup"] = existingPopup;

        // check to see if the attribute is already configured for a variable
        const existingvariableInput =
          attributeVariableValues.current[layerName] &&
          attributeVariableValues.current[layerName][name];
        layerAttribute["variableInput"] = existingvariableInput ?? "";

        newObj[layerName].push(layerAttribute);
      }
    }

    return newObj;
  }

  function extractVariableInputs(layerData) {
    const result = {};

    // check each layer and its attributes to extract any configured variable inputs
    Object.entries(layerData).forEach(([layerName, layerAttributes]) => {
      const extractedAttributeVariables = layerAttributes.reduce(
        (acc, { name, variableInput }) => {
          // only add if the name and variable input are configured
          if (name && variableInput) {
            acc[name] = variableInput;
          }
          return acc;
        },
        {}
      );

      // only add to the result if there are actually attribute variables for the layer
      if (Object.keys(extractedAttributeVariables).length > 0) {
        result[layerName] = extractedAttributeVariables;
      }
    });

    return result;
  }

  function extractFalsePopups(layerData) {
    const result = {};

    Object.keys(layerData).forEach((LayerName) => {
      const falsePopupNames = layerData[LayerName].filter(
        ({ popup }) => popup === false
      ) // Get items where popup is false
        .map(({ name }) => name) // Extract name values
        .filter(Boolean); // Remove falsy values

      // only add to result if there are actually any false popups
      if (falsePopupNames.length > 0) {
        result[LayerName] = falsePopupNames;
      }
    });

    return result;
  }

  function updateAttributes({
    index,
    layerName,
    field,
    fieldChange,
    fullChange,
  }) {
    const updatedAttributes = JSON.parse(JSON.stringify(attributes));
    // make a deep copy of the attributes to actually cause a rerender on state change
    if (fullChange) {
      updatedAttributes[layerName] = fullChange;
    } else {
      updatedAttributes[layerName][index][field] = fieldChange;
    }
    setAttributes(updatedAttributes);

    // extract attribute variables and set state and ref
    attributeVariableValues.current = extractVariableInputs(updatedAttributes);
    setAttributeVariables(attributeVariableValues.current);

    // extract omitted popups and set state and ref
    omittedPopupAttributesValues.current =
      extractFalsePopups(updatedAttributes);
    setOmittedPopupAttributes(omittedPopupAttributesValues.current);

    // if a popup is being altered, check to see if the header checkbox needs to be updated
    if (field === "popup") {
      // make a deep copy of the layerPopupSwitch to actually cause a rerender on state change
      const updatedLayerPopupSwitch = JSON.parse(
        JSON.stringify(layerPopupSwitch)
      );

      // if any field popup is true, then the header checkbox is true
      updatedLayerPopupSwitch[layerName] = updatedAttributes[layerName].some(
        ({ popup }) => popup
      );

      setLayerPopupSwitch(updatedLayerPopupSwitch);
    }
  }

  function handleLayerPopup(layerName, checkedValue) {
    // update the header checkbox
    const updatedLayerPopupSwitch = JSON.parse(
      JSON.stringify(layerPopupSwitch)
    );
    updatedLayerPopupSwitch[layerName] = checkedValue;
    setLayerPopupSwitch(updatedLayerPopupSwitch);

    // update the attributes layername and make all ppup values be the same as the header checkbox
    const updatedAttributes = {
      ...attributes,
      [layerName]: attributes[layerName].map((layerAttributes) => ({
        ...layerAttributes,
        popup: checkedValue,
      })),
    };

    // update states and refs
    omittedPopupAttributesValues.current =
      extractFalsePopups(updatedAttributes);
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
          {customAttributes === null ? (
            <StyledSpinner
              data-testid="Loading..."
              animation="border"
              variant="info"
            />
          ) : customAttributes ? (
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
                            checked={attributes[layerName][index]["popup"]}
                            onChange={(e) => {
                              updateAttributes({
                                index,
                                layerName,
                                field: "popup",
                                fieldChange: e.target.checked,
                              });
                            }}
                          />
                        </CenteredTD>
                        <td>
                          <StyledInput
                            value={
                              attributes[layerName][index]["variableInput"]
                            }
                            onChange={(e) => {
                              updateAttributes({
                                index,
                                layerName,
                                field: "variableInput",
                                fieldChange: e.target.value,
                              });
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
            Object.keys(attributes).map((layerName, index) => (
              <InputTable
                key={index}
                label={layerName}
                onChange={({ newValue, field, fullChange }) =>
                  updateAttributes({
                    index,
                    layerName,
                    field,
                    fieldChange: newValue,
                    fullChange: fullChange,
                  })
                }
                values={attributes[layerName]}
                allowRowCreation={true}
                headers={["Name", "Show in popup", "Variable Input Name"]}
              />
            ))
          )}
        </>
      )}
    </>
  );
};

AttributesPane.propTypes = {
  attributeVariables: attributeVariablesPropType, // react state that tracks what attributes are configured for variables
  setAttributeVariables: PropTypes.func.isRequired, // state setter for attributeVariables
  omittedPopupAttributes: omittedPopupAttributesPropType, // react state that tracks what attributes are not shown in popups
  setOmittedPopupAttributes: PropTypes.func.isRequired, // state setter for omittedPopupAttributes
  sourceProps: sourcePropType, // configuration and properties for openlayers layer source
  layerProps: PropTypes.shape({
    name: PropTypes.string,
  }), // configuration and properties for openlayers layer
  tabKey: PropTypes.string.isRequired, // react state that tracks what tab is shown
};

export default AttributesPane;
