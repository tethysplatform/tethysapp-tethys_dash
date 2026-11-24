// The browser half of the substitution parity fixture. The server runs a
// viewer's data request from the tile's saved args, taking from the request
// only what the browser fills in for them (tethysapp/tethysdash/saved_settings.py).
// Each fixture case records what the browser sends for its saved args; this
// test holds the browser to that record, and the pytest holds the server's
// arg builder to the run args it makes of it.
import fs from "fs";
import path from "path";
import {
  dataRequestArgs,
  getVisualization,
  updateObjectWithVariableInputs,
} from "components/visualizations/utilities";
import appAPI from "services/api/app";

const fixture = JSON.parse(
  fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../../tethysapp/tethysdash/tests/fixtures/substitution_parity.json",
    ),
    "utf8",
  ),
);

// toLocalISO's shape: local wall clock plus the UTC offset.
const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

// The call getVisualization (and the variable input preload) makes for a
// dashboard tile: every date-typed arg is resolved to local ISO.
function tileRequestArgs(fixtureCase) {
  return updateObjectWithVariableInputs({
    args: fixtureCase.saved_args,
    variableInputs: fixtureCase.variables,
    variableInputDateFormats: fixtureCase.date_formats ?? {},
    sourceArgs: fixtureCase.arg_types,
    returnDatesAsLocalISO: true,
  });
}

// The call runtimeLayerFetcher's resolveLayerArgs makes for a dynamic layer:
// no arg types, so no date arg is resolved.
function layerRequestArgs(fixtureCase) {
  return updateObjectWithVariableInputs({
    args: fixtureCase.saved_args,
    variableInputs: fixtureCase.variables ?? {},
    variableInputDateFormats: fixtureCase.date_formats,
  });
}

const REQUEST_ARGS = { tile: tileRequestArgs, layer: layerRequestArgs };

function getPath(object, keys) {
  return keys.reduce((value, key) => value[key], object);
}

function setPath(object, keys, value) {
  getPath(object, keys.slice(0, -1))[keys[keys.length - 1]] = value;
}

// What a value that depends on the clock or the time zone must share with the
// one recorded in the fixture's time zone.
const COMPARABLE = {
  date: () => "any date",
  instant: (value) => new Date(value).toISOString(),
  wall_clock: (value) => value.slice(0, 19),
};

describe("substitution parity fixture", () => {
  it.each(fixture.cases.map((fixtureCase) => [fixtureCase.name, fixtureCase]))(
    "%s",
    (_name, fixtureCase) => {
      const sent = REQUEST_ARGS[fixtureCase.kind](fixtureCase);

      // Each dynamic value is held to its comparison, then replaced by the
      // recorded one for the exact match.
      for (const { path: keys, compare } of fixtureCase.dynamic ?? []) {
        const actual = getPath(sent, keys);
        const recorded = getPath(fixtureCase.sent_args, keys);
        expect(actual).toMatch(LOCAL_ISO);
        expect(Number.isNaN(Date.parse(actual))).toBe(false);
        expect(COMPARABLE[compare](actual)).toBe(COMPARABLE[compare](recorded));
        setPath(sent, keys, recorded);
      }

      expect(sent).toEqual(fixtureCase.sent_args);
      // Of which a viewer's request sends these alone.
      expect(
        Object.keys(
          dataRequestArgs({
            rawArgs: fixtureCase.saved_args,
            resolvedArgs: sent,
            argTypes: fixtureCase.arg_types,
            kind: fixtureCase.kind,
            allArgs: false,
          }),
        ).sort(),
      ).toEqual(fixtureCase.viewer_sent_keys);
    },
  );
});

// The fixture reproduces getVisualization's call rather than driving the tile,
// so a tile whose variables are all set is also run through getVisualization
// itself: a change to its call would otherwise leave the fixture checking a
// call no tile makes.
describe("getVisualization sends what the tile call shape produces", () => {
  const casesByName = Object.fromEntries(
    fixture.cases.map((fixtureCase) => [fixtureCase.name, fixtureCase]),
  );

  it.each([
    "exact tokens keep the variable's own type",
    "an inline template takes the request's string when only a token span changed",
    "a nested token takes only its own leaf",
    "a fixed date and time takes the browser's reading of it",
    "a date range resolves each endpoint by its own rule",
  ])("%s", async (name) => {
    const fixtureCase = casesByName[name];
    const spy = jest
      .spyOn(appAPI, "getVisualizationData")
      .mockResolvedValue({ success: true, viz_type: "text", data: {} });

    await getVisualization({
      setVizType: jest.fn(),
      setVizData: jest.fn(),
      sourceType: "text",
      sourceArgs: fixtureCase.arg_types,
      itemData: { source: "parity_plugin", args: fixtureCase.saved_args },
      argsString: JSON.stringify(fixtureCase.saved_args),
      metadataString: "{}",
      variableInputValues: fixtureCase.variables,
      dashboardView: false,
      variableInputDateFormats: fixtureCase.date_formats ?? {},
      // Every arg, so the whole call shape is compared.
      allArgs: true,
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].args).toEqual(tileRequestArgs(fixtureCase));
  });
});
