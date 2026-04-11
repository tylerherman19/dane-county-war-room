// API client for Dane County Elections
const BASE_PATH = 'https://api.danecounty.gov/api/v1/elections';
import { addLog } from './debug-log';

// --- Internal Interfaces (Used by App) ---

export interface Election {
    electionId: string;
    electionName: string;
    electionDate: string;
    lastPublished: string;
}

export interface Candidate {
    candidateName: string;
    votes: number;
    percentage: number;
    party?: string;
}

export type RaceType = 'Presidential' | 'Senate' | 'Congress' | 'Assembly' | 'StateSenate' | 'Referendum' | 'Mayor' | 'Governor' | 'Alder' | 'Supervisor' | 'Other';

export interface Race {
    id: string;
    electionId?: string;
    name: string;
    type: RaceType;
    districtId?: string;
    totalPrecincts: number;
    precinctsReporting: number;
    candidates: Candidate[];
    lastUpdated: string;
}

export interface RaceResult {
    id: string;
    raceName: string;
    type?: RaceType;
    candidates: Candidate[];
    totalVotes: number;
    precinctsReporting: number;
    totalPrecincts: number;
}

export interface PrecinctResult {
    precinctName: string;
    wardNumber: string;
    candidateName: string;
    votes: number;
    registeredVoters: number;
    ballotscast: number;
}

export interface LastPublished {
    lastPublished: string;
}

export interface HistoricalTurnout {
    expectedBallots: number;
    outstandingEstimate: number;
    confidence: 'Low' | 'Medium' | 'High';
    percentageReported: number;
}

// --- API Response Interfaces (PascalCase) ---

interface ApiElection {
    ElectionId: number;
    ElectionName: string;
    ElectionDate: string;
    LastPublished: string;
}

interface ApiRace {
    RaceNumber: string;
    RaceName: string;
}

interface ApiCandidate {
    Number: number;
    Name: string;
    Votes: number;
    Percentage: number;
    PartyCode: string;
    PartyName: string;
}

interface ApiRaceResult {
    RaceName: string;
    RaceNumber: string;
    Candidates: ApiCandidate[];
    TotalPrecincts: number;
    PrecinctsReported: number;
}

interface ApiPrecinctVote {
    RaceNumber: string;
    CandidateName: string;
    PrecinctName: string; // e.g. "C Madison Wd 001"
    TotalVotes: number;
    Reported: boolean;
}

interface ApiPrecinctResultResponse {
    ElectionRace: ApiRaceResult;
    PrecinctVotes: ApiPrecinctVote[];
}

// --- Helper Functions ---

/**
 * Detect race type from a race name string.
 */
function detectRaceType(raceName: string): RaceType {
    const name = raceName.toLowerCase();
    if (name.includes('president')) return 'Presidential';
    if (name.includes('u.s. senator') || name.includes('us senator') || name.includes('united states senator')) return 'Senate';
    if (name.includes('state senator') || name.includes('state senate')) return 'StateSenate';
    if (name.includes('senator') || name.includes('senate')) return 'Senate';
    if (name.includes('congress') || name.includes('u.s. representative') || name.includes('representative in congress')) return 'Congress';
    if (name.includes('assembly')) return 'Assembly';
    if (name.includes('referendum') || name.includes('question') || name.includes('advisory')) return 'Referendum';
    if (name.includes('mayor')) return 'Mayor';
    if (name.includes('governor')) return 'Governor';
    if (name.includes('alder')) return 'Alder';
    if (name.includes('supervisor')) return 'Supervisor';
    return 'Other';
}

/**
 * Returns a group key for races that share a jurisdiction + office type,
 * e.g. "Madison Alder" or "Dane County Supervisor".
 * Returns null for standalone races that don't form a multi-district group.
 */
