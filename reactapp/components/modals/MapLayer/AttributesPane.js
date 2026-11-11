import PropTypes from "prop-types";
import { useState, useRef, useEffect, memo, useContext } from "react";
import Table from "react-bootstrap/Table";
import styled from "styled-components";
import Alert from "react-bootstrap/Alert";
import {
  getLayerAttributes,
  sourcePropertiesOptions,
  attributePropsPropType,
  sourcePropType,
  orderAttributeNames,
  isClickEnabled,
  isHoverEnabled,
  hoverFieldFilter,
} from "components/map/utilities";
import CheckboxInput from "components/inputs/CheckboxInput";
import Spinner from "react-bootstrap/Spinner";
import Button from "react-bootstrap/Button";
import {
  valuesEqual,
  checkRequiredKeys,
  removeEmptyValues,
} from "components/modals/utilities";
import InputTable from "components/inputs/InputTable";
import RowMoveButtons, {
  moveRow,
  useRowMoveFocus,
} from "components/inputs/RowMoveButtons";
import "components/modals/wideModal.css";
import JSON5 from "json5";
import { AppContext } from "components/contexts/Contexts";
import { findSelectOptionByValue } from "components/visualizations/utilities";

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

const UrlLoadBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const Hint = styled.span`
  font-size: 0.85rem;
  color: #6c757d;
`;

const EventToggles = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem 1.5rem;
  margin-bottom: 0.75rem;
