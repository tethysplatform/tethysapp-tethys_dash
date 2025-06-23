import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getLayerAttributes } from "components/map/utilities";
import AttributesPane from "components/modals/MapLayer/AttributesPane";
import PropTypes from "prop-types";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
  };
});
const mockedGetLayerAttributes = jest.mocked(getLayerAttributes);

const TestingComponent = ({
  initialAttributeProps,
  sourceProps,
  layerProps,
  tabKey,
}) => {
  const [attributeProps, setAttributeProps] = useState(
    initialAttributeProps ?? {}
  );

  return (
    <>
      <AttributesPane
        attributeProps={attributeProps}
        setAttributeProps={setAttributeProps}
        sourceProps={sourceProps}
        layerProps={layerProps}
        tabKey={tabKey}
      />
      <p data-testid="attributeVariables">
        {JSON.stringify(attributeProps.variables)}
      </p>
      <p data-testid="attributeAliases">
        {JSON.stringify(attributeProps.aliases)}
      </p>
      <p data-testid="omittedPopupAttributes">
        {JSON.stringify(attributeProps.omitted)}
      </p>
      <p data-testid="queryable">{JSON.stringify(attributeProps.queryable)}</p>
    </>
  );
};

test("AttributesPane successful query no attributes", async () => {
  mockedGetLayerAttributes.mockResolvedValue({});

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  // Headers
  expect(
    await screen.findByText("No field attributes were found.")
  ).toBeInTheDocument();
  expect(screen.queryAllByRole("table").length).toBe(0);
});

test("AttributesPane successful query no initial variables or popups", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE" },
    ],
  });

  const sourceProps = {
    type: "ESRI Image and Map Service",
    props: {
      url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  // Headers
  expect(await screen.findByText("states")).toBeInTheDocument();
  expect(screen.getByText("Name")).toBeInTheDocument();
  expect(screen.getByText("Alias")).toBeInTheDocument();
  expect(screen.getByText("Show in popup")).toBeInTheDocument();
  expect(screen.getByText("Variable Input Name")).toBeInTheDocument();

  // Body
  expect(screen.getAllByText("the_geom").length).toBe(1);
  expect(screen.getAllByText("STATE_NAME").length).toBe(1);

  const aliasTextboxes = screen.getAllByLabelText("alias row");
  expect(aliasTextboxes.length).toBe(2);
  expect(aliasTextboxes[0].value).toBe("the_geom");
  expect(aliasTextboxes[1].value).toBe("STATE");

  const variableTextboxes = screen.getAllByLabelText("variable row");
  expect(variableTextboxes.length).toBe(2);
  expect(variableTextboxes[0].value).toBe("");
  expect(variableTextboxes[1].value).toBe("");

  const popupCheckboxes = screen.getAllByLabelText("Show in popup row");
  expect(popupCheckboxes.length).toBe(2); // includes header and 2 rows
  const headerCheckbox = screen.getByLabelText("Show in popup header");
  expect(headerCheckbox).toBeInTheDocument();

  expect(headerCheckbox.checked).toBe(true);
  expect(popupCheckboxes[0].checked).toBe(true);
  expect(popupCheckboxes[1].checked).toBe(true);
});

