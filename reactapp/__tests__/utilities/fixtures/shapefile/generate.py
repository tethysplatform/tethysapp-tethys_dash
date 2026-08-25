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


# Non-ASCII attribute values in a NUL-padded .dbf, which is what Natural Earth
# ships and what no amount of String.prototype.trim() will clean up. Written with
# a .cpg so both halves of the encoding path have a fixture: the declared
# encoding, and (by deleting the .cpg in a test) the sniffed one.
def encoded(writer):
    writer.field("NAME", "C", 40)
    writer.field("LOCALNAME", "C", 24)
    writer.field("POP", "N", 10)
    writer.point(-93.364, 46.0592)
    writer.record("Miñnesota 明尼苏达州", "", 5707390)


def nul_pad_dbf(path):
    """Rewrite the .dbf's space padding as NUL padding, in place.

    pyshp pads with spaces, which trim() removes; the defect under test only
    appears with NUL padding. Only each field's own padding run is rewritten --
    trailing for character fields, leading for the right-justified numeric ones
    -- so the values themselves and the binary header are left alone.
    """
    with open(path, "rb") as handle:
        data = bytearray(handle.read())

    header_len, record_len = int.from_bytes(data[8:10], "little"), int.from_bytes(
        data[10:12], "little"
    )
    n_records = int.from_bytes(data[4:8], "little")

    fields, offset = [], 32
    while data[offset] != 0x0D:
        fields.append((chr(data[offset + 11]), data[offset + 16]))
        offset += 32

    for record in range(n_records):
        base = header_len + record * record_len + 1  # +1 skips the deletion flag
        cursor = 0
        for kind, length in fields:
            start = base + cursor
            chunk = data[start : start + length]
            if kind == "C":
                stripped = chunk.rstrip(b" ")
                chunk = stripped + b"\x00" * (length - len(stripped))
            else:
                stripped = chunk.lstrip(b" ")
                chunk = b"\x00" * (length - len(stripped)) + stripped
            data[start : start + length] = chunk
            cursor += length

    with open(path, "wb") as handle:
        handle.write(data)


def write_encoded():
    path = os.path.join(HERE, "encoded")
    writer = shapefile.Writer(path, encoding="utf-8")
    encoded(writer)
    writer.close()
    with open(path + ".prj", "w") as handle:
        handle.write(ESRI_ALBERS_PRJ)
    with open(path + ".cpg", "w") as handle:
        handle.write("UTF-8")
    nul_pad_dbf(path + ".dbf")
    return {"note": "NUL-padded utf-8 attributes; oracle asserted in the JS test"}


oracle = {
    "holes": write("holes", holes),
    "multipart": write("multipart", multipart),
    "points": write("points", points),
    "encoded": write_encoded(),
}
print(json.dumps(oracle, indent=2, sort_keys=True))
