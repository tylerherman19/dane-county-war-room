// Projections math utilities for the SIMULATE mode.
// All calculations are pure functions — no side effects, no API calls.

import { fetchHistoricalData, HistoricalRaceData, WardResult } from './historical-api-data';
import { PrecinctResult } from './api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface DistrictProjection {
    label: string;
    raceType: 'Mayor' | 'Alder';
    districtNum: number | null;        // null for Mayor
    historicalAvg: number;             // mean total votes across ALL elections
    primaryHistoricalAvg: number;      // mean total votes across Spring Primary elections only (0 if none)
    electionsCount: number;            // how many elections were averaged
    primaryElectionsCount: number;     // how many Spring Primary elections were averaged
    wardKeys: string[];                // normalized ward keys in this district
    wardAvgVotes: Record<string, number>; // wardKey → mean historical votes (all elections)
    primaryWardAvgVotes: Record<string, number>; // wardKey → mean primary-only votes per ward
    elections: HistoricalRaceData[];   // individual elections (for What If dropdown)
}

export interface WinNumberResult {
    winNumber: number;
    isEstimate: boolean;   // true for 3+ candidate races (plurality, no guarantee)
    explanation: string;   // human-readable formula step
}

export interface SimProjectionUpdate {
    projectionData: Record<string, number>;  // wardKey → ratio vs district mean (for map heatmap)
    highlightedWardKeys: Set<string>;         // wards in selected district (others dimmed)
    whatIfPrecinctResults: PrecinctResult[] | null; // null = not in What If mode
    whatIfMode: boolean;
}

// ── Win Number Math ────────────────────────────────────────────────────────

/**
 * Compute the vote target needed to win the race.
 *
 * 2 candidates: Mathematical majority — ⌈total/2⌉ + 1.
 *   Derivation: in a two-person race every vote for you is one fewer for them,
 *   so you need strictly more than half. Example: 1,000 votes → win# = 501.
 *
 * N ≥ 3 candidates: Plurality race — no guaranteed threshold.
 *   We use the "even-split floor": ⌈total/N⌉ + 1.
 *   If all N candidates split votes perfectly evenly, each gets total/N.
 *   Getting one more than that share puts you ahead of an even split.
 *   In practice you can win with fewer (if others split unevenly), or need more
 *   (if one opponent consolidates support). Marked "est." to flag this.
 */
export function computeWinNumber(expectedTotal: number, numCandidates: number): WinNumberResult {
    const n = Math.max(2, Math.round(numCandidates));
    const total = Math.max(0, expectedTotal);

    if (n === 2) {
        const win = Math.ceil(total / 2) + 1;
        return {
            winNumber: win,
            isEstimate: false,
            explanation: `⌈${total.toLocaleString()} ÷ 2⌉ + 1 = ${win.toLocaleString()} (exact majority)`,
        };
    }

    const win = Math.ceil(total / n) + 1;
    const pct = total > 0 ? ((win / total) * 100).toFixed(1) : '—';
    return {
        winNumber: win,
        isEstimate: true,
        explanation: `⌈${total.toLocaleString()} ÷ ${n}⌉ + 1 = ${win.toLocaleString()} (≈${pct}% — even-split floor, est.)`,
    };
}

/**
 * Apply turnout and registration-growth multipliers to a baseline vote count.
 *
 * adjustedTotal = baseline × (turnoutPct / 100) × (1 + regDelta / 100)
 *
 * Example: 100k historical avg, 115% turnout, +8% registration:
 *   100,000 × 1.15 × 1.08 = 124,200 expected votes
 */
export function applyMultipliers(baseline: number, turnoutPct: number, regDelta: number): number {
    return Math.round(baseline * (turnoutPct / 100) * (1 + regDelta / 100));
}

// ── Projection Map Data ────────────────────────────────────────────────────

/**
 * Compute per-ward ratio values for the PROJECTION map overlay.
 * Each value is: wardHistoricalAvg / districtMeanPerWard.
 *   > 1.0  → green (above-average turnout ward)
 *   < 1.0  → red   (below-average turnout ward)
 *   = 1.0  → neutral
 *
 * This shows the STRUCTURAL pattern of where people vote in this district,
 * helping campaigns decide where to focus door-knocking resources.
 * Wards outside the district are not included (map dims them automatically).
 */
export function computeProjectionData(district: DistrictProjection): Record<string, number> {
    const vals = Object.values(district.wardAvgVotes);
    const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
    const result: Record<string, number> = {};
    for (const [wardKey, avg] of Object.entries(district.wardAvgVotes)) {
        result[wardKey] = mean > 0 ? avg / mean : 1.0;
    }
    return result;
}

