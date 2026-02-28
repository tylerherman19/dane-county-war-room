// Ward Analysis using API data with progressive loading
import { fetchHistoricalData } from './historical-api-data';
import { RaceType } from './api';

export interface WardAnalysis {
    historicalMargin: number;
    historicalVotes: number;
    historicalRaceName: string | null;
    historicalDate: string | null;
}

// Cache for ward analysis data — keyed by the same normalized ward key used in historical-api-data.ts
const analysisCache = new Map<string, WardAnalysis>();
let currentRaceType: RaceType | null = null;
let isLoading = false;

// Normalize ward name to match the key format produced by historical-api-data.ts
function normalizeWardName(municipality: string, wardId: string): string {
    let s = municipality.toLowerCase();
    let type = '';

    if (s.includes('town')) type = 'town';
    else if (s.includes('village')) type = 'village';
    else if (s.includes('city')) type = 'city';

    s = s.replace(/^(city|village|town) of\s+/, '');
    s = s.replace(/\s+(city|village|town)\b/g, '');
    s = s.trim().replace(/\s+/g, '-');

    let key = s;
    if (type) key += `-${type}`;
    if (wardId && wardId !== '0') key += `-${wardId}`;
    return key;
}

/**
 * Start loading historical data in the background for a specific race type.
 * Pre-populates the analysisCache so ward data is ready before the first hover.
 */
export function startLoadingHistoricalData(raceType: RaceType): void {
    if (currentRaceType === raceType && analysisCache.size > 0) {
        return; // Already loaded for this race type
    }

    if (isLoading) {
        return; // Already loading
    }

    isLoading = true;
    currentRaceType = raceType;
    analysisCache.clear();

    console.log(`[Analysis Data] Starting background load for ${raceType}...`);

    fetchHistoricalData()
        .then(allData => {
            const races = allData.get(raceType);

            if (!races || races.length === 0) {
                console.log(`[Analysis Data] No historical data available for ${raceType}`);
                isLoading = false;
                return;
            }

            // Use the most recent race (already sorted desc by date in fetchHistoricalData)
            const mostRecent = races[0];
            console.log(`[Analysis Data] Pre-populating ${mostRecent.wardResults.size} wards from "${mostRecent.raceName}" (${mostRecent.electionDate})`);

            mostRecent.wardResults.forEach((wardResult, wardKey) => {
                analysisCache.set(wardKey, {
                    historicalMargin: wardResult.margin,
                    historicalVotes: wardResult.totalVotes,
                    historicalRaceName: mostRecent.raceName,
                    historicalDate: mostRecent.electionDate,
                });
            });

            console.log(`[Analysis Data] Cache ready: ${analysisCache.size} wards for ${raceType}`);
            isLoading = false;
        })
        .catch(error => {
            isLoading = false;
            console.error('[Analysis Data] Error loading historical data:', error);
        });
}

/**
 * Get ward analysis synchronously from cache.
 * Returns empty data if the cache hasn't been populated yet for this ward.
 */
export function getWardAnalysis(wardId: string, municipality: string): WardAnalysis {
    const wardKey = normalizeWardName(municipality, wardId);

    if (analysisCache.has(wardKey)) {
        return analysisCache.get(wardKey)!;
    }

    return {
        historicalMargin: 0,
        historicalVotes: 0,
        historicalRaceName: null,
        historicalDate: null,
    };
}

/**
 * Clear the cache (useful when switching races)
 */
export function clearAnalysisCache(): void {
    analysisCache.clear();
    currentRaceType = null;
}
