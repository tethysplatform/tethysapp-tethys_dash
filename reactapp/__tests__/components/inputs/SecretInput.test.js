import { useContext, useState } from "react";
import PropTypes from "prop-types";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rest } from "msw";
import SecretInput from "components/inputs/SecretInput";
import DashboardLoader from "components/loader/DashboardLoader";
import {
  AppContext,
  AvailableDashboardsContext,
  LayoutContext,
  TabContext,
} from "components/contexts/Contexts";
import { server } from "__tests__/utilities/server";
import { userDashboard } from "__tests__/utilities/constants";

const SECRET = "typed-s3cret-value";

const visualizations = [
  {
    label: "Plugins",
    options: [
      {
        source: "secret_plugin",
        value: "Secret Plugin",
        label: "Secret Plugin",
        type: "text",
        args: { station: "text", api_key: "secret" },
      },
    ],
  },
];
const dynamicMapLayers = [
  {
    label: "Dynamic Map Layers",
    options: [
      {
        source: "secret_layer",
        value: "Secret Layer",
        label: "Secret Layer",
        type: "map_layer",
        dynamic_map_layer: true,
        args: { token: "secret" },
      },
    ],
  },
];

const tilePlace = {
  tile: "tile-uuid",
  layer: "",
  arg: "api_key",
  source: "secret_plugin",
};
const layerPlace = {
  tile: "map-uuid",
  layer: "layer-1",
  arg: "token",
  source: "secret_layer",
};

const dashboardWith = (storedSecrets) => ({
  ...userDashboard,
  tabs: [
    {
      id: 1,
      name: "Tab 1",
      gridItems: [
        {
          id: 1,
          uuid: "tile-uuid",
          i: "1",
          x: 0,
          y: 0,
          w: 20,
          h: 20,
          source: "secret_plugin",
          args_string: JSON.stringify({ station: "A", api_key: "" }),
          metadata_string: "{}",
        },
        {
          id: 2,
          uuid: "map-uuid",
          i: "2",
          x: 20,
          y: 0,
          w: 20,
          h: 20,
          source: "Map",
          args_string: JSON.stringify({
            layers: [
              {
                configuration: {
                  type: "VectorLayer",
                  props: {
                    name: "Live",
                    layerId: "layer-1",
                    pluginSource: {
                      source: "secret_layer",
                      args: { token: "" },
                    },
                  },
                },
              },
            ],
          }),
          metadata_string: "{}",
        },
      ],
    },
  ],
  storedSecrets,
});

// A secret arg in an editor, under the dashboard that keeps its secrets.
const Harness = ({ place, initialValue }) => {
  const [value, setValue] = useState(initialValue);
  const { saveLayoutContext, pendingSecrets } = useContext(LayoutContext);
  const { tabs } = useContext(TabContext);
  return (
    <>
      <SecretInput
        label="Api Key"
        value={value}
        onChange={setValue}
        place={place}
      />
      <p data-testid="arg-value">{JSON.stringify(value)}</p>
      {/* What is pending, never the value. */}
      <p data-testid="pending">
        {JSON.stringify(
          Object.values(pendingSecrets).map((entry) =>
            entry.value === null ? "clear" : "set",
          ),
        )}
      </p>
      <button onClick={() => saveLayoutContext({ tabs })}>
        Save dashboard
      </button>
      <button>Elsewhere</button>
    </>
  );
};

Harness.propTypes = {
  place: PropTypes.object,
  initialValue: PropTypes.any,
};

const renderSecret = async ({
  place = tilePlace,
  storedSecrets = [],
  storedAfterSave = [],
  initialValue = "",
} = {}) => {
  const dashboard = dashboardWith(storedSecrets);
  server.use(
    rest.get(
      "http://api.test/apps/tethysdash/dashboards/get/",
      (req, res, ctx) =>
        res(ctx.status(200), ctx.json({ success: true, dashboard })),
    ),
  );
  const updateDashboard = jest.fn(async ({ newProperties }) => ({
    success: true,
    updated_dashboard: {
      ...dashboard,
      ...newProperties,
      storedSecrets: storedAfterSave,
    },
  }));
  render(
    <AppContext.Provider value={{ visualizations, dynamicMapLayers }}>
      <AvailableDashboardsContext.Provider value={{ updateDashboard }}>
        <DashboardLoader {...dashboard}>
          <Harness place={place} initialValue={initialValue} />
        </DashboardLoader>
      </AvailableDashboardsContext.Provider>
    </AppContext.Provider>,
  );
  await screen.findByTestId("arg-value");
  return { updateDashboard };
};

const pathOf = ({ tile, layer, arg }) => ({ tile, layer, arg });

