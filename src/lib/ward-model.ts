// Hand-built pre-election vote model for the AD76 Dem primary: a topline
// turnout guess spread across wards by historical weight, then split among
// candidates ward-by-ward. This is Tyler's own projection, not a statistical
// forecast — every number here is either a historical fact or a value he typed.
import { PlanningData, WardPower, shortWardName } from './planning-data';

export interface WeightRow {
    wardKey: string;
    displayName: string;
    /** Baseline share of the district vote (0–1), before any override. */
    share: number;
}

export type WeightMode = 'y2024' | 'blend';

export interface WardWeights {
    rows: WeightRow[];
    mode: WeightMode;
    /** True if a blend was requested but no 2020 data existed to blend with (silently fell back). */
    blendUnavailable: boolean;
}

/**
 * Ward weighting for the topline-to-ward split. '2024' uses the only cycle on
 * the current (post-2024-redistricting) district lines — the honest default.
 * 'blend' averages that with 2020's ward shares (the last CONTESTED open-seat
 * primary in this seat, pre-redistricting) for any ward present in both,
 * renormalized — a rougher but arguably more representative geography for a
 * five-way contested race than 2024's uncontested-in-practice turnout pattern.
 */
export function computeWardWeights(
    data: PlanningData,
    power2024: WardPower,
    mode: WeightMode
): WardWeights {
    if (mode === 'y2024') {
        return {
            rows: power2024.rows.map(r => ({ wardKey: r.wardKey, displayName: r.displayName, share: r.share })),
            mode: 'y2024',
            blendUnavailable: false,
        };
    }

    const y2020 = data.years.find(y => y.year === 2020);
    if (!y2020) {
        return {
            rows: power2024.rows.map(r => ({ wardKey: r.wardKey, displayName: r.displayName, share: r.share })),
            mode: 'y2024',
            blendUnavailable: true,
        };
    }

    const total2020 = Object.values(y2020.wardVotes).reduce((a, b) => a + b, 0) || 1;
    const blended = power2024.rows.map(r => {
        const v2020 = y2020.wardVotes[r.wardKey];
        const share2020 = v2020 !== undefined ? v2020 / total2020 : null;
        const raw = share2020 !== null ? (r.share + share2020) / 2 : r.share;
        return { wardKey: r.wardKey, displayName: r.displayName, raw };
    });
    const sum = blended.reduce((s, r) => s + r.raw, 0) || 1;

    return {
        rows: blended.map(r => ({ wardKey: r.wardKey, displayName: r.displayName, share: r.raw / sum })),
        mode: 'blend',
        blendUnavailable: false,
    };
}

// ── Turnout presets ─────────────────────────────────────────────────────────

export interface TurnoutPreset {
    id: string;
    label: string;
    votes: number;
    note: string;
}

/**
 * One preset per historical August primary cycle in this seat, plus a
 * "heavier" preset above the historical max — 2026 is a five-way open-seat
 * race with real press coverage, a turnout profile none of the last four
 * cycles (all either uncontested or, in 2020, a smaller field) fully match.
 */
export function buildTurnoutPresets(data: PlanningData): TurnoutPreset[] {
    const years = [...data.years].sort((a, b) => a.year - b.year);
    const presets: TurnoutPreset[] = years.map(y => ({
        id: String(y.year),
        label: String(y.year),
        votes: y.totalVotes,
        note: y.contested ? `contested, ${y.candidates.length}-way` : 'uncontested',
    }));
    const maxVotes = Math.max(...years.map(y => y.totalVotes), 1);
    const heavier = Math.round((maxVotes * 1.15) / 250) * 250;
    presets.push({
        id: 'heavier',
        label: 'Heavier — open seat',
        votes: heavier,
        note: 'above any recent cycle — five-way open contest',
    });
    return presets;
}

export function defaultTopline(presets: TurnoutPreset[]): number {
    return presets.find(p => p.id === 'heavier')?.votes ?? presets[presets.length - 1]?.votes ?? 15000;
}

// ── Candidate palette ────────────────────────────────────────────────────────
// A fixed, CVD-checked 5-slot order distinct from the app's party-color
// palette (which would paint all-Democratic primary candidates the same
// blue). Order matters — don't reassign per candidate list.
export const CANDIDATE_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#c98500', '#e87ba4'];

