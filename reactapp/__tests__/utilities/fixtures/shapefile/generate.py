"""Regenerate the shapefile test fixtures.

Run from the repo root:  python3 reactapp/__tests__/utilities/fixtures/shapefile/generate.py

These are real shapefile bytes rather than hand-crafted ones, because the
behavior under test is how a parser interprets the format's own conventions --
notably that polygon interior rings are encoded by winding direction with no
parent pointer. pyshp writes the files and also reads them back through its own
independent ring-nesting implementation, which is what makes the expected
GeoJSON in index.test.js a cross-implementation oracle rather than a
self-consistency check.
"""

import json
import os

import shapefile

HERE = os.path.dirname(os.path.abspath(__file__))

ESRI_ALBERS_PRJ = (
    'PROJCS["NAD_1983_Albers",GEOGCS["GCS_North_American_1983",'
    'DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137.0,298.257222101]],'
    'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]],'
    'PROJECTION["Albers"],PARAMETER["False_Easting",0.0],'
    'PARAMETER["False_Northing",0.0],PARAMETER["Central_Meridian",-96.0],'
    'PARAMETER["Standard_Parallel_1",29.5],PARAMETER["Standard_Parallel_2",45.5],'
    'PARAMETER["Latitude_Of_Origin",23.0],UNIT["Meter",1.0]]'
)

# Shapefile convention: exterior rings clockwise, interior rings counter-clockwise.
OUTER_CW = [(0, 0), (0, 10), (10, 10), (10, 0), (0, 0)]
HOLE_CCW = [(3, 3), (7, 3), (7, 7), (3, 7), (3, 3)]
ISLAND_A_CW = [(0, 0), (0, 4), (4, 4), (4, 0), (0, 0)]
ISLAND_B_CW = [(20, 20), (20, 24), (24, 24), (24, 20), (20, 20)]


def write(name, build):
    path = os.path.join(HERE, name)
    writer = shapefile.Writer(path)
    build(writer)
    writer.close()
    with open(path + ".prj", "w") as handle:
        handle.write(ESRI_ALBERS_PRJ)
    with shapefile.Reader(path) as reader:
        return {
            "shapeType": reader.shapeTypeName,
            "fields": [f[0] for f in reader.fields if f[0] != "DeletionFlag"],
            "features": [s.__geo_interface__ for s in reader.shapeRecords()],
        }


def holes(writer):
    writer.field("NAME", "C", 40)
    writer.field("AREASQKM", "N", 12, 3)
    writer.poly([OUTER_CW, HOLE_CCW])
    writer.record("Basin with hole", 91.0)


def multipart(writer):
    writer.field("NAME", "C", 40)
    writer.poly([ISLAND_A_CW, ISLAND_B_CW])
    writer.record("Two islands, one record")


def points(writer):
    writer.field("GAGE_ID", "C", 12)
    writer.field("STAGE_FT", "N", 8, 2)
    writer.point(-105.0, 40.0)
    writer.record("06730200", 4.25)
    writer.point(-104.5, 39.5)
    writer.record("06730500", 2.5)


oracle = {
    "holes": write("holes", holes),
    "multipart": write("multipart", multipart),
    "points": write("points", points),
}
print(json.dumps(oracle, indent=2, sort_keys=True))
