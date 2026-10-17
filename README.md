# Dane County Elections

A compact election explorer for Dane County, Wisconsin, published on GitHub Pages.

- **Results:** the latest election, official race totals, precinct search, and a clickable ward map. Checks for updated results every 30 seconds while visible.
- **Board:** all races with search and a saved watchlist.
- **Archive:** two compact election/race controls open searchable menus. Elections are grouped by year, with optional type/cycle controls. Race search matches candidate names, offices, districts, and places across the full archive. Matching races open their election and map together.
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
