// Turnout targeting model — how consistently each ward votes.
//
// Campaigns want to know which wards vote at a high rate across ALL elections
// vs. which only show up for president and fall off in lower-profile races
// (primaries, spring elections). We measure that per ward as:
//
//   consistency % = off-cycle turnout ÷ presidential turnout
//
//   • Peak      = ballots in the most recent presidential general (the ceiling
//                 of who's registered and votes).
//   • Off-cycle = ballots in the most recent regular Spring Election (who
//                 actually shows up when there's no presidential race on top).
//
// High % = consistent voters (reliable base, vote even in off-cycle races).
// Low  % = presidential-only (big falloff, untapped in a primary/spring race).
//
// The data is ballot counts only — there is no registration denominator — so
// this is a relative rate (share of a ward's own presidential turnout), not a
// share of registered voters. Ward keys arrive slug-form ("madison-city-1")
// and are emitted pipe-form ("City of Madison|1") to match the map/districts.

import { fetchHistoricalData, HistoricalRaceData } from './historical-api-data';
import { wardKeyToPrecinctInfo } from './projections-data';

export type TurnoutTier = 'CONSISTENT' | 'MIXED' | 'PRESIDENTIAL_ONLY';

export interface TurnoutWard {
    wardKey: string;       // pipe form: "City of Madison|46"
    displayName: string;   // "City of Madison Ward 46"
    wardNumber: string;
    presidential: number;  // peak ballots
    offCycle: number;      // off-cycle (spring) ballots
    consistency: number;   // 0–100, off-cycle as % of presidential (capped 100)
    falloff: number;       // 100 − consistency
    tier: TurnoutTier;
}

export interface TurnoutProfile {
    wards: TurnoutWard[];                  // sorted by consistency, highest first
    scoreByWard: Record<string, number>;   // pipe key → consistency, for the map overlay
    peakLabel: string;                     // e.g. "2024 Presidential"
    offCycleLabel: string;                 // e.g. "2025 Spring Election"
    avgConsistency: number;                // mean consistency across wards
}

// A ward whose presidential turnout is below this is almost always a boundary
// sliver or a renumbering artifact across cycles — excluded to keep ratios sane.
const MIN_PEAK_BALLOTS = 50;

// Prefer the newest spring election covering at least this many peak wards, so
// the off-cycle map lines up with the presidential map's ward numbering.
const MIN_OFFCYCLE_COVERAGE = 100;

/** Aggregate per-ward ballots (max across the election's races) for one election. */
function aggregateElection(races: HistoricalRaceData[]): Record<string, number> {
    const out: Record<string, number> = {};
    for (const race of races) {
        for (const [wardKey, wr] of race.wardResults) {
            out[wardKey] = Math.max(out[wardKey] ?? 0, wr.totalVotes);
        }
    }
    return out;
}

function yearOf(name: string): string {
    return name.match(/\b(19|20)\d{2}\b/)?.[0] ?? '';
}

function tierForRank(index: number, total: number): TurnoutTier {
    if (index < total / 3) return 'CONSISTENT';
    if (index < (2 * total) / 3) return 'MIXED';
    return 'PRESIDENTIAL_ONLY';
}

/**
 * Build the turnout-consistency profile for every ward we can measure.
 * Pure aside from the cached historical fetch the caller passes in.
 */
