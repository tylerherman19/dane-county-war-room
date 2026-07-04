// Candidate history across every election the county API serves.
// Uses the bulk endpoint GET /electionresults/{electionId}, which returns
// every race + candidate + county-wide votes for an election in one call.
import { Election, isAdminRace } from './api';
import { addLog } from './debug-log';

const BASE_PATH = 'https://api.danecounty.gov/api/v1/elections';

interface ApiBulkCandidate {
    Name: string;
    Votes: number;
    Percentage: number;
    PartyName: string;
}

interface ApiBulkRace {
    RaceName: string;
    RaceNumber: string;
    Candidates: ApiBulkCandidate[];
    TotalPrecincts: number;
    PrecinctsReported: number;
}

interface ApiBulkElection {
    ElectionId: number;
    ElectionName: string;
    ElectionDate: string;
    Races: ApiBulkRace[];
}

export interface CandidateRaceRecord {
    electionId: string;
    electionName: string;
    electionDate: string;
    raceId: string;
    raceName: string;
    candidateName: string;
    party?: string;
    votes: number;
    percentage: number;
    totalVotes: number;
    place: number;          // 1 = most votes in the race
    candidateCount: number; // excluding write-in rows
    won: boolean;
}

const bulkCache = new Map<string, ApiBulkElection | null>();

async function fetchBulkResults(electionId: string): Promise<ApiBulkElection | null> {
    if (bulkCache.has(electionId)) return bulkCache.get(electionId)!;
    try {
        const res = await fetch(`${BASE_PATH}/electionresults/${electionId}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const data: ApiBulkElection = await res.json();
        bulkCache.set(electionId, data);
        return data;
    } catch (e) {
        addLog('error', 'API', `bulk results ${electionId} failed: ${String(e)}`);
        bulkCache.set(electionId, null);
        return null;
    }
}

function isWriteIn(name: string): boolean {
    return name.trim().toLowerCase().startsWith('write-in');
}

/**
 * Searches every election for candidates whose name matches the query.
 * Fetches bulk results lazily (one request per election, cached for the
 * session). `onProgress(done, total)` reports fetch progress.
 */
export async function searchCandidateHistory(
    elections: Election[],
    query: string,
    onProgress?: (done: number, total: number) => void
): Promise<CandidateRaceRecord[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];

    const records: CandidateRaceRecord[] = [];
    let done = 0;

    // Fetch in small batches to stay polite to the county API
    const BATCH = 6;
    for (let i = 0; i < elections.length; i += BATCH) {
        const batch = elections.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(e => fetchBulkResults(e.electionId)));
        results.forEach((bulk, j) => {
            const election = batch[j];
            done++;
            onProgress?.(done, elections.length);
            if (!bulk?.Races) return;
            for (const race of bulk.Races) {
                if (isAdminRace(race.RaceName)) continue;
                const real = race.Candidates.filter(c => !isWriteIn(c.Name));
                const sorted = [...race.Candidates].sort((a, b) => b.Votes - a.Votes);
                const totalVotes = race.Candidates.reduce((s, c) => s + c.Votes, 0);
                for (const c of race.Candidates) {
                    if (!c.Name.toLowerCase().includes(q)) continue;
                    if (isWriteIn(c.Name)) continue;
                    const place = sorted.findIndex(s => s.Name === c.Name) + 1;
                    records.push({
                        electionId: election.electionId,
                        electionName: election.electionName,
                        electionDate: election.electionDate,
                        raceId: race.RaceNumber,
                        raceName: race.RaceName.replace(/\s*-\s*Official Canvass\s*$/i, '').trim(),
                        candidateName: c.Name.trim(),
                        party: c.PartyName?.trim() || undefined,
                        votes: c.Votes,
                        percentage: c.Percentage,
                        totalVotes,
                        place,
                        candidateCount: real.length,
                        won: place === 1,
                    });
                }
            }
        });
    }

    records.sort((a, b) => new Date(b.electionDate).getTime() - new Date(a.electionDate).getTime());
    return records;
}

/** Distinct candidate names in a result set, most races first. */
export function groupByCandidate(records: CandidateRaceRecord[]): { name: string; races: CandidateRaceRecord[] }[] {
    const m = new Map<string, CandidateRaceRecord[]>();
    for (const r of records) {
        const arr = m.get(r.candidateName) ?? [];
        arr.push(r);
        m.set(r.candidateName, arr);
    }
    return [...m.entries()]
        .map(([name, races]) => ({ name, races }))
        .sort((a, b) => b.races.length - a.races.length);
}