export function getRaceGroupKey(race: Race): string | null {
    const name = race.name;
    const alderMatch = name.match(/^([\w\s]+?)\s+Alder(?:person)?[,\s]/i);
    if (alderMatch) return `${alderMatch[1].trim()} Alder`;
    const supervisorMatch = name.match(/^([\w\s]+?)\s+(?:(?:County\s+)?Board\s+)?Supervisor/i);
    if (supervisorMatch) return `${supervisorMatch[1].trim()} Supervisor`;
    return null;
}

/**
 * Extracts a district number from a race name for sorting within a group.
 * e.g. "Madison Alder District 7" -> 7
 */
export function extractDistrictNumber(raceName: string): number {
    const m = raceName.match(/District\s+(\d+)/i);
    return m ? parseInt(m[1]) : 0;
}

/**
 * Expands ward ranges from API precinct names into individual ward numbers.
 * Examples:
 *   "V DeForest Wds 1-5, 11, 18-19" -> [1, 2, 3, 4, 5, 11, 18, 19]
 *   "C Madison Wd 001" -> [1]
 */
function expandWardRanges(precinctName: string): number[] {
    const wards: number[] = [];

    // Check if this is a grouped ward entry (contains "Wds" plural)
    const wdsMatch = precinctName.match(/Wds\s+([\d\s,\-]+)/i);
    if (wdsMatch) {
        const rangeString = wdsMatch[1].trim();
        // Split by comma to get individual ranges or numbers
        const parts = rangeString.split(',').map(p => p.trim());

        for (const part of parts) {
            // Check if it's a range (e.g., "1-5")
            const rangeMatch = part.match(/^(\d+)-(\d+)$/);
            if (rangeMatch) {
                const start = parseInt(rangeMatch[1]);
                const end = parseInt(rangeMatch[2]);
                for (let i = start; i <= end; i++) {
                    wards.push(i);
                }
            } else {
                // Single ward number
                const num = parseInt(part);
                if (!isNaN(num)) {
                    wards.push(num);
                }
            }
        }
    } else {
        // Single ward entry (e.g., "C Madison Wd 001")
        const singleMatch = precinctName.match(/Wd\s+(\d+)/i);
        if (singleMatch) {
            wards.push(parseInt(singleMatch[1]));
        }
    }

    return wards;
}

// --- Fetch Helper ---

async function fetchAPI<T>(path: string): Promise<T> {
    const url = `${BASE_PATH}${path}`;
    const t0 = Date.now();
    addLog('info', 'API', `→ ${path}`);
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            addLog('error', 'API', `✗ ${path} (${response.status} ${response.statusText})`);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        addLog('success', 'API', `✓ ${path}`, undefined, Date.now() - t0);
        return data;
    } catch (error) {
        addLog('error', 'API', `✗ ${path}: ${String(error)}`);
        throw error;
    }
}

// --- Public API Functions ---

export async function getElections(): Promise<Election[]> {
    const data = await fetchAPI<ApiElection[]>('/list');
    return data
        .map(e => ({
            electionId: e.ElectionId.toString(),
            electionName: e.ElectionName,
            electionDate: e.ElectionDate,
            lastPublished: e.LastPublished,
        }))
        .sort((a, b) => new Date(b.electionDate).getTime() - new Date(a.electionDate).getTime());
}

/**
 * Returns the lastPublished timestamp for a given election.
 * Extracted from the elections list (already cached by SWR via getElections).
 */
export async function getLastPublished(electionId: string): Promise<LastPublished> {
    const elections = await getElections();
    const election = elections.find(e => e.electionId === electionId);
    return {
        lastPublished: election?.lastPublished ?? new Date().toISOString()
    };
}

export async function getRaces(electionId: string): Promise<Race[]> {
    const data = await fetchAPI<ApiRace[]>(`/races/${electionId}`);

    return data.map(r => ({
        id: r.RaceNumber,
        electionId: electionId,
        name: r.RaceName,
        type: detectRaceType(r.RaceName),
        totalPrecincts: 0,
        precinctsReporting: 0,
        candidates: [],
        lastUpdated: new Date().toISOString()
    }));
}

