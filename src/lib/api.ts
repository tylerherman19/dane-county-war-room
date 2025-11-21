import {
    mockElections,
    mockLastPublished,
    mockRaces,
    mockRaceResults,
    generateMockPrecinctResults
} from './mock-data';

// API client for Dane County Elections
const BASE_URL = 'https://api.countyofdane.com';
const TEST_MODE = process.env.NEXT_PUBLIC_TEST_MODE === '2024';

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

export type RaceType = 'Presidential' | 'Senate' | 'Congress' | 'Assembly' | 'StateSenate' | 'Referendum' | 'Mayor' | 'Governor';

export interface Race {
    id: string;
    electionId?: string;
    name: string;
    type: RaceType;
    districtId?: string; // e.g., "76" for Assembly 76, "2" for Congress 2
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

async function fetchAPI<T>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

export async function getElections(): Promise<Election[]> {
    if (TEST_MODE) return mockElections;
    return fetchAPI<Election[]>('/api/v1/elections/list');
}

export async function getLastPublished(electionId: string): Promise<LastPublished> {
    if (TEST_MODE) return mockLastPublished;
    return fetchAPI<LastPublished>(`/api/v1/elections/lastpublished/${electionId}`);
}

export async function getRaces(electionId: string): Promise<Race[]> {
    if (TEST_MODE) {
        return mockRaces.filter(r => r.electionId === electionId || !r.electionId);
    }
    return fetchAPI<Race[]>(`/api/v1/elections/races/${electionId}`);
}

export async function getElectionResults(electionId: string): Promise<any> {
    if (TEST_MODE) return mockRaceResults; // Note: This might need adjustment if the real API returns a different shape for full results
    return fetchAPI(`/api/v1/elections/electionresults/${electionId}`);
}

export async function getRaceResults(electionId: string, raceId: string): Promise<RaceResult> {
    if (TEST_MODE) {
        const result = { ...mockRaceResults[raceId] }; // Clone to avoid mutating static data permanently if we don't want to
        if (!result) throw new Error('Race not found in mock data');

        // Calculate totals from precinct results
        const precinctResults = generateMockPrecinctResults(raceId);
        const candidates = result.candidates.map(c => ({ ...c, votes: 0, percentage: 0 }));
        let totalVotes = 0;

        precinctResults.forEach(p => {
            const candidate = candidates.find(c => c.candidateName === p.candidateName);
            if (candidate) {
                candidate.votes += p.votes;
                totalVotes += p.votes;
            }
        });

        // Update percentages
        if (totalVotes > 0) {
            candidates.forEach(c => {
                c.percentage = (c.votes / totalVotes) * 100;
            });
        }

        result.candidates = candidates;
        result.totalVotes = totalVotes;

        return result;
    }
    return fetchAPI<RaceResult>(`/api/v1/elections/electionresults/${electionId}/${raceId}`);
}

export async function getPrecinctResults(electionId: string, raceId: string): Promise<PrecinctResult[]> {
    if (TEST_MODE) return generateMockPrecinctResults(raceId);
    return fetchAPI<PrecinctResult[]>(`/api/v1/elections/precinctresults/${electionId}/${raceId}`);
}

export async function getHistoricalTurnout(raceId: string | null, currentTotalVotes: number): Promise<HistoricalTurnout> {
    // Mock implementation
    // In a real app, this would fetch from an API or use a lookup table

    let expectedBallots = 300000; // Default fallback

    // If we have race results, we can extrapolate
    // Note: In a real app, we'd need to fetch the race result here or pass it in.
    // For this mock, we'll use the mock data directly if available.
    if (TEST_MODE && raceId) {
        const race = mockRaceResults[raceId as keyof typeof mockRaceResults];
        if (race) {
            // If the election is "done" (test mode 2024), expected = actual
            // But to simulate "live", let's pretend we are at 90% reporting if we want?
            // The user wants "math to be correct". In 2024 test mode, the election is over.
            // So expected should equal total votes.
            expectedBallots = race.totalVotes;
        }
    } else {
        // Estimate based on current votes and reporting % (if we had it here)
        // For now, let's just ensure it's never less than current
        expectedBallots = Math.max(expectedBallots, currentTotalVotes);
    }

    // Ensure we don't show negative outstanding
    const outstanding = Math.max(0, expectedBallots - currentTotalVotes);

    return {
        expectedBallots,
        outstandingEstimate: outstanding,
        confidence: 'High',
        percentageReported: (currentTotalVotes / expectedBallots) * 100
    };
}
