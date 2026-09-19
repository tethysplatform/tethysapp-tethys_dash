// Step two of `npm run generate:epsg`: decide which of PROJ's EPSG definitions
// the browser can actually be trusted with, and write the table the map ships.
//
// Every candidate is transformed at five control points spread across its own
// area of use and compared against PROJ's answer at each. Every point has to
// agree: a definition can be right in the middle of its domain and wrong at the
// edges, and a datum shift reduced to seven Helmert parameters from a grid is
// wrong by different amounts in different regions. A definition that
// throws, returns non-finite coordinates, or lands further than the tolerance
// from PROJ is dropped -- not shipped with a caveat. A dropped code makes the
// layer fail with a message naming it, which an author can act on; a shipped
// one that is quietly 5 km out draws a raster in the wrong place and says
// nothing. The drop list is carried in the artifact so that message can say
// what was wrong rather than "unknown code".
//
// Two kinds of definition get dropped. Most are datums whose accurate shift to
// WGS 84 is a grid file no browser can read -- NAD27 above all, which the
// Helmert alternative misplaces by tens of metres and in places by more than a
// hundred. The rest are projections proj4 does not implement as PROJ does:
// south- and west-orientated grids (South African Gauss, Krovak), whose axis
// order it ignores, and a handful of methods it lacks outright.

import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const proj4 = require("proj4");

const here = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = join(here, "candidates.json");
const DESTINATION = join(
  here,
  "..",
  "..",
  "reactapp",
  "components",
  "map",
  "epsgDefinitions.json",
);

// How far from PROJ a definition may land and still be shipped. Five metres is
// below what is visible at the zoom levels a dashboard raster is read at, and
// it is wide enough for a datum whose best PROJ operation needs a grid file to
// ship on its Helmert alternative where that alternative is good -- OSGB36
// comes in at 4.08 m -- while still refusing the ones where it is not: NAD27
// through a Helmert is 121 m out. Measured against the whole EPSG set: 1 m
// ships 4,670 definitions, 5 m ships 5,206, 50 m ships 5,554. The last of those
// is the one to resist -- a 50 m offset on a flood depth map is invisible as an
// error and reads as data.
const TOLERANCE_METERS = 5;

// Metres per degree at the equator, and per degree of latitude. Only used to
// put a geographic CRS's error on the same scale as a projected one's, so the
// approximation is deliberate.
const METERS_PER_DEGREE_LON = 111320;
const METERS_PER_DEGREE_LAT = 110540;

// Tokens PROJ emits that proj4 has no use for. Dropping them is worth ~90 KiB
// across the table and changes nothing about how a definition transforms.
const NOISE_TOKENS = /\s\+(?:type=crs|no_defs)\b/g;

/**
 * The definition as the browser will see it: PROJ's proj4 string, plus the
 * datum shift PROJ leaves out.
 *
 * proj4 reads +towgs84 rotations in the position vector convention. PROJ states
 * which convention each operation uses, and the two differ by the sign of all
 * three rotations, so a coordinate frame operation is negated on the way in.
 */
function definitionFor(candidate) {
  const base = candidate.proj4.replace(NOISE_TOKENS, "");
  if (!candidate.towgs84) return base;
  const [x, y, z, rx, ry, rz, s] = candidate.towgs84.params;
  const flip = candidate.towgs84.convention === "coordinate_frame" ? -1 : 1;
  const params = [x, y, z, rx * flip, ry * flip, rz * flip, s];
  return `${base} +towgs84=${params.join(",")}`;
}

/** How far proj4's answer falls from PROJ's, in metres. */
function errorMeters(definition, got, expected, lat) {
  const dx = got[0] - expected[0];
  const dy = got[1] - expected[1];
  if (!/\+proj=longlat/.test(definition)) {
    return Math.hypot(dx, dy);
  }
  const scaleX = METERS_PER_DEGREE_LON * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dx * scaleX, dy * METERS_PER_DEGREE_LAT);
}

/**
 * The worst disagreement with PROJ across the CRS's control points, or null if
 * proj4 could not transform one of them at all.
 */
function worstError(definition, code, controls) {
  let worst = 0;
  for (const [lon, lat, expectedX, expectedY] of controls) {
    let result;
    try {
      result = proj4("EPSG:4326", code, [lon, lat]);
    } catch {
      return null;
    }
    if (!result || !Number.isFinite(result[0]) || !Number.isFinite(result[1])) {
      return null;
    }
    worst = Math.max(
      worst,
      errorMeters(definition, result, [expectedX, expectedY], lat),
    );
  }
  return worst;
}

function main() {
  const { projVersion, epsgVersion, probePoints, reference, candidates } =
    JSON.parse(readFileSync(CANDIDATES, "utf8"));

  const definitions = {};
  const unsupported = {};
  const tally = { shipped: 0, method: 0, axis: 0, inaccurate: 0 };
  let worst = 0;

  for (const [code, candidate] of Object.entries(candidates)) {
    const definition = definitionFor(candidate);
    const epsgCode = `EPSG:${code}`;

    let error;
    try {
      proj4.defs(epsgCode, definition);
      error = worstError(definition, epsgCode, candidate.controls);
    } catch {
      error = null;
    }

    if (error === null) {
      unsupported[code] = ["method", candidate.name];
      tally.method += 1;
      continue;
    }

    if (!(error <= TOLERANCE_METERS)) {
      // A south- or west-orientated grid is off by the width of the projection
      // rather than by a datum's worth of metres, and it is worth saying so:
      // the author's options are different from "this datum needs a grid file".
      const reason = /\+axis=/.test(candidate.proj4) ? "axis" : "inaccurate";
      unsupported[code] = [reason, candidate.name];
      tally[reason] += 1;
      continue;
    }

    definitions[code] = definition;
    tally.shipped += 1;
    worst = Math.max(worst, error);
  }

  const artifact = {
    generated: new Date().toISOString().slice(0, 10),
    projVersion,
    epsgVersion,
    probePoints,
    reference,
    toleranceMeters: TOLERANCE_METERS,
    definitions,
    unsupported,
  };
  writeFileSync(DESTINATION, JSON.stringify(artifact));

  const bytes = JSON.stringify(artifact).length;
  process.stderr.write(
    `shipped ${tally.shipped} definitions (worst ${worst.toFixed(2)} m of ` +
      `${TOLERANCE_METERS} m), dropped ${tally.method} unimplemented, ` +
      `${tally.axis} axis-orientated, ${tally.inaccurate} inaccurate; ` +
      `${(bytes / 1024).toFixed(0)} KiB\n`,
  );
}

main();
