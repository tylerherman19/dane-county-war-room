// civicAPI (https://civicapi.org) client for the State & Battleground tab.
// Free public JSON, no key. Field names below were taken from live payloads
// inspected on election day (2026-11-03); parseCivicRace() validates them at
// runtime and rejects anything that does not match instead of guessing.

export const CIVIC_API_BASE = 'https://civicapi.org/api/v2/race/';
export const CIVIC_POLL_MS = 60_000;
export const CIVIC_STALE_MS = 5 * 60_000;

export type CivicGroup = 'STATEWIDE' | 'ASSEMBLY' | 'SENATE';
export interface CivicRaceConfig { id: number; label: string; group: CivicGroup }

export const CIVIC_RACES: CivicRaceConfig[] = [
    { id: 87491, label: 'Governor / Lt. Governor', group: 'STATEWIDE' },
    { id: 87492, label: 'Attorney General', group: 'STATEWIDE' },
    { id: 87493, label: 'Secretary of State', group: 'STATEWIDE' },
    { id: 87494, label: 'State Treasurer', group: 'STATEWIDE' },
    { id: 176320, label: 'Assembly District 21', group: 'ASSEMBLY' },
    { id: 176329, label: 'Assembly District 30', group: 'ASSEMBLY' },
    { id: 176350, label: 'Assembly District 51', group: 'ASSEMBLY' },
    { id: 176352, label: 'Assembly District 53', group: 'ASSEMBLY' },
    { id: 176360, label: 'Assembly District 61', group: 'ASSEMBLY' },
    { id: 176384, label: 'Assembly District 85', group: 'ASSEMBLY' },
    { id: 176387, label: 'Assembly District 88', group: 'ASSEMBLY' },
    { id: 176388, label: 'Assembly District 89', group: 'ASSEMBLY' },
    { id: 176401, label: 'Senate District 5', group: 'SENATE' },
    { id: 176407, label: 'Senate District 17', group: 'SENATE' },
    { id: 176409, label: 'Senate District 21', group: 'SENATE' },
];

// Official full names (Wisconsin Elections Commission) where the API abbreviates.
const DISPLAY_NAMES: Record<string, string> = {
    'John Leiber': 'John S. Leiber',
    'Yee Xiong': 'Yee Leng Xiong',
};
// Governor and Lt. Governor run on one ticket; the API lists only the governor.
const TICKET_MATES: Record<number, Record<string, string>> = {
    87491: { 'David Crowley': 'Sarah Godlewski', 'Tom Tiffany': 'David Varnam' },
};
export function displayName(raceId: number, apiName: string): string {
    const name = DISPLAY_NAMES[apiName] ?? apiName;
    const mate = TICKET_MATES[raceId]?.[apiName];
    return mate ? `${name} / ${mate}` : name;
}

export interface CivicCandidate { name: string; party: string; votes: number; winner: boolean; incumbent: boolean }
export interface CivicRegion { key: string; name: string; percentReporting: number; candidates: { name: string; votes: number }[] }
export interface CivicRace {
    electionName: string;
    electionDate: string;
    pollsClose: string | null;
    percentReporting: number;
    testData: boolean;
    lastUpdated: string | null;
    candidates: CivicCandidate[];
    regions: CivicRegion[];
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

/** Validates a raw payload. Throws on anything unexpected so the UI shows an honest error rather than bad numbers. */
export function parseCivicRace(raw: unknown): CivicRace {
    if (!raw || typeof raw !== 'object') throw new Error('Payload is not an object');
    const d = raw as Record<string, unknown>;
    if (!isStr(d.election_name)) throw new Error('Missing election_name');
    if (!isStr(d.election_date) || !d.election_date.startsWith('2026-11-03')) throw new Error(`Unexpected election_date ${String(d.election_date)}`);
    if (!isNum(d.percent_reporting)) throw new Error('Missing percent_reporting');
    if (!Array.isArray(d.candidates) || d.candidates.length === 0) throw new Error('Missing candidates');
    const candidates = d.candidates.map((c: unknown) => {
        const o = (c ?? {}) as Record<string, unknown>;
        if (!isStr(o.name) || !isNum(o.votes)) throw new Error('Malformed candidate');
        return { name: o.name, party: isStr(o.party) ? o.party : '', votes: o.votes, winner: o.winner === true, incumbent: o.incumbent === true };
    });
    const regions: CivicRegion[] = [];
    if (d.region_results && typeof d.region_results === 'object') {
        for (const [key, r] of Object.entries(d.region_results as Record<string, unknown>)) {
            const o = (r ?? {}) as Record<string, unknown>;
            if (!isStr(o.name) || !Array.isArray(o.candidates)) continue;
            const cs = o.candidates.flatMap((c: unknown) => {
                const x = (c ?? {}) as Record<string, unknown>;
                return isStr(x.name) && isNum(x.votes) ? [{ name: x.name, votes: x.votes }] : [];
            });
            regions.push({ key, name: o.name, percentReporting: isNum(o.percent_reporting) ? o.percent_reporting : 0, candidates: cs });
        }
        regions.sort((a, b) => a.name.localeCompare(b.name));
    }
    return {
        electionName: d.election_name,
        electionDate: d.election_date,
        pollsClose: isStr(d.polls_close) ? d.polls_close : null,
        percentReporting: d.percent_reporting,
        testData: d.test_data === true,
        lastUpdated: isStr(d.last_updated) ? d.last_updated : null,
        candidates,
        regions,
    };
}

export async function fetchCivicRace(id: number, signal?: AbortSignal): Promise<CivicRace> {
    const res = await fetch(`${CIVIC_API_BASE}${id}`, { cache: 'no-store', signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseCivicRace(await res.json());
}

export function totalVotes(race: CivicRace): number {
    return race.candidates.reduce((n, c) => n + c.votes, 0);
}

/** Candidates ordered by votes once votes exist; API order before that (no implied leader). */
export function orderedCandidates(race: CivicRace): CivicCandidate[] {
    return totalVotes(race) > 0 ? [...race.candidates].sort((a, b) => b.votes - a.votes) : race.candidates;
}

export function isStale(lastFetchedMs: number | undefined, nowMs: number): boolean {
    return lastFetchedMs !== undefined && nowMs - lastFetchedMs > CIVIC_STALE_MS;
}