export function candidateColor(index: number): string {
    return CANDIDATE_PALETTE[index % CANDIDATE_PALETTE.length];
}

// ── Assignment state (topline, ward overrides, per-ward candidate splits) ──

export interface WardAssignState {
    topline: number;
    weightMode: WeightMode;
    /** wardKey -> override weight, same 0-100 unit as the computed baseline %. */
    wardWeightOverrides: Record<string, number>;
    /** wardKey -> candidateName -> pct (0-100). */
    pct: Record<string, Record<string, number>>;
}

const STORAGE_KEY = 'ad76-2026-ward-assign-v1';

function evenSplit(candidates: string[]): Record<string, number> {
    const n = Math.max(1, candidates.length);
    const base = Math.round((100 / n) * 10) / 10;
    const out: Record<string, number> = {};
    candidates.forEach((c, i) => {
        out[c] = i === 0 ? Math.round((100 - base * (n - 1)) * 10) / 10 : base;
    });
    return out;
}

export function loadAssignState(wardKeys: string[], candidates: string[], fallbackTopline: number): WardAssignState {
    const state: WardAssignState = {
        topline: fallbackTopline,
        weightMode: 'y2024',
        wardWeightOverrides: {},
        pct: {},
    };
    wardKeys.forEach(k => { state.pct[k] = evenSplit(candidates); });

    let raw: string | null = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { /* SSR / private mode */ }
    if (!raw) return state;

    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.topline === 'number') state.topline = parsed.topline;
        if (parsed.weightMode === 'y2024' || parsed.weightMode === 'blend') state.weightMode = parsed.weightMode;
        if (parsed.wardWeightOverrides && typeof parsed.wardWeightOverrides === 'object') {
            wardKeys.forEach(k => {
                if (typeof parsed.wardWeightOverrides[k] === 'number') state.wardWeightOverrides[k] = parsed.wardWeightOverrides[k];
            });
        }
        if (parsed.pct && typeof parsed.pct === 'object') {
            wardKeys.forEach(k => {
                if (parsed.pct[k]) {
                    candidates.forEach(c => {
                        if (typeof parsed.pct[k][c] === 'number') state.pct[k][c] = parsed.pct[k][c];
                    });
                }
            });
        }
    } catch { /* corrupt/old shape — fall back to defaults already set */ }

    return state;
}

export function saveAssignState(state: WardAssignState) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode / quota */ }
}

// ── Assignment math ──────────────────────────────────────────────────────────

export interface WardRow {
    wardKey: string;
    displayName: string;
    weightPct: number;   // normalized 0-100, post-override renormalize
    wardVotes: number;
    candidateVotes: Record<string, number>;
    pctSum: number;      // this ward's candidate pcts, should read ~100
}

export interface AssignmentResult {
    rows: WardRow[];
    candidateTotals: Record<string, number>;
    allocated: number;
}

export function computeAssignment(
    weights: WardWeights,
    state: WardAssignState,
    candidates: string[]
): AssignmentResult {
    const effective = weights.rows.map(r => {
        const override = state.wardWeightOverrides[r.wardKey];
        return { wardKey: r.wardKey, displayName: r.displayName, raw: override !== undefined ? override : r.share * 100 };
    });
    const sumRaw = effective.reduce((s, r) => s + r.raw, 0) || 1;
    const topline = state.topline || 0;

    const candidateTotals: Record<string, number> = {};
    candidates.forEach(c => { candidateTotals[c] = 0; });
    let allocated = 0;

    const rows: WardRow[] = effective.map(r => {
        const weightPct = (r.raw / sumRaw) * 100;
        const wardVotes = (weightPct / 100) * topline;
        const pctForWard = state.pct[r.wardKey] ?? {};
        const candidateVotes: Record<string, number> = {};
        let pctSum = 0;
        candidates.forEach(c => {
            const pct = pctForWard[c] ?? 0;
            pctSum += pct;
            const v = wardVotes * (pct / 100);
            candidateVotes[c] = v;
            candidateTotals[c] += v;
            allocated += v;
        });
        return { wardKey: r.wardKey, displayName: r.displayName, weightPct, wardVotes, candidateVotes, pctSum };
    });

    return { rows, candidateTotals, allocated };
}

export { shortWardName };
