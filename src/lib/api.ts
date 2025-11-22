// API client for Dane County Elections
const BASE_URL = 'https://api.danecounty.gov';

// --- Internal Interfaces (Used by App) ---

export interface Election {
    electionId: string;
    electionName: string;
    electionDate: string;
}

export interface Candidate {
    candidateName: string;
    votes: number;
    percentage: number;
    party?: string;
}

export type RaceType = 'Presidential' | 'Senate' | 'Congress' | 'Assembly' | 'StateSenate' | 'Referendum' | 'Mayor' | 'Governor' | 'Other';

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

async function fetchAPI<T>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`[API] Fetching: ${url}`);
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            console.error(`[API] Error ${response.status} fetching ${url}: ${response.statusText}`);
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`[API] Failed to fetch ${url}:`, error);
        throw error;
    }
}

// --- Public API Functions ---

export async function getElections(): Promise<Election[]> {
    const data = await fetchAPI<ApiElection[]>('/api/v1/elections/list');
    return data.map(e => ({
        electionId: e.ElectionId.toString(),
        electionName: e.ElectionName,
        electionDate: e.ElectionDate
    }));
}

export async function getLastPublished(electionId: string): Promise<LastPublished> {
    // The API doesn't have a dedicated endpoint for this, but the election list has it.
    // Or we can just return current time if not critical.
    // Actually, let's try to find it in the election list.
    const elections = await fetchAPI<ApiElection[]>('/api/v1/elections/list');
    const election = elections.find(e => e.ElectionId.toString() === electionId);
    return {
        lastPublished: election ? election.LastPublished : new Date().toISOString()
    };
}

export async function getRaces(electionId: string): Promise<Race[]> {
    const data = await fetchAPI<ApiRace[]>(`/api/v1/elections/races/${electionId}`);

    // We need to fetch details for each race to get candidates, or just return basic info.
    // The UI expects candidates to be present in the Race object for the sidebar.
    // However, fetching details for ALL races might be slow.
    // Let's see if we can get by with basic info and fetch details on demand.
    // The existing `Race` interface requires candidates.
    // For now, let's return empty candidates list and let the UI fetch results later if needed.
    // OR, we can parallel fetch results for the top few races?
    // Let's stick to basic info mapping for now.

    return data.map(r => {
        let type: RaceType = 'Other';
        const name = r.RaceName.toLowerCase();
        if (name.includes('president')) type = 'Presidential';
        else if (name.includes('senator') || name.includes('senate')) type = 'Senate'; // Broad match
        else if (name.includes('congress') || name.includes('representative')) type = 'Congress';
        else if (name.includes('assembly')) type = 'Assembly';
        else if (name.includes('referendum')) type = 'Referendum';
        else if (name.includes('mayor')) type = 'Mayor';
        else if (name.includes('governor')) type = 'Governor';

        return {
            id: r.RaceNumber,
            electionId: electionId,
            name: r.RaceName,
            type: type,
            totalPrecincts: 0, // Unknown from list
            precinctsReporting: 0, // Unknown from list
            candidates: [], // Populated later via getRaceResults
            lastUpdated: new Date().toISOString()
        };
    });
}

export async function getElectionResults(electionId: string): Promise<any> {
    // This was returning a map of raceId -> RaceResult.
    // We can't easily get ALL results in one go without many requests.
    // Consumers of this function might need to be refactored to fetch per race.
    // But for now, let's throw or return empty to force usage of getRaceResults.
    return {};
}

export async function getRaceResults(electionId: string, raceId: string): Promise<RaceResult> {
    const data = await fetchAPI<ApiRaceResult>(`/api/v1/elections/electionresults/${electionId}/${raceId}`);

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

    return {
        id: data.RaceNumber,
        raceName: data.RaceName.trim(),
        candidates: candidates,
        totalVotes: totalVotes, // Or use calculated sum if API sum is different
        precinctsReporting: data.PrecinctsReported,
        totalPrecincts: data.TotalPrecincts
    };
}

export async function getPrecinctResults(electionId: string, raceId: string): Promise<PrecinctResult[]> {
    const data = await fetchAPI<ApiPrecinctResultResponse>(`/api/v1/elections/precinctresults/${electionId}/${raceId}`);

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
        // Get the base precinct name (without ward info)
        let precinctName = pv.PrecinctName.split(' Wd')[0].trim();

        // Generic mapping for City/Town/Village prefixes
        // "C Madison" -> "City of Madison"
        // "T. Albion" / "T Albion" -> "Town of Albion"
        // "V. Dane" / "V Dane" -> "Village of Dane"
        precinctName = precinctName
            .replace(/^C[\s.]+/i, 'City of ')
            .replace(/^T[\s.]+/i, 'Town of ')
            .replace(/^V[\s.]+/i, 'Village of ');

        const totalBallots = precinctTotals[pv.PrecinctName] || 0;

        // Expand ward ranges (e.g., "Wds 1-5, 11" -> [1, 2, 3, 4, 5, 11])
        const wards = expandWardRanges(pv.PrecinctName);

        // Create a separate entry for each ward
        if (wards.length > 0) {
            for (const wardNum of wards) {
                results.push({
                    precinctName: precinctName,
                    wardNumber: wardNum.toString(),
                    candidateName: pv.CandidateName.trim(),
                    votes: pv.TotalVotes,
                    registeredVoters: 0,
                    ballotscast: totalBallots
                });
            }
        } else {
            // Fallback for precincts without ward numbers
            results.push({
                precinctName: precinctName,
                wardNumber: "0",
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
    // Use the provided race name to determine expected turnout, or fall back to default
    const expected = getExpectedTurnout(raceName || 'Default');

    return {
        expectedBallots: Math.max(expected, currentTotalVotes),
        outstandingEstimate: Math.max(0, expected - currentTotalVotes),
        confidence: 'Low',
        percentageReported: (currentTotalVotes / expected) * 100
    };
}