export function buildTurnoutProfile(
    data: Map<string, HistoricalRaceData[]>,
    districtWardKeys?: Set<string> | null,
): TurnoutProfile {
    const empty: TurnoutProfile = { wards: [], scoreByWard: {}, peakLabel: '', offCycleLabel: '', avgConsistency: 0 };

    const allRaces = Array.from(data.values()).flat();

    // Peak: most recent presidential general.
    const presidentials = (data.get('Presidential') ?? [])
        .filter(r => /General Election/.test(r.electionName))
        .sort((a, b) => b.electionDate.localeCompare(a.electionDate));
    const peakRace = presidentials[0] ?? (data.get('Presidential') ?? [])[0];
    if (!peakRace) return empty;
    const peakByWard: Record<string, number> = {};
    for (const [wk, wr] of peakRace.wardResults) peakByWard[wk] = wr.totalVotes;

    // Off-cycle: a plain Spring Election (no presidential preference on the
    // ballot). Ward numbering drifts across redistricting cycles, so match the
    // presidential to the NEWEST spring with solid coverage (nearest numbering)
    // rather than the biggest — an old county-wide spring has more ward rows but
    // a stale ward map, which produces garbage ratios.
    const peakYear = parseInt(yearOf(peakRace.electionName)) || 0;
    const springNames = Array.from(
        new Set(
            allRaces
                .map(r => r.electionName)
                .filter(n => /^\d{4} Spring Election$/.test(n)),
        ),
    )
        .sort((a, b) => yearOf(b).localeCompare(yearOf(a)))
        .filter(n => Math.abs((parseInt(yearOf(n)) || 0) - peakYear) <= 3);

    const overlapFor = (agg: Record<string, number>) =>
        Object.keys(agg).filter(wk => (peakByWard[wk] ?? 0) >= MIN_PEAK_BALLOTS).length;

    let bestOff: Record<string, number> | null = null;
    let bestName = '';
    let fallbackOff: Record<string, number> | null = null;
    let fallbackName = '';
    let fallbackOverlap = -1;
    for (const name of springNames) {
        const agg = aggregateElection(allRaces.filter(r => r.electionName === name));
        const overlap = overlapFor(agg);
        // Track the best-covered spring as a fallback if none clear the floor.
        if (overlap > fallbackOverlap) {
            fallbackOverlap = overlap;
            fallbackOff = agg;
            fallbackName = name;
        }
        // Newest-first: take the first spring that covers enough wards.
        if (overlap >= MIN_OFFCYCLE_COVERAGE) {
            bestOff = agg;
            bestName = name;
            break;
        }
    }
    if (!bestOff) { bestOff = fallbackOff; bestName = fallbackName; }
    if (!bestOff) return empty;

    // Compute consistency per ward, dropping artifacts.
    type Row = { wardKey: string; displayName: string; wardNumber: string; presidential: number; offCycle: number; consistency: number };
    const rows: Row[] = [];
    for (const [slug, off] of Object.entries(bestOff)) {
        const peak = peakByWard[slug] ?? 0;
        if (peak < MIN_PEAK_BALLOTS || off <= 0) continue;
        // Off-cycle turnout should never exceed presidential in the same era;
        // when it does it's a cross-cycle ward-key mismatch, so drop it.
        if (off > peak * 1.05) continue;

        const { precinctName, wardNumber } = wardKeyToPrecinctInfo(slug);
        const num = parseInt(wardNumber);
        const wardKey = `${precinctName}|${isNaN(num) ? 0 : num}`;
        if (districtWardKeys && !districtWardKeys.has(wardKey)) continue;

        rows.push({
            wardKey,
            displayName: `${precinctName} Ward ${wardNumber}`,
            wardNumber,
            presidential: peak,
            offCycle: off,
            consistency: Math.min(100, (off / peak) * 100),
        });
    }

    if (rows.length === 0) return empty;

    rows.sort((a, b) => b.consistency - a.consistency);

    const wards: TurnoutWard[] = rows.map((r, i) => ({
        wardKey: r.wardKey,
        displayName: r.displayName,
        wardNumber: r.wardNumber,
        presidential: r.presidential,
        offCycle: r.offCycle,
        consistency: Math.round(r.consistency),
        falloff: Math.round(100 - r.consistency),
        tier: tierForRank(i, rows.length),
    }));

    const scoreByWard: Record<string, number> = {};
    wards.forEach(w => { scoreByWard[w.wardKey] = w.consistency; });
    const avgConsistency = wards.reduce((s, w) => s + w.consistency, 0) / wards.length;

    return {
        wards,
        scoreByWard,
        peakLabel: `${yearOf(peakRace.electionName)} Presidential`,
        offCycleLabel: bestName,
        avgConsistency,
    };
}
