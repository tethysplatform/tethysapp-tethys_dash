import { act, renderHook } from "@testing-library/react";
import useSourceArgumentDiscovery from "components/modals/MapLayer/sourceArgumentDiscovery";
import { updateObjectWithVariableInputs } from "components/visualizations/utilities";
import { listArrays } from "components/map/zarrReader";
import { s3UrlToHttps } from "components/map/ModuleLoader";

// Its own file because the substituter has to be mocked at module scope: the
// main suite exercises real substitution throughout, and swapping it per test
// there would mean resetting modules, which hands the hook a second React.
jest.mock("components/visualizations/utilities", () => ({
  updateObjectWithVariableInputs: jest.fn(),
  getDependentVariableInputs: () => ["Storm"],
}));
jest.mock("components/map/zarrReader", () => ({
  listArrays: jest.fn(),
  readMetadata: jest.fn(),
}));
jest.mock("components/map/ModuleLoader", () => ({
  s3UrlToHttps: jest.fn(),
  listGeoPackageTables: jest.fn(),
  invalidateGeoPackageTables: jest.fn(),
  listGeoParquetColumns: jest.fn(),
  invalidateGeoParquetColumns: jest.fn(),
}));

beforeEach(() => {
  s3UrlToHttps.mockReset().mockImplementation((url) => url);
  listArrays
    .mockReset()
    .mockResolvedValue({ names: ["depth"], enumerated: true });
});

async function loadWith(implementation) {
  updateObjectWithVariableInputs.mockReset().mockImplementation(implementation);
  const { result } = renderHook(() =>
    useSourceArgumentDiscovery({
      sourceProps: {
        type: "Zarr",
        // eslint-disable-next-line no-template-curly-in-string
        props: { url: "https://host/${Storm}.zarr" },
      },
      variableInputValues: { Storm: "ida" },
      variableInputDateFormats: {},
    }),
  );
  await act(async () => result.current.load("variable"));
  return result;
}

test("a substituter that throws leaves the template unresolved rather than reading", async () => {
  const result = await loadWith(() => {
    throw new Error("substitution blew up");
  });

  // The value still carries its ${...}, which is not an address. No key, no
  // read -- rather than a request at a half-built url.
  expect(result.current.discoveries.variable.state).toBe("nokey");
  expect(listArrays).not.toHaveBeenCalled();
});

test("a substituter returning nothing usable is treated the same way", async () => {
  const result = await loadWith(() => ({}));

  expect(result.current.discoveries.variable.state).toBe("nokey");
  expect(listArrays).not.toHaveBeenCalled();
});

test("a substituted url is what gets read", async () => {
  const result = await loadWith(() => ({ value: "https://host/ida.zarr" }));

  expect(listArrays).toHaveBeenCalledWith({ url: "https://host/ida.zarr" });
  expect(result.current.discoveries.variable.state).toBe("ready");
});

test("substitution still runs when no variable input context is supplied", async () => {
  // The hook's callers always pass these, but the defaults exist so a caller
  // that does not is handed empty maps rather than undefined.
  updateObjectWithVariableInputs
    .mockReset()
    .mockImplementation(({ variableInputs, variableInputDateFormats }) => {
      expect(variableInputs).toEqual({});
      expect(variableInputDateFormats).toEqual({});
      return { value: "https://host/plain.zarr" };
    });

  const { result } = renderHook(() =>
    useSourceArgumentDiscovery({
      sourceProps: {
        type: "Zarr",
        // eslint-disable-next-line no-template-curly-in-string
        props: { url: "https://host/${Storm}.zarr" },
      },
    }),
  );
  await act(async () => result.current.load("variable"));

  // Storm is unsatisfied against an empty map, so no read is attempted.
  expect(result.current.discoveries.variable.state).toBe("nokey");
  expect(listArrays).not.toHaveBeenCalled();
});
