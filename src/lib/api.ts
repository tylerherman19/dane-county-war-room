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

export interface Race {
    raceNumber: number;
    raceName: string;
    raceType: string;
}

export interface Candidate {
    candidateName: string;
    votes: number;
    percentage: number;
    party?: string;
}

export interface RaceResult {
    raceNumber: number;
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
    if (TEST_MODE) return mockRaces;
    return fetchAPI<Race[]>(`/api/v1/elections/races/${electionId}`);
}

export async function getElectionResults(electionId: string): Promise<any> {
    if (TEST_MODE) return mockRaceResults; // Note: This might need adjustment if the real API returns a different shape for full results
    return fetchAPI(`/api/v1/elections/electionresults/${electionId}`);
}

export async function getRaceResults(electionId: string, raceNumber: number): Promise<RaceResult> {
    if (TEST_MODE) {
        const result = mockRaceResults[raceNumber as keyof typeof mockRaceResults];
        if (!result) throw new Error('Race not found in mock data');
        return result;
    }
    return fetchAPI<RaceResult>(`/api/v1/elections/electionresults/${electionId}/${raceNumber}`);
}

export async function getPrecinctResults(electionId: string, raceNumber: number): Promise<PrecinctResult[]> {
    if (TEST_MODE) return generateMockPrecinctResults(raceNumber);
    return fetchAPI<PrecinctResult[]>(`/api/v1/elections/precinctresults/${electionId}/${raceNumber}`);
}

export async function getHistoricalTurnout(raceId: number | null, currentTotalVotes: number): Promise<HistoricalTurnout> {
    // Mock implementation
    // In a real app, this would fetch from an API or use a lookup table

    let expectedBallots = 300000; // Default for top of ticket (President)

    // Adjust based on race ID (mock logic)
    if (raceId === 102) expectedBallots = 290000; // Senate
    if (raceId === 103) expectedBallots = 280000; // Rep
    if (raceId && raceId > 200) expectedBallots = 150000; // Local races

    // Ensure we don't show negative outstanding
    const outstanding = Math.max(0, expectedBallots - currentTotalVotes);

    return {
        expectedBallots,
        outstandingEstimate: outstanding,
        confidence: 'Medium', // Keep existing confidence for now
        percentageReported: (currentTotalVotes / expectedBallots) * 100
    };
}