test("a secret not set is an empty password field no password manager has a name for, with an info tip on how secrets are kept", async () => {
  await renderSecret();

  const field = screen.getByLabelText("Api Key Input");
  expect(field).toHaveAttribute("type", "password");
  expect(field).toHaveAttribute("autocomplete", "new-password");
  expect(field).not.toHaveAttribute("name");
  expect(field).not.toHaveAttribute("id");
  expect(field.value).toBe("");
  expect(field).toHaveAttribute("placeholder", "Enter the secret");
  await userEvent.hover(screen.getByLabelText("Api Key help"));
  expect(
    await screen.findByText(
      "Secrets are saved with the dashboard and can never be read back to keep them secure.",
    ),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Apply Api Key")).toBeDisabled();
  expect(screen.queryByText("Secret set")).not.toBeInTheDocument();
});

test("a secret typed and saved shows Secret set, and is never on screen", async () => {
  const { updateDashboard } = await renderSecret({
    storedAfterSave: [pathOf(tilePlace)],
  });

  await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
  // Typing alone commits nothing.
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");
  await userEvent.click(screen.getByText("Elsewhere"));

  expect(
    screen.getByText(
      "New secret entered. It is saved when you save the dashboard.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Api Key Input")).not.toBeInTheDocument();
  expect(screen.getByTestId("pending")).toHaveTextContent('["set"]');
  expect(document.body.innerHTML).not.toContain(SECRET);

  await userEvent.click(screen.getByText("Save dashboard"));

  expect(await screen.findByText("Secret set")).toBeInTheDocument();
  expect(updateDashboard.mock.calls[0][0].newProperties.secretChanges).toEqual([
    { ...pathOf(tilePlace), value: SECRET },
  ]);
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");
  // The arg keeps its key, blank.
  expect(screen.getByTestId("arg-value")).toHaveTextContent('""');
  expect(document.body.innerHTML).not.toContain(SECRET);
});

test.each([
  ["Apply", () => userEvent.click(screen.getByLabelText("Apply Api Key"))],
  ["Enter", () => userEvent.keyboard("{Enter}")],
])("%s commits the secret typed", async (_, commit) => {
  await renderSecret();

  await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
  await commit();

  expect(screen.getByTestId("pending")).toHaveTextContent('["set"]');
  expect(
    screen.getByText(
      "New secret entered. It is saved when you save the dashboard.",
    ),
  ).toBeInTheDocument();
});

test("tabbing past Apply commits the secret typed", async () => {
  await renderSecret();

  await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
  await userEvent.tab();
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");
  await userEvent.tab();

  expect(screen.getByTestId("pending")).toHaveTextContent('["set"]');
});

test("a stored secret cleared and saved leaves the field unset", async () => {
  const { updateDashboard } = await renderSecret({
    storedSecrets: [pathOf(tilePlace)],
    storedAfterSave: [],
  });
  expect(screen.getByText("Secret set")).toBeInTheDocument();
  expect(screen.queryByLabelText("Api Key Input")).not.toBeInTheDocument();

  await userEvent.click(screen.getByLabelText("Clear Api Key"));
  expect(
    screen.getByText("The secret is cleared when you save the dashboard."),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByText("Save dashboard"));

  expect(
    await screen.findByPlaceholderText("Enter the secret"),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Api Key Input").value).toBe("");
  expect(updateDashboard.mock.calls[0][0].newProperties.secretChanges).toEqual([
    { ...pathOf(tilePlace), value: null },
  ]);
});

test("Undo takes back a pending clear or a pending replacement, and Cancel a replacement not committed", async () => {
  await renderSecret({ storedSecrets: [pathOf(tilePlace)] });

  await userEvent.click(screen.getByLabelText("Clear Api Key"));
  await userEvent.click(screen.getByLabelText("Undo Api Key"));
  expect(screen.getByText("Secret set")).toBeInTheDocument();
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");

  await userEvent.click(screen.getByLabelText("Replace Api Key"));
  const field = screen.getByLabelText("Api Key Input");
  expect(field).toHaveFocus();
  expect(field.value).toBe("");
  await userEvent.type(field, SECRET);
  await userEvent.click(screen.getByLabelText("Cancel Api Key"));
  expect(screen.getByText("Secret set")).toBeInTheDocument();
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");

  // From the keyboard too.
  await userEvent.click(screen.getByLabelText("Replace Api Key"));
  await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
  await userEvent.tab();
  expect(screen.getByLabelText("Apply Api Key")).toHaveFocus();
  await userEvent.tab();
  expect(screen.getByLabelText("Cancel Api Key")).toHaveFocus();
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");
  await userEvent.keyboard("{Enter}");
  expect(screen.getByText("Secret set")).toBeInTheDocument();
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");

  await userEvent.click(screen.getByLabelText("Replace Api Key"));
  await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
  await userEvent.click(screen.getByText("Elsewhere"));
  expect(screen.getByTestId("pending")).toHaveTextContent('["set"]');
  await userEvent.click(screen.getByLabelText("Undo Api Key"));
  expect(screen.getByText("Secret set")).toBeInTheDocument();
  expect(screen.getByTestId("pending")).toHaveTextContent("[]");
});

test("a value found in the args is blanked, never shown", async () => {
  await renderSecret({ initialValue: "plaintext-from-before" });

  await waitFor(() =>
    expect(screen.getByTestId("arg-value")).toHaveTextContent('""'),
  );
  expect(screen.getByLabelText("Api Key Input").value).toBe("");
  expect(document.body.innerHTML).not.toContain("plaintext-from-before");
});

test("an arg the args do not have yet gets its key, blank", async () => {
  await renderSecret({ initialValue: null });

  await waitFor(() =>
    expect(screen.getByTestId("arg-value")).toHaveTextContent('""'),
  );
});

test("a secret stored for another plugin reads as none", async () => {
  await renderSecret({
    place: { ...tilePlace, source: "another_plugin" },
    storedSecrets: [pathOf(tilePlace)],
  });

  expect(screen.getByPlaceholderText("Enter the secret")).toBeInTheDocument();
  expect(screen.queryByText("Secret set")).not.toBeInTheDocument();
});

test("a dynamic layer's secret is kept for the layer", async () => {
  const { updateDashboard } = await renderSecret({ place: layerPlace });
  expect(screen.getByPlaceholderText("Enter the secret")).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Api Key Input"), SECRET);
  await userEvent.click(screen.getByText("Elsewhere"));
  await userEvent.click(screen.getByText("Save dashboard"));

  await waitFor(() => expect(updateDashboard).toHaveBeenCalled());
  expect(updateDashboard.mock.calls[0][0].newProperties.secretChanges).toEqual([
    { ...pathOf(layerPlace), value: SECRET },
  ]);
});
