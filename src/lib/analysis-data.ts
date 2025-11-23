// Ward Analysis using API data with progressive loading
import { getHistoricalComparison } from './historical-api-data';
import { RaceType } from './api';

export interface WardAnalysis {
    historicalMargin: number;
    historicalVotes: number;
    historicalRaceName: string | null;
    historicalDate: string | null;
}

// Cache for ward analysis data
const analysisCache = new Map<string, WardAnalysis>();
let currentRaceType: RaceType | null = null;
let isLoading = false;

// Normalize ward name to match API format
function normalizeWardName(municipality: string, wardId: string): string {
    let s = municipality.toLowerCase();
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
    if (wardId && wardId !== '0') key += `-${wardId}`;

    return key;
}

/**
 * Start loading historical data in the background for a specific race type
 * This is called when the map component mounts or when the race changes
 */
export function startLoadingHistoricalData(raceType: RaceType): void {
    if (currentRaceType === raceType && analysisCache.size > 0) {
        // Already loaded for this race type
        return;
    }

    if (isLoading) {
        return; // Already loading
    }

    isLoading = true;
    currentRaceType = raceType;
    analysisCache.clear();

    console.log(`[Analysis Data] Starting background load for ${raceType}...`);

    // Load data asynchronously (fire and forget)
    loadHistoricalDataForRaceType(raceType).then(() => {
        isLoading = false;
        console.log(`[Analysis Data] Loaded ${analysisCache.size} wards for ${raceType}`);
    }).catch(error => {
        isLoading = false;
        console.error('[Analysis Data] Error loading historical data:', error);
    });
}

/**
 * Internal function to load all historical data for a race type
 */
async function loadHistoricalDataForRaceType(raceType: RaceType): Promise<void> {
    console.log(`[Analysis Data] Fetching historical data for ${raceType}...`);

    try {
        // Get the most recent historical race of this type
        const comparison = await getHistoricalComparison('test-ward', raceType);

        if (comparison && comparison.historicalRaceName) {
            console.log(`[Analysis Data] Found historical race: ${comparison.historicalRaceName} (${comparison.historicalElectionDate})`);
        } else {
            console.log(`[Analysis Data] No historical data available for ${raceType}`);
        }

        // The actual ward data will be fetched on-demand via getHistoricalComparison
        // when wards are clicked/hovered
    } catch (error) {
        console.error(`[Analysis Data] Error fetching historical data for ${raceType}:`, error);
    }
}

/**
 * Get ward analysis synchronously (returns cached data or empty if not loaded yet)
 * This can be called from synchronous contexts like Leaflet callbacks
 * If data isn't cached, it will be fetched asynchronously in the background
 */
export function getWardAnalysis(
    wardId: string,
    municipality: string
): WardAnalysis {
    const wardKey = normalizeWardName(municipality, wardId);

    // Return cached data if available
    if (analysisCache.has(wardKey)) {
        return analysisCache.get(wardKey)!;
    }

    // If we have a current race type, fetch data in background
    if (currentRaceType) {
        // Fetch asynchronously (fire and forget)
        fetchWardAnalysis(wardId, municipality, currentRaceType).catch(error => {
            console.error(`[Analysis Data] Error fetching ward ${wardKey}:`, error);
        });
    }

    // Return empty data for now (will be populated when fetch completes)
    return {
        historicalMargin: 0,
        historicalVotes: 0,
        historicalRaceName: null,
        historicalDate: null
    };
}

/**
 * Fetch analysis data for a specific ward asynchronously
 * This is called on-demand when a ward is hovered/clicked
 */
export async function fetchWardAnalysis(
    wardId: string,
    municipality: string,
    raceType: RaceType
): Promise<WardAnalysis> {
    const wardKey = normalizeWardName(municipality, wardId);

    console.log(`[Analysis Data] Fetching analysis for ${municipality} Ward ${wardId} (${raceType})...`);

    // Check cache first
    if (analysisCache.has(wardKey) && currentRaceType === raceType) {
        console.log(`[Analysis Data] ✓ Using cached data for ${wardKey}`);
        return analysisCache.get(wardKey)!;
    }

    // Fetch from API
    const comparison = await getHistoricalComparison(wardKey, raceType);

    const analysis: WardAnalysis = comparison && comparison.historical ? {
        historicalMargin: comparison.historical.margin,
        historicalVotes: comparison.historical.totalVotes,
        historicalRaceName: comparison.historicalRaceName,
        historicalDate: comparison.historicalElectionDate
    } : {
        historicalMargin: 0,
        historicalVotes: 0,
        historicalRaceName: null,
        historicalDate: null
    };

    if (analysis.historicalRaceName) {
        console.log(`[Analysis Data] ✓ Fetched historical data for ${wardKey}: ${analysis.historicalRaceName} (${(analysis.historicalMargin * 100).toFixed(1)}%)`);
    } else {
        console.log(`[Analysis Data] ✗ No historical data found for ${wardKey} (${raceType})`);
    }

    // Cache it
    analysisCache.set(wardKey, analysis);

    return analysis;
}

/**
 * Clear the cache (useful when switching races)
 */
export function clearAnalysisCache(): void {
    analysisCache.clear();
    currentRaceType = null;
}
