// Historical election data fetched from API
// This replaces the hardcoded JSON files

import { getElections, getRaces, getPrecinctResults, RaceType } from './api';

export interface HistoricalRaceData {
    electionId: string;
    electionName: string;
    electionDate: string;
    raceId: string;
    raceName: string;
    raceType: RaceType;
    wardResults: Map<string, WardResult>; // key: normalized ward name
}

export interface WardResult {
    candidates: { name: string; votes: number }[];
    totalVotes: number;
    topCandidate: string;
    margin: number; // (1st - 2nd) / total
}

// Cache for historical data
let historicalDataCache: Map<RaceType, HistoricalRaceData[]> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Normalize ward name to match the format used in the app
 */
function normalizeWardName(precinctName: string, wardNumber: string): string {
    let s = precinctName.toLowerCase();
    let type = '';

    // Detect type
    if (s.includes('town')) type = 'town';
    else if (s.includes('village')) type = 'village';
    else if (s.includes('city')) type = 'city';

    // Remove "of" and type keywords
    s = s.replace(/^(city|village|town) of\s+/, '');
    s = s.replace(/\s+(city|village|town)\b/g, '');
    s = s.trim().replace(/\s+/g, '-');

    // Construct key: name-type-ward
    let key = s;
    if (type) key += `-${type}`;
    if (wardNumber && wardNumber !== '0') key += `-${wardNumber}`;

    return key;
}

/**
 * Fetch all historical data from the API
 */
export async function fetchHistoricalData(): Promise<Map<RaceType, HistoricalRaceData[]>> {
    // Check cache
    if (historicalDataCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        return historicalDataCache;
    }

    console.log('[Historical Data] Fetching from API...');

    const dataByType = new Map<RaceType, HistoricalRaceData[]>();

    try {
        // Get all elections
        const elections = await getElections();

        // Filter to elections we care about (last 10 years)
        const cutoffDate = new Date();
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 10);

        const recentElections = elections.filter(e => {
            const electionDate = new Date(e.electionDate);
            return electionDate >= cutoffDate;
        });

        console.log(`[Historical Data] Found ${recentElections.length} recent elections`);

        // For each election, get races
        for (const election of recentElections) {
            try {
                const races = await getRaces(election.electionId);

                // Filter to race types we care about
                const relevantRaces = races.filter(r =>
                    r.type === 'Presidential' ||
                    r.type === 'Mayor' ||
                    r.type === 'Governor' ||
                    r.type === 'Senate' ||
                    r.type === 'Congress'
                );

                console.log(`[Historical Data] Election ${election.electionName}: Found ${races.length} total races, ${relevantRaces.length} relevant`);
                relevantRaces.forEach(r => console.log(`  - ${r.type}: ${r.name}`));

                for (const race of relevantRaces) {
                    try {
                        // Get precinct results
                        const precinctResults = await getPrecinctResults(election.electionId, race.id);

                        // Group by ward
                        const wardResults = new Map<string, WardResult>();

                        // Group candidates by ward
                        const wardCandidates = new Map<string, { name: string; votes: number }[]>();

                        precinctResults.forEach(pr => {
                            const wardKey = normalizeWardName(pr.precinctName, pr.wardNumber);

                            if (!wardCandidates.has(wardKey)) {
                                wardCandidates.set(wardKey, []);
                            }

                            wardCandidates.get(wardKey)!.push({
                                name: pr.candidateName,
                                votes: pr.votes
                            });
                        });

                        // Calculate margins for each ward
                        wardCandidates.forEach((candidates, wardKey) => {
                            const sorted = candidates.sort((a, b) => b.votes - a.votes);
                            const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);

                            let margin = 0;
                            if (sorted.length >= 2 && totalVotes > 0) {
                                margin = (sorted[0].votes - sorted[1].votes) / totalVotes;
                            } else if (sorted.length === 1 && totalVotes > 0) {
                                margin = 1.0; // Uncontested
                            }

                            wardResults.set(wardKey, {
                                candidates: sorted,
                                totalVotes,
                                topCandidate: sorted[0]?.name || '',
                                margin
                            });
                        });

                        const historicalRace: HistoricalRaceData = {
                            electionId: election.electionId,
                            electionName: election.electionName,
                            electionDate: election.electionDate,
                            raceId: race.id,
                            raceName: race.name,
                            raceType: race.type,
                            wardResults
                        };

                        if (!dataByType.has(race.type)) {
                            dataByType.set(race.type, []);
                        }
                        dataByType.get(race.type)!.push(historicalRace);

                        console.log(`[Historical Data] ✓ Loaded ${race.type}: ${race.name} from ${election.electionName} (${wardResults.size} wards)`);
                    } catch (error) {
                        console.error(`[Historical Data] Error loading race ${race.id}:`, error);
                    }
                }
            } catch (error) {
                console.error(`[Historical Data] Error loading races for election ${election.electionId}:`, error);
            }
        }

        // Sort each race type by date (most recent first)
        dataByType.forEach((races, type) => {
            races.sort((a, b) => new Date(b.electionDate).getTime() - new Date(a.electionDate).getTime());
        });

        // Cache the results
        historicalDataCache = dataByType;
        cacheTimestamp = Date.now();

        console.log('[Historical Data] Fetch complete');
        return dataByType;
    } catch (error) {
        console.error('[Historical Data] Error fetching historical data:', error);
        return new Map();
    }
}

/**
 * Get the most recent historical race of a given type
 */
export async function getMostRecentHistoricalRace(raceType: RaceType): Promise<HistoricalRaceData | null> {
    const data = await fetchHistoricalData();
    const races = data.get(raceType);
    return races && races.length > 0 ? races[0] : null;
}

/**
 * Get historical comparison data for a specific ward
 */
export async function getHistoricalComparison(
    wardKey: string,
    currentRaceType: RaceType
): Promise<{
    historical: WardResult | null;
    historicalRaceName: string | null;
    historicalElectionDate: string | null;
} | null> {
    const mostRecent = await getMostRecentHistoricalRace(currentRaceType);

    if (!mostRecent) {
        return null;
    }

    const wardResult = mostRecent.wardResults.get(wardKey);

    return {
        historical: wardResult || null,
        historicalRaceName: mostRecent.raceName,
        historicalElectionDate: mostRecent.electionDate
    };
}
