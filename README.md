# Dane County Elections

A compact election explorer for Dane County, Wisconsin, published on GitHub Pages.

- **Results:** November and partisan-primary views for the current fall cycle, official race totals, precinct search, and a ward map. November is the default. Checks every 30 seconds while visible; unpublished elections show a waiting state and connect automatically when added to the county feed.
- **Board:** all races with search and a saved watchlist, using the same November / Primary toggle as Results.
- **Archive:** two compact election/race controls open searchable menus. Elections are grouped by year, with optional type/cycle controls. Race search matches candidate names, offices, districts, and places across the full archive. Matching races open their election and map together. Both the election and race search boxes accept candidate names. Desktop ward details open on hover; touchscreen users tap.
- **Trends:** search candidate history and compare vote shares between elections.

Coalitions, Targets, Simulate, and the AD76 planning view have been removed.

## Data and map

Election data comes directly from `https://api.danecounty.gov/api/v1/elections`. Shared links use `?e=ELECTION_ID&r=RACE_ID`; leading zeroes in race IDs are preserved. Errors are shown with a retry control; failed requests are never presented as successful refreshes.

The street map uses the standard OpenStreetMap tile service, with attribution and normal browser caching. No map API key is required. Street tiles can be disabled without losing the locally hosted ward boundaries or election results. There is no bulk/offline tile download.

`public/dane_wards.geojson` supplies the ward geometry. Historical precinct boundaries can differ from that geometry. The map reports how many result wards matched, and unmatched areas remain neutral. A combined precinct's original totals are shown with an explicit combined-wards label; the county does not publish individual ward counts for these precincts. Fractional allocations used internally preserve the combined totals and candidate shares rather than rounding invented ward counts.

## Development

Use Node 20.9+ and run `npm ci`, then `npm run dev`.

- `npm test`: regression checks for archive filters, office categories, county response parsing, grouped precinct totals, and primary candidate colors.
- `npx tsc --noEmit`: type checking.
- `npm run build`: static export to `out/` with the GitHub Pages base path.
- `npx next build --webpack`: equivalent export for environments where Turbopack cannot start its worker process.

Pushes to `main` run the test suite, build, and GitHub Pages deployment. The build does not download historical/planning datasets or rely on the county API being online.

### Archive search and map sources

Candidate search uses `public/data/archive-index.json` (names and race IDs only).
Run `node scripts/build-archive-index.mjs` to refresh it. Search checks each
entry against the county's current `LastPublished`; new or changed elections
fall back to the county API. An unavailable index also falls back to the API.
Actual vote totals always come from the county, never from the search index.

Dated LTSB ward snapshots and their original source links are recorded in
`src/lib/boundary-manifest.json`. The map chooses the latest snapshot on or
before the election date. Where no same-year snapshot exists, it explicitly
labels the layer as a reference. Unmatched precincts remain in official race
totals and are listed below the map. Combined precinct totals are labeled;
individual ward vote counts are not inferred for display. Lettered wards
remain distinct. Trends excludes combined precincts and changed geometries.

To rebuild boundary assets, install `pyshp pyproj shapely fiona` and run
`python scripts/build-boundaries.py`. This extracts only Dane County geometry,
merges separate pieces of each ward, repairs invalid polygon topology, and
simplifies lines by approximately one meter for web display. No redistributed
LTSB vote estimates are imported. These refresh scripts are deliberately not
build dependencies, so a county/GIS outage cannot break deployment.

The connection badge uses successful fetch timestamps and the county's explicit
`FinalizedDate`; 100% precinct reporting alone does not mark a race final.