export async function getRaceResults(electionId: string, raceId: string): Promise<RaceResult> {
    const data = await fetchAPI<ApiRaceResult>(`/electionresults/${electionId}/${raceId}`);

    let totalVotes = 0;
    const candidates = data.Candidates.map(c => {
        totalVotes += c.Votes;
        return {
            candidateName: c.Name.trim(),
            votes: c.Votes,
            percentage: c.Percentage,
            party: c.PartyName
        };
    });

    const type = detectRaceType(data.RaceName);
    addLog('info', 'API', `Race type: ${type} for "${data.RaceName}"`);

    return {
        id: data.RaceNumber,
        raceName: data.RaceName.trim(),
        type,
        candidates,
        totalVotes,
        precinctsReporting: data.PrecinctsReported,
        totalPrecincts: data.TotalPrecincts
    };
}

export async function getPrecinctResults(electionId: string, raceId: string): Promise<PrecinctResult[]> {
    const data = await fetchAPI<ApiPrecinctResultResponse>(`/precinctresults/${electionId}/${raceId}`);

    // 1. Calculate totals per precinct first
    const precinctTotals: Record<string, number> = {};
    data.PrecinctVotes.forEach(pv => {
        const pName = pv.PrecinctName;
        if (!precinctTotals[pName]) precinctTotals[pName] = 0;
        precinctTotals[pName] += pv.TotalVotes;
    });

    // 2. Expand grouped wards and map to PrecinctResult
    const results: PrecinctResult[] = [];

    data.PrecinctVotes.forEach(pv => {
        // Get the base precinct name (municipality)
        let precinctName = pv.PrecinctName.split(' Wd')[0].trim();

        // Map API abbreviations to full municipality names
        // "C Madison" -> "City of Madison"
        // "T Albion"  -> "Town of Albion"
        // "V Dane"    -> "Village of Dane"
        precinctName = precinctName
            .replace(/^C[\s.]+/i, 'City of ')
            .replace(/^T[\s.]+/i, 'Town of ')
            .replace(/^V[\s.]+/i, 'Village of ');

        const totalBallots = precinctTotals[pv.PrecinctName] || 0;

        // Expand ward ranges (e.g., "Wds 1-5, 11" -> [1, 2, 3, 4, 5, 11])
        const wards = expandWardRanges(pv.PrecinctName);

        if (wards.length > 0) {
            // BUG FIX: Divide votes evenly across expanded wards to avoid duplication.
            // Grouped precincts report a combined total; we distribute it proportionally.
            const votesPerWard = Math.round(pv.TotalVotes / wards.length);
            const ballotsPerWard = Math.round(totalBallots / wards.length);

            for (const wardNum of wards) {
                results.push({
                    precinctName,
                    wardNumber: wardNum.toString(),
                    candidateName: pv.CandidateName.trim(),
                    votes: votesPerWard,
                    registeredVoters: 0,
                    ballotscast: ballotsPerWard
                });
            }
        } else {
            // Fallback for precincts without ward numbers
            results.push({
                precinctName,
                wardNumber: '0',
                candidateName: pv.CandidateName.trim(),
                votes: pv.TotalVotes,
                registeredVoters: 0,
                ballotscast: totalBallots
            });
        }
    });

    return results;
}

import { getExpectedTurnout } from './historical-data';

export async function getHistoricalTurnout(raceId: string | null, currentTotalVotes: number, raceName?: string): Promise<HistoricalTurnout> {
    const expected = getExpectedTurnout(raceName || 'Default');

    return {
        expectedBallots: Math.max(expected, currentTotalVotes),
        outstandingEstimate: Math.max(0, expected - currentTotalVotes),
        confidence: 'Low',
        percentageReported: Math.min((currentTotalVotes / expected) * 100, 100)
    };
}