/**
 * Compute per-ward ratios for the What If scenario overlay.
 * Applies global and per-ward multipliers to historical vote counts,
 * then normalizes relative to the adjusted district mean.
 */
export function computeWhatIfProjectionData(
    wardResults: Map<string, WardResult>,
    globalMultiplier: number,
    perWardOverrides: Record<string, number>, // wardKey → multiplier (100 = no change)
): Record<string, number> {
    const adjusted: Record<string, number> = {};
    for (const [wardKey, wr] of wardResults.entries()) {
        const m = (perWardOverrides[wardKey] ?? globalMultiplier) / 100;
        adjusted[wardKey] = wr.totalVotes * m;
    }
    const vals = Object.values(adjusted);
    const mean = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 1;
    const result: Record<string, number> = {};
    for (const [wardKey, votes] of Object.entries(adjusted)) {
        result[wardKey] = mean > 0 ? votes / mean : 1.0;
    }
    return result;
}

// ── What If PrecinctResult Conversion ─────────────────────────────────────

/**
 * Convert historical ward results (with optional multipliers) to PrecinctResult[],
 * which is the format Map.tsx consumes for its standard winner/margin coloring.
 *
 * This lets What If mode feed adjusted historical data through the existing
 * map coloring pipeline without any changes to Map's core logic.
 */
export function toPrecinctResults(
    wardResults: Map<string, WardResult>,
    globalMultiplier: number,
    perWardOverrides: Record<string, number>,
): PrecinctResult[] {
    const results: PrecinctResult[] = [];
    for (const [wardKey, wr] of wardResults.entries()) {
        const m = (perWardOverrides[wardKey] ?? globalMultiplier) / 100;
        const { precinctName, wardNumber } = wardKeyToPrecinctInfo(wardKey);
        const adjustedTotal = Math.round(wr.totalVotes * m);
        for (const candidate of wr.candidates) {
            results.push({
                precinctName,
                wardNumber,
                candidateName: candidate.name,
                votes: Math.round(candidate.votes * m),
                registeredVoters: 0,
                ballotscast: adjustedTotal,
            });
        }
    }
    return results;
}

/**
 * Parse a normalized ward key back to a display-friendly precinctName + wardNumber.
 * Key format (from build script): "madison-city-1", "sun-prairie-city-3", "westport-town-1"
 */
export function wardKeyToPrecinctInfo(wardKey: string): { precinctName: string; wardNumber: string } {
    const typePatterns: { suffix: string; label: string }[] = [
        { suffix: '-city-', label: 'City of' },
        { suffix: '-town-', label: 'Town of' },
        { suffix: '-village-', label: 'Village of' },
    ];
    for (const { suffix, label } of typePatterns) {
        const idx = wardKey.lastIndexOf(suffix);
        if (idx !== -1) {
            const name = wardKey.slice(0, idx).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const wardNumber = wardKey.slice(idx + suffix.length);
            return { precinctName: `${label} ${name}`, wardNumber };
        }
    }
    // Fallback: split on last dash
    const lastDash = wardKey.lastIndexOf('-');
    if (lastDash !== -1) {
        const name = wardKey.slice(0, lastDash).replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { precinctName: name, wardNumber: wardKey.slice(lastDash + 1) };
    }
    return { precinctName: wardKey, wardNumber: '0' };
}

// ── District Projection Loading ────────────────────────────────────────────

/**
 * Load and compute district projections from the pre-built historical JSON.
 * Returns null fields if the data isn't available yet (first run before build).
 */
export async function loadDistrictProjections(): Promise<{
    mayor: DistrictProjection | null;
    alderDistricts: DistrictProjection[];
}> {
    const data = await fetchHistoricalData();
    const mayor = computeMayorProjection(data.get('Mayor') || []);
    const alderDistricts = computeAlderProjections((data.get('Alder') || []) as (HistoricalRaceData & { districtNum?: number })[]);
    return { mayor, alderDistricts };
}

