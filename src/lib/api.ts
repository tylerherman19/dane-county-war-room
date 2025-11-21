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

// --- Fetch Helper ---

async function fetchAPI<T>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }
        return response.json();
    } catch (error) {
        console.error(`Failed to fetch ${url}:`, error);
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

    // 2. Map to PrecinctResult
    return data.PrecinctVotes.map(pv => {
        let wardNum = "0";
        const match = pv.PrecinctName.match(/Wd\s+(\d+)/);
        if (match) wardNum = parseInt(match[1]).toString();

        let precinctName = pv.PrecinctName.split(' Wd')[0].trim();
        if (precinctName === 'C Madison') precinctName = 'City of Madison';
        if (precinctName === 'C Fitchburg') precinctName = 'City of Fitchburg';
        if (precinctName === 'C Sun Prairie') precinctName = 'City of Sun Prairie';
        if (precinctName === 'C Middleton') precinctName = 'City of Middleton';
        if (precinctName === 'C Verona') precinctName = 'City of Verona';
        if (precinctName === 'V Waunakee') precinctName = 'Village of Waunakee';

        const totalBallots = precinctTotals[pv.PrecinctName] || 0;

        return {
            precinctName: precinctName,
            wardNumber: wardNum,
            candidateName: pv.CandidateName.trim(),
            votes: pv.TotalVotes,
            registeredVoters: 0, // API still doesn't give this, but we can maybe estimate or leave 0
            ballotscast: totalBallots // Now populated correctly
        };
    });
}

export async function getHistoricalTurnout(raceId: string | null, currentTotalVotes: number): Promise<HistoricalTurnout> {
    // Still mock this for now as API doesn't give expected ballots
    return {
        expectedBallots: Math.max(300000, currentTotalVotes),
        outstandingEstimate: 0,
        confidence: 'Low',
        percentageReported: 100
    };
}
