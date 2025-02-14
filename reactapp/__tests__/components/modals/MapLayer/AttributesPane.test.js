import { useState, useEffect, act } from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  findAllByAltText,
} from "@testing-library/react";
import { getLayerAttributes } from "components/map/utilities";
import AttributesPane from "components/modals/MapLayer/AttributesPane";

jest.mock("components/map/utilities", () => {
  const originalModule = jest.requireActual("components/map/utilities");
  return {
    ...originalModule,
    getLayerAttributes: jest.fn(),
  };
});
const mockedGetLayerAttributes = jest.mocked(getLayerAttributes);
mockedGetLayerAttributes.mockResolvedValue({
  states: [
    { name: "the_geom", alias: "the_geom" },
    { name: "STATE_NAME", alias: "STATE_NAME" },
  ],
});

const TestingComponent = ({
  initialAttributeVariables,
  initialOmittedPopupAttributes,
  sourceProps,
  layerProps,
  tabKey,
}) => {
  const [omittedPopupAttributes, setOmittedPopupAttributes] = useState(
    initialOmittedPopupAttributes ?? {}
  );
  const [attributeVariables, setAttributeVariables] = useState(
    initialAttributeVariables ?? {}
  );

  return (
    <>
      <AttributesPane
        attributeVariables={attributeVariables}
        setAttributeVariables={setAttributeVariables}
        omittedPopupAttributes={omittedPopupAttributes}
        setOmittedPopupAttributes={setOmittedPopupAttributes}
        sourceProps={sourceProps}
        layerProps={layerProps}
        tabKey={tabKey}
      />
      <p data-testid="attributeVariables">
        {JSON.stringify(attributeVariables)}
      </p>
      <p data-testid="omittedPopupAttributes">
        {JSON.stringify(omittedPopupAttributes)}
      </p>
    </>
  );
};

test("AttributesPane successful query no attributes", async () => {
  mockedGetLayerAttributes.mockResolvedValue({});

  const sourceProps = {
    type: "ImageWMS",
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
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "ImageArcGISRest",
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
  expect(screen.getAllByText("the_geom").length).toBe(2);
  expect(screen.getAllByText("STATE_NAME").length).toBe(2);
  expect(screen.getAllByRole("checkbox").length).toBe(3); // includes header and 2 rows
  expect(screen.getAllByRole("textbox").length).toBe(2);

  expect(screen.getAllByRole("textbox")[0].value).toBe("");
  expect(screen.getAllByRole("textbox")[1].value).toBe("");
});

test("AttributesPane successful query with initial variables or popups", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "ImageWMS",
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
      initialOmittedPopupAttributes={{ states: ["the_geom"] }}
      initialAttributeVariables={{ states: { the_geom: "some variable" } }}
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
  expect(screen.getAllByText("the_geom").length).toBe(2);
  expect(screen.getAllByText("STATE_NAME").length).toBe(2);
  expect(screen.getAllByRole("checkbox").length).toBe(3); // includes header and 2 rows
  expect(screen.getAllByRole("textbox").length).toBe(2);

  expect(screen.getAllByRole("textbox")[0].value).toBe("some variable");
  expect(screen.getAllByRole("textbox")[1].value).toBe("");

  expect(screen.getAllByRole("checkbox")[0].checked).toBe(true);
  expect(screen.getAllByRole("checkbox")[1].checked).toBe(false);
  expect(screen.getAllByRole("checkbox")[2].checked).toBe(true);
});

test("AttributesPane unsuccessful query no initial variables or popups", async () => {
  mockedGetLayerAttributes.mockRejectedValue({ message: "Something happened" });

  const sourceProps = {
    type: "ImageWMS",
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

  // Headers
  expect(await screen.findByText("states")).toBeInTheDocument();
  expect(await screen.findByText("Name")).toBeInTheDocument();
  expect(screen.getByText("Show in popup")).toBeInTheDocument();
  expect(screen.getByText("Variable Input Name")).toBeInTheDocument();

  expect(screen.getAllByRole("checkbox").length).toBe(1); // includes  1 row
  expect(screen.getAllByRole("textbox").length).toBe(2); // name and variable input

  const rowCheckbox = screen.getAllByRole("checkbox")[0];
  await act(async () => {
    fireEvent.click(rowCheckbox);
  });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({})
  );

  const nameTextbox = screen.getAllByRole("textbox")[0];
  fireEvent.change(nameTextbox, { target: { value: "test" } });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["test"] })
  );

  const variableTextbox = screen.getAllByRole("textbox")[1];
  fireEvent.change(variableTextbox, { target: { value: "some variable" } });
  expect(screen.getByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({ states: { test: "some variable" } })
  );

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
  expect(screen.getAllByRole("textbox")[0].value).toBe("test");
  expect(screen.getAllByRole("textbox")[1].value).toBe("some variable");
});