test("AttributesPane successful query with initial variables or popups", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
      initialAttributeProps={{
        variables: { states: { the_geom: "some variable" } },
        omitted: { states: ["the_geom"] },
        aliases: { states: { the_geom: "Geometry" } },
      }}
    />
  );

  expect(screen.getByLabelText("Allow Layer Query").checked).toBe(true); // allow llayer query checkbox should be on

  const spinner = screen.getByTestId("Loading...");
  expect(spinner).toBeInTheDocument();

  // Headers
  expect(await screen.findByText("states")).toBeInTheDocument();
  expect(screen.getByText("Name")).toBeInTheDocument();
  expect(screen.getByText("Alias")).toBeInTheDocument();
  expect(screen.getByText("Show in popup")).toBeInTheDocument();
  expect(screen.getByText("Variable Input Name")).toBeInTheDocument();

  // Body
  expect(screen.getAllByText("the_geom").length).toBe(1);
  expect(screen.getAllByText("STATE_NAME").length).toBe(1);

  const aliasTextboxes = screen.getAllByLabelText("alias row");
  expect(aliasTextboxes.length).toBe(2);

  expect(aliasTextboxes[0].value).toBe("Geometry");
  expect(aliasTextboxes[1].value).toBe("STATE_NAME");

  const variableTextboxes = screen.getAllByLabelText("variable row");
  expect(variableTextboxes.length).toBe(2);

  expect(variableTextboxes[0].value).toBe("some variable");
  expect(variableTextboxes[1].value).toBe("");

  const popupCheckboxes = screen.getAllByLabelText("Show in popup row");
  expect(popupCheckboxes.length).toBe(2); // includes header and 2 rows
  const headerCheckbox = screen.getByLabelText("Show in popup header");
  expect(headerCheckbox).toBeInTheDocument();

  expect(headerCheckbox.checked).toBe(true);
  expect(popupCheckboxes[0].checked).toBe(false);
  expect(popupCheckboxes[1].checked).toBe(true);
});

test("AttributesPane unsuccessful query no initial variables or popups", async () => {
  mockedGetLayerAttributes.mockRejectedValue({ message: "Something happened" });

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  const { rerender } = render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  expect(await screen.findByText("Something happened")).toBeInTheDocument();

  expect(
    await screen.findByText(
      "Please provide the desired fields manually below or attempt to fix the issues and retry."
    )
  ).toBeInTheDocument();

  expect(screen.getByLabelText("Allow Layer Query").checked).toBe(true); // allow llayer query checkbox should be on

  // Headers
  expect(await screen.findByText("states")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(screen.getByText("Show in popup")).toBeInTheDocument();
  expect(screen.getByText("Variable Input Name")).toBeInTheDocument();

  let popCheckboxes = screen.getAllByRole("checkbox", { name: /popup/i });
  expect(popCheckboxes.length).toBe(1); // includes 1 row
  expect(screen.getAllByRole("textbox").length).toBe(3); // name, alias and variable input

  expect(screen.getByLabelText("name Input 0").value).toBe("");
  expect(screen.getByLabelText("alias Input 0").value).toBe("");
  expect(screen.getByLabelText("variableInput Input 0").value).toBe("");

  const rowCheckbox = popCheckboxes[0];
  fireEvent.click(rowCheckbox);
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({})
  );

  const nameTextbox = screen.getByLabelText("name Input 0");
  fireEvent.change(nameTextbox, { target: { value: "test" } });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["test"] })
  );

  const aliasTextbox = screen.getByLabelText("alias Input 0");
  fireEvent.change(aliasTextbox, { target: { value: "New Alias" } });
  expect(screen.getByTestId("attributeAliases")).toHaveTextContent(
    JSON.stringify({ states: { test: "New Alias" } })
  );

  const variableTextbox = screen.getByLabelText("variableInput Input 0");
  fireEvent.change(variableTextbox, { target: { value: "some variable" } });
  expect(screen.getByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({ states: { test: "some variable" } })
  );

  variableTextbox.focus();
  // adds a new row
  await userEvent.tab();
  popCheckboxes = screen.getAllByRole("checkbox", { name: /popup/i });
  expect(popCheckboxes.length).toBe(2);
  expect(screen.getAllByRole("textbox").length).toBe(6);
  expect(screen.getAllByRole("textbox")[3]).toHaveFocus();

  // dont rerun query if source props dont change
  rerender(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"configuration"}
    />
  );

  rerender(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["test"] })
  );
  expect(screen.getByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({ states: { test: "some variable" } })
  );

  expect(screen.getByLabelText("name Input 0").value).toBe("test");
  expect(screen.getByLabelText("alias Input 0").value).toBe("New Alias");
  expect(screen.getByLabelText("variableInput Input 0").value).toBe(
    "some variable"
  );
});

