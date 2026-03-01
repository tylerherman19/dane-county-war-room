// Ward Analysis using API data with progressive loading
import { fetchHistoricalData } from './historical-api-data';
import { getElections, getRaces, getPrecinctResults, RaceType } from './api';
import { addLog } from './debug-log';

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
// Pre-computed average historical votes per ward — computed once on load, not per-render.
let cachedAvgVotes: number | null = null;

// Normalize ward name to match the key format produced by historical-api-data.ts
export function normalizeWardName(municipality: string, wardId: string): string {
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
 * Finalize the cache after it has been populated: compute the county-wide average
 * and log a success message.
 */
function finalizeCache(raceName: string, electionDate: string): void {
    let totalVoteSum = 0;
    analysisCache.forEach(a => { totalVoteSum += a.historicalVotes; });
    cachedAvgVotes = analysisCache.size > 0 ? totalVoteSum / analysisCache.size : null;
    addLog('success', 'Analysis', `✓ ${analysisCache.size} wards cached from "${raceName}" (${electionDate?.slice(0, 10)})`);
}

/**
 * Fallback: when the pre-built JSON is empty, fetch a single historical race directly
 * from the live Dane County API. Walks elections newest-first and stops as soon as it
 * finds one race of the requested type — so at most a handful of API calls.
 *
 * Uses getPrecinctResults() which already returns normalized precinctName ("City of Madison")
 * and integer wardNumber ("1"), so normalizeWardName() keys match the GeoJSON.
 */
async function loadFromAPIFallback(raceType: RaceType): Promise<void> {
    addLog('info', 'Analysis', `→ JSON empty — fetching live historical baseline for ${raceType}...`);
    try {
        const elections = await getElections();

        for (const election of elections) {
            const races = await getRaces(election.electionId);
            const match = races.find(r => r.type === raceType);
            if (!match) continue;

            // Found a matching race — fetch ward-level results.
            const precincts = await getPrecinctResults(election.electionId, match.id);

            // Group by ward key. For each ward every candidate row carries the same
            // ballotscast value; take the max to get one value per ward.
            const wardMap = new Map<string, number>();
            for (const p of precincts) {
                if (p.wardNumber === '0') continue;
                const key = normalizeWardName(p.precinctName, p.wardNumber);
                wardMap.set(key, Math.max(wardMap.get(key) ?? 0, p.ballotscast));
            }

            for (const [wardKey, ballotscast] of wardMap) {
                if (ballotscast > 0) {
                    analysisCache.set(wardKey, {
                        historicalMargin: 0,   // margin unknown without candidate grouping
                        historicalVotes: ballotscast,
                        historicalRaceName: match.name,
                        historicalDate: election.electionDate,
                    });
                }
            }

            finalizeCache(match.name, election.electionDate);
            return; // Done — stop searching elections
        }

        addLog('warn', 'Analysis', `No API fallback data found for ${raceType}`);
    } catch (error) {
        addLog('error', 'Analysis', `✗ API fallback failed: ${String(error)}`);
    }
}

/**
 * Start loading historical data in the background for a specific race type.
 * Primary source: pre-built public/historical-ward-data.json.
 * Fallback: live Dane County API (fetches one matching race, newest first).
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
    cachedAvgVotes = null;

    addLog('info', 'Analysis', `→ Loading baseline for ${raceType}...`);

    fetchHistoricalData()
        .then(async allData => {
            const races = allData.get(raceType);

            if (!races || races.length === 0) {
                // Pre-built JSON is empty for this type — try the live API instead.
                await loadFromAPIFallback(raceType);
                isLoading = false;
                return;
            }

            const mostRecent = races[0];
            mostRecent.wardResults.forEach((wardResult, wardKey) => {
                analysisCache.set(wardKey, {
                    historicalMargin: wardResult.margin,
                    historicalVotes: wardResult.totalVotes,
                    historicalRaceName: mostRecent.raceName,
                    historicalDate: mostRecent.electionDate,
                });
            });

            finalizeCache(mostRecent.raceName, mostRecent.electionDate);
            isLoading = false;
        })
        .catch(error => {
            isLoading = false;
            addLog('error', 'Analysis', `✗ ${String(error)}`);
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
    cachedAvgVotes = null;
}

/**
 * Sum of all historical votes across cached wards.
 * Returns real API-derived expected total for the current race type.
 * Returns 0 if cache not yet populated — callers should fall back to static estimate.
 */
export function getExpectedTotalVotes(): number {
    let total = 0;
    analysisCache.forEach(a => { total += a.historicalVotes; });
    return total;
}

/**
 * True once the cache has been populated with real historical ward data.
 */
export function isHistoricalDataLoaded(): boolean {
    return analysisCache.size > 0 && !isLoading;
}

/**
 * Returns the race name and year from the first cached ward entry.
 * Used to display a dynamic label in the map overlay control.
 */
export function getHistoricalRaceInfo(): { name: string; year: string } | null {
    const first = analysisCache.values().next().value as WardAnalysis | undefined;
    if (!first?.historicalRaceName) return null;
    const year = first.historicalDate
        ? new Date(first.historicalDate).getFullYear().toString()
        : '';
    return { name: first.historicalRaceName, year };
}

/**
 * Returns the pre-computed county-wide average historical votes per ward.
 * Computed once when data loads — O(1) for callers, not O(n) per render.
 * Returns null if data has not been loaded yet.
 */
export function getCachedAvgVotes(): number | null {
    return cachedAvgVotes;
}

/**
 * Returns a snapshot copy of the full analysis cache.
 * Used by the projection engine.
 */
export function getAllCachedWards(): Map<string, WardAnalysis> {
    return new Map(analysisCache);
}