test("AttributesPane unsuccessful query with initial variables or popups", async () => {
  mockedGetLayerAttributes.mockRejectedValue({ message: "Something happened" });

  const sourceProps = {
    type: "ImageArcGISRest",
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
      initialOmittedPopupAttributes={{ esri: ["the_geom", "STATE_NAME"] }}
      initialAttributeVariables={{ esri: { the_geom: "some variable" } }}
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

  expect(screen.getAllByRole("checkbox").length).toBe(2); // includes 2 row
  expect(screen.getAllByRole("textbox").length).toBe(4); // name and variable input

  expect(screen.getAllByRole("textbox")[0].value).toBe("the_geom");
  expect(screen.getAllByRole("textbox")[1].value).toBe("some variable");
  expect(screen.getAllByRole("textbox")[2].value).toBe("STATE_NAME");
  expect(screen.getAllByRole("textbox")[3].value).toBe("");

  expect(screen.getAllByRole("checkbox")[0].checked).toBe(false);
  expect(screen.getAllByRole("checkbox")[1].checked).toBe(false);
});

test("AttributesPane popups header and body change", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "Geometry" },
      { name: "STATE_NAME", alias: "State" },
    ],
  });

  const sourceProps = {
    type: "ImageWMS",
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
    JSON.stringify({})
  );

  // header popup controls all popups. unchecking means that all fields are omitted
  expect(await screen.findByText("states")).toBeInTheDocument();
  const headerCheckbox = screen.getAllByRole("checkbox")[0];
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(true);
  });
  await act(async () => {
    fireEvent.click(headerCheckbox);
  });
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(false);
  });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["the_geom", "STATE_NAME"] })
  );

  // turn field popup back on. header should come back as well
  const theGeomCheckbox = screen.getAllByRole("checkbox")[1];
  await act(async () => {
    fireEvent.click(theGeomCheckbox);
  });
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(true);
  });
  expect(screen.getByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["STATE_NAME"] })
  );

  // turn field popup back off. header should also turn off
  await act(async () => {
    fireEvent.click(theGeomCheckbox);
  });
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
    type: "ImageWMS",
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
      initialOmittedPopupAttributes={initialOmittedPopupAttributes}
    />
  );
  expect(await screen.findByTestId("omittedPopupAttributes")).toHaveTextContent(
    JSON.stringify({ states: ["the_geom", "STATE_NAME"] })
  );

  // since all field popups are off, so should the header checkbox
  expect(await screen.findByText("states")).toBeInTheDocument();
  const checkboxes = screen.getAllByRole("checkbox");
  checkboxes.forEach((checkbox) => expect(checkbox.checked).toBe(false));

  const headerCheckbox = screen.getAllByRole("checkbox")[0];
  await act(async () => {
    fireEvent.click(headerCheckbox);
  });
  await waitFor(() => {
    expect(headerCheckbox.checked).toBe(true);
  });
  checkboxes.forEach((checkbox) => expect(checkbox.checked).toBe(true));
});

test("AttributesPane attributes change", async () => {
  mockedGetLayerAttributes.mockResolvedValue({
    states: [
      { name: "the_geom", alias: "the_geom" },
      { name: "STATE_NAME", alias: "STATE_NAME" },
    ],
  });

  const sourceProps = {
    type: "ImageWMS",
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

  const geomTextbox = screen.getAllByRole("textbox")[0];
  fireEvent.change(geomTextbox, { target: { value: "some variable" } });

  expect(await screen.findByTestId("attributeVariables")).toHaveTextContent(
    JSON.stringify({ states: { the_geom: "some variable" } })
  );

  const stateTextbox = screen.getAllByRole("textbox")[1];
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
    type: "ImageWMS",
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