test("AttributesPane unsuccessful query with initial variables, fields, and popups", async () => {
  mockedGetLayerAttributes.mockRejectedValue({ message: "Something happened" });

  const sourceProps = {
    type: "ESRI Image and Map Service",
    props: {
      url: "https://maps.water.noaa.gov/server/rest/services/rfc/rfc_max_forecast/MapServer",
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
      initialAttributeProps={{
        variables: { esri: { the_geom: "some variable" } },
        aliases: { esri: { the_geom: "Geometry", STATE_NAME: "State" } },
        omitted: { esri: ["the_geom", "STATE_NAME"] },
      }}
    />
  );

  expect(await screen.findByText("Something happened")).toBeInTheDocument();

  expect(
    await screen.findByText(
      "Please provide the desired fields manually below or attempt to fix the issues and retry."
    )
  ).toBeInTheDocument();

  // Headers
  expect(await screen.findByText("esri")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(screen.getByText("Show in popup")).toBeInTheDocument();
  expect(screen.getByText("Variable Input Name")).toBeInTheDocument();

  expect(screen.getByLabelText("Allow Layer Query").checked).toBe(true); // allow llayer query checkbox should be on

  const popCheckboxes = screen.getAllByRole("checkbox", { name: /popup/i });
  expect(popCheckboxes.length).toBe(2); // includes 2 row
  expect(screen.getAllByRole("textbox").length).toBe(6); // name, alias and variable input

  expect(screen.getByLabelText("name Input 0").value).toBe("the_geom");
  expect(screen.getByLabelText("alias Input 0").value).toBe("Geometry");
  expect(screen.getByLabelText("variableInput Input 0").value).toBe(
    "some variable"
  );
  expect(screen.getByLabelText("name Input 1").value).toBe("STATE_NAME");
  expect(screen.getByLabelText("alias Input 1").value).toBe("State");
  expect(screen.getByLabelText("variableInput Input 1").value).toBe("");

  expect(popCheckboxes[0].checked).toBe(false);
  expect(popCheckboxes[1].checked).toBe(false);
});

test("AttributesPane popups header and body change", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "Geometry" },
      { name: "STATE_NAME", alias: "State" },
    ],
  });

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  expect(await screen.findByTestId("omittedPopupAttributes")).toHaveTextContent(
    ""
  );

  // header popup controls all popups. unchecking means that all fields are omitted
  expect(await screen.findByText("states")).toBeInTheDocument();
  const headerCheckbox = screen.getByLabelText("Show in popup header");
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(true);
  });
  fireEvent.click(headerCheckbox);
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(false);
  });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["the_geom", "STATE_NAME"] })
  );

  // turn field popup back on. header should come back as well
  const popupCheckboxes = screen.getAllByLabelText("Show in popup row");
  const theGeomCheckbox = popupCheckboxes[0];
  fireEvent.click(theGeomCheckbox);
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(true);
  });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["STATE_NAME"] })
  );

  // turn field popup back off. header should also turn off
  fireEvent.click(theGeomCheckbox);
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(false);
  });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["the_geom", "STATE_NAME"] })
  );
});

test("AttributesPane popups initial values", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  const initialOmittedPopupAttributes = { states: ["the_geom", "STATE_NAME"] };

  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
      initialAttributeProps={{ omitted: initialOmittedPopupAttributes }}
    />
  );

  expect(await screen.findByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["the_geom", "STATE_NAME"] })
  );

  expect(screen.getByLabelText("Allow Layer Query").checked).toBe(true); // allow llayer query checkbox should be on

  // since all field popups are off, so should the header checkbox
  expect(await screen.findByText("states")).toBeInTheDocument();
  const popupCheckboxes = screen.getAllByLabelText("Show in popup row");
  popupCheckboxes.forEach((checkbox) => expect(checkbox.checked).toBe(false));

  const headerCheckbox = screen.getByLabelText("Show in popup header");
  fireEvent.click(headerCheckbox);
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(true);
  });
  popupCheckboxes.forEach((checkbox) => expect(checkbox.checked).toBe(true));
});

