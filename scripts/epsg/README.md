# EPSG definition table

`npm run generate:epsg` writes `reactapp/components/map/epsgDefinitions.json`, the table the
map resolves coordinate reference systems through. Both steps run from the repo root:

```bash
python scripts/epsg/extract.py   # PROJ's definitions -> scripts/epsg/candidates.json
node scripts/epsg/build.mjs      # validated subset  -> reactapp/components/map/epsgDefinitions.json
```

`extract.py` needs pyproj (it ships PROJ's EPSG database) and network access to PROJ's grid
CDN: the answers it records have to come from PROJ's most accurate transformations, grids
included, or every grid-based datum would be checked against the same approximation the
browser is being handed. It refuses to run when the grids are unreachable rather than
producing a table built on that comparison. `build.mjs` needs the repo's `node_modules`. The
intermediate `candidates.json` is not committed — only the built table is.

Regenerate when PROJ's EPSG database moves on, or when changing what the table carries. The
artifact records the PROJ and EPSG versions it was built from and the tolerance it was built
to, so a stale table can be told apart from a differently-built one. Each script's header
explains what it does and why; `reactapp/components/map/projections.js` explains how the map
reads the result.
