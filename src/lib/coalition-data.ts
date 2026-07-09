// Coalition analysis — build a "slate" of supportive candidates and see where
// their combined coalition is strong, plus how similarly each member's wards
// vote ("who they vote with"). All ward keys use the "Municipality|ward" form
// that matches the geojson NAME|WardNumber convention used by the map.
import { getPrecinctResults, PrecinctResult } from './api';

export interface SlateMember {
    key: string;            // stable id: electionId:raceId:candidateName
    electionId: string;
    raceId: string;
    candidateName: string;
    raceName: string;
    electionDate: string;
    party?: string;
}

export function memberKey(electionId: string, raceId: string, candidateName: string): string {
    return `${electionId}:${raceId}:${candidateName.trim()}`;
}

/** Per-ward vote share (0-100) for one candidate within their race's precinct rows. */
export function sharesByWard(rows: PrecinctResult[], candidateName: string): Record<string, number> {
    const totals: Record<string, number> = {};
    const cand: Record<string, number> = {};
    const target = candidateName.trim();
    rows.forEach(r => {
        const k = `${r.precinctName}|${parseInt(r.wardNumber) || 0}`;
        totals[k] = (totals[k] ?? 0) + r.votes;
        if (r.candidateName.trim() === target) cand[k] = (cand[k] ?? 0) + r.votes;
    });
    const out: Record<string, number> = {};
    Object.keys(totals).forEach(k => {
        if (totals[k] > 0) out[k] = ((cand[k] ?? 0) / totals[k]) * 100;
    });
    return out;
}

const shareCache = new Map<string, Record<string, number>>();

/** Fetches (and caches) a slate member's per-ward vote share. */
export async function getMemberShares(member: SlateMember): Promise<Record<string, number>> {
    const cacheKey = member.key;
    const cached = shareCache.get(cacheKey);
    if (cached) return cached;
    const rows = await getPrecinctResults(member.electionId, member.raceId);
    const shares = sharesByWard(rows, member.candidateName);
    shareCache.set(cacheKey, shares);
    return shares;
}

/**
 * Combines several members' ward shares into one coalition-strength map.
 * A ward's strength is the average share across members that contested it,
 * so members from different offices/years still stack into one coalition.
 * `minMembers` requires a ward appear for at least that many members.
 */
export function combineCoalition(
    memberShares: Record<string, number>[],
    minMembers = 1
): Record<string, number> {
    const sum: Record<string, number> = {};
    const count: Record<string, number> = {};
    memberShares.forEach(shares => {
        Object.entries(shares).forEach(([k, v]) => {
            sum[k] = (sum[k] ?? 0) + v;
            count[k] = (count[k] ?? 0) + 1;
        });
    });
    const out: Record<string, number> = {};
    Object.keys(sum).forEach(k => {
        if (count[k] >= minMembers) out[k] = sum[k] / count[k];
    });
    return out;
}

/**
 * Pearson correlation of two ward-share maps over the wards they share.
 * Returns null when there is too little overlap to be meaningful.
 * +1 = the two ride the exact same coalition; −1 = mirror opposites.
 */
export function wardCorrelation(
    a: Record<string, number>,
    b: Record<string, number>,
    minShared = 8
): { r: number; shared: number } | null {
    const keys = Object.keys(a).filter(k => k in b);
    const n = keys.length;
    if (n < minShared) return null;
    let sa = 0, sb = 0;
    keys.forEach(k => { sa += a[k]; sb += b[k]; });
    const ma = sa / n, mb = sb / n;
    let num = 0, da = 0, db = 0;
    keys.forEach(k => {
        const xa = a[k] - ma, xb = b[k] - mb;
        num += xa * xb; da += xa * xa; db += xb * xb;
    });
    if (da === 0 || db === 0) return null;
    return { r: num / Math.sqrt(da * db), shared: n };
}

/** Coalition summary stats: strongest/weakest wards and county-ish average. */
export function coalitionSummary(coalition: Record<string, number>): {
    avg: number;
    strong: { key: string; value: number }[];
    weak: { key: string; value: number }[];
    wardCount: number;
} {
    const entries = Object.entries(coalition).map(([key, value]) => ({ key, value }));
    const wardCount = entries.length;
    const avg = wardCount > 0 ? entries.reduce((s, e) => s + e.value, 0) / wardCount : 0;
    const sorted = [...entries].sort((x, y) => y.value - x.value);
    return {
        avg,
        strong: sorted.slice(0, 8),
        weak: sorted.slice(-8).reverse(),
        wardCount,
    };
}
