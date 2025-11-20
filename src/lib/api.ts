// API client for Dane County Elections
const BASE_URL = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true'
    ? ''
    : 'https://electionresults.countyofdane.com';

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

async function fetchAPI<T>(endpoint: string): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    return response.json();
}

export async function getElections(): Promise<Election[]> {
    return fetchAPI<Election[]>('/api/v1/elections/list');
}

export async function getLastPublished(electionId: string): Promise<LastPublished> {
    return fetchAPI<LastPublished>(`/api/v1/elections/lastpublished/${electionId}`);
}

export async function getRaces(electionId: string): Promise<Race[]> {
    return fetchAPI<Race[]>(`/api/v1/elections/races/${electionId}`);
}

export async function getElectionResults(electionId: string): Promise<any> {
    return fetchAPI(`/api/v1/elections/electionresults/${electionId}`);
}

export async function getRaceResults(electionId: string, raceNumber: number): Promise<RaceResult> {
    return fetchAPI<RaceResult>(`/api/v1/elections/electionresults/${electionId}/${raceNumber}`);
}

export async function getPrecinctResults(electionId: string, raceNumber: number): Promise<PrecinctResult[]> {
    return fetchAPI<PrecinctResult[]>(`/api/v1/elections/precinctresults/${electionId}/${raceNumber}`);
}
