"""Extract every EPSG CRS that PROJ can express as a proj4 string.

Step one of `npm run generate:epsg`. Step two (build.mjs) decides which of these
the browser's proj4 can actually reproduce, and writes the table the frontend
ships. The work is split in two because each half needs a different runtime:
PROJ's EPSG database is reachable from pyproj, and the only authority on what
proj4js can do is proj4js itself.

What each entry carries, and why:

  proj4     The definition, from PROJ. `to_proj4()` deliberately drops the datum
            shift (PROJ 6+ transforms through its own operation database rather
            than through +towgs84), so the shift is reconstructed separately --
            without it a raster on a local datum lands tens to hundreds of
            metres off, which looks plausible and is wrong.

  towgs84   Seven Helmert parameters, taken from the most accurate PROJ
            operation to WGS 84 that needs no grid file. Grid-based operations
            are skipped because the browser has no grids to read: for a datum
            whose best operation is a grid (OSGB36, NAD27), the Helmert
            alternative PROJ also publishes is what gets used, and build.mjs
            measures the resulting error rather than assuming it is small.

  controls  Five points to probe, and PROJ's own answer at each. They are
            spread across the CRS's area of use rather than gathered at its
            centre, because the two things being checked vary differently across
            it: projection error grows away from the standard parallels, and the
            error left by reducing a grid-based datum shift to seven Helmert
            parameters varies by region -- NAD27 is within a few metres in one
            state and tens of metres in another. One point in the middle would
            pass both. None of them sits at the projection's origin, where the
            answer is the false easting no matter how wrong the definition is.
            Each answer comes from the full 4326 -> CRS pipeline, datum shift
            included, so build.mjs compares what a map actually asks for. PROJ
            answers with its grid-based operations, fetching the grids it needs,
            so the comparison is against where the data really belongs -- not
            against the same Helmert approximation the browser is handed. See
            ensure_grids_available.
"""

import json
import re
import sys
import warnings
from pathlib import Path

import pyproj
from pyproj import CRS, Transformer, __proj_version__, database
from pyproj.transformer import TransformerGroup

# `to_proj4()` warns, every time, that a proj4 string cannot carry everything a
# CRS knows. That is the whole reason build.mjs checks each definition against
# PROJ rather than trusting it, and 5,800 copies of the warning would bury the
# summary this script prints.
warnings.filterwarnings("ignore")

# One `step proj=helmert ...` run inside a PROJ pipeline definition.
HELMERT_STEP = re.compile(r"step proj=helmert ([^\n]*?)(?= step |$)")

# Grid-driven steps. A pipeline carrying any of these cannot be reduced to
# +towgs84, because the grid is a file the browser will never have.
GRID_STEPS = (
    "proj=hgridshift",
    "proj=vgridshift",
    "proj=gridshift",
    "proj=xyzgridshift",
)

WGS84 = CRS.from_epsg(4326)

# OSGB36 -> WGS 84: a datum whose accurate transformation is an NTv2 grid
# (OSTN15) and whose Helmert alternative is several metres out. The point is in
# England, well inside the grid's coverage.
GRID_CANARY = {
    "crs": 27700,
    "lonLat": (0.1733, 51.6267),
    "gridless": (550531.33, 194220.10),
}


def ensure_grids_available():
    """Fail rather than quietly validate against PROJ's gridless fallback.

    PROJ fetches the grid files a datum shift needs, but only with its network
    enabled -- and when a grid cannot be reached it does not raise: it falls back
    to the next best operation, which is the same Helmert the browser would use.
    Every grid-based datum would then agree with itself perfectly and ship no
    matter how far out it really is, which is the one thing this pipeline exists
    to prevent. So transform a point whose two answers are known to differ, and
    stop if they do not.
    """
    pyproj.network.set_network_enabled(True)
    x, y = Transformer.from_crs(
        WGS84, CRS.from_epsg(GRID_CANARY["crs"]), always_xy=True
    ).transform(*GRID_CANARY["lonLat"])
    gridless_x, gridless_y = GRID_CANARY["gridless"]
    if abs(x - gridless_x) < 1 and abs(y - gridless_y) < 1:
        raise SystemExit(
            "PROJ answered EPSG:27700 with its gridless fallback, so its grid "
            "files are not reachable. Regenerating now would validate every "
            "grid-based datum against the very approximation it ships. Check "
            "network access to PROJ's CDN (cdn.proj.org), or install the "
            "proj-data package, and run again."
        )


