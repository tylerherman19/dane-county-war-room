// Campaign targeting model — merges two existing war-room signals into one
// ranked, exportable turf list:
//
//   • Dormant voter pool  (dormant-voter-data.ts) — voters who show in the
//     Spring general but skip the primary. The raw turnout opportunity.
//   • Coalition base strength (coalition-data.ts) — where a slate you built in
//     COALITION mode already runs strong (0–100 avg ward support).
//
// Two operating modes, chosen by whether a coalition has been built:
//   • CANVASS   — no coalition loaded. Rank purely by dormant pool: "where are
//                 the untapped primary voters?"
//   • MOBILIZE  — coalition loaded. Rank by dormant pool × your base strength:
//                 "where are OUR dormant voters?" — the highest-ROI GOTV doors.
//
// Ward keys: dormant data arrives in slug form ("madison-city-1"); coalition,
// districts, and the map all use pipe form ("City of Madison|1"). We convert
// everything to pipe form so the score map drops straight onto the choropleth.

import { wardKeyToPrecinctInfo } from './projections-data';

export type TargetMode = 'CANVASS' | 'MOBILIZE';
export type TargetTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface TargetWard {
    wardKey: string;             // pipe form: "City of Madison|46"
    displayName: string;         // "City of Madison Ward 46"
    wardNumber: string;
    dormantPool: number;         // raw dormant voters
    baseStrength: number | null; // coalition support % (0–100); null in CANVASS mode
    score: number;               // 0–100 composite (top ward = 100)
    tier: TargetTier;
}

export interface TargetResult {
    mode: TargetMode;
    wards: TargetWard[];                  // sorted by score, highest first
    scoreByWard: Record<string, number>;  // pipe key → score, for the map overlay
    totalDormant: number;                 // sum of dormant pool across ranked wards
}

export interface BuildTargetsInput {
    /** dormant pool keyed by slug ("madison-city-1") → dormant voters. */
    dormantPool: Record<string, number>;
    /** optional coalition base strength keyed by pipe form → 0–100 support. */
    coalitionByWard?: Record<string, number> | null;
    /** optional district scope: only keep these pipe-form ward keys. */
    districtWardKeys?: Set<string> | null;
}

function tierFor(score: number): TargetTier {
    if (score >= 66) return 'HIGH';
    if (score >= 33) return 'MEDIUM';
    return 'LOW';
}

/**
 * Build the ranked target list + overlay score map from dormant pool and an
 * optional coalition. Pure function — safe to call in a useMemo.
 */
export function buildTargets({
    dormantPool,
    coalitionByWard,
    districtWardKeys,
}: BuildTargetsInput): TargetResult {
    const hasCoalition = !!coalitionByWard && Object.keys(coalitionByWard).length > 0;
    const mode: TargetMode = hasCoalition ? 'MOBILIZE' : 'CANVASS';

    // Normalize dormant slug keys → pipe keys, applying the district scope.
    type Row = { wardKey: string; displayName: string; wardNumber: string; dormant: number; base: number | null };
    const rows: Row[] = [];
    for (const [slug, dormant] of Object.entries(dormantPool)) {
        if (dormant <= 0) continue;
        const { precinctName, wardNumber } = wardKeyToPrecinctInfo(slug);
        const num = parseInt(wardNumber);
        const wardKey = `${precinctName}|${isNaN(num) ? 0 : num}`;
        if (districtWardKeys && !districtWardKeys.has(wardKey)) continue;

        const base = hasCoalition ? (coalitionByWard![wardKey] ?? null) : null;
        // In MOBILIZE mode a ward with no base data is not actionable turf.
        if (mode === 'MOBILIZE' && base === null) continue;

        rows.push({
            wardKey,
            displayName: `${precinctName} Ward ${wardNumber}`,
            wardNumber,
            dormant,
            base,
        });
    }

    if (rows.length === 0) {
        return { mode, wards: [], scoreByWard: {}, totalDormant: 0 };
    }

    const maxDormant = Math.max(...rows.map(r => r.dormant));

    // Raw score: dormant opportunity, weighted by base strength in MOBILIZE mode.
    const withRaw = rows.map(r => {
        const dormantNorm = maxDormant > 0 ? r.dormant / maxDormant : 0;
        const raw = mode === 'MOBILIZE'
            ? dormantNorm * ((r.base ?? 0) / 100)
            : dormantNorm;
        return { ...r, raw };
    });
    const maxRaw = Math.max(...withRaw.map(r => r.raw), 0);

    const wards: TargetWard[] = withRaw
        .map(r => {
            const score = maxRaw > 0 ? Math.round((r.raw / maxRaw) * 100) : 0;
            return {
                wardKey: r.wardKey,
                displayName: r.displayName,
                wardNumber: r.wardNumber,
                dormantPool: r.dormant,
                baseStrength: r.base,
                score,
                tier: tierFor(score),
            };
        })
        .sort((a, b) => b.score - a.score || b.dormantPool - a.dormantPool);

    const scoreByWard: Record<string, number> = {};
    wards.forEach(w => { scoreByWard[w.wardKey] = w.score; });
    const totalDormant = wards.reduce((s, w) => s + w.dormantPool, 0);

    return { mode, wards, scoreByWard, totalDormant };
}