test("AttributesPane attributes change", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  expect(await screen.findByText("states")).toBeInTheDocument();

  const geomTextbox = screen.getAllByLabelText("variable row")[0];
  fireEvent.change(geomTextbox, { target: { value: "some variable" } });

  expect(await screen.findByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({ states: { the_geom: "some variable" } })
  );

  const geomAliasTextbox = screen.getAllByLabelText("alias row")[0];
  fireEvent.change(geomAliasTextbox, { target: { value: "Geometry" } });

  expect(screen.getByTestId("attributeAliases")).toHaveTextContent(
    JSON.stringify({
      states: { the_geom: "Geometry", STATE_NAME: "STATE_NAME" },
    })
  );

  const stateTextbox = screen.getAllByLabelText("variable row")[1];
  fireEvent.change(stateTextbox, { target: { value: "some other variable" } });

  expect(await screen.findByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({
      states: { the_geom: "some variable", STATE_NAME: "some other variable" },
    })
  );
});

test("AttributesPane layer missing name", async () => {
  render(
    <TestingComponent sourceProps={{}} layerProps={{}} tabKey={"attributes"} />
  );

  expect(
    await screen.findByText(
      "The layer name must be configured to retrieve attributes"
    )
  ).toBeInTheDocument();
});

test("AttributesPane source missing type", async () => {
  render(
    <TestingComponent
      sourceProps={{}}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  expect(
    await screen.findByText(
      "The source type must be configured to retrieve attributes"
    )
  ).toBeInTheDocument();
});

test("AttributesPane missin required params", async () => {
  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  expect(
    await screen.findByText(
      "Missing required params arguments. Please check the source and try again before getting attributes"
    )
  ).toBeInTheDocument();
});

test("AttributesPane bad GeoJSON", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "GeoJSON",
    props: {},
    geojson: "{bad: }",
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
    />
  );

  expect(
    await screen.findByText(
      "Invalid json is being used. Please alter the json and try again."
    )
  ).toBeInTheDocument();

  expect(
    await screen.findByText(
      "Expected property name or '}' in JSON at position 1"
    )
  ).toBeInTheDocument();
});

test("AttributesPane allow layer query", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "WMS",
    props: {
      url: "http://localhost:8081/geoserver/wms",
      params: {
        LAYERS: "topp:states",
      },
    },
  };
  render(
    <TestingComponent
      sourceProps={sourceProps}
      layerProps={{
        name: "esri",
      }}
      tabKey={"attributes"}
      initialAttributeProps={{
        variables: { states: { the_geom: "some variable" } },
        omitted: { states: ["the_geom"] },
        queryable: false,
      }}
    />
  );

  const layerQuery = screen.getByLabelText("Allow Layer Query");
  expect(layerQuery.checked).toBe(false);
  expect(screen.getByTestId("queryable")).toHaveTextContent(
    JSON.stringify(false)
  );

  fireEvent.click(layerQuery);

  expect(layerQuery.checked).toBe(true);
  expect(screen.getByTestId("queryable")).toBeEmptyDOMElement();

  fireEvent.click(layerQuery);

  expect(layerQuery.checked).toBe(false);
  expect(screen.getByTestId("queryable")).toHaveTextContent(
    JSON.stringify(false)
  );
});

TestingComponent.propTypes = {
  initialAttributeProps: PropTypes.object,
  sourceProps: PropTypes.object,
  layerProps: PropTypes.object,
  tabKey: PropTypes.string,
};