def helmert_to_wgs84(crs):
    """Seven Helmert parameters to WGS 84, or None when PROJ has no gridless path.

    Several operations usually exist for one datum, differing in accuracy and in
    what they need; the most accurate gridless one wins. Rotations are returned
    in PROJ's own sign convention along with the convention name, because
    position_vector and coordinate_frame differ by the sign of all three -- a
    difference of a few metres at mid latitudes, silent if it is got wrong.
    """
    try:
        group = TransformerGroup(crs, WGS84, always_xy=True)
    except Exception:
        return None

    best = None
    for transformer in group.transformers:
        definition = transformer.definition
        if any(step in definition for step in GRID_STEPS):
            continue
        steps = HELMERT_STEP.findall(definition)
        # Exactly one: a pipeline chaining two Helmerts is a datum-to-datum-to-
        # WGS84 hop that no single +towgs84 can express.
        if len(steps) != 1:
            continue
        fields = dict(pair.split("=", 1) for pair in steps[0].split() if "=" in pair)
        try:
            params = [
                float(fields.get(key, 0))
                for key in ("x", "y", "z", "rx", "ry", "rz", "s")
            ]
        except ValueError:
            continue
        accuracy = transformer.accuracy
        # PROJ reports -1 for "unknown"; rank those last rather than first.
        rank = accuracy if accuracy is not None and accuracy >= 0 else float("inf")
        if best is None or rank < best[0]:
            best = (rank, params, fields.get("convention", "position_vector"))

    if best is None:
        return None
    _, params, convention = best
    # An all-zero Helmert is the datum already being WGS 84 for our purposes.
    # Emitting it would only add bytes.
    if not any(abs(value) > 1e-9 for value in params):
        return None
    return {"params": params, "convention": convention}


# Where in the area of use to probe, as (west->east, south->north) fractions.
# Off-centre and off-axis: a definition wrong in its scale factor or its datum
# shift is wrong by different amounts in different parts of its own domain.
PROBE_FRACTIONS = (
    (1 / 3, 1 / 3),
    (2 / 3, 2 / 3),
    (1 / 6, 5 / 6),
    (5 / 6, 1 / 6),
    (1 / 2, 1 / 2),
)


def control_points(crs):
    """Points across the CRS's area of use, with PROJ's answer at each."""
    area = crs.area_of_use
    if area is None:
        return []

    # An area of use that crosses the antimeridian is stored with west > east;
    # interpolating between them as written would walk the long way round the
    # globe and probe the other side of the planet.
    span = area.east - area.west
    if span < 0:
        span += 360

    transformer = Transformer.from_crs(WGS84, crs, always_xy=True)
    points = []
    for east_fraction, north_fraction in PROBE_FRACTIONS:
        lon = area.west + span * east_fraction
        if lon > 180:
            lon -= 360
        lat = area.south + (area.north - area.south) * north_fraction
        try:
            x, y = transformer.transform(lon, lat)
        except Exception:
            continue
        if abs(x) < 1e12 and abs(y) < 1e12:
            points.append([lon, lat, x, y])
    return points


def main():
    ensure_grids_available()

    out = {}
    skipped = {"no_proj4": 0, "no_control": 0}

    for crs_type in ("PROJECTED_CRS", "GEOGRAPHIC_2D_CRS"):
        for info in database.query_crs_info(auth_name="EPSG", pj_types=[crs_type]):
            try:
                crs = CRS.from_epsg(info.code)
                definition = (crs.to_proj4() or "").strip()
            except Exception:
                definition = ""
            if not definition:
                skipped["no_proj4"] += 1
                continue

            controls = control_points(crs)
            if not controls:
                skipped["no_control"] += 1
                continue

            entry = {
                "name": crs.name,
                "proj4": definition,
                "controls": controls,
            }
            helmert = helmert_to_wgs84(crs)
            if helmert:
                entry["towgs84"] = helmert
            out[info.code] = entry

    payload = {
        "projVersion": __proj_version__,
        "epsgVersion": database.get_database_metadata("EPSG.VERSION"),
        # Provenance for the built table: how many points each definition was
        # checked at, and against what. Both change what the tolerance means.
        "probePoints": len(PROBE_FRACTIONS),
        "reference": "PROJ, grid-based operations included",
        "candidates": out,
    }
    destination = Path(__file__).with_name("candidates.json")
    destination.write_text(json.dumps(payload))
    print(
        f"extracted {len(out)} candidates "
        f"(PROJ {payload['projVersion']}, EPSG {payload['epsgVersion']}), "
        f"skipped {skipped}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
