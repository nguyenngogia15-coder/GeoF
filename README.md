# GEOF website

Static website of the GEOF (Geo.F) research group: `index.html` (main site) and `geomap.html` (GeoMap).
Plain HTML/CSS/JS, hosted on GitHub Pages. Day-to-day editing is described (in Vietnamese) in [HUONG-DAN.md](HUONG-DAN.md);
conventions for Claude Code are in [CLAUDE.md](CLAUDE.md).

```
content/   all editable content (JSON + photos)        tools/   build, publish, checks
assets/    compressed photos (generated)                geodata/ map boundary data (+ sources)
data.js, geomap-data.js   generated, do not edit        vendor/  d3 v7.9.0 (bundled)
```

Build: `node tools/build.js` (or double-click `publish.bat` / `preview.bat`).

## GeoMap

`geomap.html` is an interactive map of Vietnam showing GEOF field sites. The map is **drawn directly from GeoJSON with D3
(SVG)**. No third-party map tiles (Google, Bing, OSM, Mapbox…) are used for the base layer, and there is no satellite or terrain layer.
Projection: Web Mercator (`d3.geoMercator`); the scale bar is computed from the projection and is exact at the centre of the view.

### Data sources and licences

| Layer | Source | Licence |
|---|---|---|
| Provinces and coastal islands | [geoBoundaries](https://www.geoboundaries.org/) gbOpen, Vietnam ADM1 (build 19 Jan 2023, derived from Wikipedia / Wikimedia Commons, **2008 boundaries**, 64 provinces) | Public domain (per the geoBoundaries metadata for this layer) |
| Hoàng Sa (Paracel Islands) and Trường Sa (Spratly Islands) | The same geoBoundaries layer contains both groups (Đà Nẵng and Khánh Hòa) but only a few small islets, so they are **not drawn as shapes**. They are shown as **dots with names**, using named features and coordinates from [Wikidata](https://www.wikidata.org/) | CC0 |
| Sample place coordinates | OpenStreetMap Nominatim and Wikidata (see `coordinate_source` in each `info.json`) | © OpenStreetMap contributors (ODbL) / CC0 |
| Library | d3 v7.9.0 (`vendor/d3.v7.9.0.min.js`) | ISC |

Raw source files are kept in `geodata/source-*`; `node tools/geo-prepare.js` regenerates the simplified files from them
(Visvalingam simplification with `topojson-simplify`, polygon winding fixed for d3). Provinces are simplified; nothing else is.

Notes for readers of the data:
- The boundaries are the 2008 provincial borders, so they differ from the 2025 province mergers. The map says "Boundaries shown for illustration".
- Names on the map are those of Vietnam: "Hoàng Sa (Paracel Islands)", "Trường Sa (Spratly Islands)" and "East Sea" (Biển Đông).
- Features excluded from the Wikidata list: Luconia Shoals (off Sarawak), Louisa Reef (no Vietnamese-language label in Wikidata) and non-geographic items (a battle, a blue hole, an observatory).

### Places

Each field site is `content/places/<name>/info.json` plus photos in the same folder (copy `content/places/_mau`).
Fields: `id, name, province, lat, lng, coordinate_source, date_visited, project, direction, summary, geology_notes,
photos[{file, caption, credit}], members, links, verified, demo`.

- **Coordinates are never guessed.** `coordinate_source` is required. `verified: true` means two independent sources agree within about 3 km;
  otherwise the marker has a dashed outline and the panel says "Approximate location".
- `tools/build.js` checks every place: it must lie inside a Vietnamese province polygon, on an island polygon, within 5 km of a named
  Hoàng Sa / Trường Sa feature, or within 5 km of the coast. Otherwise the build stops with a Vietnamese error naming the place
  (and detects swapped `lat`/`lng`). Run it alone with `node tools/check-places.js`.
- The 7 places currently in the repository are **sample / demo data** (`"demo": true`): they are labelled "Demo data" and "SAMPLE" and must be replaced
  with real field sites. They do not describe real GEOF visits.