`;

// The row fields that decide which events a discovered table turns on. An
// alias or a move changes neither.
const EVENT_FIELDS = ["click", "hover", "variableInput"];

// The popup type a pair of on/off events saves as.
function popupTypeFor(clickOn, hoverOn) {
  if (clickOn && hoverOn) return "both";
  if (clickOn) return "click";
  return hoverOn ? "hover" : "none";
}

// Each sublayer's named rows that pass `keep`, as field names. A sublayer with
// none is left out unless `everySublayer` is set, which hover's lists need:
// whether their key is present at all is what tells the runtime which kind of
// list it is reading (see hoverFieldFilter), so an empty one still counts.
function extractFieldNames(layerData, keep, everySublayer = false) {
  const result = {};
  Object.entries(layerData).forEach(([layerName, rows]) => {
    const names = rows
      .filter(keep)
      .map(({ name }) => name)
      .filter(Boolean);
    if (everySublayer || names.length > 0) {
      result[layerName] = names;
    }
  });
  return result;
}

/**
 * The attribute props with the popup fields the rows describe: the click
 * table's omitted fields, hover's list and the popup type. They are written
 * together, so the props never hold a click list that has moved on while
 * hover still falls back to the old one.
 *
 * @param {object} previous The attribute props to update.
 * @param {object} layerData The rows, by sublayer.
 * @param {boolean} discovered Whether the rows are the layer's discovered
 *   fields rather than hand-entered ones.
 * @param {{clickOn: boolean, hoverOn: boolean}} [events] Which events are on.
 *   Left out, the popup type the props already have stands.
 * @returns {object}
 */
function withPopupFields(previous, layerData, discovered, events) {
  const clickOn = events ? events.clickOn : isClickEnabled(previous);
  const hoverOn = events ? events.hoverOn : isHoverEnabled(previous);
  // Legacy `queryable` and the previous type and hover lists are dropped, so
  // nothing stale is left behind.
  const {
    queryable: _legacyQueryable,
    tablePopupType: _previousTablePopupType,
    hover: _previousHover,
    omittedHover: _previousOmittedHover,
    ...rest
  } = previous;
  const next = {
    ...rest,
    // A discovered table with click off has every click box unchecked, and
    // listing every field as omitted would say nothing the type does not. A
    // hand-entered click column keeps its values while its toggle is off.
    omitted:
      discovered && !clickOn
        ? {}
        : extractFieldNames(layerData, (row) => !row.click),
  };
  if (hoverOn) {
    // Discovered fields are all on screen, so hover names the ones it shows
    // and a field the source adds later stays off the tooltip. Hand-entered
    // rows are only the fields the author typed in, so hover hides the ones
    // unchecked and shows everything else the layer returns.
    if (discovered) {
      next.hover = extractFieldNames(layerData, (row) => row.hover, true);
    } else {
      next.omittedHover = extractFieldNames(
        layerData,
        (row) => !row.hover,
        true,
      );
    }
  }
  const tablePopupType = popupTypeFor(clickOn, hoverOn);
  // "click" is the default, and is left unwritten as it always has been.
  return tablePopupType === "click" ? next : { ...next, tablePopupType };
}

const AttributesPane = ({
  attributeProps,
  setAttributeProps,
  sourceProps,
  layerProps,
  tabKey,
  shapefileDiscovery,
  openedPopupType,
}) => {
  const [warningMessage, setWarningMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [attributes, setAttributes] = useState({});
  const previousSourceProps = useRef({});
  const previousAttributeProps = useRef({});
  const [customAttributes, setCustomAttributes] = useState(null);
  const [focusRequestFor, requestFocus] = useRowMoveFocus();
  const { dynamicMapLayers } = useContext(AppContext);
  const clickOn = isClickEnabled(attributeProps);
  const hoverOn = isHoverEnabled(attributeProps);

  const isUrlGeoJSON =
    sourceProps?.type === "GeoJSON" &&
    typeof sourceProps?.geojson === "string" &&
    sourceProps.geojson.trim() !== "" &&
    !sourceProps.geojson.trim().startsWith("{");

  useEffect(() => {
    if (tabKey === "attributes") {
      setWarningMessage(null);
      setErrorMessage(null);

      if (!layerProps.name) {
        setErrorMessage(
          "The layer name must be configured to retrieve attributes",
        );
        return;
      }

      if (!sourceProps.type) {
        setErrorMessage(
          "The source type must be configured to retrieve attributes",
        );
        return;
      }

      // make sure all the required source properties are being supplied
      const validSourceProps = removeEmptyValues(sourceProps.props);
      const missingRequiredProps = checkRequiredKeys(
        sourcePropertiesOptions[sourceProps.type]?.required,
        validSourceProps,
      );
      if (missingRequiredProps.length > 0) {
        setErrorMessage(
          `Missing required ${missingRequiredProps} arguments. Please check the source and try again before getting attributes`,
        );
        return;
      }

      // make sure a valid json is supplied if the source is GeoJSON. A source
      // switched to GeoJSON has no `geojson` until some is typed or uploaded.
      if (
        sourceProps.type === "GeoJSON" &&
        typeof sourceProps.geojson === "string" &&
        sourceProps.geojson.trim().startsWith("{")
      ) {
        try {
          JSON5.parse(sourceProps.geojson);
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
            </>,
          );
          return;
        }
      }

      // only run if source props have changed
      if (!valuesEqual(previousSourceProps.current, sourceProps)) {
        setCustomAttributes(null);
        previousSourceProps.current = JSON.parse(JSON.stringify(sourceProps));

        if (isUrlGeoJSON) {
          applyLayerAttributes(null);
          return;
        }

        // A shapefile's fields come from the shared, author-triggered read in
        // the Source tab, so opening this tab must not start a multi-megabyte
        // download of its own. Whatever that read found is applied below.
        if (shapefileDiscovery?.isShapefile) {
          applyLayerAttributes(
            shapefileDiscovery.state === "ready"
              ? {
                  [layerProps.name]: shapefileDiscovery.fields.map((field) => ({
                    name: field,
                    alias: field,
                  })),
                }
              : null,
          );
          return;
        }

        // query attributes from the source props url
        queryLayerAttributes().then(applyLayerAttributes);
      }
    }
    // shapefileDiscovery is a dependency because the read is triggered from the
    // Source tab: an author who opens Attributes first, then goes back and reads
    // the fields, would otherwise never see them here -- the transition to
    // "ready" is not a sourceProps change. StylePane's effect already lists it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tabKey,
    sourceProps,
    shapefileDiscovery?.state,
    shapefileDiscovery?.fields,
  ]);

  useEffect(() => {
    if (!valuesEqual(previousAttributeProps.current, attributeProps)) {
      previousAttributeProps.current = JSON.parse(
        JSON.stringify(attributeProps),
      );
      parseAttributes(attributes, customAttributes === true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attributeProps]);

  // Seed each row's settings from the attribute props, set the rows, and
  // return them.
  function parseAttributes(layerAttributes, discovered) {
    // add the click, hover and variableInput fields, using preexisting values if possible
    layerAttributes = appendExistingVariablesAliasesAndPopups(
      layerAttributes,
      discovered,
    );

    setAttributes(layerAttributes);
    return layerAttributes;
  }

  // Which events a discovered table's columns turn on. Each is on while at
  // least one of its boxes is checked, with one exception: a layer that
  // answers an event only to update its variable inputs hides every field
  // from it, so that event stays on while the layer links variables and the
  // other event has no box checked. Only the event the layer answered when the
  // editor opened it qualifies -- click for a click or both layer, hover for a
  // hover-only one, the only kind whose hover updates variables -- so the two
  // never both apply, and re-saving a None layer that links variables leaves
  // it off.
  function deriveEvents(layerData) {
    const rows = Object.values(layerData).flat();
    const clickChecked = rows.some((row) => row.click);
    const hoverChecked = rows.some((row) => row.hover);
    const linksVariables =
      Object.keys(extractVariableInputs(layerData)).length > 0;
    return {
      clickOn:
        clickChecked ||
        (!hoverChecked &&
          linksVariables &&
          isClickEnabled({ tablePopupType: openedPopupType })),
      hoverOn:
        hoverChecked ||
        (!clickChecked && linksVariables && openedPopupType === "hover"),
    };
  }

  async function queryLayerAttributes() {
    const isDynamicMapLayer = findSelectOptionByValue(
      dynamicMapLayers,
      sourceProps.type,
    );
    // query source endpoints for attributes
    try {
      return await getLayerAttributes({
        sourceProps,
        layerName: layerProps.name,
        isDynamicMapLayer,
      });
    } catch (error) {
      setWarningMessage(
        <>
          <p>{error.message}</p>
          <br />
          <p>
            Please provide the desired fields manually below or attempt to fix
            the issues and retry.
          </p>
        </>,
      );
      return;
    }
  }

  function applyLayerAttributes(queriedLayerAttributes) {
    // remove any layers where no attributes were found, and show the rest in
    // the author's saved order, anything the order does not list going last
    let layerAttributes = Object.fromEntries(
      Object.entries(queriedLayerAttributes ?? {})
        .filter(([_, value]) => !(Array.isArray(value) && value.length === 0))
        .map(([layerName, rows]) => [
          layerName,
          applySavedOrder(layerName, rows),
        ]),
    );
    // A query that found no fields is read like one that failed. A discovered
    // table with no rows has no boxes to check, and its boxes are all that
    // turn its events on, so the author could not turn click or hover on or
    // off. The hand-entered table's toggles can.
    const discovered = Object.keys(layerAttributes).length > 0;

    if (discovered) {
      setCustomAttributes(true);

      // if the query found no fields or failed, allow the user to create their
      // own fields for configuration
    } else {
      setCustomAttributes(false);
      if (queriedLayerAttributes) {
        setWarningMessage(
          "No field attributes were found. Please provide the desired fields manually below.",
        );
      }

      // lowercase layerParams to make sure a key isnt missed from capitalization
      const validSourceProps = removeEmptyValues(sourceProps.props);
      const layerParams = validSourceProps?.params ?? [];
      const lowercaseLayerParams = Object.keys(layerParams).reduce(
        (acc, key) => {
          acc[key.toLowerCase()] = layerParams[key];
          return acc;
        },
        {},
      );

      // Check params for potential layers, otherwise just use the layer name
      const potentialLayers = lowercaseLayerParams?.layers ?? layerProps.name;

      // split layers based on a comma delimited list. For WMS, extract the layer name from the namespace (topp:states for example)
      const layers = potentialLayers
        .split(",")
        .map((layer) => layer.replace(/^[^:]*:/, ""));

      // loop through each potential layer and setup custom attributes
      for (const layerName of layers) {
        let newAttributes = [];

        // check to see if there are any current attributes or ommitted popups setup for the layer
        const existingLayerattributeVariableFields = Object.keys(
          attributeProps?.variables?.[layerName] || {},
        );
        const existingLayerAttributeAliases = Object.keys(
          attributeProps?.aliases?.[layerName] || {},
        );
        const existingOmittedPopupAttributesFields =
          attributeProps?.omitted?.[layerName] || [];
        const existingAttributeOrder = attributeProps?.order?.[layerName] || [];
        // Hover's lists can name a field no other list does, and its row has
        // to come back for the author to see that setting.
        const existingHoverFields = attributeProps?.hover?.[layerName] || [];
        const existingOmittedHoverFields =
          attributeProps?.omittedHover?.[layerName] || [];

        // get a unique array of attributes already configured for either popups or attributes,
        // led by the saved order so the rows come back the way the author left them
        const existingAttributes = [
          ...new Set([
            ...existingAttributeOrder,
            ...existingLayerattributeVariableFields,
            ...existingOmittedPopupAttributesFields,
            ...existingLayerAttributeAliases,
            ...existingHoverFields,
            ...existingOmittedHoverFields,
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

    layerAttributes = parseAttributes(layerAttributes, discovered);

    previousAttributeProps.current = JSON.parse(JSON.stringify(attributeProps));
    // The popup type is left as it was saved: only the author's own changes
    // settle it again. The click and hover lists are still rewritten from the
    // rows, which turns a hover layer saved before hover had its own list into
    // one with that list -- in this same update, since its hover fields were
    // read from the click list this replaces.
    setAttributeProps((previousAttributeProps) => ({
      ...withPopupFields(previousAttributeProps, layerAttributes, discovered),
      variables: extractVariableInputs(layerAttributes),
      aliases: extractAliases(layerAttributes),
      order: extractOrder(layerAttributes),
    }));
  }

  // Sort one layer's discovered rows into the saved order. A stable sort by
  // rank rather than a rebuild from the ordered names, so two rows that share a
  // name both survive.
  function applySavedOrder(layerName, rows) {
    const rank = new Map(
      orderAttributeNames(
        rows.map(({ name }) => name),
        attributeProps?.order?.[layerName],
      ).map((name, index) => [name, index]),
    );
    return [...rows].sort((a, b) => rank.get(a.name) - rank.get(b.name));
  }

  async function handleLoadAttributesFromUrl() {
    setWarningMessage(null);
    setCustomAttributes(null);
    const queriedLayerAttributes = await queryLayerAttributes();
    applyLayerAttributes(queriedLayerAttributes);
  }

  function appendExistingVariablesAliasesAndPopups(
    layerAttributes,
    discovered,
  ) {
    const newObj = {};
    // hoverFieldFilter reads a saved layer, so the lists are handed to it
    // under the keys a saved layer carries them in.
    const savedHoverLists = {
      hoverPopupAttributes: attributeProps?.hover,
      omittedHoverAttributes: attributeProps?.omittedHover,
      omittedPopupAttributes: attributeProps?.omitted,
    };

    // loop through layers
    for (const layerName in layerAttributes) {
      newObj[layerName] = [];
      const showsOnHover = hoverFieldFilter(savedHoverLists, layerName);

      // loop through layer attributes and append the click, hover and variableInput fields, using existing configuration if possible
      for (const layerAttribute of layerAttributes[layerName]) {
        const name = layerAttribute.name;

        // check to see if an alias is already configured
        const existingAlias =
          attributeProps?.aliases?.[layerName] &&
          attributeProps.aliases[layerName][name];
        layerAttribute["alias"] = existingAlias ?? layerAttribute.alias ?? "";

        const omittedFromClick = Boolean(
          attributeProps?.omitted?.[layerName]?.includes(name),
        );
        if (discovered) {
          // Each column shows what its event shows, so an event that is off
          // has nothing checked.
          layerAttribute["click"] = clickOn && !omittedFromClick;
          layerAttribute["hover"] = hoverOn && showsOnHover(name);
        } else {
          // A hand-entered column keeps its values while its toggle is off,
          // so turning it back on restores them. The click list is kept
          // whatever the toggle says; the hover list is dropped while hover
          // is off, so the rows hold those values until it comes back, and a
          // row that has never had one starts checked like any new row.
          layerAttribute["click"] = !omittedFromClick;
          layerAttribute["hover"] = hoverOn
            ? showsOnHover(name)
            : (layerAttribute.hover ?? true);
        }

        // check to see if the attribute is already configured for a variable
        const existingvariableInput =
          attributeProps?.variables?.[layerName] &&
          attributeProps.variables[layerName][name];
        layerAttribute["variableInput"] = existingvariableInput ?? "";

        newObj[layerName].push(layerAttribute);
      }
    }

    return newObj;
  }

  function extractAliases(layerData) {
    const result = {};

    // check each layer and its attributes to extract any configured variable inputs
    Object.entries(layerData).forEach(([layerName, layerAttributes]) => {
      const extractedAliases = layerAttributes.reduce(
        (acc, { name, alias }) => {
          acc[name] = alias;
          return acc;
        },
        {},
      );

      result[layerName] = extractedAliases;
    });

    return result;
  }

  // The row order of each layer, by field name. Blank rows (the manual table's
  // trailing row) are left out, and a repeated name keeps its first position.
  function extractOrder(layerData) {
    return Object.fromEntries(
      Object.entries(layerData).map(([layerName, layerAttributes]) => [
        layerName,
        [...new Set(layerAttributes.map(({ name }) => name).filter(Boolean))],
      ]),
    );
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
        {},
      );

      // only add to the result if there are actually attribute variables for the layer
      if (Object.keys(extractedAttributeVariables).length > 0) {
        result[layerName] = extractedAttributeVariables;
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

    // A discovered table's columns are what turn each event on, so a change to
    // one of them or to a variable link settles the popup type again. A
    // hand-entered table's type comes from its toggles.
    const discovered = customAttributes === true;
    const events =
      discovered && EVENT_FIELDS.includes(field)
        ? deriveEvents(updatedAttributes)
        : undefined;

    setAttributeProps((previousAttributeProps) => ({
      ...withPopupFields(
        previousAttributeProps,
        updatedAttributes,
        discovered,
        events,
      ),
      variables: extractVariableInputs(updatedAttributes),
      aliases: extractAliases(updatedAttributes),
      order: extractOrder(updatedAttributes),
    }));
  }

  function handleMoveRow(layerName, rowIndex, delta) {
    requestFocus(rowIndex, delta, layerName);
    updateAttributes({
      layerName,
      fullChange: moveRow(attributes[layerName], rowIndex, delta),
    });
  }

  // A column header's select-all: sets one column of one sublayer's rows.
  function handleSelectAll(layerName, field, checked) {
    updateAttributes({
      layerName,
      field,
      fullChange: attributes[layerName].map((row) => ({
        ...row,
        [field]: checked,
      })),
    });
  }

  // A column header's select-all reads as checked while any row is.
  const anyChecked = (layerName, field) =>
    attributes[layerName].some((row) => row[field]);

  // A hand-entered table's Click and Hover toggles. The rows keep their values
  // whichever way a toggle is set.
  function handleEventToggle(event, on) {
    setAttributeProps((previousAttributeProps) =>
      withPopupFields(previousAttributeProps, attributes, false, {
        clickOn:
          event === "click" ? on : isClickEnabled(previousAttributeProps),
        hoverOn:
          event === "hover" ? on : isHoverEnabled(previousAttributeProps),
      }),
    );
  }

  const renderSelectAllHeader = (layerName, field, label) => (
    <>
      {label}
      <br />
      <input
        type="checkbox"
        checked={anyChecked(layerName, field)}
        onChange={(e) => handleSelectAll(layerName, field, e.target.checked)}
        aria-label={`${label} header`}
      />
    </>
  );

  const renderRowCheckbox = (layerName, index, field, label) => (
    <CenteredTD>
      <input
        type="checkbox"
        checked={attributes[layerName][index][field]}
        aria-label={`${label} row`}
        onChange={(e) => {
          updateAttributes({
            index,
            layerName,
            field,
            fieldChange: e.target.checked,
          });
        }}
      />
    </CenteredTD>
  );

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
                      <th className="text-center" style={{ width: "10%" }}>
                        Order
                      </th>
                      <th className="text-center" style={{ width: "20%" }}>
                        Name
                      </th>
                      <th className="text-center" style={{ width: "20%" }}>
                        Alias
                      </th>
                      <th className="text-center" style={{ width: "12%" }}>
                        {renderSelectAllHeader(
                          layerName,
                          "click",
                          "Show on Click",
                        )}
                      </th>
                      <th className="text-center" style={{ width: "12%" }}>
                        {renderSelectAllHeader(
                          layerName,
                          "hover",
                          "Show on Hover",
                        )}
                      </th>
                      <th className="text-center">Variable Input Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attributes[layerName].map(({ name }, index) => (
                      <tr key={index}>
                        <CenteredTD>
                          <RowMoveButtons
                            index={index}
                            count={attributes[layerName].length}
                            label={name || `row ${index + 1}`}
                            onMove={(rowIndex, delta) =>
                              handleMoveRow(layerName, rowIndex, delta)
                            }
                            focusRequest={focusRequestFor(index, layerName)}
                          />
                        </CenteredTD>
                        <OverflowTD>{name}</OverflowTD>
                        <td>
                          <StyledInput
                            value={attributes[layerName][index]["alias"]}
                            aria-label="alias row"
                            onChange={(e) => {
                              updateAttributes({
                                index,
                                layerName,
                                field: "alias",
                                fieldChange: e.target.value,
                              });
                            }}
                          />
                        </td>
                        {renderRowCheckbox(
                          layerName,
                          index,
                          "click",
                          "Show on Click",
                        )}
                        {renderRowCheckbox(
                          layerName,
                          index,
                          "hover",
                          "Show on Hover",
                        )}
                        <td>
                          <StyledInput
                            value={
                              attributes[layerName][index]["variableInput"]
                            }
                            aria-label="variable row"
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
            <>
              {isUrlGeoJSON && (
                <UrlLoadBar>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={handleLoadAttributesFromUrl}
                    aria-label="Load attributes from URL"
                  >
                    Load attributes from URL
                  </Button>
                  <Hint>
                    Large remote GeoJSON files may take a while to load.
                  </Hint>
                </UrlLoadBar>
              )}
              {/* These rows are only the fields the author typed in, not every
                  field the layer has, so a checked box cannot be what turns an
                  event on. A toggle does instead. */}
              <EventToggles>
                <CheckboxInput
                  label="Click"
                  type="switch"
                  value={clickOn}
                  onChange={(on) => handleEventToggle("click", on)}
                />
                <CheckboxInput
                  label="Hover"
                  type="switch"
                  value={hoverOn}
                  onChange={(on) => handleEventToggle("hover", on)}
                />
                <Hint>
                  Each event that is on shows every field the layer returns,
                  except the rows unchecked for it.
                </Hint>
              </EventToggles>
              {Object.keys(attributes).map((layerName, index) => (
                <InputTable
                  key={index}
                  label={layerName}
                  onChange={({ newValue, rowIndex, field, fullChange }) =>
                    updateAttributes({
                      index: rowIndex,
                      layerName,
                      field,
                      fieldChange: newValue,
                      fullChange: fullChange,
                    })
                  }
                  values={attributes[layerName]}
                  allowRowCreation={true}
                  allowRowReorder={true}
                  headers={[
                    "Name",
                    "Alias",
                    "Show on Click",
                    "Show on Hover",
                    "Variable Input Name",
                  ]}
                  inactiveFields={[
                    ...(clickOn ? [] : ["click"]),
                    ...(hoverOn ? [] : ["hover"]),
                  ]}
                />
              ))}
            </>
          )}
        </>
      )}
    </>
  );
};

AttributesPane.propTypes = {
  // Shared, author-triggered field discovery for a shapefile source. Supplied by
  // the modal so this pane and the Style pane read one result between them.
  shapefileDiscovery: PropTypes.shape({
    isShapefile: PropTypes.bool,
    state: PropTypes.string,
    fields: PropTypes.arrayOf(PropTypes.string),
  }),
  attributeProps: attributePropsPropType, // react state that tracks attribute properties
  setAttributeProps: PropTypes.func, // state setter for attributeProps
  sourceProps: sourcePropType, // configuration and properties for openlayers layer source
  layerProps: PropTypes.shape({
    name: PropTypes.string,
  }), // configuration and properties for openlayers layer
  tabKey: PropTypes.string.isRequired, // react state that tracks what tab is shown
  // The popup type the layer had when the editor opened it, as
  // resolveTablePopupType reads it. Captured by the modal rather than here,
  // since this pane remounts -- and would capture props already edited -- when
  // the source moves to a type without an Attributes tab and back.
  openedPopupType: PropTypes.string,
};

export default memo(AttributesPane);
