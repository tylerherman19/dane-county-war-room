// Pre-election planning math for the AD76 primary, derived from the baked
// public/ad76-planning.json (ward-level history of the August DEM primary).
//
// The district was redrawn for the 2024 cycle, so per-ward expectations come
// from the most recent cycle whose wards match the current district map.
// Older cycles still inform district-wide turnout scenarios and the
// contested-race anchor (2020's seven-way open seat).

import { PrecinctResult } from './api';
import { computeWinNumber, WinNumberResult } from './projections-data';

export interface PlanningCandidate {
    name: string;
    votes: number;
    pct: number;
}

export interface PlanningYear {
    year: number;
    electionId: string;
    raceId: string;
    electionName: string;
    electionDate: string;
    raceName: string;
    totalVotes: number;
    contested: boolean;
    candidates: PlanningCandidate[];
    wardVotes: Record<string, number>; // "City of Madison|46" → race votes
}

export interface PlanningData {
    generatedAt: string;
    district: number;
    party: string;
    years: PlanningYear[]; // newest first
}

let planningCache: PlanningData | null = null;

export async function fetchPlanningData(): Promise<PlanningData> {
    if (planningCache) return planningCache;
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/ad76-planning.json`);
    if (!res.ok) throw new Error(`Failed to load planning data: ${res.status}`);
    planningCache = await res.json();
    return planningCache!;
}

// ── Ward power ranking ─────────────────────────────────────────────────────

export interface WardPowerRow {
    wardKey: string;       // "City of Madison|46"
    displayName: string;   // "Madison Wd. 46"
    rank: number;
    share: number;         // fraction of the district's primary vote (0–1)
    cumulativeShare: number; // running total in rank order
    baseVotes: number;     // raw votes in the baseline cycle
}

export interface WardPower {
    rows: WardPowerRow[];
    baselineYear: number;
    baselineTotal: number;
    /** Smallest number of top wards that cover ≥50% of the district vote. */
    wardsToHalf: number;
}

export function shortWardName(wardKey: string): string {
    const [muni, num] = wardKey.split('|');
    const short = muni
        .replace(/^City of /, '')
        .replace(/^Village of /, 'V. ')
        .replace(/^Town of /, 'T. ');
    return `${short} Wd. ${num}`;
}

/**
 * Rank the current district's wards by their share of the primary vote in the
 * most recent cycle whose ward set matches the current district boundaries.
 * A cycle "matches" when most of the current ward keys appear in its results.
 */
export function computeWardPower(data: PlanningData, currentWardKeys: Set<string>): WardPower | null {
    const baseline = data.years.find(y => {
        // Skip the in-progress cycle itself (0 votes until election night) —
        // it can otherwise out-rank 2024 as "newest" while carrying no data.
        if (y.totalVotes === 0) return false;
        const keys = Object.keys(y.wardVotes);
        if (keys.length === 0) return false;
        const overlap = keys.filter(k => currentWardKeys.has(k)).length;
        return overlap >= currentWardKeys.size * 0.9;
    });
    if (!baseline) return null;

    const total = Object.entries(baseline.wardVotes)
        .filter(([k]) => currentWardKeys.has(k))
        .reduce((s, [, v]) => s + v, 0);
    if (total === 0) return null;

    const rows: WardPowerRow[] = [...currentWardKeys]
        .map(wardKey => ({
            wardKey,
            displayName: shortWardName(wardKey),
            baseVotes: baseline.wardVotes[wardKey] ?? 0,
            share: (baseline.wardVotes[wardKey] ?? 0) / total,
            rank: 0,
            cumulativeShare: 0,
        }))
        .sort((a, b) => b.baseVotes - a.baseVotes);

    let cum = 0;
    let wardsToHalf = rows.length;
    rows.forEach((r, i) => {
        r.rank = i + 1;
        cum += r.share;
        r.cumulativeShare = cum;
        if (cum >= 0.5 && wardsToHalf === rows.length && r.share > 0) {
            wardsToHalf = i + 1;
        }
    });

    return { rows, baselineYear: baseline.year, baselineTotal: baseline.totalVotes, wardsToHalf };
}

// ── Turnout scenarios & win number ─────────────────────────────────────────

export interface TurnoutScenario {
    id: 'LOW' | 'MID' | 'HIGH';
    label: string;
    totalVotes: number;
    anchor: string; // "2022 primary (unopposed)"
}

/** Derive low / mid / high turnout scenarios from the historical cycle totals. */
export function buildScenarios(data: PlanningData): TurnoutScenario[] {
    const cycles = data.years.filter(y => y.totalVotes > 0);
    if (cycles.length === 0) return [];

    const sorted = [...cycles].sort((a, b) => a.totalVotes - b.totalVotes);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    const mid = sorted[Math.floor((sorted.length - 1) / 2)];

    const describe = (y: PlanningYear) =>
        `${y.year} primary (${y.contested ? 'contested' : 'unopposed'})`;

    const scenarios: TurnoutScenario[] = [
        { id: 'LOW', label: 'Low', totalVotes: low.totalVotes, anchor: describe(low) },
        {
            id: 'MID',
            label: 'Mid',
            totalVotes: mid !== low && mid !== high
                ? mid.totalVotes
                : Math.round((low.totalVotes + high.totalVotes) / 2),
            anchor: mid !== low && mid !== high ? describe(mid) : 'midpoint of range',
        },
        { id: 'HIGH', label: 'High', totalVotes: high.totalVotes, anchor: describe(high) },
    ];
    return scenarios;
}

export interface ScenarioOutcome {
    scenario: TurnoutScenario;
    numCandidates: number;
    winNumber: WinNumberResult;
}

export function computeScenarioOutcome(scenario: TurnoutScenario, numCandidates: number): ScenarioOutcome {
    return { scenario, numCandidates, winNumber: computeWinNumber(scenario.totalVotes, numCandidates) };
}

/** The most recent contested cycle — the real-world anchor for the win number. */
export function findContestedAnchor(data: PlanningData): PlanningYear | null {
    return data.years.find(y => y.contested && y.candidates.length >= 2) ?? null;
}

// ── Election-night readiness (expected vs actual per ward) ────────────────

export interface WardReadinessRow extends WardPowerRow {
    expectedVotes: number;      // share × scenario total
    actualVotes: number | null; // null until the ward reports
    reported: boolean;
}

export interface ReadinessSummary {
    wardsReported: number;
    wardsTotal: number;
    expectedInReported: number; // Σ expected votes over reported wards
    actualInReported: number;   // Σ actual votes over reported wards
    /** actual / expected − 1 over reported wards; null before any report. */
    deltaPct: number | null;
    /** share of the expected district vote already represented by reported wards */
    expectedShareIn: number;
}

/**
 * Join the ward power table with live precinct returns: each ward gets an
 * expected vote (its historical share × the scenario total) and, once it
 * reports, its actual votes — so the first returns read as ahead/behind
 * expectation immediately.
 */
export function computeReadiness(
    power: WardPower,
    scenarioTotal: number,
    precinctResults: PrecinctResult[] | undefined,
): { rows: WardReadinessRow[]; summary: ReadinessSummary } {
    const actualByWard = new Map<string, { votes: number; reported: boolean }>();
    (precinctResults ?? []).forEach(r => {
        const k = `${r.precinctName}|${parseInt(r.wardNumber) || 0}`;
        const entry = actualByWard.get(k) ?? { votes: 0, reported: false };
        entry.votes += r.votes;
        entry.reported = entry.reported || r.reported;
        actualByWard.set(k, entry);
    });

    const rows: WardReadinessRow[] = power.rows.map(r => {
        const live = actualByWard.get(r.wardKey);
        const reported = live?.reported ?? false;
        return {
            ...r,
            expectedVotes: Math.round(r.share * scenarioTotal),
            actualVotes: reported ? live!.votes : null,
            reported,
        };
    });

    let expectedIn = 0, actualIn = 0, reportedCount = 0, expectedShareIn = 0;
    rows.forEach(r => {
        if (r.reported) {
            reportedCount++;
            expectedIn += r.expectedVotes;
            actualIn += r.actualVotes ?? 0;
            expectedShareIn += r.share;
        }
    });

    return {
        rows,
        summary: {
            wardsReported: reportedCount,
            wardsTotal: rows.length,
            expectedInReported: expectedIn,
            actualInReported: actualIn,
            deltaPct: reportedCount > 0 && expectedIn > 0 ? (actualIn / expectedIn - 1) * 100 : null,
            expectedShareIn,
        },
    };
}
