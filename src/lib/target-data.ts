// Turnout targeting model — how consistently each ward votes.
//
// consistency % = off-cycle ballots cast ÷ presidential ballots cast, per ward
//
//   • Peak      = total ballots cast in the most recent presidential general.
//   • Off-cycle = total ballots cast in the most recent regular Spring Election.
//
// Both come from the county's "BALLOTS CAST - TOTAL" tally (getElectionTurnout),
// so it's true ballots cast — every voter counted once, regardless of which
// races they voted in — not a single down-ballot race's votes. That measures
// real turnout falloff, and because ballots-cast covers every ward it works
// county-wide, not just where a local race happened to be contested.
//
// High % = reliable base that votes in every election.
// Low  % = presidential-only (big falloff in primaries / spring elections).
//
// There is no registration denominator in the county data, so this is a
// presidential-relative rate, not turnout as a share of registered voters.
// Ward keys are pipe-form ("City of Madison|1") to match the map and districts.

export type TurnoutTier = 'CONSISTENT' | 'MIXED' | 'PRESIDENTIAL_ONLY';

export interface TurnoutWard {
    wardKey: string;       // pipe form: "City of Madison|46"
    displayName: string;   // "City of Madison Ward 46"
    wardNumber: string;
    presidential: number;  // peak ballots cast
    offCycle: number;      // off-cycle ballots cast
    consistency: number;   // 0–100, off-cycle as % of presidential (capped 100)
    falloff: number;       // 100 − consistency
    tier: TurnoutTier;
}

export interface TurnoutProfile {
    wards: TurnoutWard[];                  // sorted by consistency, highest first
    scoreByWard: Record<string, number>;   // pipe key → consistency, for the map overlay
    peakLabel: string;                     // e.g. "2024 General Election"
    offCycleLabel: string;                 // e.g. "2025 Spring Election"
    avgConsistency: number;                // mean consistency across wards
}

export interface BuildTurnoutInput {
    /** ballots cast by pipe-form ward key in the presidential general. */
    peakByWard: Record<string, number>;
    /** ballots cast by pipe-form ward key in the off-cycle spring election. */
    offByWard: Record<string, number>;
    peakLabel: string;
    offCycleLabel: string;
    districtWardKeys?: Set<string> | null;
}

// A ward whose presidential ballots are below this is a boundary sliver or a
// split/merged precinct we can't reconcile — excluded to keep ratios sane.
const MIN_PEAK_BALLOTS = 50;

function tierForRank(index: number, total: number): TurnoutTier {
    if (index < total / 3) return 'CONSISTENT';
    if (index < (2 * total) / 3) return 'MIXED';
    return 'PRESIDENTIAL_ONLY';
}

/** "City of Madison|46" → "City of Madison Ward 46". */
function displayFromKey(wardKey: string): { displayName: string; wardNumber: string } {
    const [muni, ward] = wardKey.split('|');
    return { displayName: `${muni} Ward ${ward}`, wardNumber: ward ?? '' };
}

/**
 * Build the turnout-consistency profile from two ballots-cast maps.
 * Pure — safe to call in a useMemo.
 */
export function buildTurnoutProfile({
    peakByWard,
    offByWard,
    peakLabel,
    offCycleLabel,
    districtWardKeys,
}: BuildTurnoutInput): TurnoutProfile {
    const empty: TurnoutProfile = { wards: [], scoreByWard: {}, peakLabel, offCycleLabel, avgConsistency: 0 };

    type Row = { wardKey: string; displayName: string; wardNumber: string; presidential: number; offCycle: number; consistency: number };
    const rows: Row[] = [];
    for (const [wardKey, off] of Object.entries(offByWard)) {
        const peak = peakByWard[wardKey] ?? 0;
        if (peak < MIN_PEAK_BALLOTS || off <= 0) continue;
        // Off-cycle turnout above presidential means the two elections split the
        // ward differently (merge/split); drop it rather than show a bad ratio.
        if (off > peak * 1.05) continue;
        if (districtWardKeys && !districtWardKeys.has(wardKey)) continue;

        const { displayName, wardNumber } = displayFromKey(wardKey);
        rows.push({
            wardKey,
            displayName,
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

    return { wards, scoreByWard, peakLabel, offCycleLabel, avgConsistency };
}

/** Pick the newest presidential general and newest plain Spring Election. */
export function pickTurnoutElections(
    elections: { electionId: string; electionName: string }[],
): { peak: { electionId: string; electionName: string } | null; offCycle: { electionId: string; electionName: string } | null } {
    const year = (n: string) => parseInt(n.match(/\b(19|20)\d{2}\b/)?.[0] ?? '0');
    // Elections are newest-first; be order-independent anyway by sorting on year.
    const byYearDesc = [...elections].sort((a, b) => year(b.electionName) - year(a.electionName));
    const peak = byYearDesc.find(e => /general election/i.test(e.electionName) && year(e.electionName) % 4 === 0) ?? null;
    const offCycle = byYearDesc.find(e => /^\d{4} Spring Election$/.test(e.electionName.trim())) ?? null;
    return { peak, offCycle };
}