function computeMayorProjection(races: HistoricalRaceData[]): DistrictProjection | null {
    if (races.length === 0) return null;

    // Collect all ward keys across all Mayor elections
    const allWardKeys = new Set<string>();
    races.forEach(r => r.wardResults.forEach((_, k) => allWardKeys.add(k)));

    // Average votes per ward across elections where that ward appears
    const wardAvgVotes: Record<string, number> = {};
    for (const wardKey of allWardKeys) {
        const counts = races
            .filter(r => r.wardResults.has(wardKey))
            .map(r => r.wardResults.get(wardKey)!.totalVotes);
        wardAvgVotes[wardKey] = counts.length > 0
            ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
            : 0;
    }

    // Average total votes per election
    const historicalAvg = Math.round(
        races.reduce((sum, r) => {
            return sum + Array.from(r.wardResults.values()).reduce((s, w) => s + w.totalVotes, 0);
        }, 0) / races.length
    );

    const primaryRaces = races.filter(r =>
        r.electionName.toLowerCase().includes('spring primary')
    );
    const primaryHistoricalAvg = primaryRaces.length > 0
        ? Math.round(
            primaryRaces.reduce((sum, r) => {
                return sum + Array.from(r.wardResults.values()).reduce((s, w) => s + w.totalVotes, 0);
            }, 0) / primaryRaces.length
        )
        : 0;

    // Per-ward primary-only averages (for per-ward win number granularity)
    const primaryWardAvgVotes: Record<string, number> = {};
    if (primaryRaces.length > 0) {
        for (const wardKey of allWardKeys) {
            const counts = primaryRaces
                .filter(r => r.wardResults.has(wardKey))
                .map(r => r.wardResults.get(wardKey)!.totalVotes);
            primaryWardAvgVotes[wardKey] = counts.length > 0
                ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
                : 0;
        }
    }

    return {
        label: 'Mayor of Madison',
        raceType: 'Mayor',
        districtNum: null,
        historicalAvg,
        primaryHistoricalAvg,
        electionsCount: races.length,
        primaryElectionsCount: primaryRaces.length,
        wardKeys: Array.from(allWardKeys),
        wardAvgVotes,
        primaryWardAvgVotes,
        elections: races,
    };
}

function computeAlderProjections(
    races: (HistoricalRaceData & { districtNum?: number })[],
): DistrictProjection[] {
    if (races.length === 0) return [];

    // Group by district number
    const byDistrict = new Map<number, (HistoricalRaceData & { districtNum?: number })[]>();
    for (const race of races) {
        const d = race.districtNum;
        if (d == null) continue;
        if (!byDistrict.has(d)) byDistrict.set(d, []);
        byDistrict.get(d)!.push(race);
    }

    const results: DistrictProjection[] = [];
    for (const [districtNum, distRaces] of Array.from(byDistrict.entries()).sort(([a], [b]) => a - b)) {
        if (distRaces.length === 0) continue;

        const allWardKeys = new Set<string>();
        distRaces.forEach(r => r.wardResults.forEach((_, k) => allWardKeys.add(k)));

        const wardAvgVotes: Record<string, number> = {};
        for (const wardKey of allWardKeys) {
            const counts = distRaces
                .filter(r => r.wardResults.has(wardKey))
                .map(r => r.wardResults.get(wardKey)!.totalVotes);
            wardAvgVotes[wardKey] = counts.length > 0
                ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
                : 0;
        }

        const historicalAvg = Math.round(
            distRaces.reduce((sum, r) => {
                return sum + Array.from(r.wardResults.values()).reduce((s, w) => s + w.totalVotes, 0);
            }, 0) / distRaces.length
        );

        const primaryRaces = distRaces.filter(r =>
            r.electionName.toLowerCase().includes('spring primary')
        );
        const primaryHistoricalAvg = primaryRaces.length > 0
            ? Math.round(
                primaryRaces.reduce((sum, r) => {
                    return sum + Array.from(r.wardResults.values()).reduce((s, w) => s + w.totalVotes, 0);
                }, 0) / primaryRaces.length
            )
            : 0;

        // Per-ward primary-only averages
        const primaryWardAvgVotes: Record<string, number> = {};
        if (primaryRaces.length > 0) {
            for (const wardKey of allWardKeys) {
                const counts = primaryRaces
                    .filter(r => r.wardResults.has(wardKey))
                    .map(r => r.wardResults.get(wardKey)!.totalVotes);
                primaryWardAvgVotes[wardKey] = counts.length > 0
                    ? Math.round(counts.reduce((a, b) => a + b, 0) / counts.length)
                    : 0;
            }
        }

        results.push({
            label: `Aldermanic District ${districtNum}`,
            raceType: 'Alder',
            districtNum,
            historicalAvg,
            primaryHistoricalAvg,
            electionsCount: distRaces.length,
            primaryElectionsCount: primaryRaces.length,
            wardKeys: Array.from(allWardKeys),
            wardAvgVotes,
            primaryWardAvgVotes,
            elections: distRaces,
        });
    }
    return results;
}
