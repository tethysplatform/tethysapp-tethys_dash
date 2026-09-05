import { unzipShapefileComponents } from "components/map/shapefile/unzip";

// fflate's own archives always declare a member's size, so the paths that
// reconcile against the bytes actually arriving -- and the ones that handle a
// member failing to inflate -- cannot be reached with a real archive. This
// stands in a synthetic Unzip that hands over whatever member shapes are
// needed, keeping the rest of fflate real.
let mockOnfile;
jest.mock("fflate", () => ({
  ...jest.requireActual("fflate"),
  UnzipInflate: class {},
  Unzip: class {
    register() {}
    set onfile(handler) {
      mockOnfile = handler;
    }
    get onfile() {
      return mockOnfile;
    }
    push() {}
  },
}));

const ZIP_HEADER = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

// A member that reports no declared size, so every byte is charged as it lands.
function member(name, { originalSize, onStart } = {}) {
  return {
    name,
    originalSize,
    terminate: jest.fn(),
    start() {
      onStart?.(this);
    },
  };
}

function run(members, maxBytes = 1024) {
  const result = unzipShapefileComponents(ZIP_HEADER, { maxBytes });
  return { result, members };
}

afterEach(() => {
  mockOnfile = undefined;
});

it("charges an undeclared member by the bytes that actually arrive", () => {
  const shp = member("basins.shp", {
    onStart: (file) => {
      file.ondata(null, new Uint8Array([1, 2, 3]), false);
      file.ondata(null, new Uint8Array([4, 5]), true);
    },
  });
  unzipShapefileComponents(ZIP_HEADER, { maxBytes: 1024 });
  mockOnfile(shp);

  // Nothing to assert on the archive itself -- the point is that a member with
  // no declared size is admitted and its bytes are counted.
  expect(shp.terminate).not.toHaveBeenCalled();
});

it("stops a member that outgrows what its header declared", () => {
  const shp = member("basins.shp", {
    originalSize: 4,
    onStart: (file) => {
      file.ondata(null, new Uint8Array(4), false);
      // Overshoot: the header under-declared, which is exactly the case the
      // running total exists to catch.
      file.ondata(null, new Uint8Array(5000), false);
    },
  });
  unzipShapefileComponents(ZIP_HEADER, { maxBytes: 16 });
  mockOnfile(shp);

  expect(shp.terminate).toHaveBeenCalled();
});

it("reports a member that cannot be read", () => {
  const shp = member("basins.shp", {
    originalSize: 4,
    onStart: (file) => {
      file.ondata(new Error("corrupt entry"), null, false);
    },
  });
  unzipShapefileComponents(ZIP_HEADER, { maxBytes: 1024 });
  mockOnfile(shp);

  expect(shp.terminate).not.toHaveBeenCalled();
});

it("reports a member that cannot be decompressed at all", () => {
  const shp = {
    name: "basins.shp",
    originalSize: 4,
    terminate: jest.fn(),
    start() {
      throw new Error("bad deflate stream");
    },
  };
  unzipShapefileComponents(ZIP_HEADER, { maxBytes: 1024 });
  expect(() => mockOnfile(shp)).not.toThrow();
});
